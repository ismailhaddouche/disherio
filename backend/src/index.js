require('dotenv').config();
const http = require('http');
const app = require('./app');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

// Validar configuración
const requiredEnv = ['JWT_SECRET', 'MONGO_INITDB_ROOT_USERNAME', 'MONGO_INITDB_ROOT_PASSWORD'];
const missingEnv = requiredEnv.filter(e => !process.env[e]);
if (missingEnv.length > 0) {
    console.error(`Error: Faltan variables de entorno requeridas: ${missingEnv.join(', ')}`);
    process.exit(1);
}

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'production';

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
});
app.set('io', io);

// Database Connection with authentication and retry logic
const startDB = async () => {
    const mongoUser = process.env.MONGO_INITDB_ROOT_USERNAME;
    const mongoPass = process.env.MONGO_INITDB_ROOT_PASSWORD;
    const mongoHost = process.env.MONGO_HOST || 'database';
    const mongoPort = process.env.MONGO_PORT || 27017;
    const dbName = 'disher';

    const mongoURI = `mongodb://${encodeURIComponent(mongoUser)}:${encodeURIComponent(mongoPass)}@${mongoHost}:${mongoPort}/${dbName}?authSource=admin`;

    let connected = false;
    let retries = 5;

    while (!connected && retries > 0) {
        try {
            await mongoose.connect(mongoURI, {
                serverSelectionTimeoutMS: 5000
            });
            connected = true;
            console.log('✅ Connected to MongoDB');
        } catch (err) {
            retries--;
            console.error(`❌ Error connecting to MongoDB: ${err.message}. Retries left: ${retries}`);
            if (retries === 0) {
                console.error('CRITICAL: Could not connect to MongoDB after 5 attempts. Exiting...');
                process.exit(1);
            }
            // Wait 5 seconds before retrying
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
};

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);
    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
    });
});

const startServer = async () => {
    startDB();
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Backend de Disher.io en puerto ${PORT} (${NODE_ENV})`);
    });
};

startServer();
