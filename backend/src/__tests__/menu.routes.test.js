import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { setupDB, teardownDB } from './setup.js';
import app from '../app.js';
import MenuItem from '../models/MenuItem.js';
import User from '../models/User.js';
import { generateToken } from '../middleware/auth.middleware.js';

// Set required env vars
process.env.JWT_SECRET = 'test_secret_key_for_testing';

let adminToken;

beforeAll(async () => {
    await setupDB();
    // Create test users
    const admin = new User({ username: 'testadmin', password: 'password123', role: 'admin', restaurantSlug: 'test' });
    await admin.save();
    const kitchen = new User({ username: 'testkitchen', password: 'password123', role: 'kitchen', restaurantSlug: 'test' });
    await kitchen.save();

    adminToken = generateToken({ userId: admin._id.toString(), username: 'testadmin', role: 'admin' });
});

afterAll(async () => {
    await teardownDB();
});

beforeEach(async () => {
    await MenuItem.deleteMany({});
});

describe('Menu Routes — Integration Tests', () => {

    describe('GET /api/menu', () => {
        it('should return an empty array when no items exist', async () => {
            const res = await request(app).get('/api/menu');
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
        });

        it('should return all menu items sorted by category', async () => {
            await MenuItem.create([
                { name: 'Sopa', category: 'Entrantes', basePrice: 5 },
                { name: 'Filete', category: 'Principales', basePrice: 15 },
                { name: 'Pan', category: 'Entrantes', basePrice: 2 }
            ]);

            const res = await request(app).get('/api/menu');
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(3);
            // Should be sorted by category (Entrantes before Principales)
            expect(res.body.data[0].category).toBe('Entrantes');
            expect(res.body.data[2].category).toBe('Principales');
        });
    });

    describe('POST /api/menu (Create)', () => {
        it('should create a new menu item with valid data', async () => {
            const res = await request(app)
                .post('/api/menu')
                .set('Cookie', [`disher_token=${adminToken}`])
                .send({
                    name: 'Tortilla Española',
                    category: 'Entrantes',
                    basePrice: 8.5,
                    allergens: ['Huevo'],
                    variants: [],
                    addons: []
                });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Tortilla Española');
            expect(res.body.data._id).toBeDefined();
        });

        it('should reject creation without auth token', async () => {
            const res = await request(app)
                .post('/api/menu')
                .send({ name: 'Test', category: 'Test', basePrice: 5 });

            expect(res.status).toBe(401);
        });

        it('should reject invalid menu item data', async () => {
            const res = await request(app)
                .post('/api/menu')
                .set('Cookie', [`disher_token=${adminToken}`])
                .send({ name: 'X', basePrice: -5 }); // short name, no category, negative price

            expect(res.status).toBe(400);
        });

        it('should allow admin to create items in any category', async () => {
            const res = await request(app)
                .post('/api/menu')
                .set('Cookie', [`disher_token=${adminToken}`])
                .send({ name: 'Paella', category: 'Principales', basePrice: 18 });

            expect(res.status).toBe(200);
            expect(res.body.data.category).toBe('Principales');
        });
    });

    describe('POST /api/menu (Update)', () => {
        it('should update an existing menu item when _id is provided', async () => {
            const item = await MenuItem.create({
                name: 'Old Name',
                category: 'Entrantes',
                basePrice: 5
            });

            const res = await request(app)
                .post('/api/menu')
                .set('Cookie', [`disher_token=${adminToken}`])
                .send({
                    _id: item._id.toString(),
                    name: 'New Name',
                    category: 'Entrantes',
                    basePrice: 7
                });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('New Name');
            expect(res.body.data.basePrice).toBe(7);
        });
    });
});
