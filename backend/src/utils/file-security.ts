import path from 'path';
import crypto from 'crypto';

// Lista blanca de extensiones permitidas
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// Lista blanca de MIME types permitidos
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Límites de seguridad
export const SECURITY_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_WIDTH: 4000,
  MAX_HEIGHT: 4000,
  MAX_FILES_PER_REQUEST: 1,
} as const;

// Caracteres peligrosos que deben ser eliminados
const DANGEROUS_CHARS = /[<>:"|?*\x00-\x1f]/g;

// Patrones de path traversal
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,      // ../
  /\.\.\\/g,      // ..\
  /%2e%2e%2f/gi,  // URL encoded ../
  /%2e%2e\//gi,   // URL encoded ../
  /%2e%2e%5c/gi,  // URL encoded ..\
  /%252e%252e%252f/gi, // Double URL encoded
  /\.{2,}/g,      // Múltiples puntos seguidos
];

// Caracteres de separación de ruta (para normalizar)
const PATH_SEPARATORS = /[\/\\]/g;

// Patrones de archivos ocultos o peligrosos
const DANGEROUS_PATTERNS = [
  /^\.+/,         // Archivos ocultos (.htaccess, .env, etc.)
  /\.(exe|bat|cmd|sh|php|jsp|asp|aspx|py|rb|js|ts)$/i, // Scripts ejecutables
];

/**
 * Sanitiza un nombre de archivo eliminando path traversal y caracteres peligrosos
 * @param filename - Nombre de archivo original
 * @returns Nombre de archivo sanitizado
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'unnamed';
  }

  // Decodificar URL encoding primero
  let sanitized: string;
  try {
    sanitized = decodeURIComponent(filename);
  } catch {
    sanitized = filename;
  }

  // Eliminar patrones de path traversal
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Eliminar caracteres peligrosos
  sanitized = sanitized.replace(DANGEROUS_CHARS, '');

  // Reemplazar separadores de ruta con guiones
  sanitized = sanitized.replace(PATH_SEPARATORS, '-');

  // Eliminar guiones múltiples consecutivos
  sanitized = sanitized.replace(/-+/g, '-');

  // Eliminar guiones al inicio y final
  sanitized = sanitized.replace(/^-+|-+$/g, '');

  // Extraer solo el nombre base (sin directorios adicionales)
  sanitized = path.basename(sanitized);

  // Limitar longitud
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    sanitized = sanitized.slice(0, 255 - ext.length) + ext;
  }

  // Si quedó vacío o solo tiene puntos, usar un nombre genérico
  if (!sanitized || /^\.*$/.test(sanitized) || sanitized === '.' || sanitized === '..') {
    sanitized = 'unnamed';
  }

  return sanitized;
}

/**
 * Valida si la extensión está en la lista blanca permitida
 * @param filename - Nombre de archivo
 * @param allowed - Lista de extensiones permitidas (con punto)
 * @returns true si la extensión está permitida
 */
export function isAllowedExtension(filename: string, allowed: string[] = ALLOWED_EXTENSIONS): boolean {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  const ext = path.extname(filename).toLowerCase();
  
  // Verificar que no tenga extensiones dobles peligrosas (ej: file.jpg.php)
  const baseName = path.basename(filename, ext);
  const secondaryExt = path.extname(baseName).toLowerCase();
  
  if (secondaryExt && secondaryExt !== ext) {
    // Tiene extensión doble - peligroso
    return false;
  }
  
  return allowed.includes(ext);
}

/**
 * Valida si el MIME type está en la lista blanca permitida
 * @param mimetype - MIME type del archivo
 * @param allowed - Lista de MIME types permitidos
 * @returns true si el MIME type está permitido
 */
export function isAllowedMimeType(mimetype: string, allowed: string[] = ALLOWED_MIME_TYPES): boolean {
  if (!mimetype || typeof mimetype !== 'string') {
    return false;
  }
  return allowed.includes(mimetype.toLowerCase().trim());
}

/**
 * Detecta si el archivo tiene extensión doble (posible ataque)
 * @param filename - Nombre de archivo
 * @returns true si tiene extensión doble sospechosa
 */
export function hasDoubleExtension(filename: string): boolean {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  const ext = path.extname(filename).toLowerCase();
  if (!ext) return false;

  const baseName = path.basename(filename, ext);
  const secondaryExt = path.extname(baseName);

  // Si hay una segunda extensión y es diferente de la primera
  if (secondaryExt) {
    return true;
  }

  // Verificar también por puntos múltiples consecutivos
  const parts = baseName.split('.');
  if (parts.length > 1 && parts[parts.length - 1].match(/^(jpg|jpeg|png|gif|php|asp|jsp|exe|sh|bat|cmd)$/i)) {
    return true;
  }

  return false;
}

/**
 * Detecta archivos potencialmente peligrosos
 * @param filename - Nombre de archivo
 * @returns true si el archivo es potencialmente peligroso
 */
export function isDangerousFile(filename: string): boolean {
  if (!filename || typeof filename !== 'string') {
    return true;
  }

  const lowerFilename = filename.toLowerCase();

  // Verificar patrones peligrosos
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(lowerFilename)) {
      return true;
    }
  }

  // Verificar extensiones de ejecutables conocidos
  const executableExts = ['.exe', '.dll', '.bat', '.cmd', '.sh', '.php', 
                          '.jsp', '.asp', '.aspx', '.py', '.rb', '.pl', 
                          '.cgi', '.jar', '.war', '.ear'];
  const ext = path.extname(lowerFilename);
  if (executableExts.includes(ext)) {
    return true;
  }

  return false;
}

