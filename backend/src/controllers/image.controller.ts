import { Request, Response } from 'express';
import multer from 'multer';
import { asyncHandler, createError } from '../utils/async-handler';
import * as ImageService from '../services/image.service';

// Filter for only allow specific image types
const fileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  // Also validate file extension as additional security
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const fileExtension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));

  if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('INVALID_FILE_TYPE'), false);
  }
};

const storage = multer.memoryStorage();
export const uploadMiddleware = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // Max 10MB
});

export const uploadDishImage = asyncHandler(async (req: Request, res: Response): Promise<void => {
  if (!req.file) {
    throw createError.badRequest('NO_FILE_UPLOADED');
  }
  const publicUrl = await ImageService.processAndSaveImage(req.file, 'dishes');
  res.status(201).json({ url: publicUrl });
});

export const uploadCategoryImage = asyncHandler(async (req: Request, res: Response): Promise<void => {
  if (!req.file) {
    throw createError.badRequest('NO_FILE_UPLOADED');
  }
  const publicUrl = await ImageService.processAndSaveImage(req.file, 'categories');
  res.status(201).json({ url: publicUrl });
});

export const uploadRestaurantLogo = asyncHandler(async (req: Request, res: Response): Promise<void => {
  if (!req.file) {
    throw createError.badRequest('NO_FILE_UPLOADED');
  }
  const publicUrl = await ImageService.processAndSaveImage(req.file, 'restaurants');
  res.status(201).json({ url: publicUrl });
});
