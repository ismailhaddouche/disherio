import { z } from 'zod';
import { LocalizedFieldSchema } from './localized-string.schema';

// Price validation helper - positive number with max limit
const priceValidation = z.number().positive().max(999999);

export const VariantSchema = z.object({
  variant_id: z.string().optional(),
  variant_name: LocalizedFieldSchema,
  variant_description: LocalizedFieldSchema.optional(),
  variant_url_image: z.string().url().optional(),
  variant_price: priceValidation,
});

export const ExtraSchema = z.object({
  extra_id: z.string().optional(),
  extra_name: LocalizedFieldSchema,
  extra_description: LocalizedFieldSchema.optional(),
  extra_price: priceValidation,
  extra_url_image: z.string().url().optional(),
});

export const CategorySchema = z.object({
  restaurant_id: z.string(),
  category_name: LocalizedFieldSchema,
  category_order: z.number().int().min(0).default(0),
  category_description: LocalizedFieldSchema.optional(),
  category_image_url: z.string().url().optional(),
});

export const AllergenSchema = z.object({
  alergen_name: LocalizedFieldSchema,
});

export const DishSchema = z.object({
  restaurant_id: z.string(),
  category_id: z.string(),
  disher_name: LocalizedFieldSchema,
  disher_description: LocalizedFieldSchema.optional(),
  disher_url_image: z.string().url().optional(),
  disher_status: z.enum(['ACTIVATED', 'DESACTIVATED']).default('ACTIVATED'),
  disher_price: priceValidation,
  disher_type: z.enum(['KITCHEN', 'SERVICE']),
  disher_alergens: z.array(z.string()).default([]),
  disher_variant: z.boolean().default(false),
  variants: z.array(VariantSchema).default([]),
  extras: z.array(ExtraSchema).default([]),
});

// Schemas para validación de API (movidos desde backend)
export const CreateDishSchema = DishSchema;
export const UpdateDishSchema = CreateDishSchema.partial();

// Re-exportar esquemas de validación de precio
export const PriceValidationSchema = priceValidation;

// Type exports
export type CreateDishInput = z.infer<typeof CreateDishSchema>;
export type UpdateDishInput = z.infer<typeof UpdateDishSchema>;
export type VariantInput = z.infer<typeof VariantSchema>;
export type ExtraInput = z.infer<typeof ExtraSchema>;
