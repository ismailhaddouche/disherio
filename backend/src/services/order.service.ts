import { ErrorCode } from '@disherio/shared';
import { getIO } from '../config/socket';
import { notifyTASNewOrder } from '../sockets/tas.handler';
import { emitSessionFullyPaid, emitTicketPaid } from '../sockets/pos.handler';
import { notifyCustomerItemUpdate } from '../sockets/totem.handler';
import * as TaxUtils from '../utils/tax';
import { withTransaction } from '../utils/transactions';
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

interface ItemPriceBreakdown {
  basePrice: number;
  variantPrice: number;
  extrasTotal: number;
  total: number;
}

function calculateItemPrice(item: {
  item_base_price: number;
  item_disher_variant?: { price?: number } | null;
  item_disher_extras?: Array<{ price: number }>;
}): ItemPriceBreakdown {
  const variantPrice = item.item_disher_variant?.price ?? 0;
  const extrasTotal = item.item_disher_extras?.reduce((sum, e) => sum + e.price, 0) ?? 0;
  
  return {
    basePrice: item.item_base_price,
    variantPrice,
    extrasTotal,
    total: item.item_base_price + variantPrice + extrasTotal,
  };
}

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

export async function createOrder(sessionId: string, staffId?: string, customerId?: string) {
  try {
    // Use transaction to ensure session validation and order creation are atomic
    return withTransaction(async (session) => {
      const totemSession = await totemSessionRepo.findById(sessionId);
      if (!totemSession || totemSession.totem_state !== 'STARTED') {
        throw new Error(ErrorCode.SESSION_NOT_ACTIVE);
      }
      return orderRepo.createOrder(sessionId, staffId, customerId, session);
    });
  } catch (err) {
    if (err instanceof ValidationError) throw err;
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
  // Use transaction to ensure order validation, dish availability check, and item creation are atomic
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

    // Validate all prices before creating the item
    validateItemPrices(
      dish.disher_price,
      variant?.variant_price,
      selectedExtras.map(e => ({ price: e.extra_price }))
    );

    // Get customer name if customerId is provided
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

    // Notify TAS (waiters) about the new order item
    notifyTASNewOrder(sessionId, {
      item,
      addedBy: 'customer', // or 'system' depending on context
      dishType: dish.disher_type,
    });

    return item;
  });
}

export async function updateItemState(
  itemId: string,
  newState: string,
  _requesterId: string,
  requesterPerms: string[]
) {
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
}

export async function getSessionItems(sessionId: string) {
  return itemOrderRepo.findBySessionIdLean(sessionId);
}

export async function getKitchenItems(restaurantId: string) {
  const totems = await totemRepo.findByRestaurantIdSelectId(restaurantId);
  const totemIds = totems.map((t) => t._id.toString());
  const sessions = await totemSessionRepo.findByTotemIdsAndState(totemIds, 'STARTED');
  const sessionIds = sessions.map((s) => s._id.toString());

  const totemNameMap = new Map(totems.map(t => [t._id.toString(), t.totem_name]));
  const sessionTotemMap = new Map(
    sessions.map(s => [s._id.toString(), totemNameMap.get(s.totem_id.toString()) ?? ''])
  );

  const items = await itemOrderRepo.findKitchenItemsBySessionIds(sessionIds);
  return items.map(item => ({
    ...item,
    totem_name: sessionTotemMap.get(item.session_id.toString()) ?? '',
  }));
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

function calculateTips(
  totalWithTax: number,
  customTip: number | undefined,
  restaurant: { tips_state?: boolean; tips_type?: string; tips_rate?: number }
): number {
  if (customTip !== undefined && customTip >= 0) {
    return parseFloat(customTip.toFixed(2));
  }
  
  if (restaurant.tips_state && restaurant.tips_type === 'MANDATORY' && restaurant.tips_rate) {
    return parseFloat((totalWithTax * (restaurant.tips_rate / 100)).toFixed(2));
  }
  
  return 0;
}

export async function createPayment(
  sessionId: string,
  paymentType: 'ALL' | 'BY_USER' | 'SHARED',
  parts: number = 1,
  customTip?: number
) {
  const { total } = await calculateSessionTotal(sessionId, customTip);

  // Validate that there are items in the session before creating the payment
  if (total <= 0) {
    throw new Error(ErrorCode.NO_ITEMS_TO_PAY);
  }

  const tickets = paymentType === 'BY_USER'
    ? await buildByUserTickets(sessionId)
    : buildSharedTickets(total, parts);

  // Use transaction to ensure payment creation and session update are atomic
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
}

function buildSharedTickets(total: number, parts: number) {
  return TaxUtils.splitAmount(total, parts).map((amount, index) => ({
    ticket_part: index + 1,
    ticket_total_parts: parts,
    ticket_amount: amount,
    paid: false,
  }));
}

async function buildByUserTickets(sessionId: string) {
  const items = await itemOrderRepo.findBySessionId(sessionId);
  const customerTotals = calculateCustomerTotals(items);

  return Object.entries(customerTotals).map(([customerId, amount], index) => ({
    ticket_part: index + 1,
    ticket_total_parts: Object.keys(customerTotals).length,
    ticket_amount: parseFloat(amount.toFixed(2)),
    ticket_customer_name: `Customer ${customerId.slice(-4)}`,
    paid: false,
  }));
}

function calculateCustomerTotals(items: Array<{
  customer_id?: { toString(): string } | null;
  item_base_price: number;
  item_disher_variant?: { price?: number } | null;
  item_disher_extras?: Array<{ price: number }>;
}>): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const item of items) {
    const customerId = item.customer_id?.toString() ?? 'unknown';
    const prices = calculateItemPrice(item);
    
    totals[customerId] = (totals[customerId] ?? 0) + prices.total;
  }

  return totals;
}

export async function markTicketPaid(paymentId: string, ticketPart: number) {
  const payment = await paymentRepo.findById(paymentId);
  if (!payment) throw new Error(ErrorCode.PAYMENT_NOT_FOUND);

  // Use transaction to ensure payment update and session state change are atomic
  return withTransaction(async (session) => {
    const updated = await paymentRepo.markTicketPaid(paymentId, ticketPart, session);
    if (!updated) throw new Error(ErrorCode.TICKET_NOT_FOUND);

    const allPaid = updated.tickets.every((t) => t.paid);
    const sessionIdStr = updated.session_id.toString();
    
    // Emit ticket paid notification to POS and TAS
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
      
      // Emit detailed session fully paid notification
      emitSessionFullyPaid(sessionIdStr, {
        paymentTotal: updated.payment_total,
        paymentType: updated.payment_type,
      });
    }

    return updated;
  });
}

export async function deleteItem(itemId: string, requesterPerms: string[]) {
  // Use transaction to ensure item state check and deletion are atomic
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
}

export async function assignItemToCustomer(itemId: string, customerId: string | null) {
  // Use transaction to ensure item and customer lookup and update are atomic
  return withTransaction(async (session) => {
    const item = await itemOrderRepo.findById(itemId);
    if (!item) throw new Error(ErrorCode.ITEM_NOT_FOUND);

    // Get customer name if customerId is provided
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
}

export async function getServiceItems(restaurantId: string) {
  const totems = await totemRepo.findByRestaurantIdSelectId(restaurantId);
  const totemIds = totems.map((t) => t._id.toString());
  const sessions = await totemSessionRepo.findByTotemIdsAndState(totemIds, 'STARTED');
  const sessionIds = sessions.map((s) => s._id.toString());

  return itemOrderRepo.findServiceItemsBySessionIds(sessionIds);
}
