/**
 * JWT Secret validation utility
 * Ensures JWT_SECRET meets security requirements
 */

import { logger } from '../config/logger';

export interface JWTValidationResult {
  valid: boolean;
  error?: string;
}

const DEFAULT_SECRET = 'changeme_in_production';
const MIN_LENGTH = 32;

/**
 * Validates JWT_SECRET against security requirements:
 * - Must not be empty/null/undefined
 * - Must not be the default value 'changeme_in_production'
 * - Must be at least 32 characters long
 */
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

/**
 * Validates JWT_SECRET and exits process if invalid
 * Use this for fatal validation at startup
 */
export function validateJWTSecretOrExit(secret: string | undefined): void {
  const result = validateJWTSecret(secret);
  
  if (!result.valid) {
    logger.error(`❌ ${result.error}`);
    process.exit(1);
  }
}
