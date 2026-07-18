import * as crypto from 'crypto';
import { Types } from 'mongoose';
import { TotemRepository, TotemSessionRepository, CustomerRepository } from '../repositories/totem.repository';
import { ItemOrderRepository, PaymentRepository } from '../repositories/order.repository';
import { ITotem, ITotemSession, ISessionCustomer, TotemSession } from '../models/totem.model';
import { IItemOrder } from '../models/order.model';
import { CreateTotemData, ErrorCode, UpdateTotemData } from '@disherio/shared';
import { CircuitBreaker } from '../utils/circuit-breaker';
import { circuitBreakerMonitor } from '../utils/circuit-breaker-monitor';
import { createError } from '../utils/async-handler';
import { logger } from '../config/logger';
import { withTransaction } from '../utils/transactions';

// Repository instances
const totemRepo = new TotemRepository();
const totemSessionRepo = new TotemSessionRepository();
const customerRepo = new CustomerRepository();
const itemOrderRepo = new ItemOrderRepository();
const paymentRepo = new PaymentRepository();

type TotemWriteOperation =
  | { type: 'create'; data: CreateTotemData }
  | { type: 'update'; totemId: string; data: UpdateTotemData & { totem_qr?: string } }
  | { type: 'delete'; totemId: string };

/**
 * Find the active (STARTED) session for a specific totem. Multiple totems in
 * the same restaurant can each have their own active session simultaneously
 * (one session per table, not per restaurant).
 */
async function getStartedSessionForTotem(totemId: Types.ObjectId): Promise<ITotemSession | null> {
  return TotemSession.findOne({
    totem_id: totemId,
    totem_state: 'STARTED',
  })
    .sort({ session_date_start: -1 })
    .exec();
}

/**
 * Staff-initiated session start: if the totem already has an active session,
 * return it (idempotent); otherwise create a new one.
 */
async function startOrGetTotemSession(totem: ITotem): Promise<ITotemSession> {
  const activeSession = await getStartedSessionForTotem(totem._id);
  if (activeSession) {
    // Back-fill a session token on legacy sessions so every active session
    // carries the ephemeral per-table credential.
    if (!activeSession.session_token) {
      activeSession.session_token = crypto.randomUUID();
      await totemSessionRepo.setSessionToken(
        activeSession._id.toString(),
        activeSession.session_token
      );
    }
    return activeSession;
  }

  return totemSessionRepo.createSession(totem._id.toString(), crypto.randomUUID());
}

/**
 * Public QR scan: join the current active session, or create a fresh session
 * when the table has none. Closed sessions are historical records and must not
 * prevent a later customer from using the same permanent table QR.
 */
async function getOrCreateSessionForQR(totem: ITotem): Promise<ITotemSession> {
  const activeSession = await getStartedSessionForTotem(totem._id);
  if (activeSession) {
    if (!activeSession.session_token) {
      activeSession.session_token = crypto.randomUUID();
      await totemSessionRepo.setSessionToken(
        activeSession._id.toString(),
        activeSession.session_token
      );
    }
    return activeSession;
  }

  return totemSessionRepo.createSession(totem._id.toString(), crypto.randomUUID());
}

// ============================================================================
// CIRCUIT BREAKERS - Protection for critical operations
// ============================================================================

// Circuit breaker for starting session - low threshold since critical
const startSessionBreaker = new CircuitBreaker(
  async (totemId: string): Promise<ITotemSession> => {
    const totem = await totemRepo.findById(totemId);
    if (!totem) throw createError.notFound('TOTEM_NOT_FOUND');

    return startOrGetTotemSession(totem);
  },
  { failureThreshold: 3, resetTimeout: 15000, halfOpenMaxCalls: 2 },
  'TotemService.startSession'
);

// Circuit breaker for closing session
const closeSessionBreaker = new CircuitBreaker(
  async (sessionId: string): Promise<ITotemSession | null> => {
    return totemSessionRepo.updateStateIf(sessionId, ['STARTED'], 'COMPLETE');
  },
  { failureThreshold: 5, resetTimeout: 10000, halfOpenMaxCalls: 3 },
  'TotemService.closeSession'
);

