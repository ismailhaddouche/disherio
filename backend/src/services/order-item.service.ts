import { ErrorCode } from '@disherio/shared';
import { IExtra } from '../models/dish.model';
import { IItemOrder } from '../models/order.model';
import { CircuitBreaker } from '../utils/circuit-breaker';
import { circuitBreakerMonitor } from '../utils/circuit-breaker-monitor';
import { normalizeLocalizedField } from '../utils/i18n.utils';
import { assertValidItemStateTransition, ItemState } from '../utils/item-state-machine';
import { withTransaction } from '../utils/transactions';
import { getCustomerInSession, getRestaurantIdForSession } from './order-access.service';
import { assertItemTransitionPermission } from './item-transition-policy';
import { assertValidItemPrices } from './order-price-policy';
import { orderRealtimeEffects } from './order-realtime-effects.service';
import { orderRepositories } from './order-repositories';
import {
  assertIdempotentPayload,
  getCategoryUnlimitedMap,
  orderRequestHash,
  resolveRequestedDishOptions,
} from './order-request-policy.service';

const {
  dishes: dishRepository,
  items: itemRepository,
  orders: orderRepository,
  payments: paymentRepository,
  sessions: sessionRepository,
} = orderRepositories;

const FORCE_CANCEL_PERMISSIONS = new Set(['ADMIN', 'POS']);
const DELETE_PERMISSIONS = new Set(['ADMIN', 'POS', 'TAS']);

function hasAnyPermission(permissions: string[], allowed: ReadonlySet<string>): boolean {
  return permissions.some((permission) => allowed.has(permission));
}

interface AddItemArguments {
  orderId: string;
  sessionId: string;
  dishId: string;
  customerId?: string;
  variantId?: string;
  extras: string[];
  source: 'POS' | 'TAS';
  actorId?: string;
}

interface UpdateItemStateArguments {
  itemId: string;
  newState: string;
  requesterId: string;
  requesterPerms: string[];
  source: 'KDS' | 'POS' | 'TAS';
}

const createOrderBreaker = new CircuitBreaker(
  async (sessionId: string, staffId?: string, customerId?: string) => withTransaction(async (session) => {
    const lockedSession = await sessionRepository.lockIfStateIn(sessionId, ['STARTED'], session);
    if (!lockedSession || lockedSession.totem_state !== 'STARTED') {
      throw new Error(ErrorCode.SESSION_NOT_ACTIVE);
    }
    return orderRepository.createOrder(sessionId, staffId, customerId, session);
  }),
  { failureThreshold: 3, resetTimeout: 15000, halfOpenMaxCalls: 2 },
  'OrderService.createOrder'
);

const addItemBreaker = new CircuitBreaker(
  async (args: AddItemArguments) => {
    const { orderId, sessionId, dishId, customerId, variantId, extras, source, actorId } = args;
    const { item, restaurantId } = await withTransaction(async (session) => {
      const lockedSession = await sessionRepository.lockIfStateIn(sessionId, ['STARTED'], session);
      if (!lockedSession || lockedSession.totem_state !== 'STARTED') {
        throw new Error(ErrorCode.SESSION_NOT_ACTIVE);
      }

      const order = await orderRepository.findById(orderId);
      if (!order) throw new Error(ErrorCode.ORDER_NOT_FOUND);
      if (order.session_id.toString() !== sessionId) {
        throw new Error(ErrorCode.VALIDATION_ERROR);
      }

      const dish = await dishRepository.findById(dishId);
      if (!dish) throw new Error(ErrorCode.DISH_NOT_FOUND);
      const restaurantId = await getRestaurantIdForSession(sessionId, ['STARTED']);
      if (dish.restaurant_id.toString() !== restaurantId) throw new Error(ErrorCode.FORBIDDEN);
      if (dish.disher_status !== 'ACTIVATED') throw new Error(ErrorCode.DISH_NOT_AVAILABLE);

      const { variant, selectedExtras } = resolveRequestedDishOptions(
        dish.variants,
        dish.extras,
        variantId,
        extras
      );
      assertValidItemPrices(
        dish.disher_price,
        variant?.variant_price,
        selectedExtras.map((extra) => ({ price: extra.extra_price }))
      );

      const customerName = customerId
        ? (await getCustomerInSession(customerId, sessionId)).customer_name
        : undefined;
      const item = await itemRepository.createItem({
        order_id: orderId,
        session_id: sessionId,
        item_dish_id: dishId,
        customer_id: customerId,
        customer_name: customerName,
        last_activity_source: source,
        last_activity_user_id: actorId ?? order.staff_id?.toString(),
        order_number: order.order_number,
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
        item_disher_extras: selectedExtras.map((extra: IExtra) => ({
          extra_id: extra._id.toString(),
          name: extra.extra_name,
          price: extra.extra_price,
        })),
      }, session);

      return { item, restaurantId };
    });

    if (item.item_disher_type === 'KITCHEN') {
      orderRealtimeEffects.emitNewKitchenItem(sessionId, restaurantId, item);
    }
    orderRealtimeEffects.notifyTASNewOrder(sessionId, {
      item,
      addedBy: 'staff',
      dishType: item.item_disher_type,
    });
    orderRealtimeEffects.notifyPOSNewOrder(sessionId, {
      items: [item],
      orderId,
      addedBy: 'staff',
    });
    return item;
  },
  { failureThreshold: 5, resetTimeout: 20000, halfOpenMaxCalls: 3 },
  'OrderService.addItem'
);

