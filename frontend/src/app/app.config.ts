import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  ErrorHandler,
  isDevMode,
  inject,
  APP_INITIALIZER,
} from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { provideRouter, withPreloading } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatIconRegistry } from '@angular/material/icon';
import { routes } from './app.routes';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { GlobalErrorHandler } from './core/services/global-error.handler';
import { AuthService } from './core/services/auth.service';
import { I18nService } from './core/services/i18n.service';
import { AuthPreloadingStrategy } from './core/strategies/auth-preloading.strategy';
import { authStore } from './store/auth.store';
import { firstValueFrom } from 'rxjs';

/**
 * Configures the Material icon registry to use the "Material Symbols Outlined"
 * font set for every `<mat-icon>`. Angular Material defaults to the classic
 * "material-icons" font, which this application never loads, so without this
 * call the icon ligatures render as literal text. Must run before the first
 * component paints, hence the APP_INITIALIZER.
 */
function configureIcons(): () => void {
  const registry = inject(MatIconRegistry);
  registry.setDefaultFontSetClass('material-symbols-outlined');
  return () => {};
}

function initializeAuth(): () => Promise<void> {
  const authService = inject(AuthService);
  return async () => {
    if (!authStore.isAuthenticated()) return;
    try {
      const response = await firstValueFrom(authService.refresh());
      authStore.setAuth(response.user, Date.now() + response.expires_in_ms);
    } catch {
      authStore.clearAuth();
    }
  };
}

/**
 * Preloads the initial translation catalog before the first paint so
 * templates never render raw i18n keys. APP_INITIALIZERs run concurrently:
 * if the auth refresh later hydrates a different profile language, the
 * service loads that catalog lazily and the UI updates reactively.
 */
function initializeI18n(): () => Promise<void> {
  const i18n = inject(I18nService);
  return () => i18n.ensureInitialCatalog();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withPreloading(AuthPreloadingStrategy)),
    provideHttpClient(withInterceptors([errorInterceptor, jwtInterceptor])),
    provideAnimations(),
    provideNativeDateAdapter(),
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: configureIcons,
    },
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: initializeAuth,
    },
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: initializeI18n,
    },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
