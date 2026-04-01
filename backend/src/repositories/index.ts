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
  type OrderWithItems,
  type PendingItemsByStation,
  type DailyMetrics,
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

// Re-export query profiler utilities
export {
  QueryProfiler,
  ProfileQuery,
  analyzeIndexUsage,
  type QueryProfile,
  type ExplainResult,
} from '../utils/query-profiler';
