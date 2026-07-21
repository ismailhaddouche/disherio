# Error Codes Usage Guide

## Overview

DisherIO uses centralized error codes defined in `@disherio/shared` to ensure consistency between backend and frontend.

## ErrorCode Enum

All error codes are defined in `shared/errors/error-codes.ts` as a TypeScript enum.

### Categories

- **Authentication**: `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `INVALID_TOKEN`, etc.
- **Not Found**: `DISH_NOT_FOUND`, `ORDER_NOT_FOUND`, `ITEM_NOT_FOUND`, etc.
- **Business Logic**: `INVALID_STATE_TRANSITION`, `SESSION_NOT_ACTIVE`, `ACTIVE_SESSION_EXISTS`, etc.
- **Validation**: `VALIDATION_ERROR`, `INVALID_ID_FORMAT`, etc.
- **Server**: `SERVER_ERROR`, `DATABASE_ERROR`, etc.

## Error Code Reference

Enum members not covered elsewhere in this document, grouped by the enum's
own categories. HTTP statuses come from `ERROR_HTTP_STATUS_MAP`.

### Authentication & Authorization

| Code | HTTP | Cause |
|------|------|-------|
| `FORBIDDEN` | 403 | Authenticated user lacks permission for the resource or action (`rbac.ts`, `internal-only.ts`) |
| `REQUIRES_POS_AUTHORIZATION` | 403 | Order item operation requires POS authorization (`order-item.service.ts`) |
| `REQUIRES_AUTHORIZATION` | 403 | Item state transition requires authorization (`item-transition-policy.ts`) |
| `AUTHENTICATION_REQUIRED` | 401 | Socket connection attempted without valid authentication (`socketAuth.ts`) |
| `SERVER_CONFIGURATION_ERROR` | 500 | Server is misconfigured, e.g. missing JWT secret (`auth.ts`, `socketAuth.ts`) |
| `AMBIGUOUS_USERNAME` | 400 | Login username matches more than one staff account (`auth.service.ts`) |

### Resource Not Found

All map to HTTP 404.

| Code | Cause |
|------|-------|
| `CATEGORY_NOT_FOUND` | Category does not exist (`dish.service.ts`) |
| `SESSION_NOT_FOUND` | Table session does not exist (`order-access.service.ts`, `payment.service.ts`) |
| `PAYMENT_NOT_FOUND` | Payment does not exist (`payment.service.ts`) |
| `TICKET_NOT_FOUND` | Ticket does not exist when fetching receipts (`payment.service.ts`) |
| `TOTEM_NOT_FOUND` | Totem/table does not exist (`order-access.service.ts`, `socketAuth.ts`) |
| `RESTAURANT_NOT_FOUND` | Restaurant does not exist (`payment.service.ts`) |
| `STAFF_NOT_FOUND` | Staff member does not exist (`staff.service.ts`) |
| `ROLE_NOT_FOUND` | Role does not exist (`staff.service.ts`) |
| `USER_NOT_FOUND` | User does not exist (`staff.service.ts`) |
| `CUSTOMER_NOT_FOUND` | Customer does not exist in the session (`order-access.service.ts`) |

### Business Logic

| Code | HTTP | Cause |
|------|------|-------|
| `DISH_NOT_AVAILABLE` | 400 | Dish is unavailable and cannot be ordered (`order-item.service.ts`, `public-order.service.ts`) |
| `ORDER_LIMIT_REACHED` | 409 | Session reached the maximum number of concurrent orders (`order-request-policy.service.ts`) |
| `ORDER_INTERVAL_ACTIVE` | 409 | Minimum interval between orders has not elapsed (`order-request-policy.service.ts`) |
| `ORDER_ALREADY_PAID` | 400 | Order is already paid and cannot be modified (`order-item.service.ts`, `payment.service.ts`) |
| `SESSION_ALREADY_PAID` | 409 | Session is already fully paid (`totem.service.ts`) |
| `NO_ITEMS_TO_PAY` | 400 | Payment requested with no payable items (`payment.service.ts`) |
| `CANNOT_DELETE_ITEM_NOT_ORDERED` | 400 | Only items still in `ordered` state can be deleted (`order-item.service.ts`) |
| `ITEM_NOT_FOUND_OR_ALREADY_PROCESSED` | 400 | Item does not exist or its state already changed (`order-item.service.ts`) |
| `UPDATE_FAILED` | 500 | Database update did not affect the expected document (`order-item.service.ts`, `totem.service.ts`) |
| `CATEGORY_HAS_DISHES` | 409 | Category cannot be deleted while it contains dishes (`dish.service.ts`) |
| `SESSION_HAS_ITEMS` | 409 | Session cannot be closed while it has items (`totem.service.ts`) |
| `LAST_ADMIN` | 409 | The last admin account cannot be deleted or demoted (`staff.service.ts`) |

### Validation

| Code | HTTP | Cause |
|------|------|-------|
| `INVALID_PRICE` | 400 | Price is invalid or inconsistent with the expected total (`order-price-policy.ts`, `payment.service.ts`) |

### Data Conflicts

| Code | HTTP | Cause |
|------|------|-------|
| `USER_ALREADY_EXISTS` | 409 | Username is already taken (`staff.service.ts`) |
| `CUSTOMER_NAME_TAKEN` | 409 | Customer name is already used in the session (`totem.service.ts`) |
| `IDEMPOTENCY_CONFLICT` | 409 | Idempotency key reused with a different payload (`order-request-policy.service.ts`) |

### Server

| Code | HTTP | Cause |
|------|------|-------|
| `SERVICE_UNAVAILABLE` | 503 | Dependency temporarily unavailable; circuit breaker open (`circuit-breaker.ts`) |

## Backend Usage

### Throwing Errors

```typescript
import { ErrorCode } from '@disherio/shared';

