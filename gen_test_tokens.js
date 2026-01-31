const jwt = require('jsonwebtoken');
const secret = 'clawdbot_secret';

const users = ['ctx_tester', 'json_tester'];
users.forEach(u => {
    const token = jwt.sign({ user: { username: u, id: Date.now().toString() } }, secret);
    console.log(`User: ${u}\nToken: ${token}\n`);
});