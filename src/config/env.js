require('dotenv').config();
const path = require('path');

module.exports = {
    PORT: process.env.PORT || 3000,
    JWT_SECRET: process.env.JWT_SECRET || "default_secret_please_change",
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    MODEL_NAME: "gemini-2.0-flash",
    MEMORY_DIR: path.join(__dirname, '../../memory/users'),
    MEMORY_JSON_DIR: path.join(__dirname, '../../memory/users_json')
};
