import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { 
  generateSecureFilename, 
  getSecurePath,
  DimensionValidationResult,
  SECURITY_LIMITS,
} from '../utils/file-security';
import logger from '../config/logger';

const UPLOADS_DIR = '/app/uploads';

// Ensure directory exists (in local it might be different, but in Docker it's /app/uploads)
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Valida las dimensiones de una imagen
 * @param buffer - Buffer de la imagen
 * @param maxWidth - Ancho máximo permitido
 * @param maxHeight - Alto máximo permitido
 * @returns Resultado de validación
 */
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

    // Validar que sea una imagen real (no un archivo disfrazado)
    const validFormats = ['jpeg', 'jpg', 'png', 'webp', 'gif'];
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
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid image file or corrupted data',
    };
  }
}

/**
 * Procesa y guarda una imagen de forma segura
 * @param file - Archivo de Express Multer
 * @param folder - Carpeta destino (dishes, restaurants, categories)
 * @returns URL pública de la imagen
 */
export async function processAndSaveImage(
  file: Express.Multer.File, 
  folder: 'dishes' | 'restaurants' | 'categories'
): Promise<string> {
  // Generar nombre de archivo seguro con UUID
  const secureFilename = generateSecureFilename(file.originalname, true);
  
  // Obtener ruta segura (protección contra path traversal)
  const fullPath = getSecurePath(UPLOADS_DIR, folder, secureFilename);

  // Ensure subfolder exists
  const subFolderDir = path.join(UPLOADS_DIR, folder);
  if (!fs.existsSync(subFolderDir)) {
    fs.mkdirSync(subFolderDir, { recursive: true });
  }

  // Validar que sea una imagen real antes de procesar
  const validation = await validateImageDimensions(file.buffer);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid image file');
  }

  // OPTIMIZATION: Resize, auto-orient, and convert to WebP
  // También validamos que no sea un archivo malicioso disfrazado de imagen
  try {
    await sharp(file.buffer, {
      // Opciones de seguridad para prevenir ataques de denegación de servicio
      limitInputPixels: 4000 * 4000, // Máximo de píxeles
      sequentialRead: true, // Lectura secuencial para archivos grandes
    })
      .rotate() // Respect EXIF orientation (mobile photos)
      .resize(1200, null, { withoutEnlargement: true }) // Max 1200px width
      .webp({ quality: 80 }) // Efficient format
      .toFile(fullPath);
  } catch (error) {
    // Si sharp falla, es porque no es una imagen válida
    throw new Error('Invalid image file or processing error');
  }

  // Generar URL pública segura
  const publicPath = `/uploads/${folder}/${secureFilename}`;
  
  return publicPath;
}

/**
 * Elimina una imagen del sistema de archivos
 * @param imagePath - Ruta relativa de la imagen
 * @returns true si se eliminó correctamente
 */
export async function deleteImage(imagePath: string): Promise<boolean> {
  try {
    // Validar que la ruta no contenga path traversal
    if (imagePath.includes('..') || imagePath.includes('\\')) {
      throw new Error('Invalid image path');
    }

    // Extraer el nombre de archivo y validar
    const filename = path.basename(imagePath);
    const folder = path.dirname(imagePath).replace('/uploads/', '').split('/')[0];

    // Validar que sea una carpeta permitida
    const allowedFolders = ['dishes', 'categories', 'restaurants'];
    if (!allowedFolders.includes(folder)) {
      throw new Error('Invalid folder');
    }

    const fullPath = path.join(UPLOADS_DIR, folder, filename);
    
    // Verificar que esté dentro del directorio de uploads
    const resolvedPath = path.resolve(fullPath);
    const resolvedUploadsDir = path.resolve(UPLOADS_DIR);
    
    if (!resolvedPath.startsWith(resolvedUploadsDir)) {
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

/**
 * Obtiene información de una imagen
 * @param imagePath - Ruta relativa de la imagen
 * @returns Metadatos de la imagen
 */
export async function getImageInfo(imagePath: string): Promise<sharp.Metadata | null> {
  try {
    // Validar que la ruta no contenga path traversal
    if (imagePath.includes('..') || imagePath.includes('\\')) {
      throw new Error('Invalid image path');
    }

    const filename = path.basename(imagePath);
    const folder = path.dirname(imagePath).replace('/uploads/', '').split('/')[0];
    const fullPath = path.join(UPLOADS_DIR, folder, filename);
    
    // Verificar que esté dentro del directorio de uploads
    const resolvedPath = path.resolve(fullPath);
    const resolvedUploadsDir = path.resolve(UPLOADS_DIR);
    
    if (!resolvedPath.startsWith(resolvedUploadsDir)) {
      throw new Error('Path traversal detected');
    }

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const metadata = await sharp(fullPath).metadata();
    return metadata;
  } catch (error) {
    logger.error({ error, imagePath }, 'Error getting image info');
    return null;
  }
}
