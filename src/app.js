const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Routes
// Mount API routes at root to match Tauri calls: /history, /chat, etc.
app.use('/', apiRoutes);
app.use('/auth', authRoutes);

app.get('/status', (req, res) => res.json({ status: "OK", version: "3.0.0 (Tauri)" }));

module.exports = app;
