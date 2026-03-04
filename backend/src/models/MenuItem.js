const mongoose = require('mongoose');

const MenuItemSchema = new mongoose.Schema({
    category: { type: String, required: true }, // e.g., 'Entrantes', 'Principales'
    name: { type: String, required: true },
    description: String,
    basePrice: { type: Number, required: true },
    image: String,
    allergens: [String], // e.g., ['gluten', 'dairy']
    tags: [String], // e.g., ['Vegano', 'Picante']

    // Different versions or sizes
    variants: [{
        name: String, // e.g., 'Tamaño XL'
        price: { type: Number, default: 0 } // PM FIX: Absolute price for this variant
    }],

    // Complements that can be added
    addons: [{
        name: String,
        price: Number
    }],

    available: { type: Boolean, default: true },
    order: { type: Number, default: 0 },

    // Menu logic (e.g., Menu del día)
    isMenu: { type: Boolean, default: false },
    menuSections: [{
        name: String, // e.g., 'Primer Plato'
        options: [String], // List of dish names to choose from
        minChoices: { type: Number, default: 1 },
        maxChoices: { type: Number, default: 1 }
    }]
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', MenuItemSchema);
