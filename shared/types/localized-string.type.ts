import { z } from 'zod';
import { LocalizedEntrySchema, LocalizedFieldSchema } from '../schemas/localized-string.schema';

// Array-based localized field types
export type LocalizedEntry = z.infer<typeof LocalizedEntrySchema>;
export type LocalizedField = z.infer<typeof LocalizedFieldSchema>;
