---
memory_type: stack_guidelines
scope: nodejs, typescript, express, casl
tags: [backend, api, authentication, authorization]
priority: 110
---

# 🔧 DisherIo Backend Stack Guidelines

> **Stack:** Node.js + Express + TypeScript + CASL + MongoDB  
> **Purpose:** Backend API guidelines specific to DisherIo

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/              # Configuration
│   │   ├── database.ts      # MongoDB connection
│   │   ├── env.ts           # Environment validation
│   │   └── cors.ts          # CORS configuration
│   ├── controllers/         # HTTP request handlers
│   │   ├── auth.controller.ts
│   │   ├── user.controller.ts
│   │   └── order.controller.ts
│   ├── middleware/          # Express middleware
│   │   ├── auth.middleware.ts      # JWT verification
│   │   ├── error.middleware.ts     # Global error handler
│   │   ├── validation.middleware.ts # Request validation
│   │   └── permissions.middleware.ts # CASL integration
│   ├── models/              # Mongoose models
│   │   ├── user.model.ts
│   │   ├── order.model.ts
│   │   └── restaurant.model.ts
│   ├── permissions/         # CASL ability definitions
│   │   ├── abilities.ts     # Ability factory
│   │   └── hooks.ts         # Permission hooks
│   ├── routes/              # Route definitions
│   │   ├── auth.routes.ts
│   │   ├── index.ts         # Route composition
│   │   └── api/             # API routes
│   ├── services/            # Business logic
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   └── order.service.ts
│   ├── types/               # TypeScript types
│   │   ├── express.d.ts     # Express extensions
│   │   └── index.ts
│   ├── utils/               # Utilities
│   │   ├── logger.ts        # Winston/Pino logger
│   │   ├── jwt.ts           # JWT helpers
│   │   └── validators.ts    # Custom validators
│   └── index.ts             # Entry point
├── tests/                   # Test files
│   ├── unit/
│   ├── integration/
│   └── setup.ts
└── package.json
```

---

## 🔐 Authentication Flow

```
POST /api/auth/login
    ↓
Validate credentials
    ↓
Generate tokens (access + refresh)
    ↓
Return { user, accessToken, refreshToken }

Authenticated Request:
    ↓
auth.middleware → Verify JWT
    ↓
permissions.middleware → Check CASL abilities
    ↓
Controller → Execute action
```

### JWT Strategy
- **Access Token:** 15 minutes, contains user id, roles, restaurantId
- **Refresh Token:** 7 days, stored in httpOnly cookie or secure storage
- **Refresh Endpoint:** POST `/api/auth/refresh` - validates refresh token, issues new access token

---

## 🛡️ CASL Authorization Patterns

### Defining Abilities
```typescript
// src/permissions/abilities.ts
import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { User } from '../models/user.model';

type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete';
type Subjects = 'Order' | 'User' | 'Restaurant' | 'Menu' | 'all';

export type AppAbility = ReturnType<typeof createMongoAbility>;

export function defineAbilitiesFor(user: User) {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (user.role === 'super-admin') {
    can('manage', 'all');
  } else if (user.role === 'restaurant-admin') {
    can('manage', 'Restaurant', { _id: user.restaurantId });
    can('manage', 'User', { restaurantId: user.restaurantId });
    can('manage', 'Order', { restaurantId: user.restaurantId });
    can('manage', 'Menu', { restaurantId: user.restaurantId });
  } else if (user.role === 'waiter') {
    can('read', 'Menu', { restaurantId: user.restaurantId, isActive: true });
    can('create', 'Order');
    can('read', 'Order', { restaurantId: user.restaurantId, createdBy: user._id });
    can('update', 'Order', ['status'], { createdBy: user._id });
  }
  // ... more roles

  return build();
}
```

### Checking Permissions
```typescript
// Middleware approach
export const checkPermissions = (action: Actions, subject: Subjects) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ability = req.ability; // Attached by auth middleware
    
    if (ability.can(action, subject)) {
      return next();
    }
    
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      code: 'INSUFFICIENT_PERMISSIONS'
    });
  };
};

// Route usage
router.post('/orders', 
  authenticate, 
  checkPermissions('create', 'Order'),
  orderController.create
);
```

### Field-Level Permissions
```typescript
// Only allow updating specific fields based on role
can('update', 'Order', ['status', 'notes'], { 
  restaurantId: user.restaurantId,
  status: { $in: ['pending', 'preparing'] }
});
```

---

## 🧪 Testing Patterns

### Unit Test (Service)
```typescript
// tests/unit/order.service.test.ts
import { OrderService } from '../../src/services/order.service';
import { Order } from '../../src/models/order.model';

jest.mock('../../src/models/order.model');

describe('OrderService', () => {
  let orderService: OrderService;

  beforeEach(() => {
    orderService = new OrderService();
  });

  describe('create', () => {
    it('should create order with calculated total', async () => {
      // Arrange
      const orderData = {
        items: [{ productId: '1', quantity: 2, price: 10 }],
        restaurantId: 'rest123'
      };
      
      // Act
      const result = await orderService.create(orderData);
      
      // Assert
      expect(result.total).toBe(20);
      expect(Order.create).toHaveBeenCalled();
    });
  });
});
```

### Integration Test (API)
```typescript
// tests/integration/order.test.ts
import request from 'supertest';
import { app } from '../../src/index';
import { generateTestToken } from '../helpers/auth';

describe('POST /api/orders', () => {
  it('should create order when user has permission', async () => {
    // Arrange
    const token = generateTestToken({ role: 'waiter', restaurantId: '123' });
    
    // Act
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: '1', quantity: 2 }],
        tableId: 'table123'
      });
    
    // Assert
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('id');
  });

  it('should return 403 when user lacks permission', async () => {
    // Test with kitchen user who cannot create orders
  });
});
```

---

## 📊 Error Handling Standards

### Custom Error Classes
```typescript
// src/errors/index.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
  }
}

export class ValidationError extends AppError {
  constructor(details: Record<string, string>) {
    super('Validation failed', 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthorizationError extends AppError {
  constructor() {
    super('Forbidden', 403, 'FORBIDDEN');
  }
}
```

### Error Middleware
```typescript
// src/middleware/error.middleware.ts
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      details: err.details
    });
  }

  // Log unexpected errors
  logger.error('Unexpected error:', err);

  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
};
```

---

*Backend stack guidelines for DisherIo*
