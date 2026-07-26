import { describe, it, expect } from 'vitest';
import {
  DishSchema,
  CreateDishSchema,
  UpdateDishSchema,
  VariantSchema,
  ExtraSchema,
  CategorySchema,
  CreateCategorySchema,
  AllergenSchema,
  PriceValidationSchema,
} from '../schemas/dish.schema';

const name = [{ lang: 'es', value: 'Plato' }];

const validDish = {
  restaurant_id: 'r1',
  category_id: 'c1',
  disher_name: name,
  disher_price: 10,
  disher_type: 'KITCHEN' as const,
};

describe('PriceValidationSchema', () => {
  it('accepts zero (complimentary items) and rejects negatives / huge values', () => {
    expect(PriceValidationSchema.safeParse(0).success).toBe(true);
    expect(PriceValidationSchema.safeParse(-0.01).success).toBe(false);
    expect(PriceValidationSchema.safeParse(999999).success).toBe(true);
    expect(PriceValidationSchema.safeParse(1000000).success).toBe(false);
  });
});

describe('DishSchema', () => {
  it('applies defaults on a minimal valid dish', () => {
    const result = DishSchema.safeParse(validDish);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      disher_status: 'ACTIVATED',
      disher_alergens: [],
      disher_variant: false,
      variants: [],
      extras: [],
    });
  });

  it('rejects invalid status/type and negative price', () => {
    expect(DishSchema.safeParse({ ...validDish, disher_status: 'ACTIVE' }).success).toBe(false);
    expect(DishSchema.safeParse({ ...validDish, disher_type: 'BAR' }).success).toBe(false);
    expect(DishSchema.safeParse({ ...validDish, disher_price: -1 }).success).toBe(false);
  });

  it('validates disher_url_image as URL when present', () => {
    expect(DishSchema.safeParse({ ...validDish, disher_url_image: 'not-a-url' }).success).toBe(
      false
    );
    expect(
      DishSchema.safeParse({ ...validDish, disher_url_image: 'https://example.com/x.png' }).success
    ).toBe(true);
  });
});

describe('CreateDishSchema / UpdateDishSchema', () => {
  it('CreateDishSchema is .strict(): rejects unknown keys', () => {
    expect(CreateDishSchema.safeParse(validDish).success).toBe(true);
    expect(CreateDishSchema.safeParse({ ...validDish, unexpected: 1 }).success).toBe(false);
  });

  it('UpdateDishSchema is partial and .strict()', () => {
    expect(UpdateDishSchema.safeParse({}).success).toBe(true);
    expect(UpdateDishSchema.safeParse({ disher_price: 5 }).success).toBe(true);
    expect(UpdateDishSchema.safeParse({ unexpected: 1 }).success).toBe(false);
  });
});

describe('VariantSchema / ExtraSchema', () => {
  it('requires a price and localized name', () => {
    expect(VariantSchema.safeParse({ variant_name: name, variant_price: 2 }).success).toBe(true);
    expect(VariantSchema.safeParse({ variant_name: name }).success).toBe(false);
    expect(ExtraSchema.safeParse({ extra_name: name, extra_price: 0 }).success).toBe(true);
    expect(ExtraSchema.safeParse({ extra_name: name, extra_price: -1 }).success).toBe(false);
  });
});

describe('CategorySchema', () => {
  it('defaults category_order and unlimited_orders', () => {
    const result = CategorySchema.safeParse({ restaurant_id: 'r1', category_name: name });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ category_order: 0, unlimited_orders: false });
  });

  it('CreateCategorySchema is .strict()', () => {
    expect(
      CreateCategorySchema.safeParse({ restaurant_id: 'r1', category_name: name, extra: 1 })
        .success
    ).toBe(false);
  });
});

describe('AllergenSchema', () => {
  // Current behavior: the field is spelled `alergen_name` (sic) in both the
  // schema and the rest of the contract. Pinned as-is.
  it('uses the historical `alergen_name` spelling', () => {
    expect(AllergenSchema.safeParse({ alergen_name: name }).success).toBe(true);
  });

  // Current behavior: because LocalizedFieldSchema has .default([]),
  // `alergen_name` is effectively optional and the schema is not .strict(),
  // so the correctly-spelled key is silently stripped instead of rejected.
  it('silently strips the correctly-spelled `allergen_name` key', () => {
    const result = AllergenSchema.safeParse({ allergen_name: name });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ alergen_name: [] });
  });
});