const updateItemStateBreaker = new CircuitBreaker(
  async (args: UpdateItemStateArguments) => {
    const { itemId, newState, requesterId, requesterPerms, source } = args;
    const item = await itemRepository.findById(itemId);
    if (!item) throw new Error(ErrorCode.ITEM_NOT_FOUND);

    assertItemTransitionPermission(item.item_disher_type, newState, requesterPerms);
    assertValidItemStateTransition(
      item.item_state as ItemState,
      newState as ItemState,
      item.item_disher_type
    );
    if (
      newState === 'CANCELED'
      && item.item_state === 'ON_PREPARE'
      && !hasAnyPermission(requesterPerms, FORCE_CANCEL_PERMISSIONS)
    ) {
      throw new Error(ErrorCode.REQUIRES_POS_AUTHORIZATION);
    }

    const updated = await withTransaction(async (session) => {
      const sessionId = item.session_id.toString();
      const lockedSession = await sessionRepository.lockIfStateIn(
        sessionId,
        ['STARTED', 'COMPLETE'],
        session
      );
      if (!lockedSession) throw new Error(ErrorCode.SESSION_NOT_ACTIVE);
      if ((await paymentRepository.findBySessionId(sessionId, session)).length > 0) {
        throw new Error(ErrorCode.ORDER_ALREADY_PAID);
      }
      return itemRepository.updateState(
        itemId,
        item.item_state,
        newState as ItemState,
        { source, userId: requesterId },
        session
      );
    });
    if (!updated) throw new Error(ErrorCode.INVALID_STATE_TRANSITION);

    orderRealtimeEffects.emitItemStateChanged(
      item.session_id.toString(),
      item._id.toString(),
      newState,
      item.item_name_snapshot
    );
    return updated;
  },
  { failureThreshold: 5, resetTimeout: 10000, halfOpenMaxCalls: 3 },
  'OrderService.updateItemState'
);

const deleteItemBreaker = new CircuitBreaker(
  async (args: { itemId: string; requesterPerms: string[] }) => {
    const { itemId, requesterPerms } = args;
    const result = await withTransaction(async (session) => {
      const item = await itemRepository.findById(itemId);
      if (!item) throw new Error(ErrorCode.ITEM_NOT_FOUND);
      const sessionId = item.session_id.toString();
      if (!await sessionRepository.lockIfStateIn(sessionId, ['STARTED', 'COMPLETE'], session)) {
        throw new Error(ErrorCode.SESSION_NOT_ACTIVE);
      }
      if ((await paymentRepository.findBySessionId(sessionId, session)).length > 0) {
        throw new Error(ErrorCode.ORDER_ALREADY_PAID);
      }
      if (item.item_state !== 'ORDERED') throw new Error(ErrorCode.CANNOT_DELETE_ITEM_NOT_ORDERED);
      if (!hasAnyPermission(requesterPerms, DELETE_PERMISSIONS)) {
        throw new Error(ErrorCode.REQUIRES_AUTHORIZATION);
      }

      const deleted = await itemRepository.deleteItem(itemId, session);
      if (!deleted) throw new Error(ErrorCode.ITEM_NOT_FOUND_OR_ALREADY_PROCESSED);
      return { deleted, sessionId, itemId: item._id.toString() };
    });
    orderRealtimeEffects.emitItemDeleted(result.sessionId, result.itemId);
    return result.deleted;
  },
  { failureThreshold: 5, resetTimeout: 10000, halfOpenMaxCalls: 3 },
  'OrderService.deleteItem'
);

