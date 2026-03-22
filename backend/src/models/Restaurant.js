import mongoose from 'mongoose';

const TotemSchema = new mongoose.Schema({
    id: { type: Number, required: true }, // The identifying number (1, 2, 3...)
    name: { type: String, trim: true, maxlength: 100 }, // Optional name like "Mesa Terraza 1"
    qrUrl: { type: String, trim: true, maxlength: 500 },
    active: { type: Boolean, default: true },
    isVirtual: { type: Boolean, default: false },
    createdBy: { type: String, trim: true, maxlength: 100 }, // Username of the creator (for waiter filtering)
    currentSessionId: { type: String, trim: true, maxlength: 100 }
});

const RestaurantSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, default: 'default', unique: true, index: true, trim: true, maxlength: 100 },
    address: { type: String, trim: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 50 },
    email: { type: String, trim: true, maxlength: 100, lowercase: true, match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address.'] },
    logo: { type: String, trim: true, maxlength: 500 },
    description: { type: String, trim: true, maxlength: 1000 },

    // Totems configuration
    totems: [TotemSchema],
    nextTotemId: { type: Number, default: 1 },

    // Printers Catalog
    printers: [{
        id: { type: String, required: true, trim: true, maxlength: 100 },
        name: { type: String, required: true, trim: true, maxlength: 100 },
        type: { type: String, enum: ['network', 'usb', 'cloud', 'thermal'], default: 'network' },
        address: { type: String, trim: true, maxlength: 200 }, // IP Address or Device Path
        connection: { type: String, trim: true, maxlength: 50 } // e.g. "9100" for network ports
    }],

    // Kitchen stations
    stations: [{
        name: { type: String, required: true, trim: true, maxlength: 100 }, // e.g., 'Kitchen', 'Bar'
        lastPulse: Date
    }],

    // Branding
    theme: {
        primaryColor:     { type: String, default: '#3b82f6', trim: true, match: [/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid color'] },
        secondaryColor:   { type: String, default: '#10b981', trim: true, match: [/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid color'] },
        backgroundColor:  { type: String, default: '#0f172a', trim: true, match: [/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid color'] },
        textColor:        { type: String, default: '#ffffff', trim: true, match: [/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid color'] },
        fontFamily:       { type: String, default: '', trim: true, maxlength: 100 },
        borderRadius:     { type: String, default: '', trim: true, maxlength: 50 },
        darkMode:         { type: Boolean, default: true }
    },

    // Billing Configuration
    billing: {
        vatPercentage:  { type: Number, default: null },  // IVA % (null = not configured yet)
        tipEnabled:     { type: Boolean, default: false },
        tipPercentage:  { type: Number, default: 0, min: 0, max: 100 },
        tipDescription: { type: String, default: 'La propina es opcional', trim: true, maxlength: 200 },
        currency:       { type: String, default: 'EUR', trim: true, maxlength: 3 }
    },

    // Social media
    socials: {
        instagram: { type: String, trim: true, maxlength: 200 },
        facebook: { type: String, trim: true, maxlength: 200 },
        twitter: { type: String, trim: true, maxlength: 200 },
        website: { type: String, trim: true, maxlength: 200 }
    },
    defaultLanguage: { type: String, enum: ['es', 'en'], default: 'es' }
}, { timestamps: true });

export default mongoose.model('Restaurant', RestaurantSchema);
