import path from 'path';
import crypto from 'crypto';

// Whitelist of allowed extensions
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// Whitelist of allowed MIME types
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Security limits
export const SECURITY_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_WIDTH: 4000,
  MAX_HEIGHT: 4000,
  MAX_FILES_PER_REQUEST: 1,
} as const;

// Dangerous characters to be removed
const DANGEROUS_CHARS = /[<>:"|?*\x00-\x1f]/g;

// Path traversal patterns
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,      // ../
  /\.\.\\/g,      // ..\
  /%2e%2e%2f/gi,  // URL encoded ../
  /%2e%2e\//gi,   // URL encoded ../
  /%2e%2e%5c/gi,  // URL encoded ..\
  /%252e%252e%252f/gi, // Double URL encoded
      /\.{2,}/g,      // Multiple consecutive dots
];

// Path separator characters (for normalization)
const PATH_SEPARATORS = /[\/\\]/g;

// Hidden or dangerous file patterns
const DANGEROUS_PATTERNS = [
  /^\.+/,         // Hidden files (.htaccess, .env, etc.)
  /\.(exe|bat|cmd|sh|php|jsp|asp|aspx|py|rb|js|ts)$/i, // Executable scripts
];

export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'unnamed';
  }

  // Decode URL encoding first
  let sanitized: string;
  try {
    sanitized = decodeURIComponent(filename);
  } catch {
    sanitized = filename;
  }

  // Remove path traversal patterns
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Remove dangerous characters
  sanitized = sanitized.replace(DANGEROUS_CHARS, '');

  // Replace path separators with hyphens
  sanitized = sanitized.replace(PATH_SEPARATORS, '-');

  // Remove multiple consecutive hyphens
  sanitized = sanitized.replace(/-+/g, '-');

  // Remove leading and trailing hyphens
  sanitized = sanitized.replace(/^-+|-+$/g, '');

  // Extract only the base name (without additional directories)
  sanitized = path.basename(sanitized);

  // Limit length
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    sanitized = sanitized.slice(0, 255 - ext.length) + ext;
  }

  // If empty or only dots, use a generic name
  if (!sanitized || /^\.*$/.test(sanitized) || sanitized === '.' || sanitized === '..') {
    sanitized = 'unnamed';
  }

  return sanitized;
}

export function isAllowedExtension(filename: string, allowed: string[] = ALLOWED_EXTENSIONS): boolean {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  const ext = path.extname(filename).toLowerCase();

  // Check for dangerous double extensions (e.g., file.jpg.php)
  const baseName = path.basename(filename, ext);
  const secondaryExt = path.extname(baseName).toLowerCase();

  if (secondaryExt && secondaryExt !== ext) {
    // Has double extension - dangerous
    return false;
  }

  return allowed.includes(ext);
}

export function isAllowedMimeType(mimetype: string, allowed: string[] = ALLOWED_MIME_TYPES): boolean {
  if (!mimetype || typeof mimetype !== 'string') {
    return false;
  }
  return allowed.includes(mimetype.toLowerCase().trim());
}

export function hasDoubleExtension(filename: string): boolean {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  const ext = path.extname(filename).toLowerCase();
  if (!ext) return false;

  const baseName = path.basename(filename, ext);
  const secondaryExt = path.extname(baseName);

  // If there's a second extension different from the first
  if (secondaryExt) {
    return true;
  }

  // Also check for consecutive multiple dots
  const parts = baseName.split('.');
  if (parts.length > 1 && parts[parts.length - 1].match(/^(jpg|jpeg|png|gif|php|asp|jsp|exe|sh|bat|cmd)$/i)) {
    return true;
  }

  return false;
}

export function isDangerousFile(filename: string): boolean {
  if (!filename || typeof filename !== 'string') {
    return true;
  }

  const lowerFilename = filename.toLowerCase();

  // Check dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(lowerFilename)) {
      return true;
    }
  }

  // Check known executable extensions
  const executableExts = ['.exe', '.dll', '.bat', '.cmd', '.sh', '.php',
                          '.jsp', '.asp', '.aspx', '.py', '.rb', '.pl',
                          '.cgi', '.jar', '.war', '.ear'];
  const ext = path.extname(lowerFilename);
  if (executableExts.includes(ext)) {
    return true;
  }

  return false;
}

