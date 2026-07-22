import { z } from 'zod';
import { HttpUrlSchema, ImageUrlSchema } from './image.schema';

export const SocialLinksSchema = z.object({
  facebook_url: HttpUrlSchema.optional(),
  instagram_url: HttpUrlSchema.optional(),
});

export const RestaurantSchema = z.object({
  restaurant_name: z.string().trim().min(2).max(120),
  restaurant_url: HttpUrlSchema.optional(),
  logo_image_url: ImageUrlSchema.optional(),
  social_links: SocialLinksSchema.optional(),
  tax_rate: z.number().min(0).max(100),
  tips_state: z.boolean().default(false),
  tips_type: z.enum(['MANDATORY', 'VOLUNTARY']).optional(),
  tips_rate: z.number().min(0).max(100).optional(),
  default_language: z.enum(['es', 'en', 'fr']).default('es'),
  default_theme: z.enum(['light', 'dark']).default('light'),
  // Languages enabled for this restaurant's interface. Aligned with the
  // Mongoose model and the PATCH /settings allowlist so PATCH /me (which
  // validates against this schema with .strict()) can update it too.
  enabled_languages: z.array(z.enum(['es', 'en', 'fr'])).min(1).max(3)
    .refine((languages) => new Set(languages).size === languages.length, 'Languages must be unique')
    .optional(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/).default('EUR'),
  order_interval_minutes: z.number().int().min(0).default(0),
  max_orders_per_session: z.number().int().min(0).default(0),
});

