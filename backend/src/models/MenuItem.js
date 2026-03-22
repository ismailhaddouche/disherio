import mongoose from 'mongoose';

const VariantSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: [true, 'El nombre de la variante es obligatorio'], 
        trim: true,
        maxlength: [100, 'El nombre no puede exceder los 100 caracteres']
    },
    price: { 
        type: Number, 
        required: [true, 'El precio de la variante es obligatorio'], 
        min: [0, 'El precio no puede ser negativo'] 
    },
    image: { type: String, trim: true }
}, { _id: true }); // Adding _id to subdocuments is default, but explicitly showing it's a sub-document

const AddonSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: [true, 'El nombre del complemento es obligatorio'], 
        trim: true,
        maxlength: [100, 'El nombre no puede exceder los 100 caracteres']
    },
    price: { 
        type: Number, 
        required: [true, 'El precio del complemento es obligatorio'], 
        min: [0, 'El precio no puede ser negativo'] 
    }
}, { _id: true });

const MenuSectionSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: [true, 'El nombre de la sección es obligatorio'], 
        trim: true,
        maxlength: [100, 'El nombre no puede exceder los 100 caracteres']
    },
    options: { 
        type: [String], 
        required: [true, 'Las opciones son obligatorias'],
        validate: [v => Array.isArray(v) && v.length > 0, 'Debe haber al menos una opción']
    },
    minChoices: { 
        type: Number, 
        default: 1, 
        min: [0, 'El número mínimo de elecciones no puede ser negativo'] 
    },
    maxChoices: { 
        type: Number, 
        default: 1, 
        min: [1, 'El número máximo de elecciones debe ser al menos 1'] 
    }
}, { _id: true });

const MenuItemSchema = new mongoose.Schema({
    category: { 
        type: String, 
        required: [true, 'La categoría es obligatoria'], 
        trim: true, 
        maxlength: [100, 'La categoría no puede exceder los 100 caracteres'],
        index: true
    },
    name: { 
        type: String, 
        required: [true, 'El nombre es obligatorio'], 
        trim: true, 
        maxlength: [200, 'El nombre no puede exceder los 200 caracteres'] 
    },
    description: { 
        type: String, 
        maxlength: [2000, 'La descripción no puede exceder los 2000 caracteres'],
        trim: true
    },
    basePrice: { 
        type: Number, 
        required: [true, 'El precio base es obligatorio'], 
        min: [0, 'El precio base no puede ser negativo'] 
    },
    image: { type: String, trim: true },
    allergens: {
        type: [String], // e.g., ['gluten', 'dairy']
        default: []
    },
    tags: {
        type: [String], // e.g., ['Vegano', 'Picante']
        default: []
    },

    // Different versions or sizes
    variants: [VariantSchema],

    // Complements that can be added
    addons: [AddonSchema],

    available: { type: Boolean, default: true },
    order: { type: Number, default: 0 },

    // Menu logic (e.g., Menu del día)
    isMenu: { type: Boolean, default: false },
    menuSections: [MenuSectionSchema]
}, { timestamps: true });

// Indexes for performance
// Compound index covers the most common query: items by category that are available, sorted by order
MenuItemSchema.index({ category: 1, available: 1, order: 1 });
MenuItemSchema.index({ available: 1 });
MenuItemSchema.index({ order: 1 });

export default mongoose.model('MenuItem', MenuItemSchema);
