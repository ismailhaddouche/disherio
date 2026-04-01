import { z } from 'zod';
import { logger } from './logger';

const DEFAULT_JWT_SECRET = 'changeme_in_production';

/**
 * Zod schema for environment variables validation
 * Ensures all required env vars are present and valid
 */
export const envSchema = z.object({
  // JWT Secret validation - strict security requirements
  JWT_SECRET: z
    .string()
    .min(1, 'JWT_SECRET cannot be empty')
    .refine((val) => val !== DEFAULT_JWT_SECRET, {
      message: `JWT_SECRET cannot be the default value '${DEFAULT_JWT_SECRET}'`,
    })
    .refine((val) => val.length >= 32, {
      message: 'JWT_SECRET must be at least 32 characters long',
    }),

  // Database connection
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // Server configuration
  PORT: z
    .string()
    .default('3000')
    .transform((val) => parseInt(val, 10)),

  // Optional: Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

/**
 * Parsed and validated environment variables
 * Throws error if validation fails
 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates environment variables and returns parsed config
 * Exits process if validation fails
 */
export function validateEnv(): EnvConfig {
  try {
    const config = envSchema.parse(process.env);
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(
        (issue) => `  - ${issue.path.join('.')}: ${issue.message}`
      );
      
      logger.error('❌ Environment validation failed:');
      issues.forEach((issue) => logger.error(issue));
      logger.error('\nPlease check your .env file and ensure all required variables are set correctly.');
    } else {
      logger.error({ err: error }, '❌ Unexpected error validating environment');
    }
    
    process.exit(1);
  }
}

/**
 * Lazy-loaded validated environment config
 * Use this to access validated env vars after initial validation
 */
let _validatedEnv: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (!_validatedEnv) {
    _validatedEnv = validateEnv();
  }
  return _validatedEnv;
}

// Re-validate function for testing purposes
export function __resetEnv(): void {
  _validatedEnv = null;
}
