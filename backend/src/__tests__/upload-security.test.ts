/**
 * Upload Security Tests
 * Validates protection against:
 * - Path Traversal attacks (../, ..\, etc.)
 * - MIME type spoofing
 * - Double extension attacks (file.jpg.php)
 * - File size limits
 * - Image dimension limits
 */

import path from 'path';
import {
  sanitizeFilename,
  isAllowedExtension,
  isAllowedMimeType,
  hasDoubleExtension,
  isDangerousFile,
  hasMimeExtensionMismatch,
  generateSecureFilename,
  getSecurePath,
  validateFileSecurity,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  SECURITY_LIMITS,
} from '../utils/file-security';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

describe('File Security Utilities', () => {
  describe('sanitizeFilename', () => {
    it('should remove path traversal sequences (../)', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('etc-passwd');
      expect(sanitizeFilename('images/../../../etc/passwd')).toBe('images-etc-passwd');
    });

    it('should remove path traversal sequences (..\\)', () => {
      expect(sanitizeFilename('..\\..\\windows\\system32\\config')).toBe('windows-system32-config');
    });

    it('should remove URL encoded path traversal (%2e%2e%2f)', () => {
      // Simple URL encoded: %2e%2e%2f = ../
      expect(sanitizeFilename('%2e%2e%2f%2e%2e%2fetc%2fpasswd')).toBe('etc-passwd');
      // Double URL encoded: %252e = %2e
      const doubleEncoded = decodeURIComponent('%252e%252e%252fetc%252fpasswd'); // -> %2e%2e%2fetc%2fpasswd
      expect(sanitizeFilename(doubleEncoded)).toBe('etc-passwd');
    });

    it('should remove dangerous characters', () => {
      expect(sanitizeFilename('file<name>.jpg')).toBe('filename.jpg');
      expect(sanitizeFilename('file:name?.jpg')).toBe('filename.jpg');
      expect(sanitizeFilename('file|name*.jpg')).toBe('filename.jpg');
      expect(sanitizeFilename('file"name.jpg')).toBe('filename.jpg');
    });

    it('should extract only basename from paths', () => {
      expect(sanitizeFilename('/path/to/image.jpg')).toBe('path-to-image.jpg');
      expect(sanitizeFilename('C:\\Users\\Admin\\image.jpg')).toBe('C-Users-Admin-image.jpg');
    });

    it('should limit filename length to 255 characters', () => {
      const longName = 'a'.repeat(300) + '.jpg';
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(255);
    });

    it('should return generic name for empty/invalid filenames', () => {
      expect(sanitizeFilename('')).toBe('unnamed');
      expect(sanitizeFilename('.')).toBe('unnamed');
      expect(sanitizeFilename('..')).toBe('unnamed');
    });
  });

  describe('isAllowedExtension', () => {
    it('should allow valid image extensions', () => {
      expect(isAllowedExtension('image.jpg')).toBe(true);
      expect(isAllowedExtension('image.jpeg')).toBe(true);
      expect(isAllowedExtension('image.png')).toBe(true);
      expect(isAllowedExtension('image.webp')).toBe(true);
    });

    it('should reject invalid extensions', () => {
      expect(isAllowedExtension('image.gif')).toBe(false);
      expect(isAllowedExtension('image.php')).toBe(false);
      expect(isAllowedExtension('image.exe')).toBe(false);
      expect(isAllowedExtension('image.pdf')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isAllowedExtension('image.JPG')).toBe(true);
      expect(isAllowedExtension('image.PNG')).toBe(true);
    });

    it('should reject double extensions', () => {
      expect(isAllowedExtension('image.jpg.php')).toBe(false);
      expect(isAllowedExtension('image.png.exe')).toBe(false);
      expect(isAllowedExtension('image.webp.bat')).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(isAllowedExtension('')).toBe(false);
      expect(isAllowedExtension(null as any)).toBe(false);
      expect(isAllowedExtension(undefined as any)).toBe(false);
    });
  });

  describe('isAllowedMimeType', () => {
    it('should allow valid image MIME types', () => {
      expect(isAllowedMimeType('image/jpeg')).toBe(true);
      expect(isAllowedMimeType('image/png')).toBe(true);
      expect(isAllowedMimeType('image/webp')).toBe(true);
    });

    it('should reject invalid MIME types', () => {
      expect(isAllowedMimeType('image/gif')).toBe(false);
      expect(isAllowedMimeType('text/plain')).toBe(false);
      expect(isAllowedMimeType('application/php')).toBe(false);
      expect(isAllowedMimeType('application/javascript')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isAllowedMimeType('IMAGE/JPEG')).toBe(true);
      expect(isAllowedMimeType('Image/Png')).toBe(true);
    });

    it('should handle null/undefined', () => {
      expect(isAllowedMimeType('')).toBe(false);
      expect(isAllowedMimeType(null as any)).toBe(false);
      expect(isAllowedMimeType(undefined as any)).toBe(false);
    });
  });

  describe('hasDoubleExtension', () => {
    it('should detect double extensions', () => {
      expect(hasDoubleExtension('image.jpg.php')).toBe(true);
      expect(hasDoubleExtension('image.png.exe')).toBe(true);
      expect(hasDoubleExtension('image.webp.gif')).toBe(true);
      expect(hasDoubleExtension('image.jpg.bat')).toBe(true);
    });

    it('should return false for single extensions', () => {
      expect(hasDoubleExtension('image.jpg')).toBe(false);
      expect(hasDoubleExtension('image.png')).toBe(false);
      expect(hasDoubleExtension('image.webp')).toBe(false);
    });

    it('should return false for files without extension', () => {
      expect(hasDoubleExtension('image')).toBe(false);
      expect(hasDoubleExtension('README')).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(hasDoubleExtension('')).toBe(false);
      expect(hasDoubleExtension(null as any)).toBe(false);
    });
  });

  describe('isDangerousFile', () => {
    it('should detect executable files', () => {
      expect(isDangerousFile('script.exe')).toBe(true);
      expect(isDangerousFile('script.bat')).toBe(true);
      expect(isDangerousFile('script.cmd')).toBe(true);
      expect(isDangerousFile('script.sh')).toBe(true);
      expect(isDangerousFile('script.php')).toBe(true);
      expect(isDangerousFile('script.jsp')).toBe(true);
      expect(isDangerousFile('script.asp')).toBe(true);
      expect(isDangerousFile('script.aspx')).toBe(true);
      expect(isDangerousFile('script.py')).toBe(true);
      expect(isDangerousFile('script.rb')).toBe(true);
    });

    it('should detect hidden files', () => {
      expect(isDangerousFile('.htaccess')).toBe(true);
      expect(isDangerousFile('.env')).toBe(true);
      expect(isDangerousFile('.gitignore')).toBe(true);
    });

    it('should return false for safe image files', () => {
      expect(isDangerousFile('image.jpg')).toBe(false);
      expect(isDangerousFile('image.png')).toBe(false);
      expect(isDangerousFile('image.webp')).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(isDangerousFile('')).toBe(true);
      expect(isDangerousFile(null as any)).toBe(true);
    });
  });

  describe('hasMimeExtensionMismatch', () => {
    it('should detect MIME/extension mismatch', () => {
      // Extensión JPG con MIME PNG
      expect(hasMimeExtensionMismatch('image.jpg', 'image/png')).toBe(true);
      // Extensión PNG con MIME JPEG
      expect(hasMimeExtensionMismatch('image.png', 'image/jpeg')).toBe(true);
      // Extensión WEBP con MIME PNG
      expect(hasMimeExtensionMismatch('image.webp', 'image/png')).toBe(true);
    });

    it('should return false for matching MIME/extension', () => {
      expect(hasMimeExtensionMismatch('image.jpg', 'image/jpeg')).toBe(false);
      expect(hasMimeExtensionMismatch('image.jpeg', 'image/jpeg')).toBe(false);
      expect(hasMimeExtensionMismatch('image.png', 'image/png')).toBe(false);
      expect(hasMimeExtensionMismatch('image.webp', 'image/webp')).toBe(false);
    });

    it('should detect unknown MIME types', () => {
      expect(hasMimeExtensionMismatch('image.jpg', 'application/x-malicious')).toBe(true);
    });
  });

  describe('generateSecureFilename', () => {
    it('should generate unique filenames with UUID', () => {
      const name1 = generateSecureFilename('image.jpg');
      const name2 = generateSecureFilename('image.jpg');
      expect(name1).not.toBe(name2);
      expect(name1).toContain('-');
    });

    it('should include timestamp by default', () => {
      const name = generateSecureFilename('image.jpg');
      expect(name).toMatch(/^\d+-[\w-]+\.jpg$/);
    });

    it('should preserve allowed extensions', () => {
      expect(generateSecureFilename('image.jpg')).toMatch(/\.jpg$/);
      expect(generateSecureFilename('image.png')).toMatch(/\.png$/);
      expect(generateSecureFilename('image.webp')).toMatch(/\.webp$/);
    });

    it('should default to .bin for unknown extensions', () => {
      expect(generateSecureFilename('image.exe')).toMatch(/\.bin$/);
      expect(generateSecureFilename('image.php')).toMatch(/\.bin$/);
    });

    it('should handle no original filename', () => {
      const name = generateSecureFilename();
      expect(name).toMatch(/\.(bin|jpg|png|webp)$/);
    });
  });

  describe('getSecurePath', () => {
    const UPLOADS_DIR = '/app/uploads';

    it('should construct valid paths for allowed folders', () => {
      const result = getSecurePath(UPLOADS_DIR, 'dishes', 'image.jpg');
      expect(result).toBe(path.resolve('/app/uploads/dishes/image.jpg'));
    });

    it('should throw error for invalid folder', () => {
      expect(() => getSecurePath(UPLOADS_DIR, 'malicious', 'image.jpg')).toThrow('Invalid folder');
      expect(() => getSecurePath(UPLOADS_DIR, '../etc', 'passwd')).toThrow('Invalid folder');
    });

    it('should handle path traversal attempts by sanitizing', () => {
      // Path traversal es sanitizado, no debería lanzar error pero el resultado es seguro
      const result = getSecurePath(UPLOADS_DIR, 'dishes', '../etc/passwd');
      // El resultado debe estar dentro del directorio dishes
      expect(result).toContain('/dishes/');
      expect(result).not.toContain('../');
    });

    it('should sanitize malicious inputs', () => {
      const result = getSecurePath(UPLOADS_DIR, 'dishes', '<script>alert(1)</script>.jpg');
      expect(result).not.toContain('<script>');
    });
  });

  describe('validateFileSecurity', () => {
    const createMockFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
      fieldname: 'image',
      originalname: 'image.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('fake-image-data'),
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
      ...overrides,
    });

    it('should validate safe files', () => {
      const file = createMockFile();
      const result = validateFileSecurity(file);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject files exceeding size limit', () => {
      const file = createMockFile({ size: SECURITY_LIMITS.MAX_FILE_SIZE + 1 });
      const result = validateFileSecurity(file);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('size exceeds'))).toBe(true);
    });

    it('should reject dangerous files', () => {
      const file = createMockFile({ originalname: '.htaccess' });
      const result = validateFileSecurity(file);
      expect(result.valid).toBe(false);
    });

    it('should reject files with invalid extension', () => {
      const file = createMockFile({ originalname: 'image.gif', mimetype: 'image/gif' });
      const result = validateFileSecurity(file);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Extension not allowed'))).toBe(true);
    });

    it('should reject files with double extension', () => {
      const file = createMockFile({ originalname: 'image.jpg.php' });
      const result = validateFileSecurity(file);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Double file extensions are not allowed');
    });

    it('should reject files with MIME/extension mismatch', () => {
      const file = createMockFile({ originalname: 'image.jpg', mimetype: 'image/png' });
      const result = validateFileSecurity(file);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File extension does not match content type');
    });

    it('should return sanitized filename', () => {
      const file = createMockFile({ originalname: '../../../etc/passwd.jpg' });
      const result = validateFileSecurity(file);
      expect(result.sanitizedFilename).not.toContain('..');
    });

    it('should handle undefined file', () => {
      const result = validateFileSecurity(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No file provided');
    });
  });
});

