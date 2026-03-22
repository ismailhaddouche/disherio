import mongoose from 'mongoose';
import Restaurant from './src/models/Restaurant.js';
import User from './src/models/User.js';

// Use MONGODB_URI (set by docker-compose) or MONGO_URI fallback
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const RESTAURANT_NAME = process.env.INIT_NAME || 'Mi Restaurante';
const RESTAURANT_SLUG = process.env.INIT_SLUG || 'mi-restaurante';
const ADMIN_USER = process.env.INIT_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.INIT_ADMIN_PASS;
const DEFAULT_LANG = process.env.INIT_DEFAULT_LANG || 'es';
const RESET_DB = process.env.INIT_RESET || 'false';

async function initStore() {
    if (!MONGO_URI) {
        console.error('Error Crítico: MONGODB_URI no está definida.');
        process.exit(1);
    }

    if (!ADMIN_PASS) {
        console.error('Error Crítico: INIT_ADMIN_PASS no está definida.');
        process.exit(1);
    }

    console.log('Conectando a MongoDB...');

    let retries = 5;
    while (retries > 0) {
        try {
            await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 8000 });
            console.log('✅ Conectado a MongoDB');
            break;
        } catch (err) {
            retries--;
            console.error(`❌ Error conectando a MongoDB (intentos restantes: ${retries}): ${err.message}`);
            if (retries === 0) {
                console.error('No se pudo conectar a MongoDB. Abortando.');
                process.exit(1);
            }
            await new Promise(r => setTimeout(r, 5000));
        }
    }

    try {
        if (RESET_DB === 'true') {
            console.log('Borrando la base de datos como se solicitó...');
            await mongoose.connection.db.dropDatabase();
        }

        // Crear restaurante base si no existe
        const restaurantExists = await Restaurant.findOne({ slug: RESTAURANT_SLUG });
        if (!restaurantExists) {
            console.log(`Creando restaurante: ${RESTAURANT_NAME}`);
            await Restaurant.create({
                name: RESTAURANT_NAME,
                slug: RESTAURANT_SLUG,
                defaultLanguage: DEFAULT_LANG
            });
        } else {
            console.log(`Restaurante '${RESTAURANT_SLUG}' ya existe.`);
        }

        // Crear o actualizar usuario admin
        // IMPORTANTE: usar save() para que el hook pre('save') de bcrypt hashee la contraseña
        let adminUser = await User.findOne({ username: ADMIN_USER });
        if (adminUser) {
            adminUser.password = ADMIN_PASS;
            adminUser.role = 'admin';
            adminUser.restaurantSlug = RESTAURANT_SLUG;
            adminUser.active = true;
            await adminUser.save();
            console.log(`✅ Usuario '${ADMIN_USER}' actualizado con éxito.`);
        } else {
            const newAdmin = new User({
                username: ADMIN_USER,
                password: ADMIN_PASS,
                role: 'admin',
                restaurantSlug: RESTAURANT_SLUG,
                active: true
            });
            await newAdmin.save();
            console.log(`✅ Usuario '${ADMIN_USER}' creado con éxito.`);
        }

        console.log('✅ Inicialización de la tienda completada.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Falló la inicialización:', error.message);
        process.exit(1);
    }
}

initStore();
