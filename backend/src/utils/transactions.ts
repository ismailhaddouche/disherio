import { ClientSession, startSession } from 'mongoose';
import { logger } from '../config/logger';

/**
 * Transaction wrapper for MongoDB operations
 * Automatically handles session creation, commit, and rollback
 * 
 * Usage:
 * const result = await withTransaction(async (session) => {
 *   const order = await orderRepo.create(data, session);
 *   const item = await itemRepo.create(itemData, session);
 *   return { order, item };
 * });
 */
export async function withTransaction<T>(
  operations: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await startSession();
  
  try {
    session.startTransaction();
    
    const result = await operations(session);
    
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    logger.error({ error }, 'Transaction aborted due to error');
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Transaction with retry logic for handling transient errors
 * Useful for operations that may encounter write conflicts
 * 
 * @param operations - Function containing database operations
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param retryDelay - Delay between retries in ms (default: 100)
 * 
 * Usage:
 * const result = await withTransactionRetry(async (session) => {
 *   await order.save({ session });
 *   await inventory.updateOne({}, { session });
 * }, 3, 100);
 */
export async function withTransactionRetry<T>(
  operations: (session: ClientSession) => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 100
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const session = await startSession();
    
    try {
      session.startTransaction();
      
      const result = await operations(session);
      
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      lastError = error as Error;
      
      // Check if error is transient and should be retried
      const isTransientError = isRetryableError(error);
      
      if (isTransientError && attempt < maxRetries) {
        logger.warn({
          error,
          attempt,
          maxRetries,
          retryDelay
        }, 'Transaction failed with transient error, retrying...');
        
        await sleep(retryDelay * attempt); // Exponential backoff
      } else {
        logger.error({ error, attempt, maxRetries }, 'Transaction aborted due to error');
        throw error;
      }
    } finally {
      session.endSession();
    }
  }
  
  throw lastError || new Error('Transaction failed after maximum retries');
}

/**
 * Run operations within an existing session
 * Use this when you already have a session from a parent transaction
 */
export async function withSession<T>(
  _session: ClientSession,
  operations: () => Promise<T>
): Promise<T> {
  return operations();
}

/**
 * Execute multiple operations in parallel within the same session
 * All operations share the same transaction context
 * 
 * Usage:
 * await withTransaction(async (session) => {
 *   await runInParallel(session, [
 *     () => orderRepo.create(data1, session),
 *     () => orderRepo.create(data2, session),
 *     () => inventoryRepo.update(id, update, session)
 *   ]);
 * });
 */
export async function runInParallel<T>(
  session: ClientSession,
  operations: Array<(session: ClientSession) => Promise<T>>
): Promise<T[]> {
  return Promise.all(operations.map(op => op(session)));
}

/**
 * Type for repository methods that support transactions
 * All create/update/delete methods should accept an optional session parameter
 */
export type WithSession<T> = T & { session?: ClientSession };

/**
 * Helper function to check if an error is retryable (transient)
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  
  const errorMessage = error.message.toLowerCase();
  const retryableKeywords = [
    'write conflict',
    'lock timeout',
    'transaction already in progress',
    'transienttransactionerror',
    'retryable write',
    'no primary found',
    'not master',
    'exceeded time limit',
    'connection reset',
    'network timeout',
  ];
  
  return retryableKeywords.some(keyword => errorMessage.includes(keyword));
}

/**
 * Helper function for delay between retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
