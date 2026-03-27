# ADR-004: Validation and Shared Types

**Status:** Implemented

## Context

Without a single source of truth for request shapes and entity types, the backend and frontend can drift out of sync silently. A field renamed on the backend breaks the frontend only at runtime.

## Decision

Centralise validation schemas in the `shared/` package. Backend routes use these schemas in a `validate` middleware. Frontend uses the same types for HTTP call typing.

### Zod schemas (backend)

Every incoming request body is validated by a Zod schema before reaching the controller.

```typescript
// shared/src/schemas/auth.schema.ts
export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const PinSchema = z.object({
  pin_code: z.string().length(4).regex(/^\d{4}$/),
  restaurant_id: z.string().min(1),
});
```

```typescript
// middlewares/validate.ts
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.flatten() });
    }
    req.body = result.data;
    next();
  };
}
```

### TypeScript interfaces (frontend)

The frontend imports TypeScript interfaces from `shared/` for HTTP response typing. This ensures that if a field is added or renamed, TypeScript surfaces the discrepancy at compile time.

```typescript
// store/auth.store.ts
export interface AuthUser {
  staffId: string;
  restaurantId: string;
  role: string;
  permissions: string[];
  name: string;
}
```

### Permissions as string constants

Permissions are defined as plain string constants (`'ADMIN'`, `'POS'`, `'TAS'`, `'KTS'`) embedded in the JWT and checked by both the backend `requirePermission` middleware and the frontend `authStore.hasPermission()` helper. Using the same strings in both places eliminates the category of bug where the frontend sends a permission name the backend does not recognise.

## Consequences

- A schema mismatch between frontend and backend is caught at TypeScript compile time rather than at runtime
- Adding a new request field requires a change in one schema file, not in every place the field is used
- The `shared/` package must be built before either backend or frontend compiles; CI must account for this order
- Zod parse errors are returned as structured JSON (`error.flatten()`), giving clients machine-readable field-level messages
