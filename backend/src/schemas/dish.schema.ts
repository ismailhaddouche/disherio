import { z } from 'zod';

// Price validation helper - positive number with max limit
const priceValidation = z.number().positive().max(999999);

// Schema for localized entries
const LocalizedEntrySchema = z.object({
  lang: z.string(),
  value: z.string().default(''),
});

// Schema for creating a variant
export const VariantSchema = z.object({
  variant_name: z.array(LocalizedEntrySchema),
  variant_description: z.array(LocalizedEntrySchema).optional(),
  variant_url_image: z.string().optional(),
  variant_price: priceValidation,
});

// Schema for creating an extra
export const ExtraSchema = z.object({
  extra_name: z.array(LocalizedEntrySchema),
  extra_description: z.array(LocalizedEntrySchema).optional(),
  extra_price: priceValidation,
  extra_url_image: z.string().optional(),
});

// Schema for creating a dish
export const CreateDishSchema = z.object({
  restaurant_id: z.string().min(1),
  category_id: z.string().min(1),
  disher_name: z.array(LocalizedEntrySchema),
  disher_description: z.array(LocalizedEntrySchema).optional(),
  disher_url_image: z.string().optional(),
  disher_status: z.enum(['ACTIVATED', 'DESACTIVATED']).default('ACTIVATED'),
  disher_price: priceValidation,
  disher_type: z.enum(['KITCHEN', 'SERVICE']),
  disher_alergens: z.array(z.string()).default([]),
  disher_variant: z.boolean().default(false),
  variants: z.array(VariantSchema).default([]),
  extras: z.array(ExtraSchema).default([]),
});

// Schema for updating a dish
export const UpdateDishSchema = z.object({
  category_id: z.string().min(1).optional(),
  disher_name: z.array(LocalizedEntrySchema).optional(),
  disher_description: z.array(LocalizedEntrySchema).optional(),
  disher_url_image: z.string().optional(),
  disher_status: z.enum(['ACTIVATED', 'DESACTIVATED']).optional(),
  disher_price: priceValidation.optional(),
  disher_type: z.enum(['KITCHEN', 'SERVICE']).optional(),
  disher_alergens: z.array(z.string()).optional(),
  disher_variant: z.boolean().optional(),
  variants: z.array(VariantSchema).optional(),
  extras: z.array(ExtraSchema).optional(),
});

// Type exports
export type CreateDishInput = z.infer<typeof CreateDishSchema>;
export type UpdateDishInput = z.infer<typeof UpdateDishSchema>;
export type VariantInput = z.infer<typeof VariantSchema>;
export type ExtraInput = z.infer<typeof ExtraSchema>;
