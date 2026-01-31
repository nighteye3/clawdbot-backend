const fs = require('fs');
const path = require('path');
const config = require('../../config/env');
const { v4: uuidv4 } = require('uuid');
const { syncToRemote } = require('../syncService');

// Ensure base dir exists
if (!fs.existsSync(config.MEMORY_DIR)) {
    fs.mkdirSync(config.MEMORY_DIR, { recursive: true });
}

// Helper to get user dir
const getUserDir = (userId) => {
    const dir = path.join(config.MEMORY_DIR, userId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    // JSON Chats Directory
    const chatsDir = path.join(dir, 'chats');
    if (!fs.existsSync(chatsDir)) fs.mkdirSync(chatsDir, { recursive: true });

    // MD Chats Directory
    const logsDir = path.join(dir, 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    
    return { base: dir, chats: chatsDir, logs: logsDir };
};

// 1. Load Chat History (List of all chats)
const getChatIndex = (userId) => {
    const { base } = getUserDir(userId);
    const indexPath = path.join(base, 'index.json');
    if (!fs.existsSync(indexPath)) return [];
    return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
};

// 2. Create New Chat
const createChat = (userId, title = "New Chat") => {
    const { base, chats, logs } = getUserDir(userId);
    const chatId = uuidv4();
    const timestamp = new Date().toISOString();

    // Update Index
    const index = getChatIndex(userId);
    const newChatSummary = { 
        id: chatId, 
        user_id: userId, // Added to match Rust ChatResponse
        title, 
        created_at: timestamp 
    };
    index.push(newChatSummary);
    fs.writeFileSync(path.join(base, 'index.json'), JSON.stringify(index, null, 2));

    // Create Chat File (JSON)
    const chatData = {
        id: chatId,
        user_id: userId,
        title,
        created_at: timestamp,
        messages: []
    };
    fs.writeFileSync(path.join(chats, `${chatId}.json`), JSON.stringify(chatData, null, 2));
    
    // Create Markdown Log (MD)
    fs.writeFileSync(path.join(logs, `${chatId}.md`), `# Chat: ${title}\nID: ${chatId}\nDate: ${timestamp}\n\n`);

    // Sync to GitHub
    syncToRemote();

    return newChatSummary;
};

// 3. Get Specific Chat Messages
const getChatMessages = (userId, chatId) => {
    const { chats } = getUserDir(userId);
    const chatPath = path.join(chats, `${chatId}.json`);
    if (!fs.existsSync(chatPath)) return [];
    const data = JSON.parse(fs.readFileSync(chatPath, 'utf8'));
    return data.messages;
};

// 4. Append Message
const appendMessage = (userId, chatId, role, content) => {
    const { chats, logs } = getUserDir(userId);
    const chatPath = path.join(chats, `${chatId}.json`);
    const mdPath = path.join(logs, `${chatId}.md`);
    
    if (!fs.existsSync(chatPath)) return null;

    const data = JSON.parse(fs.readFileSync(chatPath, 'utf8'));
    const msgId = uuidv4();
    const timestamp = new Date().toISOString();

    const newMessage = {
        id: msgId,
        chat_id: chatId, // Added to match Rust MessageResponse
        content,
        role: role, 
        created_at: timestamp,
        is_assistant: role === 'model'
    };

    data.messages.push(newMessage);
    fs.writeFileSync(chatPath, JSON.stringify(data, null, 2));

    // Append to Markdown
    const mdEntry = `\n[${timestamp}] **${role.toUpperCase()}**: ${content}\n`;
    fs.appendFileSync(mdPath, mdEntry);

    // Sync to GitHub
    syncToRemote();

    return newMessage;
};

// 5. Get Context (Profile + Current Chat + Global Recall)
const getFullContext = (userId, chatId) => {
    const { base, chats } = getUserDir(userId);
    
    // A. Load Profile Context (Manual or extracted facts)
    let profileContext = "";
    const profilePath = path.join(base, 'profile.md');
    if (fs.existsSync(profilePath)) {
        profileContext = fs.readFileSync(profilePath, 'utf8');
    }

    // B. Load Current Chat History
    const currentMessages = getChatMessages(userId, chatId);
    const currentHistory = currentMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

    // C. Load Global Recall (Last 3 messages from ALL other chats)
    // This solves "What is my name" from previous chats
    const chatIndex = getChatIndex(userId);
    let globalRecall = "";
    
    chatIndex.forEach(chatSummary => {
        if (chatSummary.id === chatId) return; // Skip current chat

        const otherChatMsgs = getChatMessages(userId, chatSummary.id);
        if (otherChatMsgs.length > 0) {
            // Full Compilation Mode: Read ALL messages from other chats
            const conversation = otherChatMsgs.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join("\n");
            globalRecall += `\n\n--- Start of Chat "${chatSummary.title}" ---\n${conversation}\n--- End of Chat ---`;
        }
    });

    return `
=== SYSTEM / PROFILE (HIGHEST PRIORITY) ===
${profileContext}

=== FULL MEMORY FROM ALL OTHER CONVERSATIONS ===
(Use this information to answer questions about past user details, preferences, or events)
${globalRecall ? globalRecall : "No other conversations found."}

=== CURRENT CHAT HISTORY (FOCUS HERE) ===
${currentHistory}
`;
};

// 6. Update Chat Title
const updateChatTitle = (userId, chatId, newTitle) => {
    const { base, chats } = getUserDir(userId);
    
    // 1. Update Index
    const index = getChatIndex(userId);
    const chatEntry = index.find(c => c.id === chatId);
    if (chatEntry) {
        chatEntry.title = newTitle;
        fs.writeFileSync(path.join(base, 'index.json'), JSON.stringify(index, null, 2));
    }

    // 2. Update Chat File
    const chatPath = path.join(chats, `${chatId}.json`);
    if (fs.existsSync(chatPath)) {
        const data = JSON.parse(fs.readFileSync(chatPath, 'utf8'));
        data.title = newTitle;
        fs.writeFileSync(chatPath, JSON.stringify(data, null, 2));
    }
    
    // Sync to GitHub
    syncToRemote();
};

// 7. Save User Profile & Preferences
const saveUserProfile = (userId, name, preferences) => {
    const { base } = getUserDir(userId);
    const profilePath = path.join(base, 'profile.md');

    // Format preferences as Strict System Instructions
    const prefText = Object.entries(preferences)
        .map(([key, val]) => `- **${key.replace(/_/g, ' ').toUpperCase()}**: ${Array.isArray(val) ? val.join(', ') : val}`)
        .join('\n');

    const content = `
# USER PROFILE: ${name}

## 🚨 CRITICAL PREFERENCES & CONSTRAINTS 🚨
(You MUST prioritize these settings above all else in your recommendations)

${prefText}

## UPDATE TIMESTAMP
${new Date().toISOString()}
`;

    fs.writeFileSync(profilePath, content);
    syncToRemote();
};

module.exports = {
    getChatIndex,
    createChat,
    getChatMessages,
    appendMessage,
    getFullContext,
    updateChatTitle,
    saveUserProfile
};