// Circuit breaker for getting/creating session by QR - very critical
const getOrCreateSessionByQRBreaker = new CircuitBreaker(
  async (qrToken: string): Promise<{ session: ITotemSession; totem: ITotem }> => {
    const totem = await totemRepo.findByQR(qrToken);
    if (!totem) throw new Error('TOTEM_NOT_FOUND');

    const session = await getOrCreateSessionForQR(totem);
    return { session, totem };
  },
  { failureThreshold: 3, resetTimeout: 15000, halfOpenMaxCalls: 2 },
  'TotemService.getOrCreateSessionByQR'
);

// Circuit breaker for totem operations (create/update)
const totemWriteBreaker = new CircuitBreaker(
  async (operation: TotemWriteOperation): Promise<ITotem | null> => {
    if (operation.type === 'create') {
      const qr = crypto.randomUUID();
      return totemRepo.createTotem({ ...operation.data, totem_qr: qr });
    }

    if (operation.type === 'update') {
      return totemRepo.updateTotem(operation.totemId, operation.data);
    }

    if (operation.type === 'delete') {
      const operationalSession = await totemSessionRepo.findOperationalByTotemId(operation.totemId);
      if (operationalSession) {
        throw createError.conflict(ErrorCode.ACTIVE_SESSION_EXISTS);
      }
      return totemRepo.deleteTotem(operation.totemId);
    }

    throw new Error('INVALID_TOTEM_WRITE_OPERATION');
  },
  { failureThreshold: 5, resetTimeout: 20000, halfOpenMaxCalls: 3 },
  'TotemService.totemWrite'
);

// Register all circuit breakers in the monitor
circuitBreakerMonitor.register(startSessionBreaker);
circuitBreakerMonitor.register(closeSessionBreaker);
circuitBreakerMonitor.register(getOrCreateSessionByQRBreaker);
circuitBreakerMonitor.register(totemWriteBreaker);

// ============================================================================
// Public functions with Circuit Breaker
// ============================================================================

export async function getTotemByQR(qrToken: string, restaurantId?: string): Promise<ITotem | null> {
  return totemRepo.findByQRScoped(qrToken, restaurantId);
}

export async function getTotemById(totemId: string): Promise<ITotem | null> {
  return totemRepo.findById(totemId);
}

/**
 * Get a totem by id and assert it belongs to the given restaurant.
 * Throws NOT_FOUND if missing, FORBIDDEN if not in the restaurant.
 */
export async function getTotemForRestaurant(totemId: string, restaurantId: string): Promise<ITotem> {
  const totem = await totemRepo.findById(totemId);
  if (!totem) {
    throw createError.notFound('TOTEM_NOT_FOUND');
  }
  if (totem.restaurant_id.toString() !== restaurantId) {
    throw createError.forbidden('FORBIDDEN');
  }
  return totem;
}

// Permissions that may mutate (create/update/delete/regenerate) a STANDARD
// totem. TAS only manages TEMPORARY tables; managing STANDARD totems requires
// POS or ADMIN, enforced by assertCanMutateTotem in the controller layer where
// the totem document is available.
const TOTEM_MANAGE_ALL_TYPES: ReadonlySet<string> = new Set(['ADMIN', 'POS']);

/**
 * Enforce the totem-type policy for mutating totem operations. TAS may only
 * mutate TEMPORARY totems; STANDARD totems require ADMIN or POS. Used by the
 * totem controllers (create/update/delete/regenerate-qr), which have the
 * document (or, for creation, the requested type from the validated body).
 * Throws FORBIDDEN when the caller lacks permission for the totem type.
 */
export function assertCanMutateTotem(
  totemType: 'STANDARD' | 'TEMPORARY',
  permissions: string[]
): void {
  if (totemType === 'STANDARD' && !permissions.some((p) => TOTEM_MANAGE_ALL_TYPES.has(p))) {
    throw createError.forbidden('FORBIDDEN');
  }
}

export async function startSession(totemId: string): Promise<ITotemSession> {
  return startSessionBreaker.execute(totemId);
}

export async function closeSession(sessionId: string): Promise<ITotemSession | null> {
  return closeSessionBreaker.execute(sessionId);
}

