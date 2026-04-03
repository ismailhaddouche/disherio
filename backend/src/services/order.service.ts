import { ErrorCode } from '@disherio/shared';
import { getIO } from '../config/socket';
import { notifyTASNewOrder } from '../sockets/tas.handler';
import { emitSessionFullyPaid, emitTicketPaid } from '../sockets/pos.handler';
import { notifyCustomerItemUpdate } from '../sockets/totem.handler';
import * as TaxUtils from '../utils/tax';
import { withTransaction } from '../utils/transactions';
import {
  calculateItemPrice,
  calculateTips,
  buildSharedTickets,
  buildByUserTickets,
} from '../utils/calculation.utils';
import { CircuitBreaker } from '../utils/circuit-breaker';
import { circuitBreakerMonitor } from '../utils/circuit-breaker-monitor';
import { IVariant, IExtra } from '../models/dish.model';
import {
  OrderRepository,
  ItemOrderRepository,
  PaymentRepository,
  TotemRepository,
  TotemSessionRepository,
  RestaurantRepository,
  DishRepository,
  CustomerRepository,
  ValidationError,
} from '../repositories';

// Price validation constants and types
const MAX_PRICE = 999999;
const MIN_PRICE = 0;

interface PriceValidationResult {
  valid: boolean;
  field: string;
  value: number;
}

/**
 * Validates that a price is positive and within allowed range
 */
function validatePrice(price: number, fieldName: string): PriceValidationResult {
  if (typeof price !== 'number' || isNaN(price)) {
    return { valid: false, field: fieldName, value: price };
  }
  if (price <= MIN_PRICE) {
    return { valid: false, field: fieldName, value: price };
  }
  if (price > MAX_PRICE) {
    return { valid: false, field: fieldName, value: price };
  }
  return { valid: true, field: fieldName, value: price };
}

/**
 * Validates all prices in an item before adding to order
 * Throws error if any price is invalid
 */
function validateItemPrices(
  basePrice: number,
  variantPrice: number | null | undefined,
  extras: Array<{ price: number }>
): void {
  const validations: PriceValidationResult[] = [
    validatePrice(basePrice, 'item_base_price'),
  ];

  if (variantPrice !== null && variantPrice !== undefined) {
    validations.push(validatePrice(variantPrice, 'variant_price'));
  }

  for (let i = 0; i < extras.length; i++) {
    validations.push(validatePrice(extras[i].price, `extra_price[${i}]`));
  }

  const invalidPrices = validations.filter(v => !v.valid);
  
  if (invalidPrices.length > 0) {
    const details = invalidPrices
      .map(v => `${v.field}=${v.value}`)
      .join(', ');
    throw new Error(`${ErrorCode.INVALID_PRICE}: Invalid price(s) - ${details}`);
  }
}

const orderRepo = new OrderRepository();
const itemOrderRepo = new ItemOrderRepository();
const paymentRepo = new PaymentRepository();
const totemRepo = new TotemRepository();
const totemSessionRepo = new TotemSessionRepository();
const restaurantRepo = new RestaurantRepository();
const dishRepo = new DishRepository();
const customerRepo = new CustomerRepository();

// KITCHEN items flow: ORDERED -> ON_PREPARE -> SERVED
// SERVICE items (drinks) flow: ORDERED -> SERVED (skip ON_PREPARE)
const KITCHEN_STATE_TRANSITIONS: Record<string, string[]> = {
  ORDERED: ['ON_PREPARE', 'CANCELED'],
  ON_PREPARE: ['SERVED', 'CANCELED'],
  SERVED: [],
  CANCELED: [],
};

const SERVICE_STATE_TRANSITIONS: Record<string, string[]> = {
  ORDERED: ['SERVED', 'CANCELED'],  // SERVICE items skip ON_PREPARE
  SERVED: [],
  CANCELED: [],
};

const CANCEL_PERMISSIONS = ['ADMIN', 'POS'];
const DELETE_PERMISSIONS = ['ADMIN', 'POS', 'TAS'];

