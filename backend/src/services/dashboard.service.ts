import {
  CategoryRepository,
  DishRepository,
  ItemOrderRepository,
  PaymentRepository,
} from '../repositories';
import { KDSItem, PendingItemsByStation } from '../repositories/order.repository';
import { TotemRepository, TotemSessionRepository } from '../repositories/totem.repository';

export interface DashboardDateRange {
  from?: Date;
  to?: Date;
}

interface StationAggregate extends PendingItemsByStation {
  averageWaitTime?: number;
}

const dishRepo = new DishRepository();
const categoryRepo = new CategoryRepository();
const itemOrderRepo = new ItemOrderRepository();
const paymentRepo = new PaymentRepository();
const totemRepo = new TotemRepository();
const totemSessionRepo = new TotemSessionRepository();

export async function getDashboardStats(restaurantId: string, dateRange: DashboardDateRange) {
  const totems = await totemRepo.findByRestaurantIdSelectId(restaurantId);
  const totemIds = totems.map((totem) => totem._id.toString());
  const allSessions = await totemSessionRepo.findByTotemIds(totemIds, dateRange);
  const allSessionIds = allSessions.map((session) => session._id.toString());

  const [dishes, categories] = await Promise.all([
    dishRepo.findByRestaurantId(restaurantId),
    categoryRepo.findByRestaurantId(restaurantId),
  ]);
  const dishById = new Map(dishes.map((dish) => [dish._id.toString(), dish]));
  const categoryById = new Map(categories.map((category) => [category._id.toString(), category]));

  // Scoped by the restaurant's sessions, not by live dish ids: items whose
  // dish was deleted keep contributing through their stored snapshots.
  const salesByDish = await itemOrderRepo.getSalesByDish(allSessionIds, dateRange);
  const salesByDishWithNames = salesByDish.map((sale) => ({
    ...sale,
    dishName: dishById.get(sale.dishId.toString())?.disher_name?.[0]?.value
      ?? sale.dishName
      ?? 'Unknown',
  }));

  const categoryTotals = new Map<string, { revenue: number; quantity: number }>();
  for (const sale of salesByDishWithNames) {
    const categoryId = dishById.get(sale.dishId.toString())?.category_id?.toString() ?? 'uncategorized';
    const current = categoryTotals.get(categoryId) ?? { revenue: 0, quantity: 0 };
    current.revenue += sale.revenue;
    current.quantity += sale.quantity;
    categoryTotals.set(categoryId, current);
  }

  const salesByCategory = Array.from(categoryTotals.entries())
    .map(([categoryId, totals]) => ({
      categoryId,
      categoryName: categoryById.get(categoryId)?.category_name?.[0]?.value ?? 'UNCATEGORIZED',
      revenue: Math.round(totals.revenue * 100) / 100,
      quantity: totals.quantity,
    }))
    .sort((left, right) => right.revenue - left.revenue);

  const [paymentStats, statusAggregation] = await Promise.all([
    paymentRepo.getPaymentStats(restaurantId, dateRange),
    allSessionIds.length > 0
      ? itemOrderRepo.getOrderStatusCounts(allSessionIds, dateRange)
      : Promise.resolve([]),
  ]);

  const orderStatus = { ordered: 0, onPrepare: 0, served: 0, canceled: 0 };
  for (const status of statusAggregation) {
    switch (status._id) {
      case 'ORDERED': orderStatus.ordered = status.count; break;
      case 'ON_PREPARE': orderStatus.onPrepare = status.count; break;
      case 'SERVED': orderStatus.served = status.count; break;
      case 'CANCELED': orderStatus.canceled = status.count; break;
    }
  }

  return {
    salesByDish: salesByDishWithNames.slice(0, 10),
    salesByCategory,
    paymentStats,
    orderStatus,
  };
}

export async function getPopularDishes(
  restaurantId: string,
  options: { limit: number; dateRange: DashboardDateRange; type?: 'KITCHEN' | 'SERVICE' }
) {
  return dishRepo.getPopularDishes(restaurantId, options);
}

export async function getCategoryStats(restaurantId: string) {
  return dishRepo.getCategoryStats(restaurantId);
}

export async function getRealtimeMetrics(restaurantId: string) {
  const totems = await totemRepo.findByRestaurantIdSelectId(restaurantId);
  const totemIds = totems.map((totem) => totem._id.toString());
  const sessions = await totemSessionRepo.findByTotemIdsAndState(totemIds, 'STARTED');
  const sessionIds = sessions.map((session) => session._id.toString());

  if (sessionIds.length === 0) {
    return {
      activeSessions: 0,
      pendingKitchenItems: 0,
      pendingServiceItems: 0,
      averageWaitTime: 0,
      itemsByStation: [],
    };
  }

  const itemsByStation = await itemOrderRepo.getPendingItemsByStation(sessionIds, {
    includeService: true,
  });
  const kitchenItems = itemsByStation.find((station) => station._id === 'KITCHEN');
  const serviceItems = itemsByStation.find((station) => station._id === 'SERVICE');
  const allItems: KDSItem[] = itemsByStation.flatMap((station) => station.items);
  const averageWaitTime = allItems.length > 0
    ? Math.round(
        allItems.reduce((sum, item) => sum + (item.waitTimeMinutes ?? 0), 0) / allItems.length
      )
    : 0;

  return {
    activeSessions: sessions.length,
    pendingKitchenItems: kitchenItems?.count ?? 0,
    pendingServiceItems: serviceItems?.count ?? 0,
    averageWaitTime,
    itemsByStation: itemsByStation.map((station) => ({
      station: station._id,
      count: station.count,
      averageWaitTime: (station as StationAggregate).averageWaitTime,
    })),
  };
}
