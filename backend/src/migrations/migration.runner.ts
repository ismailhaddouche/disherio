import mongoose from 'mongoose';
import { logger } from '../config/logger';

export interface Migration {
  name: string;
  up(): Promise<void>;
}

export interface RunMigrationsOptions {
  /** Max time to wait for the migration lock before failing. */
  lockTimeoutMs?: number;
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
}

/**
 * Serialize migration execution across processes. The lock is a plain
 * document in the registry collection: inserting it is atomic, so exactly one
 * process wins. Stale locks (older than LOCK_STALE_MS) are stolen so a crashed
 * process cannot block startup forever.
 */
async function acquireLock(
  collection: mongoose.mongo.Collection<RegistryDoc>,
  timeoutMs: number
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    await collection.deleteMany({ _id: LOCK_ID, acquiredAt: { $lt: new Date(Date.now() - LOCK_STALE_MS) } });
    try {
      await collection.insertOne({ _id: LOCK_ID, acquiredAt: new Date() });
      return;
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
      if (Date.now() >= deadline) {
        throw new Error('MIGRATION_LOCK_TIMEOUT: another process is running migrations');
      }
      await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
    }
  }
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
  await acquireLock(collection, options.lockTimeoutMs ?? LOCK_TIMEOUT_MS);
  try {
    const applied = new Set(
      (await collection.find({ _id: { $ne: LOCK_ID } }).toArray()).map((doc) => doc._id)
    );
    const newlyApplied: string[] = [];
    for (const migration of migrations) {
      if (applied.has(migration.name)) continue;
      logger.info({ migration: migration.name }, 'Applying migration');
      await migration.up();
      await collection.insertOne({ _id: migration.name, appliedAt: new Date() });
      newlyApplied.push(migration.name);
      logger.info({ migration: migration.name }, 'Migration applied');
    }
    return newlyApplied;
  } finally {
    await collection.deleteOne({ _id: LOCK_ID });
  }
}
