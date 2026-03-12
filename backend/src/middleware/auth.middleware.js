import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be defined in environment variables');
}

export const COOKIE_NAME = 'disher_token';

export function verifyToken(req, res, next) {
    const cookieToken = req.cookies && req.cookies[COOKIE_NAME];
    const authHeader = req.headers['authorization'];
    const headerToken = authHeader ? authHeader.replace('Bearer ', '') : null;

    const token = cookieToken || headerToken;

    if (!token) {
        console.log('[AUTH] No token found in cookies or headers');
        return res.status(403).json({ error: req.t('ERRORS.NO_TOKEN_PROVIDED') });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('[AUTH] JWT Verification failed:', err.message);
            return res.status(401).json({ error: req.t('ERRORS.FAILED_AUTH_TOKEN') });
        }

        console.log('[AUTH] Token verified. Payload:', decoded);
        req.user = decoded;
        next();
    });
}

export function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function getCookieOptions() {
    // Detect if we should use Secure flag (only for HTTPS)
    const protocol = process.env.PROTOCOL || '';
    const isHttps = protocol === 'https' || (process.env.DOMAIN && process.env.DOMAIN.startsWith('https'));

    return {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'none' : 'lax', // Use 'none' for cross-site if https, beneficial for some proxy setups
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
    };
}
