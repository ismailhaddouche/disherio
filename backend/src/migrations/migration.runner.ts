import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { logger } from '../config/logger';

export interface Migration {
  name: string;
  up(): Promise<void>;
}

export interface RunMigrationsOptions {
  /** Max time to wait for the migration lock before failing. */
  lockTimeoutMs?: number;
  /** Lease duration; exposed so concurrency tests can use short intervals. */
  lockLeaseMs?: number;
}

const COLLECTION_NAME = 'schema_migrations';
const LOCK_ID = '__migration_lock__';
const LOCK_STALE_MS = 60_000;
const LOCK_TIMEOUT_MS = 30_000;
const LOCK_POLL_MS = 250;

interface RegistryDoc {
  _id: string;
  appliedAt?: Date;
  acquiredAt?: Date;
  ownerId?: string;
  expiresAt?: Date;
}

/**
 * Serialize migration execution across processes. The lock is a plain
 * document in the registry collection: inserting it is atomic, so exactly one
 * process wins. Stale locks (older than LOCK_STALE_MS) are stolen so a crashed
 * process cannot block startup forever.
 */
async function acquireLock(
  collection: mongoose.mongo.Collection<RegistryDoc>,
  timeoutMs: number,
  leaseMs: number,
  ownerId: string
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const now = new Date();
    const lockDocument = {
      ownerId,
      acquiredAt: now,
      expiresAt: new Date(now.getTime() + leaseMs),
    };
    try {
      await collection.insertOne({ _id: LOCK_ID, ...lockDocument });
      return;
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;

      const takeover = await collection.updateOne(
        {
          _id: LOCK_ID,
          $or: [
            { expiresAt: { $lte: now } },
            {
              expiresAt: { $exists: false },
              acquiredAt: { $lt: new Date(now.getTime() - LOCK_STALE_MS) },
            },
          ],
        },
        { $set: lockDocument }
      );
      if (takeover.modifiedCount === 1) return;

      if (Date.now() >= deadline) {
        throw new Error('MIGRATION_LOCK_TIMEOUT: another process is running migrations');
      }
      await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
    }
  }
}

async function renewLock(
  collection: mongoose.mongo.Collection<RegistryDoc>,
  ownerId: string,
  leaseMs: number
): Promise<boolean> {
  const result = await collection.updateOne(
    { _id: LOCK_ID, ownerId },
    { $set: { expiresAt: new Date(Date.now() + leaseMs) } }
  );
  return result.matchedCount === 1;
}

/**
 * Apply pending migrations in order. Each applied migration is recorded in
 * `schema_migrations`; already-recorded names are skipped, so migrations must
 * never be renamed or reordered once shipped. The lock is always released,
 * including on failure.
 */
export async function runMigrations(
  migrations: Migration[],
  options: RunMigrationsOptions = {}
): Promise<string[]> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('runMigrations requires an active MongoDB connection');
  }
  const collection = db.collection<RegistryDoc>(COLLECTION_NAME);
  const ownerId = randomUUID();
  const leaseMs = options.lockLeaseMs ?? LOCK_STALE_MS;
  if (!Number.isFinite(leaseMs) || leaseMs <= 0) {
    throw new Error('MIGRATION_LOCK_INVALID_LEASE');
  }
  await acquireLock(collection, options.lockTimeoutMs ?? LOCK_TIMEOUT_MS, leaseMs, ownerId);
  let lockLost = false;
  let renewalError: unknown;
  let renewalChain = Promise.resolve();
  const enqueueRenewal = (): Promise<void> => {
    renewalChain = renewalChain.then(async () => {
      if (lockLost) return;
      try {
        if (!(await renewLock(collection, ownerId, leaseMs))) lockLost = true;
      } catch (error) {
        renewalError = error;
        lockLost = true;
      }
    });
    return renewalChain;
  };
  const renewalTimer = setInterval(() => {
    void enqueueRenewal();
  }, Math.max(1, Math.floor(leaseMs / 3)));
  renewalTimer.unref();
  try {
    const applied = new Set(
      (await collection.find({ _id: { $ne: LOCK_ID } }).toArray()).map((doc) => doc._id)
    );
    const newlyApplied: string[] = [];
    for (const migration of migrations) {
      if (applied.has(migration.name)) continue;
      logger.info({ migration: migration.name }, 'Applying migration');
      await migration.up();
      await enqueueRenewal();
      if (lockLost) {
        if (renewalError) {
          const error = new Error('MIGRATION_LOCK_RENEWAL_FAILED');
          (error as Error & { cause?: unknown }).cause = renewalError;
          throw error;
        }
        throw new Error('MIGRATION_LOCK_LOST: migration lease ownership changed');
      }
      await collection.insertOne({ _id: migration.name, appliedAt: new Date() });
      newlyApplied.push(migration.name);
      logger.info({ migration: migration.name }, 'Migration applied');
    }
    return newlyApplied;
  } finally {
    clearInterval(renewalTimer);
    await renewalChain;
    await collection.deleteOne({ _id: LOCK_ID, ownerId });
  }
}
