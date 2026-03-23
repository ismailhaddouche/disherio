import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { setupDB, teardownDB } from './setup.js';
import app from '../app.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Restaurant from '../models/Restaurant.js';
import { generateToken } from '../middleware/auth.middleware.js';

process.env.JWT_SECRET = 'test_secret_key_for_testing';

let adminToken;
let kitchenToken;

beforeAll(async () => {
    await setupDB();
    const admin = new User({ username: 'orderadmin', password: 'password123', role: 'admin', restaurantSlug: 'test' });
    await admin.save();
    adminToken = generateToken({ userId: admin._id.toString(), username: 'orderadmin', role: 'admin' });

    const kitchen = new User({ username: 'orderkitchen', password: 'password123', role: 'kitchen', restaurantSlug: 'test' });
    await kitchen.save();
    kitchenToken = generateToken({ userId: kitchen._id.toString(), username: 'orderkitchen', role: 'kitchen' });

    const restaurant = new Restaurant({
        name: 'Test Rest',
        slug: 'test',
        totems: [
            { id: 1, name: 'Mesa 1', active: true, currentSessionId: 'SESS-100' },
            { id: 2, name: 'Mesa 2', active: false }
        ]
    });
    await restaurant.save();
});

afterAll(async () => {
    await teardownDB();
});

beforeEach(async () => {
    await Order.deleteMany({});
});

