import type { Migration } from './migration.runner';
import { migration0001 } from './0001-staff-pin-lookup-index';
import { migration0002 } from './0002-session-token-backfill';
import { migration0003 } from './0003-drop-staff-pin';
import { migration0004 } from './0004-session-tenant-snapshot';
import { migration0005 } from './0005-item-request-id-index';

// Migrations run in array order at bootstrap, before the HTTP port opens.
// Append new migrations at the end; never reorder or rename applied ones.
export const allMigrations: Migration[] = [
  migration0001,
  migration0002,
  migration0003,
  migration0004,
  migration0005,
];
