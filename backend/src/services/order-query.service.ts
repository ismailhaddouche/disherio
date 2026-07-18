import { orderRepositories } from './order-repositories';

export async function getSessionItems(sessionId: string) {
  return orderRepositories.items.findBySessionIdLean(sessionId);
}

async function getActiveSessionIds(restaurantId: string): Promise<string[]> {
  const totems = await orderRepositories.totems.findByRestaurantIdSelectId(restaurantId);
  const sessions = await orderRepositories.sessions.findByTotemIdsAndState(
    totems.map((totem) => totem._id.toString()),
    'STARTED'
  );
  return sessions.map((session) => session._id.toString());
}

export async function getKitchenItems(restaurantId: string) {
  const sessionIds = await getActiveSessionIds(restaurantId);
  return orderRepositories.items.getKDSItemsWithDetails(sessionIds, {
    states: ['ORDERED', 'ON_PREPARE', 'SERVED'],
    types: ['KITCHEN'],
    sortBy: 'createdAt',
    sortOrder: 'asc',
  });
}

export async function getServiceItems(restaurantId: string) {
  const sessionIds = await getActiveSessionIds(restaurantId);
  return orderRepositories.items.getKDSItemsWithDetails(sessionIds, {
    states: ['ORDERED'],
    types: ['SERVICE'],
    sortBy: 'createdAt',
    sortOrder: 'asc',
  });
}
