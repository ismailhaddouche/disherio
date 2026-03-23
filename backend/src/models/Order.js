import mongoose from 'mongoose';
import { ITEM_STATUS, ORDER_STATUS, PAYMENT_STATUS } from '../constants.js';

const MAX_ITEMS_PER_ORDER = 200;

const OrderItemSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 200 },
    price: { type: Number, required: true, min: 0 }, // Price at the moment of order (base + variants)
    quantity: { type: Number, required: true, min: 1, max: 99 },
    status: {
        type: String,
        enum: {
            values: Object.values(ITEM_STATUS),
            message: '{VALUE} no es un estado válido'
        },
        default: ITEM_STATUS.PENDING
    },
    station: { type: String, default: 'Kitchen', trim: true, maxlength: 100 },
    orderedBy: {
        _id: false, // Subdoc — no need for an extra ObjectId
        id: { type: String, trim: true, maxlength: 100 },
        name: { type: String, trim: true, maxlength: 100 }
    },
    // Support for complex menu choices
    selectedVariant: {
        name: { type: String, trim: true, maxlength: 200 },
        price: { type: Number, min: 0 }
    },
    selectedAddons: [{
        name: { type: String, trim: true, maxlength: 200 },
        price: { type: Number, min: 0 }
    }],
    menuChoices: { type: Map, of: String, default: {} },
    notes: { type: String, trim: true, maxlength: 500 },
    emoji: { type: String, trim: true, maxlength: 10 },
    image: { type: String, trim: true, maxlength: 500 },
    isCustom: { type: Boolean, default: false },
    isPaid: { type: Boolean, default: false },
    statusHistory: [{
        status: { type: String, enum: Object.values(ITEM_STATUS) },
        timestamp: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});

const OrderSchema = new mongoose.Schema({
    tableNumber: { type: String, trim: true, maxlength: 50 },
    totemId: { type: Number, required: true },
    items: { type: [OrderItemSchema], validate: { validator: v => v.length <= MAX_ITEMS_PER_ORDER, message: `An order cannot exceed ${MAX_ITEMS_PER_ORDER} items` } },
    totalAmount: { type: Number, default: 0, min: 0 },
    paymentStatus: {
        type: String,
        enum: Object.values(PAYMENT_STATUS),
        default: PAYMENT_STATUS.UNPAID
    },
    status: {
        type: String,
        enum: Object.values(ORDER_STATUS),
        default: ORDER_STATUS.ACTIVE
    },
    statusHistory: [{
        status: { type: String, enum: Object.values(ORDER_STATUS) },
        timestamp: { type: Date, default: Date.now }
    }],
    sessionId: { type: String, unique: true, sparse: true, trim: true, maxlength: 100 }
}, { timestamps: true, optimisticConcurrency: true });

// Indexes for performance optimization
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ totemId: 1, status: 1 });
OrderSchema.index({ tableNumber: 1, status: 1 });

export default mongoose.model('Order', OrderSchema);
