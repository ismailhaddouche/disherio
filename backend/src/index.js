require('dotenv').config();
const http = require('http');
const app = require('./app');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

// ============================================================================
// CONFIGURATION VALIDATION
// ============================================================================

const requiredEnvVars = ['JWT_SECRET', 'MONGODB_URI'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
    console.error(`❌ FATAL: Missing required environment variables: ${missingVars.join(', ')}`);
    console.error('   Copy .env.example to .env and configure the required values');
    process.exit(1);
}

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const MONGODB_POOL_SIZE = parseInt(process.env.MONGODB_POOL_SIZE || '10', 10);

// ============================================================================
// LOGGER UTILITY
// ============================================================================

const levels = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = levels[LOG_LEVEL] || levels.info;

// Structured JSON logger for production, human-readable for development
const formatLog = (level, msg, data) => {
    if (NODE_ENV === 'production') {
        return JSON.stringify({
            ts: new Date().toISOString(),
            level,
            msg,
            ...(data && typeof data === 'object' ? data : data ? { detail: data } : {})
        });
    }
    return `[${level.toUpperCase()}] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`;
};

const logger = {
    debug: (msg, data) => currentLevel <= levels.debug ? console.log(formatLog('debug', msg, data)) : null,
    info: (msg, data) => currentLevel <= levels.info ? console.log(formatLog('info', msg, data)) : null,
    warn: (msg, data) => currentLevel <= levels.warn ? console.warn(formatLog('warn', msg, data)) : null,
    error: (msg, data) => currentLevel <= levels.error ? console.error(formatLog('error', msg, data)) : null
};

const server = http.createServer(app);

// Socket.io with CORS and connection limits
const io = new Server(server, {
    cors: {
        origin: process.env.DOMAIN || 'http://localhost',
        credentials: true,
        methods: ['GET', 'POST']
    },
    maxHttpBufferSize: 1e6, // 1MB max message size
    pingInterval: 30000,
    pingTimeout: 60000,
    transports: ['websocket', 'polling']
});

// Store io instance for use in routes
app.set('io', io);

// Database Connection
const startDB = async () => {
    let uri = process.env.MONGODB_URI;

    if (NODE_ENV !== 'production' && !uri.includes('database')) {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create();
        uri = mongod.getUri();
        logger.info('Using in-memory MongoDB:', uri);

        // Auto-Seed for testing (after connection)
        mongoose.connection.once('open', async () => {
            try {
                const Restaurant = require('./models/Restaurant');
                const MenuItem = require('./models/MenuItem');

                const count = await Restaurant.countDocuments();
                if (count === 0) {
                    const restaurant = new Restaurant({
                        name: 'Casa Pepe',
                        slug: 'casa-pepe',
                        totems: [
                            { id: 1, name: 'Mesa Principal' },
                            { id: 2, name: 'Terraza Sol' },
                            { id: 3, name: 'Barra Centro' }
                        ],
                        nextTotemId: 4
                    });
                    await restaurant.save();

                    await MenuItem.insertMany([
                        {
                            name: 'Menú del Día',
                            description: 'Primero, Segundo, Postre y Bebida.',
                            basePrice: 13.5,
                            category: 'Principales',
                            available: true,
                            isMenu: true,
                            menuSections: [
                                { name: 'Primer Plato', options: ['Arroz a la cubana', 'Lentejas caseras'] },
                                { name: 'Segundo Plato', options: ['Pollo al Horno', 'Merluza a la Romana'] }
                            ]
                        },
                        {
                            name: 'Pizza Margarita',
                            basePrice: 10.0,
                            category: 'Principales',
                            available: true,
                            variants: [
                                { name: 'Individual', price: 10.0 },
                                { name: 'Familiar', price: 16.5 }
                            ],
                            addons: [
                                { name: 'Extra Queso', price: 1.5 }
                            ]
                        },
                        { name: 'Tortilla de Patatas', basePrice: 12.5, category: 'Entrantes', available: true },
                        { name: 'Caña de Cerveza', basePrice: 2.5, category: 'Bebidas', available: true }
                    ]);

                    const User = require('./models/User');
                    await User.deleteMany({});
                    // Use save() individually so pre-save bcrypt hook runs
                    for (const u of [
                        { username: 'admin', password: 'password', role: 'admin' },
                        { username: 'chef', password: 'password', role: 'kitchen' },
                        { username: 'caja', password: 'password', role: 'pos' }
                    ]) {
                        await new User(u).save();
                    }
                    logger.info('✅ In-memory Database seeded with Menus, Totems and Users (password: password)!');
                }
            } catch (e) { 
                logger.error('Auto-seed failed', e); 
            }
        });
    }

    try {
        await mongoose.connect(uri, {
            maxPoolSize: MONGODB_POOL_SIZE,
            minPoolSize: Math.max(1, Math.floor(MONGODB_POOL_SIZE / 2)),
            socketTimeoutMS: 45000,
            serverSelectionTimeoutMS: 5000,
            retryWrites: true
        });
        logger.info('✅ Connected to MongoDB');
    } catch (err) {
        logger.error('❌ Failed to connect to MongoDB:', err.message);
        process.exit(1);
    }

    // Auto-create default admin if no admin exists in production
    if (NODE_ENV === 'production') {
        try {
            const User = require('./models/User');
            const Restaurant = require('./models/Restaurant');

            // Check if any admin user exists
            const adminExists = await User.findOne({ role: 'admin' });

            if (!adminExists) {
                logger.warn('⚠ No admin user found. Creating default admin...');

                // Check if a restaurant exists, if not create a default one
                let restaurant = await Restaurant.findOne({});
                if (!restaurant) {
                    logger.info('Creating default restaurant...');
                    restaurant = new Restaurant({
                        name: process.env.RESTAURANT_NAME || 'Mi Restaurante',
                        address: 'Dirección por configurar',
                        totems: [],
                        nextTotemId: 1
                    });
                    await restaurant.save();
                }

                // Create default admin user
                const defaultAdmin = new User({
                    username: 'admin',
                    password: 'password',
                    role: 'admin'
                });
                await defaultAdmin.save();

                logger.warn('✅ Default admin created successfully!');
                logger.warn('   Username: admin | Password: password');
                logger.warn('⚠ IMPORTANTE: Cambia esta contraseña después del primer login.');
            }
        } catch (err) {
            logger.error('Failed to create default admin:', err);
        }
    }
};

// Socket.io Logic with error handling
io.on('connection', (socket) => {
    logger.debug('A user connected:', socket.id);

    socket.on('disconnect', () => {
        logger.debug('User disconnected:', socket.id);
    });

    socket.on('error', (err) => {
        logger.error('Socket error:', err);
    });
});

// Start server only after DB is connected
const startServer = async () => {
    try {
        await startDB();
        server.listen(PORT, '0.0.0.0', () => {
            logger.info(`✅ Disher.io Backend running on port ${PORT} in ${NODE_ENV} mode`);
            logger.info(`   Architecture: ${process.arch} | Node.js: ${process.version}`);
        });
    } catch (err) {
        logger.error('❌ Failed to start server:', err);
        process.exit(1);
    }
};

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.warn('SIGTERM received, closing gracefully...');
    server.close(() => {
        logger.info('Server closed');
        mongoose.connection.close(false, () => {
            logger.info('MongoDB connection closed');
            process.exit(0);
        });
    });
});

startServer();