describe('Upload Security Constants', () => {
  it('should have correct allowed extensions', () => {
    expect(ALLOWED_EXTENSIONS).toContain('.jpg');
    expect(ALLOWED_EXTENSIONS).toContain('.jpeg');
    expect(ALLOWED_EXTENSIONS).toContain('.png');
    expect(ALLOWED_EXTENSIONS).toContain('.webp');
    expect(ALLOWED_EXTENSIONS).not.toContain('.gif');
    expect(ALLOWED_EXTENSIONS).not.toContain('.php');
  });

  it('should have correct allowed MIME types', () => {
    expect(ALLOWED_MIME_TYPES).toContain('image/jpeg');
    expect(ALLOWED_MIME_TYPES).toContain('image/png');
    expect(ALLOWED_MIME_TYPES).toContain('image/webp');
    expect(ALLOWED_MIME_TYPES).not.toContain('image/gif');
    expect(ALLOWED_MIME_TYPES).not.toContain('application/php');
  });

  it('should have correct security limits', () => {
    expect(SECURITY_LIMITS.MAX_FILE_SIZE).toBe(5 * 1024 * 1024); // 5MB
    expect(SECURITY_LIMITS.MAX_WIDTH).toBe(4000);
    expect(SECURITY_LIMITS.MAX_HEIGHT).toBe(4000);
    expect(SECURITY_LIMITS.MAX_FILES_PER_REQUEST).toBe(1);
  });
});
