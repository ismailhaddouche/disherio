const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
    id: String,
    name: String,
    price: Number, // Price at the moment of order (base + variants)
    quantity: Number,
    status: {
        type: String,
        enum: ['pending', 'preparing', 'ready', 'served', 'cancelled'],
        default: 'pending'
    },
    station: { type: String, default: 'Kitchen' },
    orderedBy: {
        id: String,
        name: String
    },
    // Support for complex menu choices
    selectedVariant: {
        name: String,
        priceAddon: Number
    },
    selectedAddons: [{
        name: String,
        price: Number
    }],
    notes: String,
    emoji: String,
    isCustom: { type: Boolean, default: false }
});

const OrderSchema = new mongoose.Schema({
    tableNumber: String,
    totemId: { type: Number, required: true }, // PM FIX: Added identifying totem number
    items: [OrderItemSchema],
    totalAmount: { type: Number, default: 0 },
    paymentStatus: {
        type: String,
        enum: ['unpaid', 'paid', 'split', 'processing'],
        default: 'unpaid'
    },
    status: {
        type: String,
        enum: ['active', 'completed', 'cancelled'],
        default: 'active'
    }
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);
