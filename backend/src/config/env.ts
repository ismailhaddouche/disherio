import { z } from 'zod';
import { logger } from './logger';
import { loadSecretFiles } from './secret-files';

const DEFAULT_JWT_SECRET = 'changeme_in_production';

const DURATION_MULTIPLIERS = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
} as const;

function durationInSeconds(value: string): number | null {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) return null;

  const amount = Number(match[1]);
  const seconds = amount * DURATION_MULTIPLIERS[match[2] as keyof typeof DURATION_MULTIPLIERS];
  return Number.isSafeInteger(amount) && Number.isSafeInteger(seconds) ? seconds : null;
}

/**
 * Strict integer env var: rejects NaN and non-numeric input (e.g. PORT=abc,
 * PORT=3000x) and enforces an inclusive [min, max] range.
 */
const intInRange = (name: string, min: number, max: number, defaultValue: number) =>
  z
    .string()
    .default(String(defaultValue))
    .refine((val) => /^\d+$/.test(val), {
      message: `${name} must be an integer`,
    })
    .transform((val) => parseInt(val, 10))
    .refine((val) => val >= min && val <= max, {
      message: `${name} must be between ${min} and ${max}`,
    });

/**
 * JWT duration env var: matches the compact "zeit/ms" format accepted by
 * jsonwebtoken (e.g. 60s, 15m, 8h, 1d, 7d). Rejects arbitrary text.
 */
const jwtDuration = (
  name: string,
  defaultValue: string,
  minSeconds: number,
  maxSeconds: number
) =>
  z
    .string()
    .regex(/^\d+[smhd]$/, {
      message: `${name} must be a duration like 60s, 15m, 8h, 1d or 7d (number followed by s, m, h or d)`,
    })
    .refine((value) => {
      const seconds = durationInSeconds(value);
      return seconds !== null && seconds >= minSeconds && seconds <= maxSeconds;
    }, {
      message: `${name} is outside the allowed duration range`,
    })
    .default(defaultValue);

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
  PORT: intInRange('PORT', 1, 65535, 3000),

  // Optional: Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Logging level
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),

  // Frontend URL used for CORS and cookies
  FRONTEND_URL: z.string().optional(),

  // Optional: Redis configuration
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),

  // Access token lifetime (short-lived)
  JWT_EXPIRES: jwtDuration('JWT_EXPIRES', '15m', 60, 24 * 60 * 60),

  // Refresh token configuration. The secret derives deterministic successor
  // tokens during the short idempotent rotation window; refresh tokens remain
  // opaque values and only their hashes are persisted.
  JWT_REFRESH_SECRET: z
    .string()
    .min(1, 'JWT_REFRESH_SECRET cannot be empty')
    .refine((val) => val !== DEFAULT_JWT_SECRET, {
      message: `JWT_REFRESH_SECRET cannot be the default value '${DEFAULT_JWT_SECRET}'`,
    })
    .refine((val) => val.length >= 32, {
      message: 'JWT_REFRESH_SECRET must be at least 32 characters long',
    }),

  JWT_REFRESH_EXPIRES: jwtDuration('JWT_REFRESH_EXPIRES', '7d', 60 * 60, 30 * 24 * 60 * 60),

  // Reverse proxy trust flag
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),

  // Bcrypt cost factor for staff credentials.
  BCRYPT_ROUNDS: intInRange('BCRYPT_ROUNDS', 10, 15, 12),

  // Internal token for health/metrics endpoints
  INTERNAL_API_TOKEN: z.string().optional(),

  // MongoDB connection pool settings
  MONGODB_MAX_POOL_SIZE: intInRange('MONGODB_MAX_POOL_SIZE', 1, 1000, 50),
  MONGODB_SERVER_SELECTION_TIMEOUT: intInRange(
    'MONGODB_SERVER_SELECTION_TIMEOUT',
    1000,
    120000,
    30000
  ),
  MONGODB_SOCKET_TIMEOUT: intInRange('MONGODB_SOCKET_TIMEOUT', 1000, 300000, 45000),

  // Directory where processed images are stored
  UPLOADS_DIR: z.string().optional(),
}).superRefine((config, ctx) => {
  const accessSeconds = durationInSeconds(config.JWT_EXPIRES);
  const refreshSeconds = durationInSeconds(config.JWT_REFRESH_EXPIRES);
  if (accessSeconds !== null && refreshSeconds !== null && refreshSeconds <= accessSeconds) {
    ctx.addIssue({
      code: 'custom',
      path: ['JWT_REFRESH_EXPIRES'],
      message: 'JWT_REFRESH_EXPIRES must be longer than JWT_EXPIRES',
    });
  }
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
    loadSecretFiles();
    const config = envSchema.parse(process.env);
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(
        (issue) => `  - ${issue.path.join('.')}: ${issue.message}`
      );

      logger.error('[ERROR] Environment validation failed:');
      issues.forEach((issue) => logger.error(issue));
      logger.error('\nPlease check your .env file and ensure all required variables are set correctly.');
    } else {
      logger.error({ err: error }, '[ERROR] Unexpected error validating environment');
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
