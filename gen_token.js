const jwt = require('jsonwebtoken');
const secret = 'clawdbot_secret';
const payload = {
  user: {
    username: 'anukul_test',
    id: '12345'
  }
};
const token = jwt.sign(payload, secret);
console.log(token);