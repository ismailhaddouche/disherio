import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { setupDB, teardownDB } from './setup.js';
import app from '../app.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { generateToken } from '../middleware/auth.middleware.js';

let adminToken;

beforeAll(async () => {
    await setupDB();
    const admin = new User({ username: 'occadmin', password: 'password123', role: 'admin', restaurantSlug: 'test' });
    await admin.save();
    adminToken = generateToken({ userId: admin._id.toString(), username: 'occadmin', role: 'admin' });
});

afterAll(async () => {
    await teardownDB();
});

beforeEach(async () => {
    await Order.deleteMany({});
});

describe('Optimistic Concurrency Control (OCC) Integration Tests', () => {

    it('should return 409 when updating an order with a stale version (__v)', async () => {
        const order = new Order({
            tableNumber: '1',
            totemId: 1,
            items: [{ name: 'Water', price: 2, quantity: 1 }],
            totalAmount: 2,
            status: 'active'
        });
        await order.save();
        
        const initialVersion = order.__v;

        // Perform first update (valid)
        const res1 = await request(app)
            .post('/api/orders/table/1/add-items')
            .set('Cookie', ['disher_token=' + adminToken])
            .send({
                items: [{ name: 'Bread', price: 1, quantity: 1 }],
                __v: initialVersion
            });
        expect(res1.status).toBe(200);
        const versionAfterFirstUpdate = res1.body.data.__v;
        expect(versionAfterFirstUpdate).toBeGreaterThan(initialVersion);

        // Perform second update using STALE version (initialVersion)
        const res2 = await request(app)
            .post('/api/orders/table/1/add-items')
            .set('Cookie', ['disher_token=' + adminToken])
            .send({
                items: [{ name: 'Wine', price: 15, quantity: 1 }],
                __v: initialVersion
            });

        expect(res2.status).toBe(409);
        expect(res2.body.message).toContain('concurrencia');
    });

    it('should fail checkout if order was modified by another user concurrently', async () => {
        const order = new Order({
            tableNumber: '2',
            totemId: 2,
            items: [{ name: 'Steak', price: 25, quantity: 1, status: 'served' }],
            totalAmount: 25,
            status: 'active'
        });
        await order.save();
        const initialVersion = order.__v;

        // Another user modifies the order (e.g. adding a drink)
        order.items.push({ name: 'Coke', price: 3, quantity: 1, status: 'served' });
        order.totalAmount = 28;
        await order.save(); 
        // Now order.__v has incremented on server.

        // User A tries to checkout using the old version they saw
        const res = await request(app)
            .post(`/api/orders/${order._id}/checkout`)
            .set('Cookie', [`disher_token=${adminToken}`])
            .send({
                method: 'card',
                splitType: 'single',
                __v: initialVersion // Stale!
            });

        expect(res.status).toBe(409);
    });

});