export async function reopenSession(sessionId: string): Promise<ITotemSession | null> {
  return withTransaction(async (dbSession) => {
    // Reopening and token rotation share one write. The session document is
    // also the serialization point used by payment creation and item changes.
    const reopened = await totemSessionRepo.reopenWithToken(
      sessionId,
      crypto.randomUUID(),
      dbSession
    );
    if (!reopened) return null;

    const existingPayments = await paymentRepo.findBySessionId(sessionId, dbSession);
    if (existingPayments.length > 0) {
      throw createError.conflict('SESSION_ALREADY_PAID');
    }
    return reopened;
  });
}

export async function cancelSession(sessionId: string): Promise<ITotemSession | null> {
  return withTransaction(async (dbSession) => {
    const lockedSession = await totemSessionRepo.lockIfStateIn(sessionId, ['STARTED'], dbSession);
    if (!lockedSession || lockedSession.totem_state !== 'STARTED') return null;

    const activeItems = await itemOrderRepo.findActiveBySessionId(sessionId, dbSession);
    if (activeItems.length > 0) {
      throw createError.conflict('SESSION_HAS_ITEMS');
    }

    return totemSessionRepo.updateStateIf(sessionId, ['STARTED'], 'CANCELLED', dbSession);
  });
}

export async function getTotemSessions(totemId: string): Promise<ITotemSession[]> {
  return totemSessionRepo.findByTotemId(totemId);
}

export async function createTotem(data: CreateTotemData): Promise<ITotem> {
  const totem = await totemWriteBreaker.execute({ type: 'create', data });
  if (!totem) throw new Error(ErrorCode.UPDATE_FAILED);
  return totem;
}

export async function updateTotem(totemId: string, data: UpdateTotemData): Promise<ITotem | null> {
  return totemWriteBreaker.execute({ type: 'update', totemId, data });
}

export async function regenerateQr(totemId: string): Promise<string> {
  const newQr = crypto.randomUUID();
  await totemWriteBreaker.execute({
    type: 'update',
    totemId,
    data: { totem_qr: newQr },
  });
  return newQr;
}

export async function getTotemsByRestaurant(restaurantId: string): Promise<ITotem[]> {
  return totemRepo.findByRestaurantId(restaurantId);
}

export async function deleteTotem(totemId: string): Promise<ITotem | null> {
  return totemWriteBreaker.execute({ type: 'delete', totemId });
}

/**
 * Delete the totem that owns a session when that totem is TEMPORARY and the
 * session has reached a terminal state (PAID or CANCELLED). Permanent
 * (STANDARD) totems are never deleted here — only their sessions archive.
 */
export async function deleteTemporaryTotemForSession(session: ITotemSession): Promise<void> {
  const totemId = session.totem_id.toString();
  const totem = await totemRepo.findById(totemId);
  if (totem && totem.totem_type === 'TEMPORARY') {
    await totemRepo.deleteTotem(totemId);
    logger.info({ totemId, sessionId: session._id.toString() }, 'Temporary totem deleted after session ended');
  }
}

export async function getActiveSessionsByRestaurant(restaurantId: string): Promise<unknown[]> {
  return totemSessionRepo.findActiveByRestaurantId(restaurantId);
}

/**
 * Get or create a session for a totem identified by QR.
 * If this totem already has the restaurant's active session, return it.
 * If another totem has an active session, reject creating a new one.
 * If no session is active, create a new one.
 */
export async function getOrCreateSessionByQR(qrToken: string): Promise<{ session: ITotemSession; totem: ITotem }> {
  return getOrCreateSessionByQRBreaker.execute(qrToken);
}

/** Resolve an active public session only when it belongs to the supplied QR token. */
export async function getPublicSessionByQR(
  qrToken: string,
  sessionId: string,
  sessionToken?: string
): Promise<ITotemSession> {
  if (!Types.ObjectId.isValid(sessionId)) {
    throw createError.notFound('SESSION_NOT_FOUND');
  }
  const [totem, session] = await Promise.all([
    totemRepo.findByQR(qrToken),
    totemSessionRepo.findById(sessionId),
  ]);
  if (!totem || !session || session.totem_id.toString() !== totem._id.toString()) {
    throw createError.notFound('SESSION_NOT_FOUND');
  }
  if (session.totem_state !== 'STARTED') {
    throw createError.conflict('SESSION_NOT_ACTIVE');
  }
  assertSessionToken(session, sessionToken);
  return session;
}

