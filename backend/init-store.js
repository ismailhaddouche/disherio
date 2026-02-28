const mongoose = require('mongoose');
const Restaurant = require('./src/models/Restaurant');
const User = require('./src/models/User');
const MenuItem = require('./src/models/MenuItem');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://database:27017/disher';

const RESTAURANT_NAME = process.env.INIT_NAME || 'My Restaurant';
const RESTAURANT_SLUG = process.env.INIT_SLUG || 'my-restaurant';
const ADMIN_USER = process.env.INIT_USER || 'admin';
const ADMIN_PASS = process.env.INIT_PASS || 'password';
const RESET_DB = process.env.INIT_RESET === 'true';

async function initStore() {
    try {
        console.log(`Connecting to MongoDB at ${MONGO_URI}...`);
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        if (RESET_DB) {
            console.log('⚠ Wiping database as requested...');
            await Restaurant.deleteMany({});
            await User.deleteMany({});
            await MenuItem.deleteMany({});
        }

        // Check if restaurant exists (single-tenant pattern)
        let restaurant = await Restaurant.findOne({ slug: RESTAURANT_SLUG });
        if (restaurant) {
            console.log(`Restaurant '${RESTAURANT_SLUG}' already exists. Updating...`);
            restaurant.name = RESTAURANT_NAME;
            await restaurant.save();
        } else {
            console.log(`Creating restaurant: ${RESTAURANT_NAME} (${RESTAURANT_SLUG})`);
            restaurant = new Restaurant({
                name: RESTAURANT_NAME,
                slug: RESTAURANT_SLUG,
                address: 'Dirección por configurar',
                totems: [],
                nextTotemId: 1
            });
            await restaurant.save();
        }

        // Create/Update Admin User (password is hashed by User model pre-save hook)
        let user = await User.findOne({ username: ADMIN_USER });
        if (user) {
            console.log(`User '${ADMIN_USER}' already exists. Updating password...`);
            user.password = ADMIN_PASS;
            user.role = 'admin';
            user.restaurantSlug = RESTAURANT_SLUG;
            await user.save();
        } else {
            console.log(`Creating admin user: ${ADMIN_USER}`);
            user = new User({
                username: ADMIN_USER,
                password: ADMIN_PASS,
                role: 'admin',
                restaurantSlug: RESTAURANT_SLUG
            });
            await user.save();
        }
        
        // Create/Update Waiter User
        let waiter = await User.findOne({ username: 'waiter' });
        if (!waiter) {
            console.log('Creating waiter user: waiter');
            waiter = new User({
                username: 'waiter',
                password: 'password',
                role: 'waiter',
                restaurantSlug: RESTAURANT_SLUG
            });
            await waiter.save();
        }

        console.log('✅ Store initialization complete!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Init failed:', error);
        process.exit(1);
    }
}

initStore();
