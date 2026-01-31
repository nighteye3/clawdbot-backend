const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const { syncToRemote } = require('./syncService');

// Ensure directory exists
if (!fs.existsSync(config.MEMORY_DIR)) {
    fs.mkdirSync(config.MEMORY_DIR, { recursive: true });
}
if (!fs.existsSync(config.MEMORY_JSON_DIR)) {
    fs.mkdirSync(config.MEMORY_JSON_DIR, { recursive: true });
}

const getContext = (userId) => {
    // 1. Read Chat History (MD)
    const chatPath = path.join(config.MEMORY_DIR, `${userId}.md`);
    let chatHistory = "";
    
    if (!fs.existsSync(chatPath)) {
        const initContent = `# Memory for User: ${userId}\nCreated: ${new Date().toISOString()}\n\n---\n`;
        fs.writeFileSync(chatPath, initContent);
        chatHistory = initContent;
    } else {
        chatHistory = fs.readFileSync(chatPath, 'utf8');
    }

    // 2. Read User Context/Profile (MD) - Optional manual context file
    const contextPath = path.join(config.MEMORY_DIR, `${userId}_context.md`);
    let userContext = "";
    if (fs.existsSync(contextPath)) {
        userContext = fs.readFileSync(contextPath, 'utf8');
    }

    // Combine for LLM
    // If context exists, prioritize it at the top
    if (userContext.trim()) {
        return `IMPORTANT USER CONTEXT:\n${userContext}\n\n================\nCHAT HISTORY:\n${chatHistory}`;
    }
    
    return chatHistory;
};

const appendInteraction = (userId, userMsg, assistantMsg) => {
    const timestamp = new Date().toISOString();
    
    // 1. Append to Markdown (Standard Log)
    const mdPath = path.join(config.MEMORY_DIR, `${userId}.md`);
    const mdEntry = `\n[${timestamp}] **User**: ${userMsg}\n[${timestamp}] **Assistant**: ${assistantMsg}\n`;
    fs.appendFileSync(mdPath, mdEntry);
    
    // 2. Append to JSON (Structured Data)
    const jsonPath = path.join(config.MEMORY_JSON_DIR, `${userId}.json`);
    let history = [];
    
    try {
        if (fs.existsSync(jsonPath)) {
            const fileContent = fs.readFileSync(jsonPath, 'utf8');
            history = JSON.parse(fileContent);
        }
    } catch (e) {
        console.error("Error reading JSON memory:", e);
        history = [];
    }

    history.push({ role: 'user', content: userMsg, timestamp });
    history.push({ role: 'assistant', content: assistantMsg, timestamp });

    fs.writeFileSync(jsonPath, JSON.stringify(history, null, 2));

    // Trigger Auto-Sync
    syncToRemote();
};

module.exports = { getContext, appendInteraction };
