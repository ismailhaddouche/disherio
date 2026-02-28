import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { authInterceptor } from './services/auth.interceptor';
import { LucideAngularModule, LayoutDashboard, Utensils, Users, ChefHat, Wallet, Settings, LogOut, ChevronLeft, ChevronRight, Bell, Clock, RefreshCw, Plus } from 'lucide-angular';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    importProvidersFrom(LucideAngularModule.pick({ 
      LayoutDashboard, Utensils, Users, ChefHat, Wallet, Settings, LogOut, 
      ChevronLeft, ChevronRight, Bell, Clock, RefreshCw, Plus 
    }))
  ]
};
