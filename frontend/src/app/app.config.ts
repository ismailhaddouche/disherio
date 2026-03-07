import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { authInterceptor } from './services/auth.interceptor';
import { LucideAngularModule, LayoutDashboard, Utensils, Users, ChefHat, Wallet, Settings, LogOut, ChevronLeft, ChevronRight, Bell, Clock, RefreshCw, Plus, Camera, Facebook, Globe, CreditCard, Printer, User, Lock, PenLine, Package, CheckCircle2, Trash2, AlertTriangle, BookOpen, GlassWater, Circle, HandPlatter, Flame, QrCode, ClipboardList, Armchair, LayoutGrid, Loader2, CheckCircle, CheckCheck, BellRing, MessageSquare, AlertCircle, Monitor } from 'lucide-angular';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    importProvidersFrom(
      TranslateModule.forRoot({
        defaultLanguage: 'es'
      })
    ),
    provideTranslateHttpLoader({ prefix: './assets/i18n/', suffix: '.json' }),
    importProvidersFrom(LucideAngularModule.pick({
      LayoutDashboard, Utensils, Users, ChefHat, Wallet, Settings, LogOut,
      ChevronLeft, ChevronRight, Bell, Clock, RefreshCw, Plus, Camera, Facebook, Globe, CreditCard, Printer, User, Lock, PenLine, Package, CheckCircle2, Trash2, AlertTriangle, BookOpen, GlassWater, Circle, HandPlatter, Flame,
      QrCode, ClipboardList, Armchair, LayoutGrid, Loader2, CheckCircle, CheckCheck, BellRing, MessageSquare, AlertCircle, Monitor
    }))
  ]
};
