/**
 * Image URL schema tests
 * The backend stores uploaded images as relative paths under /uploads/*
 * (served by Caddy), so dish/category image fields must accept those paths
 * while still rejecting null, traversal and arbitrary paths.
 */

import {
  CreateDishSchema,
  UpdateDishSchema,
  CategorySchema,
} from '../schemas/dish.schema';

const validLocalizedName = [{ lang: 'es', value: 'Test' }];

const validDish = {
  restaurant_id: '507f1f77bcf86cd799439011',
  category_id: '507f1f77bcf86cd799439012',
  disher_name: validLocalizedName,
  disher_price: 10.99,
  disher_type: 'KITCHEN',
};

const validCategory = {
  restaurant_id: '507f1f77bcf86cd799439011',
  category_name: validLocalizedName,
};

describe('Dish image URL validation', () => {
  it('should accept a relative /uploads path', () => {
    const result = CreateDishSchema.safeParse({
      ...validDish,
      disher_url_image: '/uploads/dishes/9b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e.webp',
    });
    expect(result.success).toBe(true);
  });

  it('should accept an absolute URL', () => {
    const result = CreateDishSchema.safeParse({
      ...validDish,
      disher_url_image: 'https://cdn.example.com/dishes/paella.webp',
    });
    expect(result.success).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'data:image/svg+xml,<svg></svg>',
    'file:///etc/passwd',
    'ftp://cdn.example.com/dish.webp',
  ])('should reject a non-HTTP absolute URL: %s', (disherUrlImage) => {
    const result = CreateDishSchema.safeParse({
      ...validDish,
      disher_url_image: disherUrlImage,
    });
    expect(result.success).toBe(false);
  });

  it('should reject null image URL', () => {
    const result = CreateDishSchema.safeParse({
      ...validDish,
      disher_url_image: null,
    });
    expect(result.success).toBe(false);
  });

  it('should reject path traversal', () => {
    const result = CreateDishSchema.safeParse({
      ...validDish,
      disher_url_image: '/uploads/dishes/../../etc/passwd',
    });
    expect(result.success).toBe(false);
  });

  it('should reject relative paths outside /uploads', () => {
    const result = CreateDishSchema.safeParse({
      ...validDish,
      disher_url_image: '/static/images/dish.webp',
    });
    expect(result.success).toBe(false);
  });

  it('should accept a relative /uploads path on update', () => {
    const result = UpdateDishSchema.safeParse({
      disher_url_image: '/uploads/dishes/abc123.webp',
    });
    expect(result.success).toBe(true);
  });
});

describe('Category image URL validation', () => {
  it('should accept a relative /uploads path', () => {
    const result = CategorySchema.safeParse({
      ...validCategory,
      category_image_url: '/uploads/categories/abc123.webp',
    });
    expect(result.success).toBe(true);
  });

  it('should reject null image URL', () => {
    const result = CategorySchema.safeParse({
      ...validCategory,
      category_image_url: null,
    });
    expect(result.success).toBe(false);
  });

  it('should accept a category without image (field omitted)', () => {
    const result = CategorySchema.safeParse(validCategory);
    expect(result.success).toBe(true);
  });
});