/**
 * Verifica si hay discrepancia entre la extensión y el MIME type (MIME spoofing)
 * @param filename - Nombre de archivo
 * @param mimetype - MIME type declarado
 * @returns true si hay discrepancia sospechosa
 */
export function hasMimeExtensionMismatch(filename: string, mimetype: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  
  const mimeToExt: Record<string, string[]> = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'image/gif': ['.gif'],
  };

  const validExts = mimeToExt[mimetype.toLowerCase()];
  if (!validExts) return true; // MIME type desconocido

  return !validExts.includes(ext);
}

/**
 * Genera un nombre de archivo seguro y aleatorio
 * @param originalFilename - Nombre original del archivo (para mantener extensión)
 * @param useTimestamp - Si se debe incluir timestamp
 * @returns Nombre seguro aleatorio
 */
export function generateSecureFilename(originalFilename?: string, useTimestamp = true): string {
  // Generar UUID v4
  const randomPart = crypto.randomUUID();
  
  // Obtener extensión segura del archivo original
  let ext = '.bin';
  if (originalFilename) {
    const sanitized = sanitizeFilename(originalFilename);
    const origExt = path.extname(sanitized).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(origExt)) {
      ext = origExt === '.jpeg' ? '.jpg' : origExt;
    }
  }

  if (useTimestamp) {
    const timestamp = Date.now();
    return `${timestamp}-${randomPart}${ext}`;
  }

  return `${randomPart}${ext}`;
}

/**
 * Valida las dimensiones de una imagen usando sharp
 * @param buffer - Buffer de la imagen
 * @param maxWidth - Ancho máximo permitido
 * @param maxHeight - Alto máximo permitido
 * @returns Resultado de validación
 */
export interface DimensionValidationResult {
  valid: boolean;
  width?: number;
  height?: number;
  error?: string;
}

/**
 * Interface para resultados de validación completa
 */
export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedFilename?: string;
}

/**
 * Realiza validación completa de seguridad de un archivo
 * @param file - Archivo de Express Multer
 * @returns Resultado de validación con errores si los hay
 */
export function validateFileSecurity(
  file: Express.Multer.File | undefined
): FileValidationResult {
  const errors: string[] = [];

  if (!file) {
    return { valid: false, errors: ['No file provided'] };
  }

  // Validar tamaño
  if (file.size > SECURITY_LIMITS.MAX_FILE_SIZE) {
    errors.push(`File size exceeds maximum of ${SECURITY_LIMITS.MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Sanitizar nombre
  const sanitizedFilename = sanitizeFilename(file.originalname);

  // Validar que no sea un archivo peligroso
  if (isDangerousFile(file.originalname)) {
    errors.push('File type is not allowed');
  }

  // Validar extensión
  if (!isAllowedExtension(file.originalname)) {
    errors.push(`Extension not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }

  // Validar extensión doble
  if (hasDoubleExtension(file.originalname)) {
    errors.push('Double file extensions are not allowed');
  }

  // Validar MIME type
  if (!isAllowedMimeType(file.mimetype)) {
    errors.push(`MIME type not allowed: ${file.mimetype}`);
  }

  // Validar coincidencia entre extensión y MIME type
  if (hasMimeExtensionMismatch(file.originalname, file.mimetype)) {
    errors.push('File extension does not match content type');
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedFilename,
  };
}

/**
 * Obtiene la ruta segura absoluta dentro del directorio de uploads
 * @param uploadsDir - Directorio base de uploads
 * @param subfolder - Subcarpeta (dishes, categories, restaurants)
 * @param filename - Nombre de archivo
 * @returns Ruta segura absoluta
 */
export function getSecurePath(uploadsDir: string, subfolder: string, filename: string): string {
  // Validar que el subfolder sea uno de los permitidos (sin sanitizar primero para detectar intentos de traversal)
  const allowedFolders = ['dishes', 'categories', 'restaurants', 'temp'];
  
  // Verificar si hay intento de path traversal en el subfolder
  if (subfolder.includes('..') || subfolder.includes('/') || subfolder.includes('\\')) {
    throw new Error('Invalid folder specified');
  }
  
  if (!allowedFolders.includes(subfolder)) {
    throw new Error('Invalid folder specified');
  }

  // Sanitizar filename y verificar que no tenga path traversal
  const safeFilename = sanitizeFilename(filename);
  
  // Verificar si el filename original tenía path traversal que no fue completamente sanitizado
  if (filename.includes('..') || (filename.includes('/') && !safeFilename.includes('-'))) {
    // El filename contenía path traversal que fue eliminado, generamos un nombre seguro
    if (!safeFilename || safeFilename === 'unnamed') {
      throw new Error('Path traversal detected');
    }
  }

  // Construir ruta absoluta
  const fullPath = path.resolve(uploadsDir, subfolder, safeFilename);
  const resolvedUploadsDir = path.resolve(uploadsDir);

  // Verificar que la ruta final esté dentro del directorio de uploads (path traversal protection)
  if (!fullPath.startsWith(resolvedUploadsDir)) {
    throw new Error('Path traversal detected');
  }

  return fullPath;
}
