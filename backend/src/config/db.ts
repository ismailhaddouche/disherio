import mongoose from 'mongoose';
import { logger } from './logger';
import { getEnv } from './env';

/**
 * Maximum number of connection retry attempts
 */
const MAX_RETRIES = 5;

/**
 * Initial delay between retries in milliseconds
 * Will be doubled after each attempt (exponential backoff)
 */
const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Connection options for MongoDB
 * Provides secure and optimized connection settings
 */
const getConnectionOptions = (): mongoose.ConnectOptions => ({
  // Connection pool settings
  maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '50', 10),
  minPoolSize: 5,

  // Timeout settings (in milliseconds)
  serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT || '30000', 10),
  socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT || '45000', 10),
  connectTimeoutMS: 10000,

  // Heartbeat settings to detect stale connections
  heartbeatFrequencyMS: 10000,

  // Retry settings
  retryWrites: true,
  retryReads: true,

  // Buffer settings - disable buffering when not connected
  // to fail fast instead of queuing operations
  bufferCommands: false,
});

/**
 * Calculate delay for retry with exponential backoff
 */
const getRetryDelay = (attempt: number): number => {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s
  const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 1000;
  return Math.min(delay + jitter, 30000); // Cap at 30 seconds
};

/**
 * Wait for a specified duration
 */
const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Connect to MongoDB with retry logic and secure connection options
 *
 * Features:
 * - Exponential backoff retry (max 5 attempts)
 * - Secure connection pooling
 * - Comprehensive logging
 * - Graceful error handling
 *
 */
export async function connectDB(): Promise<void> {
  const uri = getEnv().MONGODB_URI;
  const options = getConnectionOptions();

  // Sanitize URI for logging (remove credentials)
  const sanitizedUri = uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      logger.info({
        attempt: attempt + 1,
        maxRetries: MAX_RETRIES,
        uri: sanitizedUri
      }, 'Attempting MongoDB connection...');

      await mongoose.connect(uri, options);

      logger.info({
        attempt: attempt + 1,
        maxPoolSize: options.maxPoolSize,
        serverSelectionTimeoutMS: options.serverSelectionTimeoutMS,
        socketTimeoutMS: options.socketTimeoutMS
      }, 'MongoDB connected successfully');

      // Set up connection event handlers
      setupConnectionHandlers();

      return;

    } catch (err) {
      lastError = err as Error;
      const attemptNumber = attempt + 1;

      logger.warn({
        err: lastError,
        attempt: attemptNumber,
        maxRetries: MAX_RETRIES,
        willRetry: attemptNumber < MAX_RETRIES
      }, `MongoDB connection attempt ${attemptNumber} failed`);

      if (attemptNumber < MAX_RETRIES) {
        const delay = getRetryDelay(attempt);
        logger.info({ delayMs: Math.round(delay) }, `Waiting before retry...`);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  logger.error({
    err: lastError,
    totalAttempts: MAX_RETRIES,
    uri: sanitizedUri
  }, 'MongoDB connection failed after maximum retry attempts');

  throw lastError ?? new Error('MongoDB connection failed');
}

/**
 * Set up Mongoose connection event handlers
 * for monitoring connection health
 */
function setupConnectionHandlers(): void {
  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB connection error');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });
}

export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  logger.info('Closing MongoDB connection...');
  await mongoose.connection.close(false);
  logger.info('MongoDB connection closed successfully');
}

/**
 * Check if MongoDB connection is healthy
 */
export function isConnected(): boolean {
  return mongoose.connection.readyState === 1; // 1 = connected
}

/**
 * Get current connection state description
 */
export function getConnectionState(): string {
  const states: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] || 'unknown';
}
