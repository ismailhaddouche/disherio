import { ErrorCode } from '@disherio/shared';
import { IExtra } from '../models/dish.model';
import { IItemOrder } from '../models/order.model';
import {
  DishRepository,
  ItemOrderRepository,
  OrderRepository,
  TotemSessionRepository,
} from '../repositories';
import { notifyKDSNewItem } from '../sockets/kds.handler';
import { notifyPOSNewOrder } from '../sockets/pos.handler';
import { notifyTASNewOrder } from '../sockets/tas.handler';
import { normalizeLocalizedField } from '../utils/i18n.utils';
import { withTransaction } from '../utils/transactions';
import {
  assertIdempotentPayload,
  assertLimitedOrderAllowed,
  getCategoryUnlimitedMap,
  getSessionOrderLimitStatus,
  orderRequestHash,
  resolveRequestedDishOptions,
} from './order-request-policy.service';
import * as totemService from './totem.service';

const dishRepo = new DishRepository();
const itemOrderRepo = new ItemOrderRepository();
const orderRepo = new OrderRepository();
const totemSessionRepo = new TotemSessionRepository();

export interface PublicOrderItemInput {
  dishId: string;
  quantity: number;
  variantId?: string;
  extras?: string[];
}

export interface PublicOrderResult {
  orderId: string;
  items: IItemOrder[];
}

