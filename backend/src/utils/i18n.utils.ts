import { ILocalizedEntry } from '../models/dish.model';

export function normalizeLocalizedField(field: unknown): ILocalizedEntry[] {
  // If it's already an array, validate and return
  if (Array.isArray(field)) {
    return field.filter(item => item && typeof item === 'object' && item.lang);
  }

  // If it's an object (legacy format), convert to array
  if (field && typeof field === 'object' && !Array.isArray(field)) {
    return Object.entries(field).map(([lang, value]) => ({
      lang,
      value: String(value || '')
    }));
  }

  // Return empty array as fallback
  return [];
}
