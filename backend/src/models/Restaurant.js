import mongoose from 'mongoose';

const TotemSchema = new mongoose.Schema({
    id: { type: Number, required: true }, // The identifying number (1, 2, 3...)
    name: String, // Optional name like "Mesa Terraza 1"
    qrUrl: String,
    active: { type: Boolean, default: true },
    isVirtual: { type: Boolean, default: false },
    createdBy: String, // Username of the creator (for waiter filtering)
    currentSessionId: String
});

const RestaurantSchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, default: 'default', unique: true, index: true },
    address: String,
    phone: String,
    email: String,
    logo: String,
    description: String,

    // Totems configuration
    totems: [TotemSchema],
    nextTotemId: { type: Number, default: 1 },

    // Printers Catalog
    printers: [{
        id: { type: String, required: true },
        name: { type: String, required: true },
        type: { type: String, enum: ['network', 'usb', 'cloud', 'thermal'], default: 'network' },
        address: String, // IP Address or Device Path
        connection: String // e.g. "9100" for network ports
    }],

    // Kitchen stations
    stations: [{
        name: { type: String, required: true, maxlength: 100 }, // e.g., 'Kitchen', 'Bar'
        lastPulse: Date
    }],

    // Branding
    theme: {
        primaryColor:     { type: String, default: '#3b82f6' },
        secondaryColor:   { type: String, default: '#10b981' },
        backgroundColor:  { type: String, default: '#0f172a' },
        textColor:        { type: String, default: '#ffffff' },
        fontFamily:       { type: String, default: '' },
        borderRadius:     { type: String, default: '' },
        darkMode:         { type: Boolean, default: true }
    },

    // Billing Configuration
    billing: {
        vatPercentage:  { type: Number, default: null },  // IVA % (null = not configured yet)
        tipEnabled:     { type: Boolean, default: false },
        tipPercentage:  { type: Number, default: 0, min: 0, max: 100 },
        tipDescription: { type: String, default: 'La propina es opcional', maxlength: 200 },
        currency:       { type: String, default: 'EUR', maxlength: 3 }
    },

    // Social media
    socials: {
        instagram: String,
        facebook: String,
        twitter: String,
        website: String
    },
    defaultLanguage: { type: String, enum: ['es', 'en'], default: 'es' }
}, { timestamps: true });

export default mongoose.model('Restaurant', RestaurantSchema);