function validateStateTransition(currentState: string, newState: string, itemType?: 'KITCHEN' | 'SERVICE'): void {
  const transitions = itemType === 'SERVICE' 
    ? SERVICE_STATE_TRANSITIONS 
    : KITCHEN_STATE_TRANSITIONS;
  const validTransitions = transitions[currentState];
  if (!validTransitions?.includes(newState)) {
    throw new Error(ErrorCode.INVALID_STATE_TRANSITION);
  }
}

function canForceCancel(permissions: string[]): boolean {
  return permissions.some((p) => CANCEL_PERMISSIONS.includes(p));
}

function canDelete(permissions: string[]): boolean {
  return permissions.some((p) => DELETE_PERMISSIONS.includes(p));
}

function emitItemStateChanged(sessionId: string, itemId: string, newState: string, itemName?: any): void {
  getIO().to(`session:${sessionId}`).emit('item:state_changed', { itemId, newState });
  // Also notify customers directly
  notifyCustomerItemUpdate(sessionId, itemId, newState, itemName);
}

function emitItemDeleted(sessionId: string, itemId: string): void {
  getIO().to(`session:${sessionId}`).emit('item:deleted', { itemId });
}

function emitCustomerAssigned(sessionId: string, itemId: string, customerId: string | null): void {
  getIO().to(`session:${sessionId}`).emit('item:customer_assigned', { itemId, customerId });
}

function emitNewKitchenItem(sessionId: string, item: unknown): void {
  getIO().to(`session:${sessionId}`).emit('kds:new_item', item);
}

// Legacy function - kept for compatibility
function emitSessionPaidLegacy(sessionId: string): void {
  getIO().to(`session:${sessionId}`).emit('session:paid');
}

// ============================================================================
// CIRCUIT BREAKERS - Protección para operaciones críticas
// ============================================================================

// Circuit breaker para crear órdenes - threshold bajo porque es crítico
const createOrderBreaker = new CircuitBreaker(
  async (sessionId: string, staffId?: string, customerId?: string) => {
    return withTransaction(async (session) => {
      const totemSession = await totemSessionRepo.findById(sessionId);
      if (!totemSession || totemSession.totem_state !== 'STARTED') {
        throw new Error(ErrorCode.SESSION_NOT_ACTIVE);
      }
      return orderRepo.createOrder(sessionId, staffId, customerId, session);
    });
  },
  { failureThreshold: 3, resetTimeout: 15000, halfOpenMaxCalls: 2 },
  'OrderService.createOrder'
);

// Circuit breaker para agregar items - threshold medio
const addItemBreaker = new CircuitBreaker(
  async (args: {
    orderId: string;
    sessionId: string;
    dishId: string;
    customerId?: string;
    variantId?: string;
    extras: string[];
  }) => {
    const { orderId, sessionId, dishId, customerId, variantId, extras } = args;
    return withTransaction(async (session) => {
      const order = await orderRepo.findById(orderId);
      if (!order) throw new Error(ErrorCode.ORDER_NOT_FOUND);

      const dish = await dishRepo.findById(dishId);
      if (!dish) throw new Error(ErrorCode.DISH_NOT_FOUND);
      if (dish.disher_status !== 'ACTIVATED') throw new Error(ErrorCode.DISH_NOT_AVAILABLE);

      const variant = variantId
        ? dish.variants.find((v: IVariant) => v._id.toString() === variantId)
        : null;
      
      const selectedExtras = dish.extras.filter((e: IExtra) =>
        extras.includes(e._id.toString())
      );

      validateItemPrices(
        dish.disher_price,
        variant?.variant_price,
        selectedExtras.map(e => ({ price: e.extra_price }))
      );

      let customerName: string | undefined;
      if (customerId) {
        const customer = await customerRepo.findById(customerId);
        customerName = customer?.customer_name;
      }

      const item = await itemOrderRepo.createItem({
        order_id: orderId,
        session_id: sessionId,
        item_dish_id: dishId,
        customer_id: customerId,
        customer_name: customerName,
        item_disher_type: dish.disher_type,
        item_name_snapshot: dish.disher_name,
        item_base_price: dish.disher_price,
        item_disher_variant: variant
          ? {
              variant_id: variant._id.toString(),
              name: variant.variant_name,
              price: variant.variant_price,
            }
          : null,
        item_disher_extras: selectedExtras.map((e: IExtra) => ({
          extra_id: e._id.toString(),
          name: e.extra_name,
          price: e.extra_price,
        })),
      }, session);

      if (dish.disher_type === 'KITCHEN') {
        emitNewKitchenItem(sessionId, item);
      }

      notifyTASNewOrder(sessionId, {
        item,
        addedBy: 'customer',
        dishType: dish.disher_type,
      });

      return item;
    });
  },
  { failureThreshold: 5, resetTimeout: 20000, halfOpenMaxCalls: 3 },
  'OrderService.addItem'
);

