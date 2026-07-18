import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ErrorCode } from '@disherio/shared';
import { asyncHandler, createError } from '../utils/async-handler';
import * as ImageService from '../services/image.service';
import * as DishService from '../services/dish.service';
import {
  validateFileSecurity,
  SECURITY_LIMITS,
  isAllowedExtension,
  isAllowedMimeType,
  hasDoubleExtension,
  isDangerousFile,
  hasMimeExtensionMismatch,
} from '../utils/file-security';

// Filter for only allow specific image types with enhanced security
const fileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const errors: string[] = [];

  // Validate it's not a dangerous file
  if (isDangerousFile(file.originalname)) {
    errors.push('DANGEROUS_FILE_TYPE');
  }

  // Validate extension
  if (!isAllowedExtension(file.originalname)) {
    errors.push('INVALID_EXTENSION');
  }

  // Validate double extension (e.g., file.jpg.php)
  if (hasDoubleExtension(file.originalname)) {
    errors.push('DOUBLE_EXTENSION_NOT_ALLOWED');
  }

  // Validate MIME type
  if (!isAllowedMimeType(file.mimetype)) {
    errors.push('INVALID_MIME_TYPE');
  }

  // Validate extension and MIME match (prevent MIME spoofing)
  if (hasMimeExtensionMismatch(file.originalname, file.mimetype)) {
    errors.push('MIME_EXTENSION_MISMATCH');
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(', ')) as any;
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }

  cb(null, true);
};

const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: SECURITY_LIMITS.MAX_FILE_SIZE, // 5MB
    files: SECURITY_LIMITS.MAX_FILES_PER_REQUEST, // Only 1 file per request
  }
});

// Performs content and dimension checks after Multer accepts the upload.
const validateImageFile = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.file) {
    throw createError.badRequest(ErrorCode.NO_FILE_UPLOADED);
  }

  // Complete security validation
  const validation = validateFileSecurity(req.file);

  if (!validation.valid) {
    const error = createError.badRequest(ErrorCode.INVALID_FILE);
    (error as any).details = validation.errors;
    throw error;
  }

  // Validate image dimensions using the service
  const dimensionValidation = await ImageService.validateImageDimensions(
    req.file.buffer,
    SECURITY_LIMITS.MAX_WIDTH,
    SECURITY_LIMITS.MAX_HEIGHT
  );

  if (!dimensionValidation.valid) {
    throw createError.badRequest(ErrorCode.INVALID_IMAGE_DIMENSIONS);
  }

  next();
});

export const uploadDishImage = [
  validateImageFile,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Verify the dish belongs to the caller's restaurant before saving
    // the upload, preventing cross-tenant image association (IDOR).
    const dish = await DishService.getDishById(String(req.params.id));
    if (!dish) {
      throw createError.notFound('DISH_NOT_FOUND');
    }
    if (dish.restaurant_id.toString() !== req.user!.restaurantId) {
      throw createError.forbidden('FORBIDDEN');
    }
    const publicUrl = await ImageService.processAndSaveImage(req.file!, 'dishes');
    res.status(201).json({ url: publicUrl });
  })
];

export const uploadCategoryImage = [
  validateImageFile,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Verify the category belongs to the caller's restaurant before saving.
    const category = await DishService.getCategoryByIdForRestaurant(
      String(req.params.id),
      req.user!.restaurantId
    );
    if (!category) {
      throw createError.notFound('CATEGORY_NOT_FOUND');
    }
    const publicUrl = await ImageService.processAndSaveImage(req.file!, 'categories');
    res.status(201).json({ url: publicUrl });
  })
];

export const uploadRestaurantLogo = [
  validateImageFile,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // The logo is scoped to the caller's own restaurant; no :id param needed.
    const publicUrl = await ImageService.processAndSaveImage(req.file!, 'restaurants');
    res.status(201).json({ url: publicUrl });
  })
];

/**
 * Middleware to handle multer errors
 */
export const handleMulterError = (err: any, _req: Request, _res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const error = createError.badRequest('FILE_TOO_LARGE');
      (error as any).maxSize = SECURITY_LIMITS.MAX_FILE_SIZE;
      return next(error);
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(createError.badRequest(ErrorCode.UNEXPECTED_FIELD));
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return next(createError.badRequest(ErrorCode.TOO_MANY_FILES));
    }
    return next(createError.badRequest(ErrorCode.UPLOAD_ERROR));
  }

  if (err) {
    if (err.code === 'INVALID_FILE_TYPE' || err.message?.includes('INVALID')) {
      return next(createError.badRequest('INVALID_FILE_TYPE'));
    }
    return next(err);
  }

  next();
};
