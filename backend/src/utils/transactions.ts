import { ClientSession, startSession } from 'mongoose';
import { logger } from '../config/logger';

export async function withTransaction<T>(
  operations: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await startSession();
  let result!: T;
  let completed = false;

  try {
    await session.withTransaction(async () => {
      result = await operations(session);
      completed = true;
      return result;
    });
    if (!completed) throw new Error('TRANSACTION_DID_NOT_COMPLETE');
    return result;
  } catch (error) {
    logger.error({ error }, 'Transaction failed');
    throw error;
  } finally {
    await session.endSession();
  }
}

export type WithSession<T> = T & { session?: ClientSession };
