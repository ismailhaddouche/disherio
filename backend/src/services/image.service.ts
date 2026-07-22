import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import {
  generateSecureFilename,
  getSecurePath,
  DimensionValidationResult,
  SECURITY_LIMITS,
  isPathInside,
} from '../utils/file-security';
import logger from '../config/logger';

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/uploads';

// Ensure directory exists (in local it might be different, but in Docker it's /app/uploads)
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export async function validateImageDimensions(
  buffer: Buffer,
  maxWidth: number = SECURITY_LIMITS.MAX_WIDTH,
  maxHeight: number = SECURITY_LIMITS.MAX_HEIGHT
): Promise<DimensionValidationResult> {
  try {
    const metadata = await sharp(buffer).metadata();

    if (!metadata.width || !metadata.height) {
      return {
        valid: false,
        error: 'Could not read image dimensions',
      };
    }

    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      return {
        valid: false,
        width: metadata.width,
        height: metadata.height,
        error: `Image dimensions (${metadata.width}x${metadata.height}) exceed maximum allowed (${maxWidth}x${maxHeight})`,
      };
    }

    // Verify that the upload contains a real image. Must match the allowed
    // extensions/MIME types in utils/file-security.ts (JPEG, PNG, WebP only).
    const validFormats = ['jpeg', 'jpg', 'png', 'webp'];
    if (!metadata.format || !validFormats.includes(metadata.format.toLowerCase())) {
      return {
        valid: false,
        error: 'Invalid or unsupported image format',
      };
    }

    return {
      valid: true,
      width: metadata.width,
      height: metadata.height,
    };
  } catch {
    return {
      valid: false,
      error: 'Invalid image file or corrupted data',
    };
  }
}

export async function processAndSaveImage(
  file: Express.Multer.File,
  folder: 'dishes' | 'restaurants' | 'categories',
  restaurantId: string
): Promise<string> {
  const normalizedRestaurantId = restaurantId.toLowerCase();
  if (!/^[a-f\d]{24}$/.test(normalizedRestaurantId)) {
    throw new Error('Invalid restaurant owner for image');
  }
  // The output encoder below always writes WebP bytes, so the public filename
  // must also end in .webp. Keeping the upload's original extension would make
  // static hosting advertise the wrong Content-Type (and `nosniff` clients can
  // legitimately reject the image).
  const secureFilename = `${normalizedRestaurantId}-${generateSecureFilename('converted.webp', true)}`;

  // Get safe path (path traversal protection)
  const fullPath = getSecurePath(UPLOADS_DIR, folder, secureFilename);

  // Ensure subfolder exists
  const subFolderDir = path.join(UPLOADS_DIR, folder);
  if (!fs.existsSync(subFolderDir)) {
    fs.mkdirSync(subFolderDir, { recursive: true });
  }

  // Validate it's a real image before processing
  const validation = await validateImageDimensions(file.buffer);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid image file');
  }

  // OPTIMIZATION: Resize, auto-orient, and convert to WebP
  // Also validate it's not a malicious file disguised as image
  try {
    await sharp(file.buffer, {
      // Security options to prevent denial of service attacks
      limitInputPixels: 4000 * 4000, // Maximum pixels
      sequentialRead: true, // Sequential read for large files
    })
      .rotate() // Respect EXIF orientation (mobile photos)
      .resize(1200, null, { withoutEnlargement: true }) // Max 1200px width
      .webp({ quality: 80 }) // Efficient format
      .toFile(fullPath);
  } catch {
    // If sharp fails, it's not a valid image
    throw new Error('Invalid image file or processing error');
  }

  // Generate public safe URL
  const publicPath = `/uploads/${folder}/${secureFilename}`;

  return publicPath;
}

export async function deleteImage(imagePath: string, restaurantId: string): Promise<boolean> {
  try {
    // Validate path has no path traversal
    if (imagePath.includes('..') || imagePath.includes('\\')) {
      throw new Error('Invalid image path');
    }

    // Extract filename and validate
    const filename = path.basename(imagePath);
    const folder = path.dirname(imagePath).replace('/uploads/', '').split('/')[0];
    const normalizedRestaurantId = restaurantId.toLowerCase();
    if (!/^[a-f\d]{24}$/.test(normalizedRestaurantId)) {
      throw new Error('Invalid restaurant owner for image');
    }

    // New uploads are tenant-prefixed. Legacy unowned files are deliberately
    // retained: deleting an orphan is safer than allowing one restaurant to
    // remove a file referenced by another tenant.
    if (!filename.toLowerCase().startsWith(`${normalizedRestaurantId}-`)) {
      logger.warn({ imagePath, restaurantId }, 'Refused to delete image owned by another tenant');
      return false;
    }

    // Validate it's an allowed folder
    const allowedFolders = ['dishes', 'categories', 'restaurants'];
    if (!allowedFolders.includes(folder)) {
      throw new Error('Invalid folder');
    }

    const fullPath = path.join(UPLOADS_DIR, folder, filename);

    // Verify it's within uploads directory
    const resolvedPath = path.resolve(fullPath);
    const resolvedUploadsDir = path.resolve(UPLOADS_DIR);

    if (!isPathInside(resolvedUploadsDir, resolvedPath)) {
      throw new Error('Path traversal detected');
    }

    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
      return true;
    }

    return false;
  } catch (error) {
    logger.error({ error, imagePath }, 'Error deleting image');
    return false;
  }
}