export async function createPublicOrderFromQR(
  qr: string,
  sessionId: string,
  items: PublicOrderItemInput[],
  requestId: string,
  customerId?: string,
  sessionToken?: string
): Promise<PublicOrderResult> {
  if (
    items.length === 0
    || items.length > 100
    || items.reduce((total, item) => total + item.quantity, 0) > 100
  ) {
    throw new Error(ErrorCode.VALIDATION_ERROR);
  }

  const session = await totemService.getPublicSessionByQR(qr, sessionId, sessionToken);
  const totem = await totemService.getTotemByQR(qr);
  if (!totem) throw new Error(ErrorCode.TOTEM_NOT_FOUND);

  const restaurantId = totem.restaurant_id.toString();
  const sessionIdStr = session._id.toString();
  const requestHash = orderRequestHash({
    customer_id: customerId ?? null,
    items: items.map(item => ({ ...item, extras: [...(item.extras ?? [])].sort() })),
  });

  const { orderId, createdItems, created } = await withTransaction(async (dbSession) => {
    const lockedSession = await totemSessionRepo.lockById(sessionIdStr, dbSession);
    if (!lockedSession) throw new Error(ErrorCode.SESSION_NOT_FOUND);

    const lockedToken = lockedSession.session_token;
    if (!lockedToken || lockedToken !== sessionToken) {
      throw new Error(ErrorCode.INVALID_TOKEN);
    }

    const existingOrder = await orderRepo.findByRequestId(sessionIdStr, requestId, dbSession);
    if (existingOrder) {
      assertIdempotentPayload(existingOrder.request_hash, requestHash);
      return {
        orderId: existingOrder._id.toString(),
        createdItems: await itemOrderRepo.findByOrderId(existingOrder._id.toString(), dbSession),
        created: false,
      };
    }

    if (lockedSession.totem_state !== 'STARTED') {
      throw new Error(ErrorCode.SESSION_NOT_ACTIVE);
    }
    const publicCustomer = customerId
      ? await totemService.assertCustomerInSession(customerId, sessionIdStr, sessionToken)
      : undefined;
    const uniqueDishIds = [...new Set(items.map(item => item.dishId))];
    const dishes = await Promise.all(uniqueDishIds.map(id => dishRepo.findById(id)));
    const dishMap = new Map(
      dishes
        .filter((dish): dish is NonNullable<typeof dish> => dish !== null)
        .map(dish => [dish._id.toString(), dish])
    );
    const categoryUnlimitedMap = await getCategoryUnlimitedMap(
      dishes
        .filter((dish): dish is NonNullable<typeof dish> => dish !== null)
        .map(dish => dish.category_id.toString())
    );
    const limitedDishIds = new Set<string>();
    const unlimitedDishIds = new Set<string>();
    for (const item of items) {
      const dish = dishMap.get(item.dishId);
      if (!dish) throw new Error(ErrorCode.DISH_NOT_FOUND);
      if (dish.restaurant_id.toString() !== restaurantId) throw new Error(ErrorCode.FORBIDDEN);
      if (dish.disher_status !== 'ACTIVATED') throw new Error(ErrorCode.DISH_NOT_AVAILABLE);
      if (categoryUnlimitedMap.get(dish.category_id.toString()) ?? false) {
        unlimitedDishIds.add(item.dishId);
      } else {
        limitedDishIds.add(item.dishId);
      }
    }

    const limitStatus = await getSessionOrderLimitStatus(sessionIdStr, restaurantId, dbSession);
    assertLimitedOrderAllowed(limitStatus, [...limitedDishIds], [...unlimitedDishIds]);

    const order = await orderRepo.createOrder(
      sessionIdStr,
      undefined,
      customerId,
      dbSession,
      { requestId, requestHash }
    );

    const itemsToCreate: Array<{
      order_id: string;
      session_id: string;
      item_dish_id: string;
      customer_id?: string;
      customer_name?: string;
      last_activity_source?: 'CUSTOMER';
      last_activity_user_id?: string;
      item_disher_type: 'KITCHEN' | 'SERVICE';
      order_number?: number;
      item_name_snapshot: { lang: string; value: string }[];
      item_base_price: number;
      item_disher_variant: { variant_id: string; name: { lang: string; value: string }[]; price: number } | null;
      item_disher_extras: { extra_id: string; name: { lang: string; value: string }[]; price: number }[];
      unlimited_order_item?: boolean;
    }> = [];

    for (const item of items) {
      const dish = dishMap.get(item.dishId);
      if (!dish) throw new Error(ErrorCode.DISH_NOT_FOUND);

      const { variant, selectedExtras } = resolveRequestedDishOptions(
        dish.variants,
        dish.extras,
        item.variantId,
        item.extras
      );
      const normalizedDishName = normalizeLocalizedField(dish.disher_name);
      if (normalizedDishName.length === 0) throw new Error(ErrorCode.VALIDATION_ERROR);
      if (typeof dish.disher_price !== 'number' || dish.disher_price < 0) {
        throw new Error(ErrorCode.INVALID_PRICE);
      }

      for (let index = 0; index < (item.quantity || 1); index++) {
        const normalizedVariant = variant
          ? {
              variant_id: variant._id.toString(),
              name: normalizeLocalizedField(variant.variant_name),
              price: variant.variant_price,
            }
          : null;
        if (normalizedVariant && normalizedVariant.name.length === 0) {
          throw new Error(ErrorCode.VALIDATION_ERROR);
        }

        const normalizedExtras = selectedExtras.map((extra: IExtra) => ({
          extra_id: extra._id.toString(),
          name: normalizeLocalizedField(extra.extra_name),
          price: extra.extra_price,
        }));
        if (normalizedExtras.some(extra => extra.name.length === 0)) {
          throw new Error(ErrorCode.VALIDATION_ERROR);
        }

        itemsToCreate.push({
          order_id: order._id.toString(),
          session_id: sessionIdStr,
          item_dish_id: item.dishId,
          customer_id: customerId,
          customer_name: publicCustomer?.customer_name,
          last_activity_source: 'CUSTOMER',
          last_activity_user_id: customerId,
          order_number: order.order_number,
          item_disher_type: dish.disher_type,
          item_name_snapshot: normalizedDishName,
          item_base_price: dish.disher_price,
          item_disher_variant: normalizedVariant,
          item_disher_extras: normalizedExtras,
          unlimited_order_item: categoryUnlimitedMap.get(dish.category_id.toString()) ?? false,
        });
      }
    }

    const insertedItems = await itemOrderRepo.addItemsBatch(itemsToCreate, dbSession);
    if (insertedItems.length !== itemsToCreate.length) {
      throw new Error(ErrorCode.VALIDATION_ERROR);
    }
    return { orderId: order._id.toString(), createdItems: insertedItems, created: true };
  });

  if (created) {
    for (const item of createdItems) {
      if (item.item_disher_type === 'KITCHEN') {
        notifyKDSNewItem(sessionIdStr, restaurantId, item);
      }
    }

    notifyTASNewOrder(sessionIdStr, { items: createdItems, orderId, addedBy: 'customer' });
    notifyPOSNewOrder(sessionIdStr, { items: createdItems, orderId, addedBy: 'customer' });
  }

  return { orderId, items: createdItems };
}

export { resolveRequestedDishOptions } from './order-request-policy.service';
