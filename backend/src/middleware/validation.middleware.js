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
    _id: Joi.string().allow(''),
    name: Joi.string().required().min(2),
    description: Joi.string().allow(''),
    category: Joi.string().required(),
    basePrice: Joi.number().min(0).required(),
    available: Joi.boolean().default(true),
    order: Joi.number().integer().min(0).default(0),
    image: Joi.string().allow(''),
    allergens: Joi.array().items(Joi.string()),
    tags: Joi.array().items(Joi.string()),
    isMenu: Joi.boolean().default(false),
    variants: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        price: Joi.number().min(0).required(),
        image: Joi.string().allow('').optional()
    })),
    addons: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        price: Joi.number().min(0).required()
    })),
    menuSections: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        options: Joi.array().items(Joi.string()).min(1).required()
    }))
}).unknown(true);

/**
 * Order iteration schema (for adding items to a session/order)
 */
export const orderItemSchema = Joi.object({
    menuItemId: Joi.string().required(),
    quantity: Joi.number().integer().min(1).default(1),
    notes: Joi.string().allow(''),
    selectedVariant: Joi.object({
        name: Joi.string().required(),
        price: Joi.number().required()
    }).allow(null),
    selectedAddons: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        price: Joi.number().required()
    })).default([]),
    image: Joi.string().allow('').optional(),
    menuChoices: Joi.object().pattern(Joi.string(), Joi.string()).default({})
});

export const orderPlacementSchema = Joi.object({
    items: Joi.array().items(orderItemSchema).min(1).required()
});
