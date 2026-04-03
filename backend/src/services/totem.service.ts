import * as crypto from 'crypto';
import { Types } from 'mongoose';
import { TotemRepository, TotemSessionRepository, CustomerRepository } from '../repositories/totem.repository';
import { ItemOrderRepository } from '../repositories/order.repository';
import { ITotem, ITotemSession, ISessionCustomer, TotemSession } from '../models/totem.model';
import { IItemOrder } from '../models/order.model';
import { CreateTotemData, UpdateTotemData } from '@disherio/shared';
import { CircuitBreaker } from '../utils/circuit-breaker';
import { circuitBreakerMonitor } from '../utils/circuit-breaker-monitor';

// Repository instances
const totemRepo = new TotemRepository();
const totemSessionRepo = new TotemSessionRepository();
const customerRepo = new CustomerRepository();
const itemOrderRepo = new ItemOrderRepository();

// ============================================================================
// CIRCUIT BREAKERS - Protección para operaciones críticas
// ============================================================================

// Circuit breaker para iniciar sesión - threshold bajo por ser operación crítica
const startSessionBreaker = new CircuitBreaker(
  async (totemId: string): Promise<ITotemSession | null> => {
    const session = await TotemSession.findOneAndUpdate(
      {
        totem_id: new Types.ObjectId(totemId),
        totem_state: { $nin: ['COMPLETE', 'PAID'] }
      },
      {
        $setOnInsert: {
          totem_id: new Types.ObjectId(totemId),
          totem_state: 'STARTED',
          session_date_start: new Date()
        }
      },
      {
        upsert: true,
        new: true
      }
    );

    return session;
  },
  { failureThreshold: 3, resetTimeout: 15000, halfOpenMaxCalls: 2 },
  'TotemService.startSession'
);

// Circuit breaker para cerrar sesión
const closeSessionBreaker = new CircuitBreaker(
  async (sessionId: string): Promise<ITotemSession | null> => {
    return totemSessionRepo.updateState(sessionId, 'COMPLETE');
  },
  { failureThreshold: 5, resetTimeout: 10000, halfOpenMaxCalls: 3 },
  'TotemService.closeSession'
);

// Circuit breaker para obtener/crear sesión por QR - operación muy crítica
const getOrCreateSessionByQRBreaker = new CircuitBreaker(
  async (qrToken: string): Promise<{ session: ITotemSession; totem: ITotem }> => {
    const totem = await totemRepo.findByQR(qrToken);
    if (!totem) throw new Error('TOTEM_NOT_FOUND');

    const session = await TotemSession.findOneAndUpdate(
      {
        totem_id: totem._id,
        totem_state: { $nin: ['COMPLETE', 'PAID'] }
      },
      {
        $setOnInsert: {
          totem_id: totem._id,
          totem_state: 'STARTED',
          session_date_start: new Date()
        }
      },
      {
        upsert: true,
        new: true
      }
    );

    if (!session) {
      throw new Error('SESSION_CREATION_FAILED');
    }

    return { session, totem };
  },
  { failureThreshold: 3, resetTimeout: 15000, halfOpenMaxCalls: 2 },
  'TotemService.getOrCreateSessionByQR'
);

// Circuit breaker para operaciones de totem (crear/actualizar)
const totemWriteBreaker = new CircuitBreaker(
  async (args: { type: 'create' | 'update' | 'delete'; totemId?: string; data?: any }): Promise<any> => {
    const { type, totemId, data } = args;
    
    if (type === 'create') {
      const qr = crypto.randomUUID();
      return totemRepo.createTotem({ ...data, totem_qr: qr });
    }
    
    if (type === 'update' && totemId) {
      return totemRepo.updateTotem(totemId, data);
    }
    
    if (type === 'delete' && totemId) {
      await TotemSession.updateMany(
        { totem_id: new Types.ObjectId(totemId), totem_state: 'STARTED' },
        { $set: { totem_state: 'COMPLETE' } }
      );
      return totemRepo.deleteTotem(totemId);
    }
    
    throw new Error('INVALID_OPERATION');
  },
  { failureThreshold: 5, resetTimeout: 20000, halfOpenMaxCalls: 3 },
  'TotemService.totemWrite'
);

// Registrar todos los circuit breakers en el monitor
circuitBreakerMonitor.register(startSessionBreaker);
circuitBreakerMonitor.register(closeSessionBreaker);
circuitBreakerMonitor.register(getOrCreateSessionByQRBreaker);
circuitBreakerMonitor.register(totemWriteBreaker);

// ============================================================================
// Funciones públicas con Circuit Breaker
// ============================================================================

export async function getTotemByQR(qrToken: string): Promise<ITotem | null> {
  return totemRepo.findByQR(qrToken);
}

export async function getTotemById(totemId: string): Promise<ITotem | null> {
  return totemRepo.findById(totemId);
}

export async function startSession(totemId: string): Promise<ITotemSession | null> {
  return startSessionBreaker.execute(totemId);
}

export async function closeSession(sessionId: string): Promise<ITotemSession | null> {
  return closeSessionBreaker.execute(sessionId);
}

export async function createTotem(data: CreateTotemData): Promise<ITotem> {
  return totemWriteBreaker.execute({ type: 'create', data });
}

export async function updateTotem(totemId: string, data: UpdateTotemData): Promise<ITotem | null> {
  return totemWriteBreaker.execute({ type: 'update', totemId, data });
}

export async function regenerateQr(totemId: string): Promise<string> {
  const newQr = crypto.randomUUID();
  await totemWriteBreaker.execute({ type: 'update', totemId, data: { totem_qr: newQr } });
  return newQr;
}

export async function getTotemsByRestaurant(restaurantId: string): Promise<ITotem[]> {
  return totemRepo.findByRestaurantId(restaurantId);
}

export async function deleteTotem(totemId: string): Promise<ITotem | null> {
  return totemWriteBreaker.execute({ type: 'delete', totemId });
}

export async function getActiveSessionsByRestaurant(restaurantId: string): Promise<unknown[]> {
  return totemSessionRepo.findActiveByRestaurantId(restaurantId);
}

/**
 * Get or create a session for a totem identified by QR.
 * If there's an active (STARTED) session, return it.
 * If not (no session, or last is COMPLETE/PAID), create a new one.
 */
export async function getOrCreateSessionByQR(qrToken: string): Promise<{ session: ITotemSession; totem: ITotem }> {
  return getOrCreateSessionByQRBreaker.execute(qrToken);
}

/**
 * Create a customer for a session
 */
export async function createCustomer(sessionId: string, customerName: string): Promise<ISessionCustomer> {
  return customerRepo.createCustomer({
    session_id: sessionId,
    customer_name: customerName,
  } as any);
}

/**
 * Get customers by session ID
 */
export async function getCustomersBySession(sessionId: string): Promise<ISessionCustomer[]> {
  return customerRepo.findBySessionId(sessionId);
}

/**
 * Get all items for a session (public - for totem view)
 */
export async function getSessionItems(sessionId: string): Promise<IItemOrder[]> {
  return itemOrderRepo.findActiveBySessionId(sessionId);
}

/**
 * Get items for a specific customer (public - for "My Orders" view)
 */
export async function getCustomerItems(customerId: string): Promise<IItemOrder[]> {
  return itemOrderRepo.findByCustomerId(customerId);
}

// ============================================================================
// Exports adicionales para monitoreo
// ============================================================================

export { startSessionBreaker, closeSessionBreaker, getOrCreateSessionByQRBreaker, totemWriteBreaker };