// Circuit breaker para actualizar estado de items
const updateItemStateBreaker = new CircuitBreaker(
  async (args: {
    itemId: string;
    newState: string;
    requesterPerms: string[];
  }) => {
    const { itemId, newState, requesterPerms } = args;
    const item = await itemOrderRepo.findById(itemId);
    if (!item) throw new Error(ErrorCode.ITEM_NOT_FOUND);

    validateStateTransition(item.item_state, newState, item.item_disher_type);

    if (newState === 'CANCELED' && item.item_state === 'ON_PREPARE') {
      if (!canForceCancel(requesterPerms)) {
        throw new Error(ErrorCode.REQUIRES_POS_AUTHORIZATION);
      }
    }

    const updated = await itemOrderRepo.updateState(
      itemId,
      newState as 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED'
    );

    emitItemStateChanged(item.session_id.toString(), item._id.toString(), newState, item.item_name_snapshot);

    return updated;
  },
  { failureThreshold: 5, resetTimeout: 10000, halfOpenMaxCalls: 3 },
  'OrderService.updateItemState'
);

// Circuit breaker para crear pagos
const createPaymentBreaker = new CircuitBreaker(
  async (args: {
    sessionId: string;
    paymentType: 'ALL' | 'BY_USER' | 'SHARED';
    parts: number;
    customTip?: number;
  }) => {
    const { sessionId, paymentType, parts, customTip } = args;
    const { total } = await calculateSessionTotal(sessionId, customTip);

    if (total <= 0) {
      throw new Error(ErrorCode.NO_ITEMS_TO_PAY);
    }

    const tickets = paymentType === 'BY_USER'
      ? await buildByUserTickets(sessionId)
      : buildSharedTickets(total, parts);

    return withTransaction(async (session) => {
      const payment = await paymentRepo.createPayment(
        {
          session_id: sessionId,
          payment_type: paymentType,
          payment_total: total,
          tickets,
        },
        session
      );

      await totemSessionRepo.updateState(sessionId, 'COMPLETE', session);
      return payment;
    });
  },
  { failureThreshold: 3, resetTimeout: 15000, halfOpenMaxCalls: 2 },
  'OrderService.createPayment'
);

// Circuit breaker para marcar ticket pagado
const markTicketPaidBreaker = new CircuitBreaker(
  async (args: { paymentId: string; ticketPart: number }) => {
    const { paymentId, ticketPart } = args;
    const payment = await paymentRepo.findById(paymentId);
    if (!payment) throw new Error(ErrorCode.PAYMENT_NOT_FOUND);

    return withTransaction(async (session) => {
      const updated = await paymentRepo.markTicketPaid(paymentId, ticketPart, session);
      if (!updated) throw new Error(ErrorCode.TICKET_NOT_FOUND);

      const allPaid = updated.tickets.every((t) => t.paid);
      const sessionIdStr = updated.session_id.toString();
      
      const ticket = updated.tickets.find(t => t.ticket_part === ticketPart);
      if (ticket) {
        const remainingAmount = updated.tickets
          .filter(t => !t.paid)
          .reduce((sum, t) => sum + t.ticket_amount, 0);
          
        emitTicketPaid(sessionIdStr, {
          ticketPart,
          ticketAmount: ticket.ticket_amount,
          remainingAmount,
        });
      }
      
      if (allPaid) {
        await totemSessionRepo.updateState(sessionIdStr, 'PAID', session);
        emitSessionPaidLegacy(sessionIdStr);
        
        emitSessionFullyPaid(sessionIdStr, {
          paymentTotal: updated.payment_total,
          paymentType: updated.payment_type,
        });
      }

      return updated;
    });
  },
  { failureThreshold: 3, resetTimeout: 15000, halfOpenMaxCalls: 2 },
  'OrderService.markTicketPaid'
);

