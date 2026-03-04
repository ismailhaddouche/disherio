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

// Conexión a la Base de Datos con autenticación
const startDB = async () => {
    const mongoUser = process.env.MONGO_INITDB_ROOT_USERNAME;
    const mongoPass = process.env.MONGO_INITDB_ROOT_PASSWORD;
    const mongoHost = process.env.MONGO_HOST || 'database';
    const mongoPort = process.env.MONGO_PORT || 27017;
    const dbName = 'disher';

    const mongoURI = `mongodb://${mongoUser}:${mongoPass}@${mongoHost}:${mongoPort}/${dbName}?authSource=admin`;

    try {
        await mongoose.connect(mongoURI, {
            serverSelectionTimeoutMS: 5000
        });
        console.log('✅ Conectado a MongoDB');
    } catch (err) {
        console.error(`❌ Error al conectar a MongoDB: ${err.message}`);
        process.exit(1);
    }
};

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);
    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
    });
});

const startServer = async () => {
    await startDB();
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Backend de Disher.io en puerto ${PORT} (${NODE_ENV})`);
    });
};

startServer();
