const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'disher_secret_key_2026';

const COOKIE_NAME = 'disher_token';

// Middleware for token verification
// Reads from httpOnly cookie first, falls back to Authorization header for API clients
function verifyToken(req, res, next) {
    const cookieToken = req.cookies && req.cookies[COOKIE_NAME];
    const authHeader = req.headers['authorization'];
    const headerToken = authHeader ? authHeader.replace('Bearer ', '') : null;

    const token = cookieToken || headerToken;

    if (!token) {
        return res.status(403).json({ error: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Failed to authenticate token' });
        }

        req.user = decoded;
        next();
    });
}

// Helper to generate tokens
function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

// Cookie options for httpOnly JWT
function getCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours in ms
        path: '/'
    };
}

module.exports = {
    verifyToken,
    generateToken,
    getCookieOptions,
    COOKIE_NAME
};
