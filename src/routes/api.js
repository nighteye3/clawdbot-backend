const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const storage = require('../services/v2/storageService');
const { eventBus, formatSSE } = require('../services/v2/sseService');
const llmService = require('../services/llmService');

// 1. GET /history - Load all chats
router.get('/history', authenticateToken, (req, res) => {
    try {
        const userId = req.user.user.username || req.user.user.id;
        const history = storage.getChatIndex(userId);
        res.json(history); // Tauri expects: Promise<any> (Array)
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. POST /chat - Create new chat
router.post('/chat', authenticateToken, (req, res) => {
    try {
        const userId = req.user.user.username || req.user.user.id;
        const { title } = req.body;
        const newChat = storage.createChat(userId, title || 'New Chat');
        res.json(newChat); // Tauri expects: { id, title, ... }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. POST /chat/ask - Handle User Message (Async LLM)
router.post('/chat/ask', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user.username || req.user.user.id;
        const { chat_id, content } = req.body;

        if (!chat_id || !content) return res.status(400).json({ error: "Missing fields" });

        // A. Save User Message
        const userMsg = storage.appendMessage(userId, chat_id, 'user', content);
        
        // B. Emit User Message to SSE (so it appears in UI)
        eventBus.emit(`chat:${chat_id}`, userMsg);

        // C. Reply Immediately (Tauri expects Promise<void>)
        res.status(200).send();

        // D. Background: Generate LLM Response
        (async () => {
            try {
                const context = storage.getFullContext(userId, chat_id);
                const aiResponseText = await llmService.generateResponse(context, content);
                
                // Save Assistant Message
                const aiMsg = storage.appendMessage(userId, chat_id, 'model', aiResponseText);
                
                // Emit Assistant Message to SSE
                eventBus.emit(`chat:${chat_id}`, aiMsg);
                
            } catch (err) {
                console.error("Background LLM Error:", err);
                const errorMsg = storage.appendMessage(userId, chat_id, 'model', "Error: Failed to generate response.");
                eventBus.emit(`chat:${chat_id}`, errorMsg);
            }
        })();

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. GET /chat/:id - SSE Stream
router.get('/chat/:id', authenticateToken, (req, res) => {
    const chatId = req.params.id;
    const userId = req.user.user.username || req.user.user.id;

    // Headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send existing history immediately
    const previousMessages = storage.getChatMessages(userId, chatId);
    previousMessages.forEach(msg => {
        res.write(formatSSE(msg));
    });

    // Listen for new messages
    const listener = (msg) => {
        res.write(formatSSE(msg));
    };

    eventBus.on(`chat:${chatId}`, listener);

    // Cleanup on close
    req.on('close', () => {
        eventBus.off(`chat:${chatId}`, listener);
        res.end();
    });
});

module.exports = router;
