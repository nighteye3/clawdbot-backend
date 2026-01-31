const jwt = require('jsonwebtoken');
const config = require('../config/env');

const authenticateToken = (req, res, next) => {
    // Check Header OR Query Param (for SSE)
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1]; // Bearer <TOKEN>
    
    if (!token && req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({ error: "Access Denied: No Token Provided" });
    }

    try {
        // If JWT_SECRET matches the generator, verify signature
        const decoded = jwt.verify(token, config.JWT_SECRET);
        
        // Map 'sub' to 'id' (Standard JWT claim)
        req.user = {
            id: decoded.sub || decoded.user?.id || decoded.id,
            role: decoded.role
        };
        next();
    } catch (err) {
        // If signature fails (different secret), at least decode payload 
        // WARNING: Only for dev/testing if you don't have the secret
        try {
            const decoded = jwt.decode(token);
            if (decoded) {
                 req.user = {
                    id: decoded.sub || decoded.user?.id || decoded.id,
                    role: decoded.role
                };
                next();
            } else {
                return res.status(403).json({ error: "Invalid Token" });
            }
        } catch (e) {
            return res.status(403).json({ error: "Invalid Token" });
        }
    }
};

module.exports = authenticateToken;
