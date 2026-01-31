const express = require('express');
const router = express.Router();
// const authenticateToken = require('../middleware/auth'); // Disabled for Tauri compatibility
const storage = require('../services/v2/storageService');
const { eventBus, formatSSE } = require('../services/v2/sseService');
const llmService = require('../services/llmService');

const DEFAULT_USER = "default_user"; // Hardcoded user for no-auth mode

// 1. GET /history - Load all chats
router.get('/history', (req, res) => {
    try {
        const userId = DEFAULT_USER;
        const history = storage.getChatIndex(userId);
        res.json(history); 
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. POST /chat - Create new chat
router.post('/chat', (req, res) => {
    try {
        const userId = DEFAULT_USER;
        const { title } = req.body;
        const newChat = storage.createChat(userId, title || 'New Chat');
        res.json(newChat); 
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. POST /chat/ask - Handle User Message (Async LLM)
router.post('/chat/ask', async (req, res) => {
    try {
        const userId = DEFAULT_USER;
        const { chat_id, content } = req.body;

        if (!chat_id || !content) return res.status(400).json({ error: "Missing fields" });

        // A. Save User Message
        const userMsg = storage.appendMessage(userId, chat_id, 'user', content);
        
        // A2. Auto-Update Title (if it's the first actual message)
        const chatMsgs = storage.getChatMessages(userId, chat_id);
        if (chatMsgs.length <= 1) { 
            const newTitle = content.length > 30 ? content.substring(0, 30) + '...' : content;
            storage.updateChatTitle(userId, chat_id, newTitle);
        }
        
        // B. Emit User Message to SSE (so it appears in UI)
        eventBus.emit(`chat:${chat_id}`, userMsg);

        // C. Reply Immediately (202 Accepted)
        res.status(202).send();

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
router.get('/chat/:id', (req, res) => {
    const chatId = req.params.id;
    const userId = DEFAULT_USER;

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

    // Keep-Alive Heartbeat (every 15s)
    const keepAliveInterval = setInterval(() => {
        res.write(': keep-alive\n\n');
    }, 15000);

    // Cleanup on close
    req.on('close', () => {
        clearInterval(keepAliveInterval);
        eventBus.off(`chat:${chatId}`, listener);
        res.end();
    });
});

module.exports = router;
