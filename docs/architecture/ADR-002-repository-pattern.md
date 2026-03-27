# ADR-002: Repository Pattern

**Status:** Implemented

## Context

Direct Mongoose model usage scattered across service functions made unit testing difficult (every test required a live MongoDB connection) and made it hard to reason about which queries existed for a given entity.

## Decision

Every Mongoose model has a corresponding repository class that encapsulates all queries for that model. Services only import repositories, never models directly.

### Repository structure

```typescript
// repositories/user.repository.ts
export class UserRepository {
  async findByUsername(username: string): Promise<IStaff | null> {
    if (!Types.ObjectId.isValid(username)) { /* ... */ }
    return Staff.findOne({ username }).lean();
  }

  async findByRestaurantId(restaurantId: string): Promise<IStaff[]> {
    return Staff.find({ restaurant_id: restaurantId }).lean();
  }

  async createUser(data: CreateUserData): Promise<IStaff> {
    return Staff.create(data);
  }
}
```

### Service usage

```typescript
// services/auth.service.ts
const userRepo = new UserRepository();

export async function loginWithUsername(username: string, password: string) {
  const staff = await userRepo.findByUsername(username);
  if (!staff) throw new Error('INVALID_CREDENTIALS');
  // ... business logic only, no Mongoose calls
}
```

### Rules

1. Repositories only contain queries — no business logic.
2. Services never import or call Mongoose models directly.
3. ObjectId validation happens inside repository methods before any query is executed.
4. Repository methods return plain objects (`.lean()`) where possible.

## Consequences

- Services are unit-testable by substituting the repository with a simple in-memory object
- All queries for a given entity are in one file, making optimization straightforward
- Adding a new query means one addition in the repository with no changes to other layers
- Slightly more files than putting queries directly in services
