import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { setupDB, teardownDB } from './setup.js';
import OrderService from '../services/order.service.js';
import MenuService from '../services/menu.service.js';
import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';

beforeAll(async () => {
    await setupDB();
});

afterAll(async () => {
    await teardownDB();
});

beforeEach(async () => {
    await Order.deleteMany({});
    await MenuItem.deleteMany({});
});

describe('Services Unit Tests', () => {

    describe('OrderService', () => {
        it('should calculate total correctly', () => {
            const items = [
                { price: 10, quantity: 2 },
                { price: 5, quantity: 1 }
            ];
            const total = OrderService.calculateTotal(items);
            expect(total).toBe(25);
        });

        it('should update order status and history', async () => {
            const order = new Order({
                tableNumber: '1',
                totemId: 1,
                items: [],
                totalAmount: 0,
                status: 'active'
            });

            OrderService.updateOrderStatus(order, 'completed');
            expect(order.status).toBe('completed');
            expect(order.statusHistory.length).toBe(1);
            expect(order.statusHistory[0].status).toBe('completed');
        });

        it('should process checkout (single payment)', () => {
            const order = new Order({
                items: [
                    { name: 'Pizza', price: 10, quantity: 1, isPaid: false },
                    { name: 'Beer', price: 5, quantity: 1, isPaid: false }
                ],
                totalAmount: 15
            });

            const billingConfig = { vatPercentage: 21, tipEnabled: true, tipPercentage: 10 };
            const result = OrderService.processCheckout(order, {
                splitType: 'single',
                billingConfig
            });

            // 15 + 1.5 (tip) = 16.5
            expect(result.finalAmount).toBe(16.5);
            expect(result.tipAmount).toBe(1.5);
            expect(result.totalPaidFlag).toBe(true);
            expect(order.items.every(i => i.isPaid)).toBe(true);
        });

        it('should process checkout (split equal)', () => {
            const order = new Order({
                items: [{ name: 'Meal', price: 40, quantity: 1, isPaid: false }],
                totalAmount: 40
            });

            const result = OrderService.processCheckout(order, {
                splitType: 'equal',
                parts: 4,
                billingConfig: { vatPercentage: 0, tipEnabled: false }
            });

            expect(result.finalAmount).toBe(10);
            expect(result.totalPaidFlag).toBe(false);
            expect(order.items[0].isPaid).toBe(false); // only one part paid
        });
        
        it('should process checkout (by user)', () => {
            const order = new Order({
                items: [
                    { name: 'User1 Item', price: 20, quantity: 1, orderedBy: { id: 'user1' }, isPaid: false },
                    { name: 'User2 Item', price: 30, quantity: 1, orderedBy: { id: 'user2' }, isPaid: false }
                ]
            });
            
            const result = OrderService.processCheckout(order, {
                splitType: 'by-user',
                userId: 'user1',
                billingConfig: { vatPercentage: 0, tipEnabled: false }
            });
            
            expect(result.finalAmount).toBe(20);
            expect(order.items[0].isPaid).toBe(true);
            expect(order.items[1].isPaid).toBe(false);
            expect(result.totalPaidFlag).toBe(false);
        });
    });

    describe('MenuService', () => {
        it('should create a new item', async () => {
            const data = { name: 'New Service Item', category: 'Test', basePrice: 10 };
            const result = await MenuService.createOrUpdateItem(null, data);
            
            expect(result.isNew).toBe(true);
            expect(result.item.name).toBe('New Service Item');
            
            const saved = await MenuItem.findOne({ name: 'New Service Item' });
            expect(saved).toBeDefined();
        });

        it('should toggle availability', async () => {
            const item = await MenuItem.create({ name: 'Toggle Me', category: 'Test', basePrice: 5, available: true });
            const result = await MenuService.toggleAvailability(item._id);
            
            expect(result.previousStatus).toBe(true);
            expect(result.item.available).toBe(false);
            
            const updated = await MenuItem.findById(item._id);
            expect(updated.available).toBe(false);
        });

        it('should return null when toggling non-existent item', async () => {
            const result = await MenuService.toggleAvailability('650000000000000000000000');
            expect(result).toBeNull();
        });
    });

});
