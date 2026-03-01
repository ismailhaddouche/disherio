const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'disher_secret_key_2026';

const COOKIE_NAME = 'disher_token';

function verifyToken(req, res, next) {
    const cookieToken = req.cookies && req.cookies[COOKIE_NAME];
    const authHeader = req.headers['authorization'];
    const headerToken = authHeader ? authHeader.replace('Bearer ', '') : null;

    const token = cookieToken || headerToken;

    if (!token) {
        console.log('[AUTH] No token found in cookies or headers');
        return res.status(403).json({ error: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('[AUTH] JWT Verification failed:', err.message);
            return res.status(401).json({ error: 'Failed to authenticate token' });
        }

        console.log('[AUTH] Token verified. Payload:', decoded);
        req.user = decoded;
        next();
    });
}

function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

function getCookieOptions() {
    // Detect if we should use Secure flag (only for HTTPS)
    const isHttps = process.env.DOMAIN && process.env.DOMAIN.startsWith('https');
    
    return {
        httpOnly: true,
        secure: isHttps, // ONLY true if domain is https
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, 
        path: '/'
    };
}

module.exports = {
    verifyToken,
    generateToken,
    getCookieOptions,
    COOKIE_NAME
};