// Circuit breaker para eliminar items
const deleteItemBreaker = new CircuitBreaker(
  async (args: { itemId: string; requesterPerms: string[] }) => {
    const { itemId, requesterPerms } = args;
    return withTransaction(async (session) => {
      const item = await itemOrderRepo.findById(itemId);
      if (!item) throw new Error(ErrorCode.ITEM_NOT_FOUND);
      
      if (item.item_state !== 'ORDERED') {
        throw new Error(ErrorCode.CANNOT_DELETE_ITEM_NOT_ORDERED);
      }
      
      if (!canDelete(requesterPerms)) {
        throw new Error(ErrorCode.REQUIRES_AUTHORIZATION);
      }

      const deleted = await itemOrderRepo.deleteItem(itemId, session);
      if (!deleted) throw new Error(ErrorCode.ITEM_NOT_FOUND_OR_ALREADY_PROCESSED);

      emitItemDeleted(item.session_id.toString(), item._id.toString());

      return deleted;
    });
  },
  { failureThreshold: 5, resetTimeout: 10000, halfOpenMaxCalls: 3 },
  'OrderService.deleteItem'
);

// Circuit breaker para asignar items a cliente
const assignItemBreaker = new CircuitBreaker(
  async (args: { itemId: string; customerId: string | null }) => {
    const { itemId, customerId } = args;
    return withTransaction(async (session) => {
      const item = await itemOrderRepo.findById(itemId);
      if (!item) throw new Error(ErrorCode.ITEM_NOT_FOUND);

      let customerName: string | null = null;
      if (customerId) {
        const customer = await customerRepo.findById(customerId);
        customerName = customer?.customer_name ?? null;
      }

      const updated = await itemOrderRepo.assignItemToCustomer(itemId, customerId, customerName, session);
      if (!updated) throw new Error(ErrorCode.UPDATE_FAILED);

      emitCustomerAssigned(item.session_id.toString(), item._id.toString(), customerId);

      return updated;
    });
  },
  { failureThreshold: 5, resetTimeout: 10000, halfOpenMaxCalls: 3 },
  'OrderService.assignItemToCustomer'
);

// Registrar todos los circuit breakers en el monitor
circuitBreakerMonitor.register(createOrderBreaker);
circuitBreakerMonitor.register(addItemBreaker);
circuitBreakerMonitor.register(updateItemStateBreaker);
circuitBreakerMonitor.register(createPaymentBreaker);
circuitBreakerMonitor.register(markTicketPaidBreaker);
circuitBreakerMonitor.register(deleteItemBreaker);
circuitBreakerMonitor.register(assignItemBreaker);

// ============================================================================
// Funciones públicas con Circuit Breaker
// ============================================================================

export async function createOrder(sessionId: string, staffId?: string, customerId?: string) {
  try {
    return await createOrderBreaker.execute(sessionId, staffId, customerId);
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    if ((err as Error).message === 'CIRCUIT_BREAKER_OPEN') {
      throw new Error(`${ErrorCode.DATABASE_ERROR}: Order creation temporarily unavailable - circuit breaker open`);
    }
    throw new Error(ErrorCode.SESSION_NOT_ACTIVE);
  }
}

export async function addItemToOrder(
  orderId: string,
  sessionId: string,
  dishId: string,
  customerId?: string,
  variantId?: string,
  extras: string[] = []
) {
  return addItemBreaker.execute({ orderId, sessionId, dishId, customerId, variantId, extras });
}

export async function updateItemState(
  itemId: string,
  newState: string,
  _requesterId: string,
  requesterPerms: string[]
) {
  return updateItemStateBreaker.execute({ itemId, newState, requesterPerms });
}

export async function getSessionItems(sessionId: string) {
  return itemOrderRepo.findBySessionIdLean(sessionId);
}

/**
 * Get kitchen items using optimized aggregation with KDS details.
 */
