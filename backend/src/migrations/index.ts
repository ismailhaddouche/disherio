import type { Migration } from './migration.runner';
import { migration0001 } from './0001-staff-pin-lookup-index';
import { migration0002 } from './0002-session-token-backfill';

// Migrations run in array order at bootstrap, before the HTTP port opens.
// Append new migrations at the end; never reorder or rename applied ones.
export const allMigrations: Migration[] = [migration0001, migration0002];
