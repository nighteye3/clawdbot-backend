require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3000;
const MEMORY_DIR = path.join(__dirname, 'memory', 'users');

// Ensure memory directory exists
if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

app.use(cors());
app.use(bodyParser.json());

// Helper: Read user memory
const getMemory = (userId) => {
    const filePath = path.join(MEMORY_DIR, `${userId}.md`);
    if (!fs.existsSync(filePath)) return "";
    return fs.readFileSync(filePath, 'utf8');
};

// Helper: Append to memory
const appendMemory = (userId, role, text) => {
    const filePath = path.join(MEMORY_DIR, `${userId}.md`);
    const timestamp = new Date().toISOString();
    const entry = `\n[${timestamp}] ${role}: ${text}\n`;
    fs.appendFileSync(filePath, entry);
};

app.post('/chat', async (req, res) => {
    try {
        const { userId, message } = req.body;

        if (!userId || !message) {
            return res.status(400).json({ error: "Missing userId or message" });
        }

        console.log(`[${userId}] User: ${message}`);

        // 1. Load Context
        const history = getMemory(userId);
        
        // 2. Construct Prompt (Simple approach: append history)
        // Note: For very long history, you might need a summarization strategy.
        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: "You are a helpful AI assistant. Below is our conversation history so far. Context:\n" + history }],
                },
                {
                    role: "model",
                    parts: [{ text: "Understood. I will maintain the context of our conversation." }],
                }
            ],
        });

        // 3. Update Memory with new user message
        appendMemory(userId, "User", message);

        // 4. Generate Response
        const result = await chat.sendMessage(message);
        const response = result.response;
        const text = response.text();

        console.log(`[${userId}] Bot: ${text}`);

        // 5. Update Memory with bot response
        appendMemory(userId, "Bot", text);

        res.json({ reply: text });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});

app.get('/status', (req, res) => {
    res.json({ status: "ok", active_users: fs.readdirSync(MEMORY_DIR).length });
});

app.listen(PORT, () => {
    console.log(`Proxy Server running on port ${PORT}`);
});
