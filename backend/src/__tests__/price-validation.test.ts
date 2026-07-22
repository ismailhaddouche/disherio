/**
 * Price Validation Tests
 * Validates that all price-related validations work correctly:
 * - Menu item prices may be zero but cannot be negative
 * - Payment amounts must remain positive
 * - Prices have a maximum limit
 */

import {
  CreateDishSchema,
  UpdateDishSchema,
  VariantSchema,
  ExtraSchema,
  PriceValidationSchema,
} from '../schemas/dish.schema';
import {
  ItemOrderSchema,
  CreatePaymentSchema
} from '../schemas/order.schema';

describe('Dish Schema Price Validation', () => {
  const validLocalizedName = [{ lang: 'es', value: 'Test' }];
  const restaurantId = '507f1f77bcf86cd799439011';
  const categoryId = '507f1f77bcf86cd799439012';

  describe('CreateDishSchema', () => {
    it('should accept valid positive price', () => {
      const validDish = {
        restaurant_id: restaurantId,
        category_id: categoryId,
        disher_name: validLocalizedName,
        disher_price: 10.99,
        disher_type: 'KITCHEN',
      };

      const result = CreateDishSchema.safeParse(validDish);
      expect(result.success).toBe(true);
    });

    it('should reject negative price', () => {
      const invalidDish = {
        restaurant_id: restaurantId,
        category_id: categoryId,
        disher_name: validLocalizedName,
        disher_price: -10,
        disher_type: 'KITCHEN',
      };

      const result = CreateDishSchema.safeParse(invalidDish);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('disher_price');
      }
    });

    it('should accept a complimentary dish with zero price', () => {
      const complimentaryDish = {
        restaurant_id: restaurantId,
        category_id: categoryId,
        disher_name: validLocalizedName,
        disher_price: 0,
        disher_type: 'KITCHEN',
      };

      const result = CreateDishSchema.safeParse(complimentaryDish);
      expect(result.success).toBe(true);
    });

    it('should reject price exceeding maximum', () => {
      const invalidDish = {
        restaurant_id: restaurantId,
        category_id: categoryId,
        disher_name: validLocalizedName,
        disher_price: 1000000, // Exceeds 999999
        disher_type: 'KITCHEN',
      };

      const result = CreateDishSchema.safeParse(invalidDish);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('disher_price');
      }
    });
  });

  describe('VariantSchema', () => {
    it('should accept valid variant price', () => {
      const validVariant = {
        variant_name: validLocalizedName,
        variant_price: 5.99,
      };

      const result = VariantSchema.safeParse(validVariant);
      expect(result.success).toBe(true);
    });

    it('should reject negative variant price', () => {
      const invalidVariant = {
        variant_name: validLocalizedName,
        variant_price: -5,
      };

      const result = VariantSchema.safeParse(invalidVariant);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('variant_price');
      }
    });

    it('should accept a zero-price variant', () => {
      const freeVariant = {
        variant_name: validLocalizedName,
        variant_price: 0,
      };

      const result = VariantSchema.safeParse(freeVariant);
      expect(result.success).toBe(true);
    });
  });

  describe('ExtraSchema', () => {
    it('should accept valid extra price', () => {
      const validExtra = {
        extra_name: validLocalizedName,
        extra_price: 2.50,
      };

      const result = ExtraSchema.safeParse(validExtra);
      expect(result.success).toBe(true);
    });

    it('should reject negative extra price', () => {
      const invalidExtra = {
        extra_name: validLocalizedName,
        extra_price: -1,
      };

      const result = ExtraSchema.safeParse(invalidExtra);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('extra_price');
      }
    });

    it('should accept a free extra', () => {
      const freeExtra = {
        extra_name: validLocalizedName,
        extra_price: 0,
      };

      const result = ExtraSchema.safeParse(freeExtra);
      expect(result.success).toBe(true);
    });
  });

  describe('UpdateDishSchema', () => {
    it('should accept valid price in update', () => {
      const validUpdate = {
        disher_price: 15.99,
      };

      const result = UpdateDishSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it('should reject negative price in update', () => {
      const invalidUpdate = {
        disher_price: -5,
      };

      const result = UpdateDishSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });

    it('should accept zero price in update', () => {
      const complimentaryUpdate = {
        disher_price: 0,
      };

      const result = UpdateDishSchema.safeParse(complimentaryUpdate);
      expect(result.success).toBe(true);
    });
  });
});

