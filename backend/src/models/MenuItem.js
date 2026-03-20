import mongoose from 'mongoose';

const MenuItemSchema = new mongoose.Schema({
    category: { type: String, required: true, trim: true, maxlength: 100 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 2000 },
    basePrice: { type: Number, required: true, min: 0 },
    image: String,
    allergens: [String], // e.g., ['gluten', 'dairy']
    tags: [String], // e.g., ['Vegano', 'Picante']

    // Different versions or sizes
    variants: [{
        name: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
        image: String
    }],

    // Complements that can be added
    addons: [{
        name: { type: String, required: true },
        price: { type: Number, required: true, min: 0 }
    }],

    available: { type: Boolean, default: true },  // indexed below
    order: { type: Number, default: 0 },           // indexed below

    // Menu logic (e.g., Menu del día)
    isMenu: { type: Boolean, default: false },
    menuSections: [{
        name: { type: String, required: true },
        options: { type: [String], required: true },
        minChoices: { type: Number, default: 1, min: 0 },
        maxChoices: { type: Number, default: 1, min: 1 }
    }]
}, { timestamps: true });

// Indexes for performance
// Compound index covers the most common query: items by category that are available, sorted by order
MenuItemSchema.index({ category: 1, available: 1, order: 1 });
MenuItemSchema.index({ available: 1 });
MenuItemSchema.index({ order: 1 });

export default mongoose.model('MenuItem', MenuItemSchema);
