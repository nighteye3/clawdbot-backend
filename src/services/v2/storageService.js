const fs = require('fs');
const path = require('path');
const config = require('../../config/env');
const { v4: uuidv4 } = require('uuid');

// Ensure base dir exists
if (!fs.existsSync(config.MEMORY_DIR)) {
    fs.mkdirSync(config.MEMORY_DIR, { recursive: true });
}

// Helper to get user dir
const getUserDir = (userId) => {
    const dir = path.join(config.MEMORY_DIR, userId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const chatsDir = path.join(dir, 'chats');
    if (!fs.existsSync(chatsDir)) fs.mkdirSync(chatsDir, { recursive: true });
    
    return { base: dir, chats: chatsDir };
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
    const { base, chats } = getUserDir(userId);
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

    // Create Chat File
    const chatData = {
        id: chatId,
        user_id: userId,
        title,
        created_at: timestamp,
        messages: []
    };
    fs.writeFileSync(path.join(chats, `${chatId}.json`), JSON.stringify(chatData, null, 2));
    
    // Create Markdown Log
    fs.writeFileSync(path.join(chats, `${chatId}.md`), `# Chat: ${title}\nID: ${chatId}\nDate: ${timestamp}\n\n`);

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
    const { chats } = getUserDir(userId);
    const chatPath = path.join(chats, `${chatId}.json`);
    const mdPath = path.join(chats, `${chatId}.md`);
    
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

    return newMessage;
};

// 5. Get Context (Profile + Current Chat)
const getFullContext = (userId, chatId) => {
    const { base } = getUserDir(userId);
    
    // Load Profile Context
    let profileContext = "";
    const profilePath = path.join(base, 'profile.md');
    if (fs.existsSync(profilePath)) {
        profileContext = fs.readFileSync(profilePath, 'utf8');
    }

    // Load Chat History
    const messages = getChatMessages(userId, chatId);
    const history = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

    return `SYSTEM CONTEXT:\n${profileContext}\n\nCHAT HISTORY:\n${history}`;
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
};

module.exports = {
    getChatIndex,
    createChat,
    getChatMessages,
    appendMessage,
    getFullContext,
    updateChatTitle
};
