import { z } from 'zod';

// Array-based localized field: lang is an app language code ('es' | 'en' | 'fr')
// aligned with the restaurant's enabled_languages.
export const LocalizedEntrySchema = z.object({
  lang: z.string().refine((lang) => ['es', 'en', 'fr'].includes(lang), 'Invalid language'),
  value: z.string().max(1000).default(''),
});

export const LocalizedFieldSchema = z.array(LocalizedEntrySchema)
  .max(3)
  .refine(
    (entries) => new Set(entries.map((entry) => entry.lang)).size === entries.length,
    'Languages must be unique'
  )
  .default([]);

export const LocalizedNameSchema = LocalizedFieldSchema.refine(
  (entries) => entries.some((entry) => entry.value.trim().length > 0),
  'At least one localized name is required'
);