/**
 * Verify the caller knows the session's ephemeral token. An active (STARTED)
 * session must always carry a session_token: getOrCreateSessionByQR /
 * startOrGetTotemSession back-fill it whenever they touch a session. A session
 * without one is in an inconsistent state and is rejected rather than allowed
 * through with QR-only knowledge, which would silently downgrade the session
 * model. This mirrors the stricter check the socket layer already applies.
 */
export function assertSessionToken(session: ITotemSession, sessionToken?: string): void {
  if (!session.session_token) {
    logger.error({ sessionId: session._id.toString() }, 'Started session has no session_token; rejecting');
    throw createError.unauthorized('INVALID_TOKEN');
  }
  if (!sessionToken || sessionToken !== session.session_token) {
    throw createError.unauthorized('INVALID_TOKEN');
  }
}

/**
 * Validate the session token against a session already loaded by id, without
 * requiring the totem QR. Used by customer-scoped public assertions.
 */
async function assertSessionTokenById(
  sessionId: string,
  sessionToken?: string
): Promise<void> {
  if (!Types.ObjectId.isValid(sessionId)) {
    throw createError.notFound('SESSION_NOT_FOUND');
  }
  const session = await totemSessionRepo.findById(sessionId);
  if (!session) {
    throw createError.notFound('SESSION_NOT_FOUND');
  }
  if (session.totem_state !== 'STARTED') {
    throw createError.conflict('SESSION_NOT_ACTIVE');
  }
  assertSessionToken(session, sessionToken);
}

export async function assertCustomerInSession(
  customerId: string,
  sessionId: string,
  sessionToken?: string
): Promise<ISessionCustomer> {
  if (!Types.ObjectId.isValid(customerId)) {
    throw createError.notFound('CUSTOMER_NOT_FOUND');
  }
  const customer = await customerRepo.findById(customerId);
  if (!customer || customer.session_id.toString() !== sessionId) {
    throw createError.notFound('CUSTOMER_NOT_FOUND');
  }
  await assertSessionTokenById(sessionId, sessionToken);
  return customer;
}

/**
 * Create a customer for a session
 */
export async function createCustomer(
  qrToken: string,
  sessionId: string,
  customerName: string,
  sessionToken?: string
): Promise<ISessionCustomer> {
  await getPublicSessionByQR(qrToken, sessionId, sessionToken);
  return createCustomerForActiveSession(sessionId, customerName, sessionToken);
}

export async function createCustomerForActiveSession(
  sessionId: string,
  customerName: string,
  sessionToken?: string
): Promise<ISessionCustomer> {
  return withTransaction(async (dbSession) => {
    const session = await totemSessionRepo.lockIfStateIn(sessionId, ['STARTED'], dbSession);
    if (!session || session.totem_state !== 'STARTED') {
      throw createError.conflict('SESSION_NOT_ACTIVE');
    }
    if (sessionToken !== undefined) assertSessionToken(session, sessionToken);

    const existing = await customerRepo.findByNameInSession(sessionId, customerName, dbSession);
    if (existing) throw createError.conflict('CUSTOMER_NAME_TAKEN');

    return customerRepo.createCustomer({
      session_id: sessionId,
      customer_name: customerName,
    }, dbSession);
  });
}

/**
 * Get customers by session ID
 */
export async function getCustomersBySession(
  qrToken: string,
  sessionId: string,
  sessionToken?: string
): Promise<ISessionCustomer[]> {
  await getPublicSessionByQR(qrToken, sessionId, sessionToken);
  return customerRepo.findBySessionId(sessionId);
}

/**
 * Get all items for a session (public - for totem view)
 */
export async function getSessionItems(
  qrToken: string,
  sessionId: string,
  sessionToken?: string
): Promise<IItemOrder[]> {
  await getPublicSessionByQR(qrToken, sessionId, sessionToken);
  return itemOrderRepo.findActiveBySessionId(sessionId);
}

/**
 * Get items for a specific customer (public - for "My Orders" view)
 */
export async function getCustomerItems(
  qrToken: string,
  sessionId: string,
  customerId: string,
  sessionToken?: string
): Promise<IItemOrder[]> {
  await getPublicSessionByQR(qrToken, sessionId, sessionToken);
  await assertCustomerInSession(customerId, sessionId, sessionToken);
  return itemOrderRepo.findByCustomerId(customerId);
}
