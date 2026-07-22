import { z } from 'zod';

export const UploadsImagePathSchema = z.string().regex(
  /^\/uploads\/(dishes|categories|restaurants)\/[A-Za-z0-9][A-Za-z0-9_-]*\.(webp|png|jpe?g)$/i,
  'Invalid image path'
);

export const ImageUrlSchema = z.union([z.string().url(), UploadsImagePathSchema]);