export async function getKitchenItems(restaurantId: string) {
  const totems = await totemRepo.findByRestaurantIdSelectId(restaurantId);
  const totemIds = totems.map((t) => t._id.toString());
  const sessions = await totemSessionRepo.findByTotemIdsAndState(totemIds, 'STARTED');
  const sessionIds = sessions.map((s) => s._id.toString());

  // Use optimized KDS aggregation
  const items = await itemOrderRepo.getKDSItemsWithDetails(sessionIds, {
    states: ['ORDERED', 'ON_PREPARE'],
    types: ['KITCHEN'],
    sortBy: 'createdAt',
    sortOrder: 'asc',
  });

  return items;
}

export async function calculateSessionTotal(
  sessionId: string,
  customTip?: number
): Promise<{ subtotal: number; tax: number; tips: number; total: number }> {
  const session = await totemSessionRepo.findById(sessionId);
  if (!session) throw new Error(ErrorCode.SESSION_NOT_FOUND);

  const totem = await totemRepo.findById(session.totem_id.toString());
  if (!totem) throw new Error(ErrorCode.TOTEM_NOT_FOUND);

  const restaurant = await restaurantRepo.findById(totem.restaurant_id.toString());
  if (!restaurant) throw new Error(ErrorCode.RESTAURANT_NOT_FOUND);

  const items = await itemOrderRepo.findActiveBySessionId(sessionId);

  const totalWithTax = items.reduce((acc, item) => {
    const prices = calculateItemPrice(item);
    return acc + prices.total;
  }, 0);

  const tax = TaxUtils.extractTax(totalWithTax, restaurant.tax_rate);
  const subtotal = parseFloat((totalWithTax - tax).toFixed(2));
  const tips = calculateTips(totalWithTax, customTip, restaurant);

  return {
    subtotal,
    tax,
    tips,
    total: parseFloat((totalWithTax + tips).toFixed(2)),
  };
}

export async function createPayment(
  sessionId: string,
  paymentType: 'ALL' | 'BY_USER' | 'SHARED',
  parts: number = 1,
  customTip?: number
) {
  return createPaymentBreaker.execute({ sessionId, paymentType, parts, customTip });
}

export async function markTicketPaid(paymentId: string, ticketPart: number) {
  return markTicketPaidBreaker.execute({ paymentId, ticketPart });
}

export async function deleteItem(itemId: string, requesterPerms: string[]) {
  return deleteItemBreaker.execute({ itemId, requesterPerms });
}

export async function assignItemToCustomer(itemId: string, customerId: string | null) {
  return assignItemBreaker.execute({ itemId, customerId });
}

/**
 * Get service items using optimized aggregation.
 */
export async function getServiceItems(restaurantId: string) {
  const totems = await totemRepo.findByRestaurantIdSelectId(restaurantId);
  const totemIds = totems.map((t) => t._id.toString());
  const sessions = await totemSessionRepo.findByTotemIdsAndState(totemIds, 'STARTED');
  const sessionIds = sessions.map((s) => s._id.toString());

  // Use optimized KDS aggregation for service items
  const items = await itemOrderRepo.getKDSItemsWithDetails(sessionIds, {
    states: ['ORDERED'],
    types: ['SERVICE'],
    sortBy: 'createdAt',
    sortOrder: 'asc',
  });

  return items;
}

/**
 * Get orders with items for a session using optimized aggregation.
 */
export async function getOrdersWithItems(sessionId: string) {
  return orderRepo.getOrdersWithItems(sessionId, {
    includeCancelled: false,
  });
}

/**
 * Get daily metrics for a restaurant.
 */
export async function getDailyMetrics(restaurantId: string, date: Date) {
  const totems = await totemRepo.findByRestaurantIdSelectId(restaurantId);
  const totemIds = totems.map(t => t._id.toString());
  const sessions = await totemSessionRepo.findByTotemIdsAndState(totemIds, 'STARTED');
  const sessionIds = sessions.map(s => s._id.toString());

  return orderRepo.getDailyMetrics(sessionIds, date);
}

// ============================================================================
// Exports adicionales para monitoreo
// ============================================================================

export { createOrderBreaker, addItemBreaker, updateItemStateBreaker };
export { createPaymentBreaker, markTicketPaidBreaker, deleteItemBreaker, assignItemBreaker };
