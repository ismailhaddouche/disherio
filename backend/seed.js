const mongoose = require('mongoose');
const Restaurant = require('./src/models/Restaurant');
const MenuItem = require('./src/models/MenuItem');
const User = require('./src/models/User');
const Order = require('./src/models/Order');
const ActivityLog = require('./src/models/ActivityLog');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/disher';

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // Clear existing data
        await Restaurant.deleteMany({});
        await MenuItem.deleteMany({});
        await Order.deleteMany({});
        await User.deleteMany({});
        await ActivityLog.deleteMany({});

        // Create Users (use save() individually so pre-save bcrypt hook runs)
        for (const u of [
            { username: 'admin', password: 'password', role: 'admin' },
            { username: 'cocina', password: 'password', role: 'kitchen' },
            { username: 'caja', password: 'password', role: 'pos' }
        ]) {
            await new User(u).save();
        }
        console.log('Initial users created (admin: password, cocina: password, caja: password)');

        // Create Restaurant
        const restaurant = new Restaurant({
            name: 'Casa Pepe',
            address: 'Calle Mayor 1, Madrid',
            totems: [
                { id: 1, name: 'Mesa Principal' },
                { id: 2, name: 'Terraza Sol' },
                { id: 3, name: 'Barra Centro' }
            ],
            nextTotemId: 4
        });
        await restaurant.save();
        console.log('Restaurant created: Casa Pepe');

        // Create Menu Items
        const items = [
            {
                name: 'Menú del Día',
                description: 'El clásico de la casa. Incluye Primero, Segundo y Postre.',
                basePrice: 13.5,
                category: 'Principales',
                available: true,
                order: 0,
                isMenu: true,
                menuSections: [
                    { name: 'Primer Plato', options: ['Arroz a la cubana', 'Lentejas caseras', 'Ensalada Mixta'] },
                    { name: 'Segundo Plato', options: ['Pollo al Horno', 'Merluza a la Romana', 'Escalope de Ternera'] }
                ]
            },
            {
                name: 'Pizza Margarita',
                description: 'Tomate San Marzano, mozzarella fior di latte y albahaca.',
                basePrice: 10.0,
                category: 'Principales',
                available: true,
                order: 1,
                variants: [
                    { name: 'Individual', price: 10.0 },
                    { name: 'Familiar', price: 16.5 }
                ],
                addons: [
                    { name: 'Borde relleno queso', price: 2.0 },
                    { name: 'Extra Orégano', price: 0.5 }
                ]
            },
            {
                name: 'Tortilla de Patatas',
                description: 'Nuestra especialidad, con huevos de corral.',
                basePrice: 12.5,
                category: 'Entrantes',
                available: true,
                order: 2
            },
            {
                name: 'Croquetas de Jamón',
                description: 'Bechamel cremosa y jamón ibérico.',
                basePrice: 10.0,
                category: 'Entrantes',
                available: true,
                order: 3
            },
            {
                name: 'Caña de Cerveza',
                description: 'Muy fría.',
                basePrice: 2.5,
                category: 'Bebidas',
                available: true,
                order: 4
            }
        ];

        await MenuItem.insertMany(items);
        console.log('Menu items created (including Daily Menu and Variants)');

        console.log('Seed completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Seed error:', error);
        process.exit(1);
    }
}

seed();
