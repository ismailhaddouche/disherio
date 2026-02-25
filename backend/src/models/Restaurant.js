const mongoose = require('mongoose');

const TotemSchema = new mongoose.Schema({
    id: { type: Number, required: true }, // The identifying number (1, 2, 3...)
    name: String, // Optional name like "Mesa Terraza 1"
    qrUrl: String,
    active: { type: Boolean, default: true }
});

const RestaurantSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: String,
    phone: String,
    email: String,
    logo: String,
    description: String,

    // Totems configuration
    totems: [TotemSchema],
    nextTotemId: { type: Number, default: 1 },

    // Kitchen stations
    stations: [{
        name: String, // e.g., 'Kitchen', 'Bar'
        lastPulse: Date
    }],

    // Branding
    theme: {
        primaryColor: { type: String, default: '#3b82f6' }, // Blue default
        secondaryColor: { type: String, default: '#10b981' }, // Green default
        backgroundColor: { type: String, default: '#0f172a' }, // Dark default
        textColor: { type: String, default: '#ffffff' } // White default
    },

    // Billing Configuration
    billing: {
        vatPercentage: { type: Number, default: null }, // IVA % (null = not configured)
        tipEnabled: { type: Boolean, default: false },
        tipPercentage: { type: Number, default: 0 },
        tipDescription: { type: String, default: 'La propina es opcional' }
    },

    // Social media
    socials: {
        instagram: String,
        facebook: String,
        twitter: String,
        website: String
    }
}, { timestamps: true });

module.exports = mongoose.model('Restaurant', RestaurantSchema);
