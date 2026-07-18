
import { logger } from '../config/logger';

export interface JWTValidationResult {
  valid: boolean;
  error?: string;
}

const DEFAULT_SECRET = 'changeme_in_production';
const MIN_LENGTH = 32;

export function validateJWTSecret(secret: string | undefined): JWTValidationResult {
  // Check if secret exists
  if (!secret) {
    return {
      valid: false,
      error: 'JWT_SECRET is not set. Please set a secure JWT_SECRET in .env file',
    };
  }

  // Check for default value
  if (secret === DEFAULT_SECRET) {
    return {
      valid: false,
      error: `JWT_SECRET uses the default value '${DEFAULT_SECRET}'. Please set a unique secure secret`,
    };
  }

  // Check minimum length
  if (secret.length < MIN_LENGTH) {
    return {
      valid: false,
      error: `JWT_SECRET must be at least ${MIN_LENGTH} characters long (current: ${secret.length}). Use a longer secret for better security`,
    };
  }

  return { valid: true };
}

export function validateJWTSecretOrExit(secret: string | undefined): void {
  const result = validateJWTSecret(secret);

  if (!result.valid) {
    logger.error(`[ERROR] ${result.error}`);
    process.exit(1);
  }
}
