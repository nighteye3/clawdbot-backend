const EventEmitter = require('events');
const eventBus = new EventEmitter();

// Helper to construct SSE format
const formatSSE = (data) => {
    return `event: ai_chat_message\ndata: ${JSON.stringify(data)}\n\n`;
};

module.exports = { eventBus, formatSSE };
