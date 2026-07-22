import { z } from 'zod';
import { LocalizedFieldSchema, LocalizedNameSchema } from './localized-string.schema';
import { ImageUrlSchema } from './image.schema';

// Menu prices may be zero for complimentary dishes, variants, and extras.
const priceValidation = z.number().min(0).max(999999);

export const VariantSchema = z.object({
  variant_id: z.string().optional(),
  variant_name: LocalizedNameSchema,
  variant_description: LocalizedFieldSchema.optional(),
  variant_url_image: ImageUrlSchema.optional(),
  variant_price: priceValidation,
});

export const ExtraSchema = z.object({
  extra_id: z.string().optional(),
  extra_name: LocalizedNameSchema,
  extra_description: LocalizedFieldSchema.optional(),
  extra_price: priceValidation,
  extra_url_image: ImageUrlSchema.optional(),
});

export const CategorySchema = z.object({
  restaurant_id: z.string(),
  category_name: LocalizedNameSchema,
  category_order: z.number().int().min(0).default(0),
  category_description: LocalizedFieldSchema.optional(),
  category_image_url: ImageUrlSchema.optional(),
  unlimited_orders: z.boolean().default(false),
});

export const DishSchema = z.object({
  restaurant_id: z.string(),
  category_id: z.string(),
  disher_name: LocalizedNameSchema,
  disher_description: LocalizedFieldSchema.optional(),
  disher_url_image: ImageUrlSchema.optional(),
  disher_status: z.enum(['ACTIVATED', 'DESACTIVATED']).default('ACTIVATED'),
  disher_price: priceValidation,
  disher_type: z.enum(['KITCHEN', 'SERVICE']),
  disher_alergens: z.array(z.string()).default([]),
  disher_variant: z.boolean().default(false),
  variants: z.array(VariantSchema).default([]),
  extras: z.array(ExtraSchema).default([]),
});

// API validation schemas shared with the backend.
export const CreateDishSchema = DishSchema.strict();
export const UpdateDishSchema = CreateDishSchema.partial().strict();

// Re-export price validation schemas.
export const PriceValidationSchema = priceValidation;

