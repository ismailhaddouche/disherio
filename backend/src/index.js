import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import app from './app.js';
import { COOKIE_NAME } from './middleware/auth.middleware.js';

const PORT = process.env.PORT || 3000;

// Validate essential environment variables
const REQUIRED_ENV = ['JWT_SECRET', 'MONGO_INITDB_ROOT_USERNAME', 'MONGO_INITDB_ROOT_PASSWORD'];
const missingEnv = REQUIRED_ENV.filter(env => !process.env[env]);

if (missingEnv.length > 0) {
    console.error(`[CRITICAL ERROR] Missing required environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
}

// Cryptographic Strength Validation
if (process.env.JWT_SECRET.length < 32) {
    console.error('[CRITICAL ERROR] JWT_SECRET is too weak! It must be at least 32 characters long.');
    console.error('Use "openssl rand -base64 32" to generate a strong secret.');
    process.exit(1);
}

const FORBIDDEN_SECRETS = ['CHANGE_ME_TO_A_STRONG_SECRET_KEY_32_CHARS_MINIMUM', 'dummy-secret-key-for-development-only-12345'];
if (FORBIDDEN_SECRETS.includes(process.env.JWT_SECRET)) {
    console.error('[CRITICAL ERROR] You are using a default/example JWT_SECRET. This is EXTREMELY INSECURE.');
    process.exit(1);
}

// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.io
// Mirror the same CORS origin logic used in app.js for consistency
const SOCKET_CORS_ORIGINS = process.env.NODE_ENV === 'production'
    ? [
        ...(process.env.DOMAIN ? [process.env.DOMAIN] : []),
        /\.disher\.io$/,
        /^https?:\/\/\d+\.\d+\.\d+\.\d+(:\d+)?$/  // IP addresses (LAN / VPS without domain)
      ]
    : true;

const io = new Server(server, {
    cors: {
        origin: SOCKET_CORS_ORIGINS,
        credentials: true
    },
    connectionStateRecovery: {
        // Almacenar eventos por un máximo de 2 minutos
        maxDisconnectionDuration: 2 * 60 * 1000,
        // Habilitar almacenamiento de eventos en memoria
        skipMiddlewares: true
    }
});

// Attach io to app for use in routes
app.set('io', io);

io.use((socket, next) => {
    try {
        const cookiesHeader = socket.request.headers.cookie;
        const cookies = cookiesHeader ? cookie.parse(cookiesHeader) : {};
        const token = cookies[COOKIE_NAME] || socket.handshake.auth?.token;

        if (!token) {
            return next(new Error('UNAUTHORIZED'));
        }

        const payload = jwt.verify(token, process.env.JWT_SECRET);
        socket.data.user = payload;
        return next();
    } catch (error) {
        console.error('[SOCKET] Auth error:', error.message);
        return next(new Error('UNAUTHORIZED'));
    }
});

const ROOM_PERMISSIONS = {
    admin: ['customer', 'kitchen', 'pos', 'waiter', 'config'],
    kitchen: ['kitchen'],
    pos: ['pos', 'orders'],
    waiter: ['waiter', 'orders'],
    customer: ['customer']
};

const canJoinRoom = (room, role) => {
    if (!room || typeof room !== 'string') return false;
    if (room.startsWith('table:')) {
        return ['admin', 'waiter', 'pos'].includes(role);
    }
    const allowed = ROOM_PERMISSIONS[role] || [];
    return allowed.includes(room);
};

io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log(`[SOCKET] User connected: ${socket.id} (${user?.username || 'unknown'})`);

    if (user?.role) {
        socket.join(user.role);
    }

    socket.on('join-room', (room) => {
        if (!user?.role || !canJoinRoom(room, user.role)) {
            console.warn(`[SOCKET] User ${socket.id} (role: ${user?.role}) attempted to join unauthorized room: ${room}`);
            socket.emit('room-access-denied', { room });
            return;
        }
        socket.join(room);
        console.log(`[SOCKET] User ${socket.id} joined room: ${room}`);
    });

    socket.on('disconnect', () => {
        console.log(`[SOCKET] User disconnected: ${socket.id}`);
    });
});

// Database Connection with Retry Logic — server only starts after DB is ready
const connectDB = async () => {
    const mongoUser = encodeURIComponent(process.env.MONGO_INITDB_ROOT_USERNAME);
    const mongoPass = encodeURIComponent(process.env.MONGO_INITDB_ROOT_PASSWORD);
    const mongoHost = process.env.MONGO_HOST || 'database';
    const mongoDB   = process.env.MONGO_DB_NAME || 'disher';
    const MONGO_URI = `mongodb://${mongoUser}:${mongoPass}@${mongoHost}:27017/${mongoDB}?authSource=admin`;

    try {
        await mongoose.connect(MONGO_URI);
        console.log('[DATABASE] Connected to MongoDB');

        // Only start listening AFTER the DB connection is established
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`[SERVER] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
        });
    } catch (err) {
        console.error('[DATABASE ERROR] Connection failed, retrying in 5 seconds...', err.message);
        setTimeout(connectDB, 5000);
    }
};

connectDB();

// --- Global Resilience Listeners ---
process.on('unhandledRejection', function(reason, promise) {
    console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
    // Suggestion: Send alert to monitoring service here
});

process.on('uncaughtException', function(err) {
    console.error('[CRITICAL] Uncaught Exception:', err);
    // Exit gracefully to avoid inconsistent state
    process.exit(1);
});

async function gracefulShutdown(signal) {
    console.log(`[SHUTDOWN] Received ${signal}. Closing HTTP server...`);
    server.close(() => {
        console.log('[SHUTDOWN] HTTP server closed');
    });

    try {
        await io.close();
        console.log('[SHUTDOWN] Socket.io closed');
    } catch (error) {
        console.error('[SHUTDOWN] Socket.io close error:', error.message);
    }

    try {
        await mongoose.connection.close();
        console.log('[SHUTDOWN] MongoDB connection closed');
    } catch (error) {
        console.error('[SHUTDOWN] MongoDB close error:', error.message);
    }

    process.exit(0);
}

['SIGTERM', 'SIGINT'].forEach(signal => {
    process.on(signal, () => gracefulShutdown(signal));
});

export { io };
