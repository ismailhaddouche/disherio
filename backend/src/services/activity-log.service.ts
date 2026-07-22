import i18next from 'i18next';
import {
  ActivityLogRepository,
  ActivityLogType,
} from '../repositories/activity-log.repository';
import { TotemSessionRepository } from '../repositories/totem.repository';

export interface ActivityLogFilters {
  from?: Date;
  to?: Date;
  userId?: string;
  type?: ActivityLogType;
}

const activityLogRepo = new ActivityLogRepository();
const totemSessionRepo = new TotemSessionRepository();

/**
 * Resolve the restaurant's session ids so log aggregations pre-filter by the
 * indexed session_id field instead of scanning every tenant's itemorders.
 */
async function getRestaurantSessionIds(restaurantId: string): Promise<string[]> {
  const sessions = await totemSessionRepo.findByRestaurantId(restaurantId);
  return sessions.map((session) => session._id.toString());
}

function actionFromState(state: string): string {
  switch (state) {
    case 'ORDERED':
    case 'ON_PREPARE':
    case 'SERVED':
    case 'CANCELED':
      return state;
    default:
      return 'UNKNOWN_ACTION';
  }
}

export async function getLogs(restaurantId: string, filters: ActivityLogFilters) {
  const sessionIds = await getRestaurantSessionIds(restaurantId);
  const records = await activityLogRepo.find({
    restaurantId,
    sessionIds,
    ...filters,
    limit: 100,
  });
  const logs = records.map((record) => ({
    id: record._id.toString(),
    type: record.type,
    timestamp: record.timestamp,
    userId: record.userId?.toString(),
    userName: record.userName,
    action: actionFromState(record.itemState),
    details: {
      dishType: record.dishType,
      basePrice: record.basePrice,
      extras: record.extrasCount,
      variant: record.variantName ?? null,
    },
    dishName: record.dishName ?? i18next.t('common.UNKNOWN'),
    status: record.itemState,
  }));

  return {
    logs,
    filters: {
      users: [...new Set(logs.flatMap((log) => log.userId ? [log.userId] : []))],
      types: ['KDS', 'POS', 'TAS', 'CUSTOMER'] as const,
    },
    total: logs.length,
  };
}

export async function getLogUsers(restaurantId: string) {
  const sessionIds = await getRestaurantSessionIds(restaurantId);
  return activityLogRepo.findUsers(restaurantId, sessionIds);
}
