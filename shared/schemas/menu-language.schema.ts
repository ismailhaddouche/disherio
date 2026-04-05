import { z } from 'zod';

export const MenuLanguageSchema = z.object({
  restaurant_id: z.string(),
  name: z.string().min(1).trim(),
  code: z.string().min(1).trim().toLowerCase(),
  is_default: z.boolean().default(false),
  linked_app_lang: z.enum(['es', 'en', 'fr']).nullable().default(null),
  order: z.number().default(0),
});

// Schema for creating a new menu language
export const CreateMenuLanguageSchema = MenuLanguageSchema.omit({ 
  is_default: true,
  order: true 
});

// Schema for updating a menu language (partial)
export const UpdateMenuLanguageSchema = MenuLanguageSchema.partial();

// Type exports
export type MenuLanguageInput = z.infer<typeof MenuLanguageSchema>;
export type CreateMenuLanguageInput = z.infer<typeof CreateMenuLanguageSchema>;
export type UpdateMenuLanguageInput = z.infer<typeof UpdateMenuLanguageSchema>;