export function hasMimeExtensionMismatch(filename: string, mimetype: string): boolean {
  const ext = path.extname(filename).toLowerCase();

  const mimeToExt: Record<string, string[]> = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
  };

  const validExts = mimeToExt[mimetype.toLowerCase()];
  if (!validExts) return true; // Unknown MIME type.

  return !validExts.includes(ext);
}

export function generateSecureFilename(originalFilename?: string, useTimestamp = true): string {
  // Generate UUID v4
  const randomPart = crypto.randomUUID();

  // Get safe extension from original file
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

export interface DimensionValidationResult {
  valid: boolean;
  width?: number;
  height?: number;
  error?: string;
}

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedFilename?: string;
}

/**
 * Validate file magic bytes to confirm the buffer is actually an image.
 * Checks JPEG (FF D8), PNG (89 50 4E 47), and WebP (52 49 46 46 ... 57 45 42 50).
 * This is a defense-in-depth check complementing Sharp's metadata validation.
 */
export function hasValidImageMagicBytes(buffer: Buffer | undefined): boolean {
  if (!buffer || buffer.length < 12) return false;

  // JPEG: starts with FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;

  // PNG: starts with 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  )
    return true;

  // WebP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  )
    return true;

  return false;
}

export function validateFileSecurity(
  file: Express.Multer.File | undefined
): FileValidationResult {
  const errors: string[] = [];

  if (!file) {
    return { valid: false, errors: ['No file provided'] };
  }

  // Validate size
  if (file.size > SECURITY_LIMITS.MAX_FILE_SIZE) {
    errors.push(`File size exceeds maximum of ${SECURITY_LIMITS.MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Sanitize name
  const sanitizedFilename = sanitizeFilename(file.originalname);

  // Validate it's not a dangerous file
  if (isDangerousFile(file.originalname)) {
    errors.push('File type is not allowed');
  }

  // Validate extension
  if (!isAllowedExtension(file.originalname)) {
    errors.push(`Extension not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }

  // Validate double extension
  if (hasDoubleExtension(file.originalname)) {
    errors.push('Double file extensions are not allowed');
  }

  // Validate MIME type
  if (!isAllowedMimeType(file.mimetype)) {
    errors.push(`MIME type not allowed: ${file.mimetype}`);
  }

  // Validate extension and MIME type match
  if (hasMimeExtensionMismatch(file.originalname, file.mimetype)) {
    errors.push('File extension does not match content type');
  }

  // Validate magic bytes (defense in depth against MIME spoofing)
  if (!hasValidImageMagicBytes(file.buffer)) {
    errors.push('File content does not match a valid image format');
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedFilename,
  };
}

export function getSecurePath(uploadsDir: string, subfolder: string, filename: string): string {
  // Validate subfolder is in the allowed list (check before sanitizing for traversal detection)
  const allowedFolders = ['dishes', 'categories', 'restaurants', 'temp'];

  // Check for path traversal attempt in subfolder
  if (subfolder.includes('..') || subfolder.includes('/') || subfolder.includes('\\')) {
    throw new Error('Invalid folder specified');
  }

  if (!allowedFolders.includes(subfolder)) {
    throw new Error('Invalid folder specified');
  }

  // Sanitize filename and verify no path traversal
  const safeFilename = sanitizeFilename(filename);

  // Check if original filename had unsanitized path traversal
  if (filename.includes('..') || (filename.includes('/') && !safeFilename.includes('-'))) {
    // Original filename had path traversal which was removed, generate safe name
    if (!safeFilename || safeFilename === 'unnamed') {
      throw new Error('Path traversal detected');
    }
  }

  // Build and validate the absolute path.
  const fullPath = path.resolve(uploadsDir, subfolder, safeFilename);
  const resolvedUploadsDir = path.resolve(uploadsDir);

  // Verify final path is within uploads directory (path traversal protection)
  if (!fullPath.startsWith(resolvedUploadsDir)) {
    throw new Error('Path traversal detected');
  }

  return fullPath;
}
