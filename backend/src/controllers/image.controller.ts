import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { asyncHandler, createError } from '../utils/async-handler';
import * as ImageService from '../services/image.service';
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

  // Validar que no sea archivo peligroso
  if (isDangerousFile(file.originalname)) {
    errors.push('DANGEROUS_FILE_TYPE');
  }

  // Validar extensión
  if (!isAllowedExtension(file.originalname)) {
    errors.push('INVALID_EXTENSION');
  }

  // Validar extensión doble (ej: file.jpg.php)
  if (hasDoubleExtension(file.originalname)) {
    errors.push('DOUBLE_EXTENSION_NOT_ALLOWED');
  }

  // Validar MIME type
  if (!isAllowedMimeType(file.mimetype)) {
    errors.push('INVALID_MIME_TYPE');
  }

  // Validar coincidencia entre extensión y MIME (prevenir MIME spoofing)
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
    files: SECURITY_LIMITS.MAX_FILES_PER_REQUEST, // Solo 1 archivo por request
  }
});

/**
 * Middleware de validación adicional después de multer
 * Valida que el archivo sea realmente una imagen válida usando sharp
 */
const validateImageFile = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.file) {
    throw createError.badRequest('NO_FILE_UPLOADED');
  }

  // Validación completa de seguridad
  const validation = validateFileSecurity(req.file);
  
  if (!validation.valid) {
    const error = createError.badRequest('INVALID_FILE');
    (error as any).details = validation.errors;
    throw error;
  }

  // Validar dimensiones de imagen usando el service
  const dimensionValidation = await ImageService.validateImageDimensions(
    req.file.buffer,
    SECURITY_LIMITS.MAX_WIDTH,
    SECURITY_LIMITS.MAX_HEIGHT
  );

  if (!dimensionValidation.valid) {
    throw createError.badRequest('INVALID_IMAGE_DIMENSIONS');
  }

  next();
});

export const uploadDishImage = [
  validateImageFile,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const publicUrl = await ImageService.processAndSaveImage(req.file!, 'dishes');
    res.status(201).json({ url: publicUrl });
  })
];

export const uploadCategoryImage = [
  validateImageFile,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const publicUrl = await ImageService.processAndSaveImage(req.file!, 'categories');
    res.status(201).json({ url: publicUrl });
  })
];

export const uploadRestaurantLogo = [
  validateImageFile,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const publicUrl = await ImageService.processAndSaveImage(req.file!, 'restaurants');
    res.status(201).json({ url: publicUrl });
  })
];

/**
 * Middleware para manejar errores de multer
 */
export const handleMulterError = (err: any, _req: Request, _res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const error = createError.badRequest('FILE_TOO_LARGE');
      (error as any).maxSize = SECURITY_LIMITS.MAX_FILE_SIZE;
      return next(error);
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(createError.badRequest('UNEXPECTED_FIELD'));
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return next(createError.badRequest('TOO_MANY_FILES'));
    }
    return next(createError.badRequest('UPLOAD_ERROR'));
  }
  
  if (err) {
    if (err.code === 'INVALID_FILE_TYPE' || err.message?.includes('INVALID')) {
      return next(createError.badRequest('INVALID_FILE_TYPE'));
    }
    return next(err);
  }
  
  next();
};
