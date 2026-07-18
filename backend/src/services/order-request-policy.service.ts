import { ErrorCode } from '@disherio/shared';
import { createHash } from 'node:crypto';
import { ClientSession, Types } from 'mongoose';
import { Category, IExtra, IVariant } from '../models/dish.model';
import { createError } from '../utils/async-handler';
import { orderRepositories } from './order-repositories';

const { items: itemOrderRepo, restaurants: restaurantRepo } = orderRepositories;

export interface SessionOrderLimitStatus {
  interval_minutes: number;
  max_orders_per_session: number;
  limited_order_count: number;
  remaining_limited_orders: number | null;
  next_limited_order_at: string | null;
}

export async function getCategoryUnlimitedMap(categoryIds: string[]): Promise<Map<string, boolean>> {
  const validCategoryIds = [...new Set(categoryIds)].filter(id => Types.ObjectId.isValid(id));
  if (validCategoryIds.length === 0) return new Map();

  const categories = await Category.find({
    _id: { $in: validCategoryIds.map(id => new Types.ObjectId(id)) },
  })
    .select('_id unlimited_orders')
    .lean()
    .exec();

  return new Map(categories.map(category => [
    category._id.toString(),
    Boolean(category.unlimited_orders),
  ]));
}

export async function getSessionOrderLimitStatus(
  sessionId: string,
  restaurantId: string,
  session?: ClientSession
): Promise<SessionOrderLimitStatus> {
  const restaurant = await restaurantRepo.findByIdLean(restaurantId);
  const intervalMinutes = Math.max(0, Number(restaurant?.order_interval_minutes ?? 0));
  const maxOrders = Math.max(0, Number(restaurant?.max_orders_per_session ?? 0));
  const stats = await itemOrderRepo.getLimitedOrderStats(sessionId, session);

  return buildSessionOrderLimitStatus(intervalMinutes, maxOrders, stats);
}

export async function getSessionOrderLimitStatuses(
  sessionIds: string[],
  restaurantId: string
): Promise<Map<string, SessionOrderLimitStatus>> {
  if (sessionIds.length === 0) return new Map();

  const [restaurant, statsBySession] = await Promise.all([
    restaurantRepo.findByIdLean(restaurantId),
    itemOrderRepo.getLimitedOrderStatsBySessionIds(sessionIds),
  ]);
  const intervalMinutes = Math.max(0, Number(restaurant?.order_interval_minutes ?? 0));
  const maxOrders = Math.max(0, Number(restaurant?.max_orders_per_session ?? 0));

  return new Map(sessionIds.map(sessionId => [
    sessionId,
    buildSessionOrderLimitStatus(
      intervalMinutes,
      maxOrders,
      statsBySession.get(sessionId) ?? { count: 0, lastOrderDate: null }
    ),
  ]));
}

export async function getActiveItemCountsBySessionIds(
  sessionIds: string[]
): Promise<Map<string, number>> {
  return itemOrderRepo.getActiveItemCountsBySessionIds(sessionIds);
}

export function assertLimitedOrderAllowed(
  status: SessionOrderLimitStatus,
  limitedDishIds: string[],
  unlimitedDishIds: string[]
): void {
  if (limitedDishIds.length === 0) return;

  const details = {
    status,
    blockedLimitedDishIds: limitedDishIds,
    allowedUnlimitedDishIds: unlimitedDishIds,
    canSubmitUnlimitedOnly: unlimitedDishIds.length > 0,
  };

  if (status.max_orders_per_session > 0 && status.limited_order_count >= status.max_orders_per_session) {
    throw createError.conflict(ErrorCode.ORDER_LIMIT_REACHED, {
      ...details,
      reason: ErrorCode.ORDER_LIMIT_REACHED,
    });
  }

  if (status.next_limited_order_at) {
    throw createError.conflict(ErrorCode.ORDER_INTERVAL_ACTIVE, {
      ...details,
      reason: ErrorCode.ORDER_INTERVAL_ACTIVE,
    });
  }
}

export function orderRequestHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalizePayload(payload))).digest('hex');
}

export function assertIdempotentPayload(requestHash: string | undefined, expectedHash: string): void {
  if (requestHash !== expectedHash) {
    throw createError.conflict(ErrorCode.IDEMPOTENCY_CONFLICT);
  }
}

export function resolveRequestedDishOptions(
  variants: IVariant[],
  extras: IExtra[],
  variantId?: string,
  requestedExtraIds: string[] = []
): { variant: IVariant | null; selectedExtras: IExtra[] } {
  const variant = variantId
    ? variants.find(candidate => candidate._id.toString() === variantId) ?? null
    : null;
  if (variantId && !variant) {
    throw new Error(ErrorCode.VALIDATION_ERROR);
  }

  const selectedExtras = extras.filter(extra => requestedExtraIds.includes(extra._id.toString()));
  if (new Set(requestedExtraIds).size !== requestedExtraIds.length || selectedExtras.length !== requestedExtraIds.length) {
    throw new Error(ErrorCode.VALIDATION_ERROR);
  }
  return { variant, selectedExtras };
}

function buildSessionOrderLimitStatus(
  intervalMinutes: number,
  maxOrders: number,
  stats: { count: number; lastOrderDate: Date | null }
): SessionOrderLimitStatus {
  const nextDate = intervalMinutes > 0 && stats.lastOrderDate
    ? new Date(stats.lastOrderDate.getTime() + intervalMinutes * 60 * 1000)
    : null;
  const nextLimitedOrderAt = nextDate && nextDate.getTime() > Date.now()
    ? nextDate.toISOString()
    : null;

  return {
    interval_minutes: intervalMinutes,
    max_orders_per_session: maxOrders,
    limited_order_count: stats.count,
    remaining_limited_orders: maxOrders > 0 ? Math.max(0, maxOrders - stats.count) : null,
    next_limited_order_at: nextLimitedOrderAt,
  };
}

function canonicalizePayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizePayload);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((normalized, key) => {
        const entry = (value as Record<string, unknown>)[key];
        if (entry !== undefined) normalized[key] = canonicalizePayload(entry);
        return normalized;
      }, {});
  }
  return value;
}
