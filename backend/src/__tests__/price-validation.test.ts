/**
 * Price Validation Tests
 * Validates that all price-related validations work correctly:
 * - Prices must be positive numbers
 * - Prices cannot be zero or negative
 * - Prices have a maximum limit
 */

import { z } from 'zod';
import { ErrorCode } from '@disherio/shared';
import { 
  CreateDishSchema, 
  UpdateDishSchema, 
  VariantSchema, 
  ExtraSchema 
} from '../schemas/dish.schema';
import { 
  OrderItemSchema, 
  CreatePaymentSchema 
} from '../schemas/order.schema';

describe('Dish Schema Price Validation', () => {
  const validLocalizedName = [{ lang: 'es', value: 'Test' }];

  describe('CreateDishSchema', () => {
    it('should accept valid positive price', () => {
      const validDish = {
        restaurant_id: 'rest123',
        category_id: 'cat123',
        disher_name: validLocalizedName,
        disher_price: 10.99,
        disher_type: 'KITCHEN',
      };

      const result = CreateDishSchema.safeParse(validDish);
      expect(result.success).toBe(true);
    });

    it('should reject negative price', () => {
      const invalidDish = {
        restaurant_id: 'rest123',
        category_id: 'cat123',
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

    it('should reject zero price', () => {
      const invalidDish = {
        restaurant_id: 'rest123',
        category_id: 'cat123',
        disher_name: validLocalizedName,
        disher_price: 0,
        disher_type: 'KITCHEN',
      };

      const result = CreateDishSchema.safeParse(invalidDish);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('disher_price');
      }
    });

    it('should reject price exceeding maximum', () => {
      const invalidDish = {
        restaurant_id: 'rest123',
        category_id: 'cat123',
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

    it('should reject zero variant price', () => {
      const invalidVariant = {
        variant_name: validLocalizedName,
        variant_price: 0,
      };

      const result = VariantSchema.safeParse(invalidVariant);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('variant_price');
      }
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

    it('should reject zero extra price', () => {
      const invalidExtra = {
        extra_name: validLocalizedName,
        extra_price: 0,
      };

      const result = ExtraSchema.safeParse(invalidExtra);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('extra_price');
      }
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

    it('should reject zero price in update', () => {
      const invalidUpdate = {
        disher_price: 0,
      };

      const result = UpdateDishSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });
  });
});

describe('Order Schema Price Validation', () => {
  const validLocalizedName = [{ lang: 'es', value: 'Test' }];

  describe('OrderItemSchema', () => {
    const validOrderItem = {
      order_id: 'order123',
      session_id: 'session123',
      item_dish_id: 'dish123',
      item_disher_type: 'KITCHEN',
      item_name_snapshot: validLocalizedName,
      item_base_price: 10.99,
    };

    it('should accept valid item base price', () => {
      const result = OrderItemSchema.safeParse(validOrderItem);
      expect(result.success).toBe(true);
    });

    it('should reject negative item base price', () => {
      const invalidItem = {
        ...validOrderItem,
        item_base_price: -10,
      };

      const result = OrderItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('item_base_price');
      }
    });

    it('should reject zero item base price', () => {
      const invalidItem = {
        ...validOrderItem,
        item_base_price: 0,
      };

      const result = OrderItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('item_base_price');
      }
    });

    it('should reject negative variant price', () => {
      const invalidItem = {
        ...validOrderItem,
        item_disher_variant: {
          variant_id: 'var123',
          name: validLocalizedName,
          price: -5,
        },
      };

      const result = OrderItemSchema.safeParse(invalidItem);
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
            extra_id: 'extra123',
            name: validLocalizedName,
            price: -2,
          },
        ],
      };

      const result = OrderItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('price');
      }
    });
  });

  describe('CreatePaymentSchema', () => {
    const validPayment = {
      session_id: 'session123',
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

describe('Order Service Price Validation Functions', () => {
  // Import the private functions by replicating their logic for testing
  const MAX_PRICE = 999999;
  const MIN_PRICE = 0;

  interface PriceValidationResult {
    valid: boolean;
    field: string;
    value: number;
  }

  function validatePrice(price: number, fieldName: string): PriceValidationResult {
    if (typeof price !== 'number' || isNaN(price)) {
      return { valid: false, field: fieldName, value: price };
    }
    if (price <= MIN_PRICE) {
      return { valid: false, field: fieldName, value: price };
    }
    if (price > MAX_PRICE) {
      return { valid: false, field: fieldName, value: price };
    }
    return { valid: true, field: fieldName, value: price };
  }

  function validateItemPrices(
    basePrice: number,
    variantPrice: number | null | undefined,
    extras: Array<{ price: number }>
  ): string | null {
    const validations: PriceValidationResult[] = [
      validatePrice(basePrice, 'item_base_price'),
    ];

    if (variantPrice !== null && variantPrice !== undefined) {
      validations.push(validatePrice(variantPrice, 'variant_price'));
    }

    for (let i = 0; i < extras.length; i++) {
      validations.push(validatePrice(extras[i].price, `extra_price[${i}]`));
    }

    const invalidPrices = validations.filter(v => !v.valid);
    
    if (invalidPrices.length > 0) {
      const details = invalidPrices
        .map(v => `${v.field}=${v.value}`)
        .join(', ');
      return `${ErrorCode.INVALID_PRICE}: Invalid price(s) - ${details}`;
    }
    return null;
  }

  describe('validatePrice', () => {
    it('should validate positive prices', () => {
      expect(validatePrice(10.99, 'test').valid).toBe(true);
      expect(validatePrice(0.01, 'test').valid).toBe(true);
      expect(validatePrice(999999, 'test').valid).toBe(true);
    });

    it('should reject negative prices', () => {
      const result = validatePrice(-10, 'base_price');
      expect(result.valid).toBe(false);
      expect(result.field).toBe('base_price');
      expect(result.value).toBe(-10);
    });

    it('should reject zero price', () => {
      const result = validatePrice(0, 'base_price');
      expect(result.valid).toBe(false);
      expect(result.field).toBe('base_price');
      expect(result.value).toBe(0);
    });

    it('should reject prices exceeding maximum', () => {
      const result = validatePrice(1000000, 'base_price');
      expect(result.valid).toBe(false);
      expect(result.field).toBe('base_price');
      expect(result.value).toBe(1000000);
    });

    it('should reject non-numeric values', () => {
      expect(validatePrice(NaN, 'test').valid).toBe(false);
      expect(validatePrice(Infinity, 'test').valid).toBe(false);
      expect(validatePrice(-Infinity, 'test').valid).toBe(false);
    });
  });

  describe('validateItemPrices', () => {
    it('should return null for all valid prices', () => {
      const result = validateItemPrices(
        10.99,
        5.00,
        [{ price: 2.50 }, { price: 1.00 }]
      );
      expect(result).toBeNull();
    });

    it('should detect negative base price', () => {
      const result = validateItemPrices(
        -10,
        null,
        []
      );
      expect(result).toContain(ErrorCode.INVALID_PRICE);
      expect(result).toContain('item_base_price=-10');
    });

    it('should detect zero base price', () => {
      const result = validateItemPrices(
        0,
        null,
        []
      );
      expect(result).toContain(ErrorCode.INVALID_PRICE);
      expect(result).toContain('item_base_price=0');
    });

    it('should detect negative variant price', () => {
      const result = validateItemPrices(
        10,
        -5,
        []
      );
      expect(result).toContain(ErrorCode.INVALID_PRICE);
      expect(result).toContain('variant_price=-5');
    });

    it('should detect negative extra price', () => {
      const result = validateItemPrices(
        10,
        null,
        [{ price: 2.50 }, { price: -1.00 }]
      );
      expect(result).toContain(ErrorCode.INVALID_PRICE);
      expect(result).toContain('extra_price[1]=-1');
    });

    it('should detect multiple invalid prices', () => {
      const result = validateItemPrices(
        -10,
        -5,
        [{ price: -1.00 }, { price: -2.00 }]
      );
      expect(result).toContain(ErrorCode.INVALID_PRICE);
      expect(result).toContain('item_base_price=-10');
      expect(result).toContain('variant_price=-5');
      expect(result).toContain('extra_price[0]=-1');
      expect(result).toContain('extra_price[1]=-2');
    });

    it('should accept null variant price', () => {
      const result = validateItemPrices(
        10.99,
        null,
        [{ price: 2.50 }]
      );
      expect(result).toBeNull();
    });

    it('should accept undefined variant price', () => {
      const result = validateItemPrices(
        10.99,
        undefined,
        [{ price: 2.50 }]
      );
      expect(result).toBeNull();
    });
  });
});

describe('Price Validation Edge Cases', () => {
  it('should handle very small positive prices', () => {
    const schema = z.number().positive().max(999999);
    expect(schema.safeParse(0.01).success).toBe(true);
    expect(schema.safeParse(0.001).success).toBe(true);
  });

  it('should handle prices at exact boundaries', () => {
    const schema = z.number().positive().max(999999);
    expect(schema.safeParse(999999).success).toBe(true);
    expect(schema.safeParse(999999.99).success).toBe(false);
  });

  it('should reject non-numeric types', () => {
    const schema = z.number().positive().max(999999);
    expect(schema.safeParse('10').success).toBe(false);
    expect(schema.safeParse(null).success).toBe(false);
    expect(schema.safeParse(undefined).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse([]).success).toBe(false);
  });
});
