import jwt from 'jsonwebtoken';
import { ROLES } from '../constants.js';

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
        if (process.env.NODE_ENV !== 'production') {
            console.log('[AUTH] No token found in cookies or headers');
        }
        return res.error(req.t('ERRORS.NO_TOKEN_PROVIDED'), 401);
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('[AUTH] JWT Verification failed:', err.message);
            return res.status(401).json({ error: req.t('ERRORS.FAILED_AUTH_TOKEN') });
        }

        if (process.env.NODE_ENV !== 'production') {
            console.log('[AUTH] Token verified for user:', decoded?.username);
        }
        req.user = decoded;
        next();
    });
}

export function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function getCookieOptions() {
    // PROTOCOL takes precedence; fall back to INSTALL_MODE (local = HTTP, anything else = HTTPS)
    const protocol = process.env.PROTOCOL || '';
    const isHttps = protocol === 'https' ||
        (process.env.INSTALL_MODE !== undefined && process.env.INSTALL_MODE !== 'local');

    return {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
    };
}

export function requireRole(...allowedRoles) {
    return function(req, res, next) {
        if (!req.user || !req.user.role) {
            return res.error(req.t?.('ERRORS.UNAUTHORIZED') || 'Unauthorized', 401);
        }

        if (req.user.role === ROLES.ADMIN || allowedRoles.includes(req.user.role)) {
            return next();
        }

        return res.error(req.t?.('ERRORS.ACCESS_DENIED_ROLE') || 'Access denied for this role', 403);
    };
}
