import Restaurant from '../models/Restaurant.js';
import Order from '../models/Order.js';
import Ticket from '../models/Ticket.js';
import ActivityLog from '../models/ActivityLog.js';
import { randomInt } from 'crypto';
import { ORDER_STATUS } from '../constants.js';

class RestaurantService {
    async getRestaurant() {
        let restaurant = await Restaurant.findOne();
        if (!restaurant) {
            restaurant = new Restaurant({
                name: process.env.RESTAURANT_NAME || 'Mi Restaurante'
            });
            await restaurant.save();
        }
        return restaurant;
    }

    async updateRestaurant(data) {
        let restaurant = await Restaurant.findOne();
        if (!restaurant) {
            restaurant = new Restaurant({ name: 'Mi Restaurante', slug: 'default' });
        }

        const oldState = restaurant.toObject();

        const ALLOWED_FIELDS = [
            'name', 'address', 'phone', 'email', 'description',
            'theme', 'billing', 'socials', 'stations', 'defaultLanguage'
        ];

        for (const field of ALLOWED_FIELDS) {
            if (data[field] !== undefined) {
                restaurant[field] = data[field];
            }
        }
        await restaurant.save();

        return { restaurant, oldState };
    }

    generateSessionId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = 'DSH-';
        for (let i = 0; i < 12; i++) {
            result += chars[randomInt(chars.length)];
        }
        const currentYear = new Date().getFullYear();
        return `${result}-${currentYear}-${currentYear + 1}`;
    }

    async getTotemSession(totemIdNum) {
        const restaurant = await Restaurant.findOne();
        if (!restaurant) return { error: 'RESTAURANT_NOT_FOUND' };

        const totem = restaurant.totems.find(t => t.id === totemIdNum);
        if (!totem) return { error: 'TOTEM_NOT_FOUND' };
        if (!totem.active) return { error: 'TOTEM_INACTIVE' };

        let sessionId = totem.currentSessionId;

        if (sessionId) {
            const activeOrder = await Order.findOne({ sessionId, status: ORDER_STATUS.ACTIVE });
            if (!activeOrder) {
                // Stale session, clear it.
                sessionId = null;
                totem.currentSessionId = null;
                await restaurant.save();
            }
        }

        return { sessionId: sessionId || null, totemId: totem.id, tableNumber: totem.name || totem.id.toString() };
    }

    async startTotemSession(totemIdNum) {
        const restaurant = await Restaurant.findOne();
        if (!restaurant) return { error: 'RESTAURANT_NOT_FOUND' };

        const totem = restaurant.totems.find(t => t.id === totemIdNum);
        if (!totem) return { error: 'TOTEM_NOT_FOUND' };
        if (!totem.active) return { error: 'TOTEM_INACTIVE' };

        let sessionId = totem.currentSessionId;

        // Verify if a real active session already exists
        if (sessionId) {
            const activeOrder = await Order.findOne({ sessionId, status: ORDER_STATUS.ACTIVE });
            if (activeOrder) {
                // Session already started by someone else, return existing
                return { session: { sessionId, totemId: totem.id, tableNumber: totem.name || totem.id.toString() }, isNew: false };
            }
        }

        // Generate new session since none exists or it was stale
        sessionId = this.generateSessionId();
        totem.currentSessionId = sessionId;
        await restaurant.save();

        // Initialize an empty active Order to lock the session
        const newOrder = new Order({
            tableNumber: totem.name || totem.id.toString(),
            totemId: totem.id,
            sessionId: sessionId,
            items: [],
            status: ORDER_STATUS.ACTIVE
        });
        await newOrder.save();

        return { session: { sessionId, totemId: totem.id, tableNumber: totem.name || totem.id.toString() }, newOrder, isNew: true };
    }

    async getTotems() {
        const restaurant = await Restaurant.findOne();
        return restaurant?.totems || [];
    }

    async addTotem(data, creatorUsername) {
        let restaurant = await Restaurant.findOne();
        if (!restaurant) {
            restaurant = new Restaurant({ name: 'Mi Restaurante' });
        }

        // CHECK DUPLICATE NAME
        const duplicate = restaurant.totems.find(t => t.name.toLowerCase() === data.name.toLowerCase());
        if (duplicate) return { error: 'DUPLICATE_TOTEM_NAME' };

        const newTotem = {
            id: restaurant.nextTotemId,
            name: data.name,
            active: true,
            isVirtual: data.isVirtual === true,
            createdBy: creatorUsername
        };

        restaurant.totems.push(newTotem);
        restaurant.nextTotemId += 1;
        await restaurant.save();

        return { newTotem };
    }

    async updateTotem(idStr, data) {
        let restaurant = await Restaurant.findOne();
        if (!restaurant) return { error: 'RESTAURANT_NOT_FOUND' };

        const totem = restaurant.totems.find(t => String(t.id) === idStr);
        if (!totem) return { error: 'TOTEM_NOT_FOUND' };

        // CHECK DUPLICATE (excluding itself)
        const duplicate = restaurant.totems.find(t => t.name.toLowerCase() === data.name.toLowerCase() && String(t.id) !== idStr);
        if (duplicate) return { error: 'DUPLICATE_TOTEM_NAME' };

        const oldTotem = { ...totem.toObject() };
        totem.name = data.name;
        await restaurant.save();

        return { totem, oldTotem };
    }

    async deleteTotem(idStr, userRole) {
        let restaurant = await Restaurant.findOne();
        if (!restaurant) return { error: 'RESTAURANT_NOT_FOUND' };

        const totem = restaurant.totems.find(t => String(t.id) === idStr);
        if (!totem) return { error: 'TOTEM_NOT_FOUND' };

        // Waiter can only delete virtual totems
        if (userRole === 'waiter' && !totem.isVirtual) {
            return { error: 'ACCESS_DENIED_ADMIN' };
        }

        if (userRole !== 'admin' && userRole !== 'waiter') {
            return { error: 'ACCESS_DENIED_ADMIN' };
        }

        const totemData = { ...totem.toObject() };
        restaurant.totems = restaurant.totems.filter(t => String(t.id) !== idStr);
        await restaurant.save();

        return { totem: totemData };
    }

    async closeShift() {
        const restaurant = await Restaurant.findOne();
        if (!restaurant) return { error: 'RESTAURANT_NOT_FOUND' };

        const affectedTables = restaurant.totems.filter(t => t.currentSessionId).map(t => t.name || t.id);

        restaurant.totems.forEach(totem => {
            totem.currentSessionId = null;
        });

        await restaurant.save();

        // Mark all still-active orders as completed so they stop showing in KDS/POS
        await Order.updateMany(
            { status: ORDER_STATUS.ACTIVE },
            { $set: { status: ORDER_STATUS.COMPLETED } }
        );

        return { affectedTables };
    }

    async getLogs() {
        return await ActivityLog.find().sort({ timestamp: -1 }).limit(200);
    }

    async getHistory() {
        return await Ticket.find().sort({ timestamp: -1 }).limit(200);
    }

    async deleteTicket(ticketId) {
        const ticket = await Ticket.findById(ticketId);
        if (!ticket) return null;
        await Ticket.findByIdAndDelete(ticketId);
        return ticket;
    }
}

export default new RestaurantService();