import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import app from './app.js';

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
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? [process.env.DOMAIN, /\.disher\.io$/]
            : true,
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

io.on('connection', (socket) => {
    console.log(`[SOCKET] User connected: ${socket.id}`);

    socket.on('join-room', (room) => {
        socket.join(room);
        console.log(`[SOCKET] User ${socket.id} joined room: ${room}`);
    });

    socket.on('disconnect', () => {
        console.log(`[SOCKET] User disconnected: ${socket.id}`);
    });
});

// Database Connection with Retry Logic
const connectDB = async () => {
    const mongoUser = encodeURIComponent(process.env.MONGO_INITDB_ROOT_USERNAME);
    const mongoPass = encodeURIComponent(process.env.MONGO_INITDB_ROOT_PASSWORD);
    const mongoHost = process.env.MONGO_HOST || 'database';
    const MONGO_URI = `mongodb://${mongoUser}:${mongoPass}@${mongoHost}:27017/disher?authSource=admin`;

    try {
        await mongoose.connect(MONGO_URI);
        console.log('[DATABASE] Connected to MongoDB');
    } catch (err) {
        console.error('[DATABASE ERROR] Connection failed, retrying in 5 seconds...', err.message);
        setTimeout(connectDB, 5000);
    }
};

connectDB();

server.listen(PORT, '0.0.0.0', async function() {
    console.log(`[SERVER] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

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

export { io };