describe('Order Schema Price Validation', () => {
  const validLocalizedName = [{ lang: 'es', value: 'Test' }];

  describe('ItemOrderSchema', () => {
    const validOrderItem = {
      order_id: '507f1f77bcf86cd799439021',
      session_id: '507f1f77bcf86cd799439022',
      item_dish_id: '507f1f77bcf86cd799439023',
      item_disher_type: 'KITCHEN',
      item_name_snapshot: validLocalizedName,
      item_base_price: 10.99,
    };

    it('should accept valid item base price', () => {
      const result = ItemOrderSchema.safeParse(validOrderItem);
      expect(result.success).toBe(true);
    });

    it('should reject negative item base price', () => {
      const invalidItem = {
        ...validOrderItem,
        item_base_price: -10,
      };

      const result = ItemOrderSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('item_base_price');
      }
    });

    it('should accept a zero item base price', () => {
      const complimentaryItem = {
        ...validOrderItem,
        item_base_price: 0,
      };

      const result = ItemOrderSchema.safeParse(complimentaryItem);
      expect(result.success).toBe(true);
    });

    it('should reject negative variant price', () => {
      const invalidItem = {
        ...validOrderItem,
        item_disher_variant: {
          variant_id: '507f1f77bcf86cd799439024',
          name: validLocalizedName,
          price: -5,
        },
      };

      const result = ItemOrderSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('price');
      }
    });

    it('should reject negative extra price', () => {
      const invalidItem = {
        ...validOrderItem,
        item_disher_extras: [
          {
            extra_id: '507f1f77bcf86cd799439025',
            name: validLocalizedName,
            price: -2,
          },
        ],
      };

      const result = ItemOrderSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('price');
      }
    });
  });

  describe('CreatePaymentSchema', () => {
    const validPayment = {
      session_id: '507f1f77bcf86cd799439026',
      payment_type: 'ALL',
      payment_total: 50.00,
      tickets: [
        {
          ticket_part: 1,
          ticket_total_parts: 1,
          ticket_amount: 50.00,
          paid: false,
        },
      ],
    };

    it('should accept valid payment total', () => {
      const result = CreatePaymentSchema.safeParse(validPayment);
      expect(result.success).toBe(true);
    });

    it('should reject negative payment total', () => {
      const invalidPayment = {
        ...validPayment,
        payment_total: -50,
      };

      const result = CreatePaymentSchema.safeParse(invalidPayment);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('payment_total');
      }
    });

    it('should reject zero payment total', () => {
      const invalidPayment = {
        ...validPayment,
        payment_total: 0,
      };

      const result = CreatePaymentSchema.safeParse(invalidPayment);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('payment_total');
      }
    });

    it('should reject negative ticket amount', () => {
      const invalidPayment = {
        ...validPayment,
        tickets: [
          {
            ticket_part: 1,
            ticket_total_parts: 1,
            ticket_amount: -25,
            paid: false,
          },
        ],
      };

      const result = CreatePaymentSchema.safeParse(invalidPayment);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('ticket_amount');
      }
    });

    it('should reject zero ticket amount', () => {
      const invalidPayment = {
        ...validPayment,
        tickets: [
          {
            ticket_part: 1,
            ticket_total_parts: 1,
            ticket_amount: 0,
            paid: false,
          },
        ],
      };

      const result = CreatePaymentSchema.safeParse(invalidPayment);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('ticket_amount');
      }
    });
  });
});

describe('Price Validation Edge Cases', () => {
  it('should handle very small positive prices', () => {
    const schema = PriceValidationSchema;
    expect(schema.safeParse(0.01).success).toBe(true);
    expect(schema.safeParse(0.001).success).toBe(true);
  });

  it('should handle prices at exact boundaries', () => {
    const schema = PriceValidationSchema;
    expect(schema.safeParse(999999).success).toBe(true);
    expect(schema.safeParse(999999.99).success).toBe(false);
  });

  it('should reject non-numeric types', () => {
    const schema = PriceValidationSchema;
    expect(schema.safeParse('10').success).toBe(false);
    expect(schema.safeParse(null).success).toBe(false);
    expect(schema.safeParse(undefined).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse([]).success).toBe(false);
  });
});
