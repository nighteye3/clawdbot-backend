const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const memoryService = require('../services/memoryService');
const llmService = require('../services/llmService');

router.post('/', authenticateToken, async (req, res) => {
    try {
        const userPayload = req.user.user || req.user;
        const userId = req.body.userId || userPayload.id || userPayload.username || 'unknown_user';
        const message = req.body.message;

        if (!message) return res.status(400).json({ error: "Message required" });

        // 1. Get Context
        const context = memoryService.getContext(userId);

        // 2. Generate Reply
        const reply = await llmService.generateResponse(context, message);

        // 3. Save & Sync
        memoryService.appendInteraction(userId, message, reply);

        res.json({ reply, userId });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
