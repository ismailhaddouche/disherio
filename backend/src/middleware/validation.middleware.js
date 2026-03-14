import Joi from 'joi';

/**
 * Common validation middleware to handle Joi schemas
 * @param {Joi.Schema} schema - The Joi schema to validate against
 * @param {string} property - The request property to validate (body, query, params)
 */
export const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error } = schema.validate(req[property], { abortEarly: false });
        if (error) {
            const message = error.details.map(d => d.message).join(', ');
            return res.error(message, 400);
        }
        next();
    };
};

/**
 * MenuItem Schemas
 */
export const menuItemSchema = Joi.object({
    _id: Joi.string().max(50).allow(''),
    name: Joi.string().required().min(2).max(100).trim(),
    description: Joi.string().max(1000).allow('').trim(),
    category: Joi.string().required().max(50).trim(),
    basePrice: Joi.number().min(0).max(10000).required(),
    available: Joi.boolean().default(true),
    order: Joi.number().integer().min(0).max(1000).default(0),
    image: Joi.string().max(255).allow(''),
    allergens: Joi.array().items(Joi.string().max(50)).max(20),
    tags: Joi.array().items(Joi.string().max(50)).max(20),
    isMenu: Joi.boolean().default(false),
    variants: Joi.array().items(Joi.object({
        name: Joi.string().required().max(100).trim(),
        price: Joi.number().min(0).max(10000).required(),
        image: Joi.string().max(255).allow('').optional()
    })).max(50),
    addons: Joi.array().items(Joi.object({
        name: Joi.string().required().max(100).trim(),
        price: Joi.number().min(0).max(10000).required()
    })).max(50),
    menuSections: Joi.array().items(Joi.object({
        name: Joi.string().required().max(100).trim(),
        options: Joi.array().items(Joi.string().max(100)).min(1).max(20).required()
    })).max(10)
}).unknown(true);

/**
 * Order iteration schema (for adding items to a session/order)
 */
export const orderItemSchema = Joi.object({
    menuItemId: Joi.string().max(50).required(),
    name: Joi.string().max(100).optional(),
    price: Joi.number().min(0).max(10000).optional(),
    quantity: Joi.number().integer().min(1).max(99).default(1),
    notes: Joi.string().max(500).allow('').trim(),
    selectedVariant: Joi.object({
        name: Joi.string().max(100).required(),
        price: Joi.number().min(0).max(10000).required()
    }).allow(null),
    selectedAddons: Joi.array().items(Joi.object({
        name: Joi.string().max(100).required(),
        price: Joi.number().min(0).max(10000).required()
    })).max(50).default([]),
    image: Joi.string().max(255).allow('').optional(),
    menuChoices: Joi.object().pattern(Joi.string().max(100), Joi.string().max(100)).max(20).default({}),
    __v: Joi.number().optional()
}).unknown(true);

export const orderPlacementSchema = Joi.object({
    items: Joi.array().items(orderItemSchema).min(1).max(50).required(),
    tableNumber: Joi.string().max(10).optional(),
    totemId: Joi.number().integer().optional(),
    sessionId: Joi.string().max(100).optional(),
    __v: Joi.number().optional()
}).unknown(true);

/**
 * Restaurant Configuration Schemas
 */
export const restaurantUpdateSchema = Joi.object({
    name: Joi.string().min(2).max(100).trim(),
    address: Joi.string().max(200).trim().allow(''),
    phone: Joi.string().max(20).trim().allow(''),
    email: Joi.string().email().max(100).trim().allow(''),
    description: Joi.string().max(500).trim().allow(''),
    defaultLanguage: Joi.string().valid('es', 'en'),
    theme: Joi.object({
        primaryColor: Joi.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
        secondaryColor: Joi.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
        fontFamily: Joi.string().max(50).optional(),
        borderRadius: Joi.string().max(20).optional(),
        darkMode: Joi.boolean().optional()
    }).optional(),
    billing: Joi.object({
        vatPercentage: Joi.number().min(0).max(100).required(),
        tipEnabled: Joi.boolean().required(),
        tipPercentage: Joi.number().min(0).max(100).optional(),
        tipDescription: Joi.string().max(100).allow('').optional(),
        currency: Joi.string().length(3).default('EUR')
    }).optional(),
    socials: Joi.object({
        website: Joi.string().uri().allow('').optional(),
        instagram: Joi.string().max(100).allow('').optional(),
        facebook: Joi.string().max(100).allow('').optional(),
        twitter: Joi.string().max(100).allow('').optional()
    }).optional(),
    stations: Joi.array().items(Joi.string().max(50)).max(20)
}).min(1).unknown(true);

/**
 * Common MongoID Schema
 */
export const mongoIdSchema = Joi.object({
    id: Joi.string().hex().length(24).required(),
    itemId: Joi.string().hex().length(24).optional(),
    orderId: Joi.string().hex().length(24).optional()
});
