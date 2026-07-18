// Repositories index - Clean Architecture data access layer

export {
  BaseRepository,
  ValidationError,
  validateObjectId,
  validateObjectIdOptional,
  toObjectId,
} from './base.repository';

export {
  OrderRepository,
  ItemOrderRepository,
  PaymentRepository,
  // Types
  type PendingItemsByStation,
  type SalesByDish,
  type KDSItem,
} from './order.repository';

export {
  DishRepository,
  CategoryRepository,
  // Types
  type DishWithCategory,
  type DishStats,
  type CategoryStats,
} from './dish.repository';

export {
  UserRepository,
  RoleRepository,
} from './user.repository';

export {
  RestaurantRepository,
  PrinterRepository,
} from './restaurant.repository';

export {
  TotemRepository,
  TotemSessionRepository,
  CustomerRepository,
} from './totem.repository';

export {
  ActivityLogRepository,
  type ActivityLogQuery,
  type ActivityLogRecord,
  type ActivityLogType,
  type ActivityLogUser,
} from './activity-log.repository';

// Re-export query profiler utilities
export {
  QueryProfiler,
  ProfileQuery,
  analyzeIndexUsage,
  type QueryProfile,
  type ExplainResult,
} from '../utils/query-profiler';
