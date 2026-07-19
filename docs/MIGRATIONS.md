# Database Migrations

DisherIo uses a small versioned migration runner (`backend/src/migrations/`) instead of
opportunistic schema fixes at runtime.

## How it works

- `runMigrations(allMigrations)` runs at bootstrap, right after `connectDB()` and before the
  HTTP port opens. If a migration throws, the process exits (fail-fast).
- Applied migrations are recorded in the MongoDB collection `schema_migrations`
  (`{ _id: <name>, appliedAt }`). Already-recorded names are skipped.
- A lock document in the same collection serializes concurrent processes; stale locks
  (> 60 s) are stolen automatically.

## Adding a migration

1. Create `backend/src/migrations/NNNN-short-description.ts` with the next sequence number:

   ```ts
   export const migrationNNNN = {
     name: 'NNNN-short-description',
     async up(): Promise<void> {
       // ...
     },
   };
   ```

2. Register it at the END of `allMigrations` in `backend/src/migrations/index.ts`.
   Never reorder or rename migrations that may already be applied anywhere.
3. Make it idempotent where possible and prefer Mongoose models over raw collection names.
4. Add a test in `backend/src/__tests__/migration-runner.test.ts` (or a sibling file) following
   the existing integration pattern (`MONGODB_URI_TEST` gating).

Index-only changes that are purely declarative may stay in Mongoose schema `index()` calls;
use a migration whenever existing documents or existing indexes must change.
