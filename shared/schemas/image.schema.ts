import { z } from 'zod';

export const UploadsImagePathSchema = z.string().regex(
  /^\/uploads\/(dishes|categories|restaurants)\/[A-Za-z0-9][A-Za-z0-9_-]*\.(webp|png|jpe?g)$/i,
  'Invalid image path'
);

export const HttpUrlSchema = z.string().url().refine((value) => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}, 'URL must use HTTP or HTTPS');

export const ImageUrlSchema = z.union([HttpUrlSchema, UploadsImagePathSchema]);
