import { HttpContextToken } from '@angular/common/http';

/**
 * Mark an HTTP request as "silent" so the error interceptor
 * does not show a toast notification on failure.
 * Use for background/passive calls (session checks, syncs, init).
 *
 * Usage:
 *   this.http.get(url, { context: new HttpContext().set(SILENT_REQUEST, true) })
 */
export const SILENT_REQUEST = new HttpContextToken<boolean>(() => false);