// In services
if (!dish) {
  throw new Error(ErrorCode.DISH_NOT_FOUND);
}

// The error-handler middleware will automatically:
// - Map ErrorCode to appropriate HTTP status (404, 400, 403, etc.)
// - Translate the error message using i18next
// - Return consistent JSON: { error: string, errorCode: ErrorCode, status: number }
```

### HTTP Status Mapping

The `ERROR_HTTP_STATUS_MAP` provides automatic mapping:

```typescript
ErrorCode.UNAUTHORIZED → 401
ErrorCode.DISH_NOT_FOUND → 404
ErrorCode.VALIDATION_ERROR → 400
ErrorCode.DUPLICATE_RESOURCE → 409
// etc.
```

## Frontend Usage

### Handling Errors

```typescript
import { ErrorCode } from '@disherio/shared';
import { HttpErrorResponse } from '@angular/common/http';

// In services or components
this.http.get('/api/dishes/123').subscribe({
  next: (dish) => { /* ... */ },
  error: (err: HttpErrorResponse) => {
    if (err.error?.errorCode === ErrorCode.DISH_NOT_FOUND) {
      // Show "Dish not found" message
      this.showNotFoundError();
    } else if (err.error?.errorCode === ErrorCode.UNAUTHORIZED) {
      // Redirect to login
      this.router.navigate(['/login']);
    }
  }
});
```

### JWT Interceptor

The JWT interceptor already uses ErrorCode to handle authentication errors:

```typescript
// In jwt.interceptor.ts
catchError((error: HttpErrorResponse) => {
  const errorCode = error.error?.errorCode;
  if (
    error.status === 401 ||
    errorCode === ErrorCode.UNAUTHORIZED ||
    errorCode === ErrorCode.INVALID_TOKEN ||
    errorCode === ErrorCode.SESSION_EXPIRED
  ) {
    authStore.clearAuth();
    router.navigate(['/login']);
  }
  return throwError(() => error);
})
```

## Rate Limiting (429)

The rate limiters in `backend/src/middlewares/rateLimit.config.ts` emit enum
members `AUTH_RATE_LIMIT_EXCEEDED`, `API_RATE_LIMIT_EXCEEDED`,
`STRICT_RATE_LIMIT_EXCEEDED`, `UPLOAD_RATE_LIMIT_EXCEEDED`,
`QR_RATE_LIMIT_EXCEEDED`, and `QR_BRUTE_FORCE_DETECTED`. Responses include a
`retryAfter` field (seconds):

| Code | Limiter | Limit |
|------|---------|-------|
| `API_RATE_LIMIT_EXCEEDED` | General API | 1000 requests per 15 minutes |
| `STRICT_RATE_LIMIT_EXCEEDED` | Strict mutations | 20 requests per 15 minutes |
| `UPLOAD_RATE_LIMIT_EXCEEDED` | Uploads | 10 uploads per hour |

## Adding New Error Codes

1. Add the new code to `shared/errors/error-codes.ts`:
   ```typescript
   export enum ErrorCode {
     // ... existing codes
     NEW_ERROR_CODE = 'NEW_ERROR_CODE',
   }
   ```

2. Add HTTP status mapping in `ERROR_HTTP_STATUS_MAP`:
   ```typescript
   [ErrorCode.NEW_ERROR_CODE]: 400, // or appropriate status
   ```

3. Add translation key in backend i18n files:
   ```json
   // backend/src/locales/en/translation.json
   {
     "errors": {
       "NEW_ERROR_CODE": "Custom error message"
     }
   }
   ```

4. Use in backend:
   ```typescript
   throw new Error(ErrorCode.NEW_ERROR_CODE);
   ```

5. Use in frontend:
   ```typescript
   if (error.errorCode === ErrorCode.NEW_ERROR_CODE) { ... }
   ```

## Best Practices

1. **Always use ErrorCode enum** instead of hardcoded strings
2. **Check error codes, not status codes** when specific handling is needed
3. **Add translations** for all new error codes
4. **Keep error codes granular** - don't use generic SERVER_ERROR for business logic errors
5. **Document business logic errors** in code comments

## Migration Guide

If you find hardcoded error strings like:
```typescript
// OLD (don't do this)
throw new Error('DISH_NOT_FOUND');
if (error.errorCode === 'DISH_NOT_FOUND') { ... }
```

Replace with:
```typescript
// NEW (correct way)
import { ErrorCode } from '@disherio/shared';

throw new Error(ErrorCode.DISH_NOT_FOUND);
if (error.errorCode === ErrorCode.DISH_NOT_FOUND) { ... }
```
