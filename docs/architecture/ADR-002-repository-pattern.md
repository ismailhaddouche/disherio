# ADR-002: Repository Pattern

**Status:** Implemented

## Context

Direct Mongoose model usage scattered across service functions made unit testing difficult (every test required a live MongoDB connection) and made it hard to reason about which queries existed for a given entity.

## Decision

Use repositories as the normal boundary for reusable queries, tenant-scoped
lookups, aggregations, and persistence shared by multiple callers. The current
repositories cover users and roles, restaurants, dishes and categories, orders
and payments, and totems and sessions.

Direct model access remains in a small number of services, controllers, and
socket handlers where no repository exists or where an operation needs an
explicit document lock, atomic state filter, or transaction-specific query.
Such access must still enforce validation, tenant ownership, and transaction
boundaries at the owning layer.

### Repository structure

```typescript
// repositories/user.repository.ts
export class UserRepository {
  async findByUsernameAndRestaurant(
    username: string,
    restaurantId: string
  ): Promise<IStaff | null> {
    validateObjectId(restaurantId, 'restaurant_id');
    return Staff.findOne({
      username: username.toLowerCase(),
      restaurant_id: new Types.ObjectId(restaurantId),
    }).select('+password_hash').exec();
  }

  async findByRestaurantId(restaurantId: string): Promise<IStaff[]> {
    validateObjectId(restaurantId, 'restaurant_id');
    return Staff.find({ restaurant_id: new Types.ObjectId(restaurantId) })
      .populate('role_id')
      .lean()
      .exec();
  }
}
```

### Service usage

```typescript
// services/auth.service.ts
const userRepo = new UserRepository();

export async function loginWithUsername(
  username: string,
  password: string,
  restaurantId?: string
) {
  const staff = restaurantId
    ? await userRepo.findByUsernameAndRestaurant(username, restaurantId)
    : await userRepo.findByUsername(username);
  if (!staff) throw new Error('INVALID_CREDENTIALS');
  // Authentication and payload construction remain service concerns.
}
```

### Rules

1. Repositories contain persistence and query composition, not HTTP or UI logic.
2. Services use an existing repository for ordinary access instead of
   duplicating its query.
3. Direct model access requires a concrete persistence reason and must not
   bypass tenant ownership, validation, atomic filters, or sessions.
4. ObjectId validation happens before a query is executed.
5. Read-only methods return plain objects with `.lean()` where document methods
   are unnecessary.

## Consequences

- Reusable and query-heavy persistence is centralized and can be tested without
  coupling business logic to query construction.
- Transactional or atomic operations can remain close to the invariant they
  protect when forcing them through a generic repository would obscure it.
- Persistence access is not fully centralized, so reviews must inspect both
  repositories and the documented direct-access exceptions.
