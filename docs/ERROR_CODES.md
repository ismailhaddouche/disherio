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

## Codes Emitted Outside the Shared Enum

Some operational errors are raised as string literals instead of `ErrorCode`
members. They use the same `{ error, errorCode, status }` response shape.

### Upload validation (400)

Raised by the image-upload pipeline (`backend/src/controllers/image.controller.ts`):

| Code | Cause |
|------|-------|
| `NO_FILE_UPLOADED` | Multipart request arrived without a file |
| `INVALID_FILE` | File failed security/content validation; failing checks are returned in `details` |
| `INVALID_IMAGE_DIMENSIONS` | Image exceeds 4000x4000 pixels |
| `UNEXPECTED_FIELD` | Multipart field name is not the expected upload field |
| `TOO_MANY_FILES` | More than one file was sent in a single upload request |
| `UPLOAD_ERROR` | Any other Multer failure |

`INVALID_FILE_TYPE` and `FILE_TOO_LARGE` (5 MB limit) belong to the same
pipeline but are already part of the shared enum.

### Public totem validation (400)

| Code | Cause |
|------|-------|
| `CUSTOMER_NAME_REQUIRED` | `POST /totems/menu/:qr/session/:sessionId/customers` received a `customer_name` that is missing or shorter than 2 characters |

### Rate limiting (429)

Raised by `backend/src/middlewares/rateLimit.config.ts` alongside the enum
members `AUTH_RATE_LIMIT_EXCEEDED`, `QR_RATE_LIMIT_EXCEEDED`, and
`QR_BRUTE_FORCE_DETECTED`. Responses include a `retryAfter` field (seconds):

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