describe('Order Routes — Integration Tests', () => {

    describe('GET /api/orders', () => {
        it('should return active orders (auth required)', async () => {
            await Order.create({
                tableNumber: '1',
                totemId: 1,
                items: [{ name: 'Sopa', price: 5, quantity: 1 }],
                totalAmount: 5,
                status: 'active'
            });

            const res = await request(app)
                .get('/api/orders')
                .set('Cookie', [`disher_token=${adminToken}`]);

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
        });

        it('should reject without auth token (401)', async () => {
            const res = await request(app).get('/api/orders');
            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/orders/table/:tableNumber', () => {
        it('should return active order for table', async () => {
            await Order.create({
                tableNumber: 'T5',
                totemId: 5,
                items: [{ name: 'Pizza', price: 12, quantity: 1 }],
                totalAmount: 12,
                status: 'active'
            });

            const res = await request(app).get('/api/orders/table/T5');
            expect(res.status).toBe(200);
            expect(res.body.data.tableNumber).toBe('T5');
        });

        it('should return null for non-existent active order', async () => {
            const res = await request(app).get('/api/orders/table/NONEXIST');
            expect(res.status).toBe(200);
            expect(res.body.data).toBeNull();
        });
    });

    describe('GET /api/orders/session/:sessionId', () => {
        it('should return order by session ID', async () => {
            await Order.create({
                tableNumber: '1',
                totemId: 1,
                sessionId: 'SESS-123',
                items: [{ name: 'Water', price: 2, quantity: 1 }],
                totalAmount: 2,
                status: 'active'
            });

            const res = await request(app).get('/api/orders/session/SESS-123');
            expect(res.status).toBe(200);
            expect(res.body.data.sessionId).toBe('SESS-123');
        });
    });

    describe('POST /api/orders', () => {
        it('should create a new order with valid totem and session', async () => {
            const res = await request(app)
                .post('/api/orders')
                .set('Cookie', [`disher_token=${adminToken}`])
                .send({
                    totemId: 1,
                    sessionId: 'SESS-100',
                    items: [{ name: 'New Item', price: 10, quantity: 1, menuItemId: '650000000000000000000001' }]
                });

            expect(res.status).toBe(201);
            expect(res.body.data.sessionId).toBe('SESS-100');
        });

        it('should reject if totem is inactive (403)', async () => {
            const res = await request(app)
                .post('/api/orders')
                .set('Cookie', [`disher_token=${adminToken}`])
                .send({
                    totemId: 2,
                    sessionId: 'SESS-200',
                    items: [{ name: 'X', price: 1, quantity: 1, menuItemId: '650000000000000000000001' }]
                });

            expect(res.status).toBe(403);
        });

        it('should reject if session does not match totem (409)', async () => {
            const res = await request(app)
                .post('/api/orders')
                .set('Cookie', [`disher_token=${adminToken}`])
                .send({
                    totemId: 1,
                    sessionId: 'WRONG-SESS',
                    items: [{ name: 'X', price: 1, quantity: 1, menuItemId: '650000000000000000000001' }]
                });

            expect(res.status).toBe(409);
        });
    });

    describe('POST /api/orders/table/:tableNumber/add-items', () => {
        it('should add items to an existing order', async () => {
            const order = await Order.create({
                tableNumber: '10',
                totemId: 10,
                items: [{ name: 'Existing', price: 5, quantity: 1 }],
                totalAmount: 5,
                status: 'active'
            });

            const res = await request(app)
                .post('/api/orders/table/10/add-items')
                .set('Cookie', [`disher_token=${adminToken}`])
                .send({
                    items: [{ name: 'Added', price: 3, quantity: 1, menuItemId: '650000000000000000000001' }],
                    __v: order.__v
                });

            expect(res.status).toBe(200);
            expect(res.body.data.items.length).toBe(2);
            expect(res.body.data.totalAmount).toBe(8);
        });

        it('should return 409 on version conflict (OCC)', async () => {
            const order = await Order.create({
                tableNumber: '1',
                totemId: 1,
                items: [{ name: 'Water', price: 2, quantity: 1 }],
                totalAmount: 2,
                status: 'active'
            });

            // Simulate a stale version
            const res = await request(app)
                .post('/api/orders/table/1/add-items')
                .set('Cookie', [`disher_token=${adminToken}`])
                .send({
                    items: [{ name: 'Bread', price: 1, quantity: 1, menuItemId: '650000000000000000000001' }],
                    __v: order.__v - 1 
                });

            expect(res.status).toBe(409);
        });
    });

    describe('PATCH /api/orders/:orderId/items/:itemId/associate', () => {
        it('should associate an item with a user', async () => {
            const order = await Order.create({
                tableNumber: '1',
                totemId: 1,
                items: [{ name: 'Unassigned', price: 10, quantity: 1 }],
                totalAmount: 10,
                status: 'active'
            });
            const itemId = order.items[0]._id;

            const res = await request(app)
                .patch(`/api/orders/${order._id}/items/${itemId}/associate`)
                .set('Cookie', [`disher_token=${adminToken}`])
                .send({
                    userId: 'user123',
                    userName: 'John Doe',
                    __v: order.__v
                });

            expect(res.status).toBe(200);
            expect(res.body.data.items[0].orderedBy.id).toBe('user123');
        });

        it('should return 404 for non-existent order', async () => {
            const res = await request(app)
                .patch('/api/orders/650000000000000000000000/items/650000000000000000000001/associate')
                .set('Cookie', [`disher_token=${adminToken}`])
                .send({ userId: 'u', userName: 'n', __v: 0 });

            expect(res.status).toBe(404);
        });
    });

    describe('PATCH /api/orders/:orderId', () => {
        it('should update order status', async () => {
            const order = await Order.create({
                tableNumber: '1',
                totemId: 1,
                items: [{ name: 'A', price: 5, quantity: 1 }],
                totalAmount: 5,
                status: 'active'
            });

            const res = await request(app)
                .patch(`/api/orders/${order._id}`)
                .set('Cookie', [`disher_token=${adminToken}`])
                .send({ status: 'completed', __v: order.__v });

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('completed');
        });

        it('should reject invalid status value (400)', async () => {
            const order = await Order.create({ tableNumber: '1', totemId: 1, items: [], totalAmount: 0 });
            const res = await request(app)
                .patch(`/api/orders/${order._id}`)
                .set('Cookie', [`disher_token=${adminToken}`])
                .send({ status: 'invalid_status' });

            expect(res.status).toBe(400);
        });
    });
});
