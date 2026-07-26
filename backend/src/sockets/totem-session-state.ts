/**
 * Shared totem session state (multi-node safe).
 *
 * The socket.io Redis adapter distributes rooms across nodes, but the totem
 * handler also needs a cluster-wide view of "who is at each table" and which
 * sessions are in the process of closing. That state lives here, backed by
 * Redis keys with per-entry TTLs so nothing leaks when sessions end or a
 * node dies mid-operation.
 *
 * When Redis is unavailable (development/tests) it degrades to an in-memory
 * store with the same semantics, following the pattern of
 * pin-security.service.ts.
 */

import { logger } from '../config/logger';
import { getRedisClient, initRedis, type DisherRedisClient } from '../config/redis';

// Redis key layout
const CLOSING_KEY_PREFIX = 'totem:closing:';
// The scheduled force-disconnect fires 5s after the close starts; the TTL only
// needs to safely outlive that window in case the node dies mid-close.
const CLOSING_TTL_SECONDS = 30;
const SESSION_CUSTOMERS_PREFIX = 'totem:session_customers:';
// Matches the previous in-memory SESSION_TIMEOUT_MS (24h of inactivity).
const SESSION_CUSTOMERS_TTL_SECONDS = 24 * 60 * 60;

// Public view of a customer at a table. The session token is deliberately NOT
// stored here: it stays in the node-local customerInfo map of the handler.
export interface SessionCustomerInfo {
  customerId?: string;
  customerName: string;
  socketId: string;
  joinedAt: string;
}

// In-memory fallback used only when Redis is unavailable (development/tests).
// Entries carry their own expiry so the fallback mirrors the Redis TTLs.
const memoryClosing = new Map<string, number>(); // sessionId -> expiresAt (ms)
const memoryCustomers = new Map<string, {
  expiresAt: number;
  customers: Map<string, SessionCustomerInfo>;
}>(); // sessionId -> entry

let redis: DisherRedisClient | null = null;

async function getRedis(): Promise<DisherRedisClient | null> {
  if (redis?.isReady) return redis;

  try {
    redis = getRedisClient();
    if (redis?.isReady) return redis;
    // If not ready, try initializing
    redis = await initRedis();
    return redis;
  } catch (err) {
    logger.warn({ err }, 'Redis unavailable for totem session state; using in-memory fallback');
    return null;
  }
}

function isMemoryClosingActive(sessionId: string): boolean {
  const expiresAt = memoryClosing.get(sessionId);
  if (expiresAt === undefined) return false;
  if (expiresAt <= Date.now()) {
    memoryClosing.delete(sessionId);
    return false;
  }
  return true;
}

function getMemorySessionEntry(sessionId: string) {
  const entry = memoryCustomers.get(sessionId);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    memoryCustomers.delete(sessionId);
    return undefined;
  }
  return entry;
}

// ==================== "SESSION CLOSING" MARKS ====================

// Each mark expires on its own (CLOSING_TTL_SECONDS). There is intentionally
// no shared set to trim: the old in-memory implementation cleared the whole
// set when it grew past 500 entries, which reopened a window for duplicate
// session closes.
export async function markSessionClosing(sessionId: string): Promise<void> {
  const client = await getRedis();
  if (client) {
    try {
      await client.set(`${CLOSING_KEY_PREFIX}${sessionId}`, '1', { EX: CLOSING_TTL_SECONDS });
      return;
    } catch (err) {
      logger.warn({ err, sessionId }, 'Failed to mark session closing in Redis; using fallback');
    }
  }
  memoryClosing.set(sessionId, Date.now() + CLOSING_TTL_SECONDS * 1000);
}

export async function unmarkSessionClosing(sessionId: string): Promise<void> {
  // Clear both stores so a mark written during a Redis outage cannot linger.
  memoryClosing.delete(sessionId);
  const client = await getRedis();
  if (client) {
    try {
      await client.del(`${CLOSING_KEY_PREFIX}${sessionId}`);
    } catch (err) {
      logger.warn({ err, sessionId }, 'Failed to clear session closing mark in Redis');
    }
  }
}

