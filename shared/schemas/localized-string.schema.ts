import { z } from 'zod';

// Array-based localized field: lang is an app language code ('es' | 'en' | 'fr')
// aligned with the restaurant's enabled_languages.
export const LocalizedEntrySchema = z.object({
  lang: z.string(),
  value: z.string().default(''),
});

export const LocalizedFieldSchema = z.array(LocalizedEntrySchema).default([]);
