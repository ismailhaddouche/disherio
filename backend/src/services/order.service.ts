import { getIO } from '../config/socket';
import * as TaxUtils from '../utils/tax';
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
    throw new Error('INVALID_STATE_TRANSITION');
  }
}

function canForceCancel(permissions: string[]): boolean {
  return permissions.some((p) => CANCEL_PERMISSIONS.includes(p));
}

function canDelete(permissions: string[]): boolean {
  return permissions.some((p) => DELETE_PERMISSIONS.includes(p));
}

function emitItemStateChanged(sessionId: string, itemId: string, newState: string): void {
  getIO().to(`session:${sessionId}`).emit('item:state_changed', { itemId, newState });
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

function emitSessionPaid(sessionId: string): void {
  getIO().to(`session:${sessionId}`).emit('session:paid');
}

export async function createOrder(sessionId: string, staffId?: string, customerId?: string) {
  try {
    const session = await totemSessionRepo.findById(sessionId);
    if (!session || session.totem_state !== 'STARTED') {
      throw new Error('SESSION_NOT_ACTIVE');
    }
    return orderRepo.createOrder(sessionId, staffId, customerId);
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new Error('SESSION_NOT_ACTIVE');
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
  const order = await orderRepo.findById(orderId);
  if (!order) throw new Error('ORDER_NOT_FOUND');

  const dish = await dishRepo.findById(dishId);
  if (!dish) throw new Error('DISH_NOT_FOUND');
  if (dish.disher_status !== 'ACTIVATED') throw new Error('DISH_NOT_AVAILABLE');

  const variant = variantId
    ? dish.variants.find((v: IVariant) => v._id.toString() === variantId)
    : null;
  
  const selectedExtras = dish.extras.filter((e: IExtra) =>
    extras.includes(e._id.toString())
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
  });

  if (dish.disher_type === 'KITCHEN') {
    emitNewKitchenItem(sessionId, item);
  }

  return item;
}

export async function updateItemState(
  itemId: string,
  newState: string,
  _requesterId: string,
  requesterPerms: string[]
) {
  const item = await itemOrderRepo.findById(itemId);
  if (!item) throw new Error('ITEM_NOT_FOUND');

  validateStateTransition(item.item_state, newState, item.item_disher_type);

  if (newState === 'CANCELED' && item.item_state === 'ON_PREPARE') {
    if (!canForceCancel(requesterPerms)) {
      throw new Error('REQUIRES_POS_AUTHORIZATION');
    }
  }

  const updated = await itemOrderRepo.updateState(
    itemId,
    newState as 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED'
  );

  emitItemStateChanged(item.session_id.toString(), item._id.toString(), newState);

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

  return itemOrderRepo.findKitchenItemsBySessionIds(sessionIds);
}

export async function calculateSessionTotal(
  sessionId: string,
  customTip?: number
): Promise<{ subtotal: number; tax: number; tips: number; total: number }> {
  const session = await totemSessionRepo.findById(sessionId);
  if (!session) throw new Error('SESSION_NOT_FOUND');

  const totem = await totemRepo.findById(session.totem_id.toString());
  if (!totem) throw new Error('TOTEM_NOT_FOUND');

  const restaurant = await restaurantRepo.findById(totem.restaurant_id.toString());
  if (!restaurant) throw new Error('RESTAURANT_NOT_FOUND');

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

  // Validar que haya items en la sesión antes de crear el pago
  if (total <= 0) {
    throw new Error('NO_ITEMS_TO_PAY');
  }

  const tickets = paymentType === 'BY_USER'
    ? await buildByUserTickets(sessionId)
    : buildSharedTickets(total, parts);

  const payment = await paymentRepo.createPayment({
    session_id: sessionId,
    payment_type: paymentType,
    payment_total: total,
    tickets,
  });

  await totemSessionRepo.updateState(sessionId, 'COMPLETE');
  return payment;
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
  if (!payment) throw new Error('PAYMENT_NOT_FOUND');

  const updated = await paymentRepo.markTicketPaid(paymentId, ticketPart);
  if (!updated) throw new Error('TICKET_NOT_FOUND');

  const allPaid = updated.tickets.every((t) => t.paid);
  if (allPaid) {
    await totemSessionRepo.updateState(updated.session_id.toString(), 'PAID');
    emitSessionPaid(updated.session_id.toString());
  }

  return updated;
}

export async function deleteItem(itemId: string, requesterPerms: string[]) {
  const item = await itemOrderRepo.findById(itemId);
  if (!item) throw new Error('ITEM_NOT_FOUND');
  
  if (item.item_state !== 'ORDERED') {
    throw new Error('CANNOT_DELETE_ITEM_NOT_ORDERED');
  }
  
  if (!canDelete(requesterPerms)) {
    throw new Error('REQUIRES_AUTHORIZATION');
  }

  const deleted = await itemOrderRepo.deleteItem(itemId);
  if (!deleted) throw new Error('ITEM_NOT_FOUND_OR_ALREADY_PROCESSED');

  emitItemDeleted(item.session_id.toString(), item._id.toString());

  return deleted;
}

export async function assignItemToCustomer(itemId: string, customerId: string | null) {
  const item = await itemOrderRepo.findById(itemId);
  if (!item) throw new Error('ITEM_NOT_FOUND');

  // Get customer name if customerId is provided
  let customerName: string | null = null;
  if (customerId) {
    const customer = await customerRepo.findById(customerId);
    customerName = customer?.customer_name ?? null;
  }

  const updated = await itemOrderRepo.assignItemToCustomer(itemId, customerId, customerName);
  if (!updated) throw new Error('UPDATE_FAILED');

  emitCustomerAssigned(item.session_id.toString(), item._id.toString(), customerId);

  return updated;
}

export async function getServiceItems(restaurantId: string) {
  const totems = await totemRepo.findByRestaurantIdSelectId(restaurantId);
  const totemIds = totems.map((t) => t._id.toString());
  const sessions = await totemSessionRepo.findByTotemIdsAndState(totemIds, 'STARTED');
  const sessionIds = sessions.map((s) => s._id.toString());

  return itemOrderRepo.findServiceItemsBySessionIds(sessionIds);
}