export async function isSessionClosing(sessionId: string): Promise<boolean> {
  const client = await getRedis();
  if (client) {
    try {
      return (await client.exists(`${CLOSING_KEY_PREFIX}${sessionId}`)) === 1;
    } catch (err) {
      logger.warn({ err, sessionId }, 'Failed to check session closing mark in Redis; using fallback');
    }
  }
  return isMemoryClosingActive(sessionId);
}

// ==================== SESSION CUSTOMERS (WHO IS AT THE TABLE) ====================

export async function addSessionCustomer(sessionId: string, info: SessionCustomerInfo): Promise<void> {
  const client = await getRedis();
  if (client) {
    try {
      const key = `${SESSION_CUSTOMERS_PREFIX}${sessionId}`;
      await client.hSet(key, info.socketId, JSON.stringify(info));
      await client.expire(key, SESSION_CUSTOMERS_TTL_SECONDS);
      return;
    } catch (err) {
      logger.warn({ err, sessionId, socketId: info.socketId }, 'Failed to add session customer in Redis; using fallback');
    }
  }
  const entry = memoryCustomers.get(sessionId) ?? { expiresAt: 0, customers: new Map<string, SessionCustomerInfo>() };
  entry.customers.set(info.socketId, info);
  entry.expiresAt = Date.now() + SESSION_CUSTOMERS_TTL_SECONDS * 1000;
  memoryCustomers.set(sessionId, entry);
}

// Removes the customer and returns how many remain at the table (all nodes).
export async function removeSessionCustomer(sessionId: string, socketId: string): Promise<number> {
  const client = await getRedis();
  if (client) {
    try {
      const key = `${SESSION_CUSTOMERS_PREFIX}${sessionId}`;
      await client.hDel(key, socketId);
      return await client.hLen(key);
    } catch (err) {
      logger.warn({ err, sessionId, socketId }, 'Failed to remove session customer in Redis; using fallback');
    }
  }
  const entry = getMemorySessionEntry(sessionId);
  if (!entry) return 0;
  entry.customers.delete(socketId);
  if (entry.customers.size === 0) {
    memoryCustomers.delete(sessionId);
  }
  return entry.customers.size;
}

export async function getSessionCustomers(sessionId: string): Promise<SessionCustomerInfo[]> {
  const client = await getRedis();
  if (client) {
    try {
      const values = await client.hVals(`${SESSION_CUSTOMERS_PREFIX}${sessionId}`);
      return values.map(value => JSON.parse(value) as SessionCustomerInfo);
    } catch (err) {
      logger.warn({ err, sessionId }, 'Failed to read session customers from Redis; using fallback');
    }
  }
  const entry = getMemorySessionEntry(sessionId);
  return entry ? Array.from(entry.customers.values()) : [];
}

export async function getSessionCustomerCount(sessionId: string): Promise<number> {
  const client = await getRedis();
  if (client) {
    try {
      return await client.hLen(`${SESSION_CUSTOMERS_PREFIX}${sessionId}`);
    } catch (err) {
      logger.warn({ err, sessionId }, 'Failed to count session customers in Redis; using fallback');
    }
  }
  return getMemorySessionEntry(sessionId)?.customers.size ?? 0;
}

export async function clearSessionCustomers(sessionId: string): Promise<void> {
  memoryCustomers.delete(sessionId);
  const client = await getRedis();
  if (client) {
    try {
      await client.del(`${SESSION_CUSTOMERS_PREFIX}${sessionId}`);
    } catch (err) {
      logger.warn({ err, sessionId }, 'Failed to clear session customers in Redis');
    }
  }
}

// Refreshes the inactivity TTL (replaces the old sessionLastActivity map).
export async function touchSessionCustomers(sessionId: string): Promise<void> {
  const client = await getRedis();
  if (client) {
    try {
      await client.expire(`${SESSION_CUSTOMERS_PREFIX}${sessionId}`, SESSION_CUSTOMERS_TTL_SECONDS);
      return;
    } catch (err) {
      logger.warn({ err, sessionId }, 'Failed to refresh session customers TTL in Redis');
    }
  }
  const entry = getMemorySessionEntry(sessionId);
  if (entry) {
    entry.expiresAt = Date.now() + SESSION_CUSTOMERS_TTL_SECONDS * 1000;
  }
}
