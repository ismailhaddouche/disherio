# ADR-004: Validation and Shared Types

**Status:** Implemented

## Context

Without a single source of truth for request shapes and entity types, the backend and frontend can drift out of sync silently. A field renamed on the backend breaks the frontend only at runtime.

## Decision

Keep public domain schemas and types in the `shared/` package. Backend routes
consume those schemas directly or through the existing dish and order
re-exports. Authentication keeps route-specific login schemas under
`backend/src/schemas/`. Frontend clients import shared contracts for HTTP typing.

### Zod schemas (backend)

Mutation request bodies are validated by a Zod schema before reaching the
controller. Multipart uploads use Multer plus content, signature, MIME,
extension, size, and dimension validation instead of the JSON body middleware.

```typescript
// backend/src/schemas/auth.schema.ts
export const LoginSchema = z.object({
  username: z.string().min(2).max(50),
  password: z.string().min(6),
  restaurant_id: z.string().optional(),
});
```

```typescript
// middlewares/validate.ts
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        errors: result.error.flatten().fieldErrors,
      });
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

- Shared contract mismatches surface during workspace compilation instead of
  only at runtime.
- Shared request changes have one canonical schema; route-specific
  authentication schemas remain backend-owned.
- The `shared/` package must be built before either backend or frontend compiles; CI must account for this order
- Zod parse errors are returned as structured JSON (`error.flatten()`), giving clients machine-readable field-level messages
