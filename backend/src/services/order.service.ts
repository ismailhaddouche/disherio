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
  ValidationError,
} from '../repositories';

// Repository instances
const orderRepo = new OrderRepository();
const itemOrderRepo = new ItemOrderRepository();
const paymentRepo = new PaymentRepository();
const totemRepo = new TotemRepository();
const totemSessionRepo = new TotemSessionRepository();
const restaurantRepo = new RestaurantRepository();
const dishRepo = new DishRepository();

export async function createOrder(sessionId: string, staffId?: string, customerId?: string) {
  try {
    const session = await totemSessionRepo.findById(sessionId);
    if (!session || session.totem_state !== 'STARTED') throw new Error('SESSION_NOT_ACTIVE');
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
  // Validate order exists
  const order = await orderRepo.findById(orderId);
  if (!order) throw new Error('ORDER_NOT_FOUND');

  const dish = await dishRepo.findById(dishId);
  if (!dish) throw new Error('DISH_NOT_FOUND');
  if (dish.disher_status !== 'ACTIVATED') throw new Error('DISH_NOT_AVAILABLE');

  const variant = variantId
    ? dish.variants.find((v: IVariant) => v._id.toString() === variantId)
    : null;
  const extraItems = dish.extras.filter((e: IExtra) =>
    extras.includes(e._id.toString())
  );

  const item = await itemOrderRepo.createItem({
    order_id: orderId,
    session_id: sessionId,
    item_dish_id: dishId,
    customer_id: customerId,
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
    item_disher_extras: extraItems.map((e: any) => ({
      extra_id: e._id.toString(),
      name: e.extra_name,
      price: e.extra_price,
    })),
  });

  if (dish.disher_type === 'KITCHEN') {
    getIO().to(`session:${sessionId}`).emit('kds:new_item', item);
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

  const validTransitions: Record<string, string[]> = {
    ORDERED: ['ON_PREPARE', 'CANCELED'],
    ON_PREPARE: ['SERVED', 'CANCELED'],
    SERVED: [],
    CANCELED: [],
  };

  if (!validTransitions[item.item_state]?.includes(newState)) {
    throw new Error('INVALID_STATE_TRANSITION');
  }

  // TAS can only cancel ORDERED items freely; ON_PREPARE requires POS/ADMIN
  if (newState === 'CANCELED' && item.item_state === 'ON_PREPARE') {
    const canForceCancel = requesterPerms.some((p) => ['ADMIN', 'POS'].includes(p));
    if (!canForceCancel) throw new Error('REQUIRES_POS_AUTHORIZATION');
  }

  const updated = await itemOrderRepo.updateState(
    itemId,
    newState as 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED'
  );

  getIO().to(`session:${item.session_id.toString()}`).emit('item:state_changed', {
    itemId: item._id,
    newState,
  });

  return updated;
}

export async function getSessionItems(sessionId: string) {
  return itemOrderRepo.findBySessionIdLean(sessionId);
}

// BUG-05: return all active kitchen items for the restaurant (ORDERED + ON_PREPARE)
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

  // Get restaurant through totem
  const totem = await totemRepo.findById(session.totem_id.toString());
  if (!totem) throw new Error('TOTEM_NOT_FOUND');

  const restaurant = await restaurantRepo.findById(totem.restaurant_id.toString());
  if (!restaurant) throw new Error('RESTAURANT_NOT_FOUND');

  const items = await itemOrderRepo.findActiveBySessionId(sessionId);

  // The prices in items already INCLUDE tax (PVP)
  const totalWithTax = items.reduce((acc, item) => {
    const variantPrice = item.item_disher_variant?.price || 0;
    const extrasTotal =
      (item.item_disher_extras || []).reduce(
        (s: number, e) => s + e.price,
        0
      );
    return acc + item.item_base_price + variantPrice + extrasTotal;
  }, 0);

  // Extract tax from the total gross
  const tax = TaxUtils.extractTax(totalWithTax, restaurant.tax_rate);
  const subtotal = parseFloat((totalWithTax - tax).toFixed(2));

  // Tips: If customTip is provided, use it. Otherwise, if MANDATORY, calculate it.
  let tips = 0;
  if (customTip !== undefined && customTip >= 0) {
    tips = customTip;
  } else if (
    restaurant.tips_state &&
    restaurant.tips_type === 'MANDATORY' &&
    restaurant.tips_rate
  ) {
    tips = parseFloat((totalWithTax * (restaurant.tips_rate / 100)).toFixed(2));
  }

  return {
    subtotal,
    tax,
    tips: parseFloat(tips.toFixed(2)),
    total: parseFloat((totalWithTax + tips).toFixed(2)),
  };
}

export async function createPayment(
  sessionId: string,
  paymentType: 'ALL' | 'BY_USER' | 'SHARED',
  parts: number = 1,
  customTip?: number
) {
  const { total } = await calculateSessionTotal(sessionId, customTip);

  const tickets =
    paymentType === 'BY_USER'
      ? await buildByUserTickets(sessionId, total)
      : TaxUtils.splitAmount(total, parts).map((amount, i) => ({
          ticket_part: i + 1,
          ticket_total_parts: parts,
          ticket_amount: amount,
          paid: false,
        }));

  const payment = await paymentRepo.createPayment({
    session_id: sessionId,
    payment_type: paymentType,
    payment_total: total,
    tickets,
  });

  await totemSessionRepo.updateState(sessionId, 'COMPLETE');
  return payment;
}

async function buildByUserTickets(sessionId: string, _total: number) {
  const items = await itemOrderRepo.findBySessionId(sessionId);

  const byCustomer: Record<
    string,
    { name: string; amount: number }
  > = {};

  for (const item of items) {
    const cId = item.customer_id?.toString() || 'unknown';
    // Note: customer name lookup would require Customer model
    if (!byCustomer[cId]) byCustomer[cId] = { name: `Customer ${cId.slice(-4)}`, amount: 0 };
    const variantPrice = item.item_disher_variant?.price || 0;
    const extrasTotal =
      (item.item_disher_extras || []).reduce(
        (s: number, e) => s + e.price,
        0
      );
    byCustomer[cId].amount += item.item_base_price + variantPrice + extrasTotal;
  }

  const customers = Object.values(byCustomer);
  return customers.map((c, i) => ({
    ticket_part: i + 1,
    ticket_total_parts: customers.length,
    ticket_amount: parseFloat(c.amount.toFixed(2)),
    ticket_customer_name: c.name,
    paid: false,
  }));
}

export async function markTicketPaid(paymentId: string, ticketPart: number) {
  const payment = await paymentRepo.findById(paymentId);
  if (!payment) throw new Error('PAYMENT_NOT_FOUND');

  const updated = await paymentRepo.markTicketPaid(paymentId, ticketPart);
  if (!updated) throw new Error('TICKET_NOT_FOUND');

  const allPaid = updated.tickets.every((t) => t.paid);
  if (allPaid) {
    await totemSessionRepo.updateState(updated.session_id.toString(), 'PAID');
    getIO().to(`session:${updated.session_id.toString()}`).emit('session:paid');
  }

  return updated;
}
