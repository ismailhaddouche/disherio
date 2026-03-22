import { describe, it, expect } from '@jest/globals';
import { menuItemSchema, orderItemSchema, orderPlacementSchema } from '../middleware/validation.middleware.js';

describe('Validation Middleware — Joi Schemas', () => {

    // ── menuItemSchema ───────────────────────────────────────────────────────

    describe('menuItemSchema', () => {
        it('should accept a valid menu item', () => {
            const input = {
                name: 'Tortilla Española',
                category: 'Entrantes',
                basePrice: 8.50,
                available: true,
                allergens: [],
                variants: [],
                addons: []
            };
            const { error } = menuItemSchema.validate(input);
            expect(error).toBeUndefined();
        });

        it('should reject when name is missing', () => {
            const input = { category: 'Entrantes', basePrice: 5 };
            const { error } = menuItemSchema.validate(input);
            expect(error).toBeDefined();
            expect(error.details[0].path).toContain('name');
        });

        it('should reject when name is too short', () => {
            const input = { name: 'X', category: 'Entrantes', basePrice: 5 };
            const { error } = menuItemSchema.validate(input);
            expect(error).toBeDefined();
        });

        it('should reject when category is missing', () => {
            const input = { name: 'Paella', basePrice: 12 };
            const { error } = menuItemSchema.validate(input);
            expect(error).toBeDefined();
            expect(error.details[0].path).toContain('category');
        });

        it('should reject negative basePrice', () => {
            const input = { name: 'Test', category: 'Cat', basePrice: -1 };
            const { error } = menuItemSchema.validate(input);
            expect(error).toBeDefined();
        });

        it('should accept valid variants', () => {
            const input = {
                name: 'Pizza',
                category: 'Principales',
                basePrice: 10,
                variants: [
                    { name: 'Small', price: 8 },
                    { name: 'Large', price: 14 }
                ]
            };
            const { error } = menuItemSchema.validate(input);
            expect(error).toBeUndefined();
        });

        it('should reject variants with missing price', () => {
            const input = {
                name: 'Pizza',
                category: 'Principales',
                basePrice: 10,
                variants: [{ name: 'Small' }]
            };
            const { error } = menuItemSchema.validate(input);
            expect(error).toBeDefined();
        });

        it('should accept valid menuSections when isMenu=true', () => {
            const input = {
                name: 'Menú del Día',
                category: 'Menús',
                basePrice: 15,
                isMenu: true,
                menuSections: [
                    { name: 'Primero', options: ['Sopa', 'Ensalada'] },
                    { name: 'Segundo', options: ['Carne', 'Pescado'] }
                ]
            };
            const { error } = menuItemSchema.validate(input);
            expect(error).toBeUndefined();
        });

        it('should reject menuSection with empty options', () => {
            const input = {
                name: 'Menú del Día',
                category: 'Menús',
                basePrice: 15,
                isMenu: true,
                menuSections: [{ name: 'Primero', options: [] }]
            };
            const { error } = menuItemSchema.validate(input);
            expect(error).toBeDefined();
        });
    });

    // ── orderItemSchema ──────────────────────────────────────────────────────

    describe('orderItemSchema', () => {
        it('should accept a valid order item', () => {
            const input = {
                menuItemId: 'abc123',
                quantity: 2,
                notes: 'No onions'
            };
            const { error } = orderItemSchema.validate(input);
            expect(error).toBeUndefined();
        });

        it('should reject when menuItemId is missing', () => {
            const input = { quantity: 1 };
            const { error } = orderItemSchema.validate(input);
            expect(error).toBeDefined();
        });

        it('should reject quantity less than 1', () => {
            const input = { menuItemId: 'abc', quantity: 0 };
            const { error } = orderItemSchema.validate(input);
            expect(error).toBeDefined();
        });

        it('should default quantity to 1 if not provided', () => {
            const input = { menuItemId: 'abc' };
            const { value } = orderItemSchema.validate(input);
            expect(value.quantity).toBe(1);
        });

        it('should accept selectedVariant', () => {
            const input = {
                menuItemId: 'abc',
                selectedVariant: { name: 'Large', price: 3 }
            };
            const { error } = orderItemSchema.validate(input);
            expect(error).toBeUndefined();
        });

        it('should accept selectedAddons', () => {
            const input = {
                menuItemId: 'abc',
                selectedAddons: [
                    { name: 'Extra Cheese', price: 1.5 },
                    { name: 'Bacon', price: 2 }
                ]
            };
            const { error } = orderItemSchema.validate(input);
            expect(error).toBeUndefined();
        });
    });

    // ── orderPlacementSchema ─────────────────────────────────────────────────

    describe('orderPlacementSchema', () => {
        it('should accept a valid order placement', () => {
            const input = {
                items: [
                    { menuItemId: 'item1', quantity: 1 },
                    { menuItemId: 'item2', quantity: 2 }
                ]
            };
            const { error } = orderPlacementSchema.validate(input);
            expect(error).toBeUndefined();
        });

        it('should reject empty items array', () => {
            const input = { items: [] };
            const { error } = orderPlacementSchema.validate(input);
            expect(error).toBeDefined();
        });

        it('should reject when items is missing', () => {
            const input = {};
            const { error } = orderPlacementSchema.validate(input);
            expect(error).toBeDefined();
        });

        it('should reject items with invalid entries', () => {
            const input = {
                items: [{ quantity: 1 }] // missing menuItemId
            };
            const { error } = orderPlacementSchema.validate(input);
            expect(error).toBeDefined();
        });
    });
});
