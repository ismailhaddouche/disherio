import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';
import { i18nMiddleware } from './services/i18n.service.js';
import { responseHandler } from './middleware/response.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ── Security ─────────────────────────────────────────────────────────────────
app.set('trust proxy', 1);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ['\'self\''],
            styleSrc: ['\'self\'', '\'unsafe-inline\''],
            scriptSrc: ['\'self\''],
            imgSrc: ['\'self\'', 'data:', 'https:'],
        }
    },
    hsts: { maxAge: 31536000, includeSubDomains: true }
}));

// ── Performance ──────────────────────────────────────────────────────────────
app.use(compression());

// ── CORS ─────────────────────────────────────────────────────────────────────
const CORS_ORIGINS = process.env.NODE_ENV === 'production'
    ? [
        ...(process.env.DOMAIN ? [process.env.DOMAIN] : []),
        /\.disher\.io$/,
        /^https?:\/\/\d+\.\d+\.\d+\.\d+(:\d+)?$/  // IP addresses (dev/internal)
      ]
    : true;

app.use(cors({
    origin: CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language']
}));

// ── Body Parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));        // images go through multer, not JSON
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
// Custom NoSQL Sanitization (strips $-prefixed keys and keys with dots to prevent injection)
app.use((req, res, next) => {
    const sanitize = (value) => {
        if (Array.isArray(value)) {
            value.forEach((item, i) => { value[i] = sanitize(item); });
        } else if (value && typeof value === 'object') {
            Object.keys(value).forEach(key => {
                if (key.startsWith('$') || key.includes('.')) {
                    delete value[key];
                } else {
                    value[key] = sanitize(value[key]);
                }
            });
        }
        return value;
    };
    if (req.body) sanitize(req.body);
    if (req.params) sanitize(req.params);
    if (req.query) sanitize(req.query);
    next();
});

// ── I18n ─────────────────────────────────────────────────────────────────────
app.use(i18nMiddleware);

// ── Standardized Response Helpers ────────────────────────────────────────────
app.use(responseHandler);

// ── Rate Limiting ────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 2000 : 10000,
    standardHeaders: true,
    legacyHeaders: false,
    handler: function(req, res) {
        res.error(req.t?.('errors.too_many_requests') || 'Too many requests', 429);
    }
});
app.use('/api/', apiLimiter);

// ── Static Files ─────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', routes);

// ── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.error(req.t?.('ERRORS.ROUTE_NOT_FOUND', { route: req.originalUrl }) || 'Route not found', 404);
});

// ── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
    console.error(`[SERVER ERROR] ${new Date().toISOString()}:`, err);

    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(val => val.message);
        return res.error(messages[0], 400, err);
    }

    if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
        return res.error(req.t?.('ERRORS.UNAUTHORIZED') || 'Unauthorized', 401);
    }

    if (err.name === 'MulterError' || err.message?.startsWith('ERRORS.')) {
        const key = err.name === 'MulterError' ? 'ERRORS.IMAGE_PROCESS_ERROR' : err.message;
        return res.error(req.t?.(key) || key, 400);
    }

    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
        ? (req.t?.('ERRORS.INTERNAL_SERVER_ERROR') || 'Internal server error')
        : err.message;

    if (typeof res.error === 'function') {
        res.error(message, statusCode, err);
    } else {
        res.status(statusCode).json({ success: false, message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });
    }
});

export default app;
