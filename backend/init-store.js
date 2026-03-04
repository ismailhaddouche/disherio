const mongoose = require('mongoose');
const Restaurant = require('./src/models/Restaurant');
const User = require('./src/models/User');
require('dotenv').config();

// Ahora, las contraseñas son requeridas a través de variables de entorno.
const {
    MONGO_URI,
    INIT_NAME: RESTAURANT_NAME = 'Mi Restaurante',
    INIT_SLUG: RESTAURANT_SLUG = 'mi-restaurante',
    INIT_ADMIN_USER: ADMIN_USER = 'admin',
    INIT_WAITER_USER: WAITER_USER = 'waiter',
    INIT_ADMIN_PASS,
    INIT_WAITER_PASS,
    INIT_RESET: RESET_DB = 'false'
} = process.env;

async function initStore() {
    if (!INIT_ADMIN_PASS || !INIT_WAITER_PASS) {
        console.error('Error Crítico: Las contraseñas para los usuarios admin y waiter deben ser proporcionadas.');
        process.exit(1);
    }

    try {
        await mongoose.connect(MONGO_URI);

        if (RESET_DB === 'true') {
            console.log('Borrando la base de datos como se solicitó...');
            await mongoose.connection.db.dropDatabase();
        }

        const restaurantExists = await Restaurant.findOne({ slug: RESTAURANT_SLUG });
        if (!restaurantExists) {
            console.log(`Creando restaurante: ${RESTAURANT_NAME}`);
            await Restaurant.create({
                name: RESTAURANT_NAME,
                slug: RESTAURANT_SLUG,
            });
        }

        // Crear o actualizar usuario admin
        await User.findOneAndUpdate(
            { username: ADMIN_USER },
            { password: INIT_ADMIN_PASS, role: 'admin', restaurantSlug: RESTAURANT_SLUG },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log(`Usuario '${ADMIN_USER}' creado/actualizado con éxito.`);

        // Crear o actualizar usuario waiter
        await User.findOneAndUpdate(
            { username: WAITER_USER },
            { password: INIT_WAITER_PASS, role: 'waiter', restaurantSlug: RESTAURANT_SLUG },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log(`Usuario '${WAITER_USER}' creado/actualizado con éxito.`);

        console.log('✅ Inicialización de la tienda completada.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Falló la inicialización:', error);
        process.exit(1);
    }
}

initStore();
