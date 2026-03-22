import { ApplicationConfig, ErrorHandler, importProvidersFrom, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { authInterceptor } from './services/auth.interceptor';
import { errorInterceptor } from './interceptors/error.interceptor';
import { responseInterceptor } from './interceptors/response.interceptor';
import { LucideAngularModule, LayoutDashboard, Utensils, Users, ChefHat, Wallet, Settings, LogOut, ChevronLeft, ChevronRight, Bell, Clock, RefreshCw, Plus, Camera, Facebook, Globe, CreditCard, Printer, User, Lock, PenLine, Package, CheckCircle2, Trash2, AlertTriangle, BookOpen, GlassWater, Circle, HandPlatter, Flame, QrCode, ClipboardList, Armchair, LayoutGrid, Loader2, CheckCircle, CheckCheck, BellRing, MessageSquare, AlertCircle, Monitor, Activity, History, UserCheck, Edit2, Pen, Check, X, ArrowLeft, Banknote, ChartBar, ChartPie, ChevronsLeft, ChevronsRight, CirclePlus, Columns2, Euro, Grid2x2, Hash, Info, Instagram, Layers, Menu, Minus, Pencil, Receipt, Save, Send, ShoppingBag, ShoppingCart, SlidersHorizontal, Split, TriangleAlert, UtensilsCrossed } from 'lucide-angular';

import { routes } from './app.routes';
import { GlobalErrorHandler } from './core/handlers/global-error.handler';
import { AppInitializerService } from './core/services/app-initializer.service';

export function initializeApp(initializer: AppInitializerService) {
  return () => initializer.init();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [AppInitializerService],
      multi: true
    },
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor, responseInterceptor])),
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
      QrCode, ClipboardList, Armchair, LayoutGrid, Loader2, CheckCircle, CheckCheck, BellRing, MessageSquare, AlertCircle, Monitor,
      Activity, History, UserCheck, Edit2, Pen, Check, X,
      ArrowLeft, Banknote, ChartBar, ChartPie, ChevronsLeft, ChevronsRight, CirclePlus, Columns2, Euro, Grid2x2,
      Hash, Info, Instagram, Layers, Menu, Minus, Pencil, Receipt, Save, Send,
      ShoppingBag, ShoppingCart, SlidersHorizontal, Split, TriangleAlert, UtensilsCrossed
    }))
  ]
};
