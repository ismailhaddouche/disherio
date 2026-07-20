import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';
import { authStore } from '../../store/auth.store';

/**
 * Preloads lazy routes only when the current user has the required permissions.
 * Routes without a `permissions` data field are preloaded normally.
 */
@Injectable({ providedIn: 'root' })
export class AuthPreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const required = route.data?.['permissions'] as string[] | undefined;
    if (!required || required.length === 0) {
      return load();
    }

    const user = authStore.user();
    if (!user) {
      return of(null);
    }

    return required.some((p) => user.permissions.includes(p)) ? load() : of(null);
  }
}