const assignItemBreaker = new CircuitBreaker(
  async (args: { itemId: string; customerId: string | null }) => {
    const { itemId, customerId } = args;
    const result = await withTransaction(async (session) => {
      const item = await itemRepository.findById(itemId);
      if (!item) throw new Error(ErrorCode.ITEM_NOT_FOUND);
      const sessionId = item.session_id.toString();
      if (!await sessionRepository.lockIfStateIn(sessionId, ['STARTED', 'COMPLETE'], session)) {
        throw new Error(ErrorCode.SESSION_NOT_ACTIVE);
      }
      if ((await paymentRepository.findBySessionId(sessionId, session)).length > 0) {
        throw new Error(ErrorCode.ORDER_ALREADY_PAID);
      }

      const customerName = customerId
        ? (await getCustomerInSession(customerId, sessionId)).customer_name
        : null;
      const updated = await itemRepository.assignItemToCustomer(
        itemId,
        customerId,
        customerName,
        session
      );
      if (!updated) throw new Error(ErrorCode.UPDATE_FAILED);
      return { updated, sessionId, itemId: item._id.toString() };
    });
    orderRealtimeEffects.emitCustomerAssigned(result.sessionId, result.itemId, customerId);
    return result.updated;
  },
  { failureThreshold: 5, resetTimeout: 10000, halfOpenMaxCalls: 3 },
  'OrderService.assignItemToCustomer'
);

for (const breaker of [
  createOrderBreaker,
  addItemBreaker,
  updateItemStateBreaker,
  deleteItemBreaker,
  assignItemBreaker,
]) {
  circuitBreakerMonitor.register(breaker);
}

export async function createOrder(sessionId: string, staffId?: string, customerId?: string) {
  return createOrderBreaker.execute(sessionId, staffId, customerId);
}

export async function addItemToOrder(
  orderId: string,
  sessionId: string,
  dishId: string,
  customerId?: string,
  variantId?: string,
  extras: string[] = [],
  source: 'POS' | 'TAS' = 'POS',
  actorId?: string
) {
  return addItemBreaker.execute({
    orderId,
    sessionId,
    dishId,
    customerId,
    variantId,
    extras,
    source,
    actorId,
  });
}

export interface BatchItemInput {
  dishId: string;
  quantity: number;
  customerId?: string;
  variantId?: string;
  extras?: string[];
}

