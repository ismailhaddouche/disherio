import { ApplicationConfig, provideBrowserGlobalErrorListeners, ErrorHandler } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { errorInterceptor } from './interceptors/error.interceptor';
import { GlobalErrorHandler } from './services/global-error.handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Configuración de router con lazy loading y preloading strategy
    // PreloadAllModules: Carga todos los módulos lazy después de la carga inicial
    provideRouter(routes, withPreloading(PreloadAllModules)),
    // Registrar interceptores en orden: JWT primero, luego manejo de errores
    provideHttpClient(withInterceptors([jwtInterceptor, errorInterceptor])),
    provideAnimations(),
    // Configurar manejador global de errores
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};