export async function addBatchItems(
  sessionId: string,
  staffId: string,
  items: BatchItemInput[],
  requestId: string,
  asServed: boolean = false,
  source: 'POS' | 'TAS' = 'POS'
): Promise<{ orderId: string; items: IItemOrder[] }> {
  if (items.length === 0) throw new Error(ErrorCode.VALIDATION_ERROR);

  const restaurantId = await getRestaurantIdForSession(sessionId);
  const requestHash = orderRequestHash({
    session_id: sessionId,
    as_served: asServed,
    items: items.map((item) => ({ ...item, extras: [...(item.extras ?? [])].sort() })),
  });

  const transactionResult = await withTransaction(async (session) => {
    const lockedSession = await sessionRepository.lockById(sessionId, session);
    if (!lockedSession) throw new Error(ErrorCode.SESSION_NOT_FOUND);

    const existingOrder = await orderRepository.findByRequestId(sessionId, requestId, session);
    if (existingOrder) {
      assertIdempotentPayload(existingOrder.request_hash, requestHash);
      const persistedItems = await itemRepository.findByOrderId(existingOrder._id.toString(), session);
      return {
        orderId: existingOrder._id.toString(),
        batchId: persistedItems[0]?.batch_id ?? '',
        createdItems: persistedItems,
        created: false,
      };
    }

    const isValidCorrection = lockedSession.totem_state === 'COMPLETE' && asServed;
    if (lockedSession.totem_state !== 'STARTED' && !isValidCorrection) {
      throw new Error(ErrorCode.SESSION_NOT_ACTIVE);
    }
    if (isValidCorrection && (await paymentRepository.findBySessionId(sessionId, session)).length > 0) {
      throw new Error(ErrorCode.ORDER_ALREADY_PAID);
    }

    const uniqueDishIds = [...new Set(items.map((item) => item.dishId))];
    const dishes = await Promise.all(uniqueDishIds.map((id) => dishRepository.findById(id)));
    const existingDishes = dishes.filter((dish): dish is NonNullable<typeof dish> => dish !== null);
    const dishMap = new Map(existingDishes.map((dish) => [dish._id.toString(), dish]));
    const categoryUnlimitedMap = await getCategoryUnlimitedMap(
      existingDishes.map((dish) => dish.category_id.toString())
    );
    const customerNameById = new Map<string, string>();

    for (const input of items) {
      const dish = dishMap.get(input.dishId);
      if (!dish) throw new Error(ErrorCode.DISH_NOT_FOUND);
      if (dish.restaurant_id.toString() !== restaurantId) throw new Error(ErrorCode.FORBIDDEN);
      if (dish.disher_status !== 'ACTIVATED') throw new Error(ErrorCode.DISH_NOT_AVAILABLE);
      const { variant, selectedExtras } = resolveRequestedDishOptions(
        dish.variants,
        dish.extras,
        input.variantId,
        input.extras
      );
      assertValidItemPrices(
        dish.disher_price,
        variant?.variant_price,
        selectedExtras.map((extra) => ({ price: extra.extra_price }))
      );
      if (input.customerId) {
        customerNameById.set(
          input.customerId,
          (await getCustomerInSession(input.customerId, sessionId)).customer_name
        );
      }
    }

    const order = await orderRepository.createOrder(
      sessionId,
      staffId,
      undefined,
      session,
      { requestId, requestHash }
    );
    const orderId = order._id.toString();
    const batchId = `batch_${orderId}_${Date.now()}`;
    const itemsToCreate: Parameters<typeof itemRepository.addItemsBatch>[0] = [];

    for (const input of items) {
      const dish = dishMap.get(input.dishId);
      if (!dish) throw new Error(ErrorCode.DISH_NOT_FOUND);
      const { variant, selectedExtras } = resolveRequestedDishOptions(
        dish.variants,
        dish.extras,
        input.variantId,
        input.extras
      );
      const normalizedVariant = variant
        ? {
            variant_id: variant._id.toString(),
            name: normalizeLocalizedField(variant.variant_name),
            price: variant.variant_price,
          }
        : null;
      const normalizedExtras = selectedExtras.map((extra: IExtra) => ({
        extra_id: extra._id.toString(),
        name: normalizeLocalizedField(extra.extra_name),
        price: extra.extra_price,
      }));

      for (let index = 0; index < (input.quantity || 1); index++) {
        itemsToCreate.push({
          order_id: orderId,
          session_id: sessionId,
          item_dish_id: input.dishId,
          customer_id: input.customerId,
          customer_name: input.customerId ? customerNameById.get(input.customerId) : undefined,
          last_activity_source: source,
          last_activity_user_id: staffId,
          order_number: order.order_number,
          item_state: asServed ? 'SERVED' : 'ORDERED',
          item_disher_type: dish.disher_type,
          item_name_snapshot: normalizeLocalizedField(dish.disher_name),
          item_base_price: dish.disher_price,
          item_disher_variant: normalizedVariant,
          item_disher_extras: normalizedExtras,
          unlimited_order_item: categoryUnlimitedMap.get(dish.category_id.toString()) ?? false,
          batch_id: batchId,
        });
      }
    }

    const createdItems = await itemRepository.addItemsBatch(itemsToCreate, session);
    if (createdItems.length !== itemsToCreate.length) throw new Error(ErrorCode.VALIDATION_ERROR);
    return { orderId, batchId, createdItems, created: true };
  });

  if (transactionResult.created && !asServed) {
    for (const item of transactionResult.createdItems) {
      if (item.item_disher_type === 'KITCHEN') {
        orderRealtimeEffects.notifyKDSNewItem(sessionId, restaurantId, {
          ...item.toObject(),
          batch_id: transactionResult.batchId,
        });
      }
    }
  }
  if (transactionResult.created) {
    const event = {
      items: transactionResult.createdItems,
      orderId: transactionResult.orderId,
      addedBy: 'staff',
    };
    orderRealtimeEffects.notifyTASNewOrder(sessionId, event);
    orderRealtimeEffects.notifyPOSNewOrder(sessionId, event);
  }

  return { orderId: transactionResult.orderId, items: transactionResult.createdItems };
}

export async function updateItemState(
  itemId: string,
  newState: string,
  requesterId: string,
  requesterPerms: string[],
  source: 'KDS' | 'POS' | 'TAS' = 'POS'
) {
  return updateItemStateBreaker.execute({ itemId, newState, requesterId, requesterPerms, source });
}

export async function deleteItem(itemId: string, requesterPerms: string[]) {
  return deleteItemBreaker.execute({ itemId, requesterPerms });
}

export async function assignItemToCustomer(itemId: string, customerId: string | null) {
  return assignItemBreaker.execute({ itemId, customerId });
}
