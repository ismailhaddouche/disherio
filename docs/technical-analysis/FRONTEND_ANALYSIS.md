# 🔬 ANÁLISIS TÉCNICO DEL FRONTEND - DISHERIO

**Documento Generado:** 2026-04-05  
**Versión Angular:** 21.2.x  
**Tipo de Análisis:** Académico y Profundo  
**Arquitectura:** Standalone Components + Signals

---

## 📋 ÍNDICE

1. [Estructura del Proyecto](#1-estructura-del-proyecto)
2. [Dependencias y Librerías](#2-dependencias-y-librerías)
3. [Configuración Angular](#3-configuración-angular)
4. [Módulos y Componentes](#4-módulos-y-componentes)
5. [Servicios](#5-servicios)
6. [Rutas y Navegación](#6-rutas-y-navegación)
7. [Interceptores](#7-interceptores)
8. [Componentes UI](#8-componentes-ui)
9. [Gestión de Estado](#9-gestión-de-estado)
10. [I18N Internacionalización](#10-i18n-internacionalización)
11. [Tests](#11-tests)
12. [Análisis de Seguridad](#12-análisis-de-seguridad)

---

## 1. ESTRUCTURA DEL PROYECTO

### 1.1 Organización de Carpetas

```
frontend/
├── src/
│   ├── app/
│   │   ├── components/          # Componentes globales
│   │   │   ├── error-notification/
│   │   │   └── offline-indicator/
│   │   ├── core/                # Núcleo de la aplicación
│   │   │   ├── casl/           # Autorización CASL
│   │   │   ├── guards/         # Route Guards
│   │   │   ├── interceptors/   # HTTP Interceptors
│   │   │   └── services/       # Core Services
│   │   ├── features/           # Features organizadas por dominio
│   │   │   ├── admin/          # Panel de administración
│   │   │   │   ├── categories/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── dishes/
│   │   │   │   ├── logs/
│   │   │   │   ├── settings/
│   │   │   │   ├── staff/
│   │   │   │   └── totems/
│   │   │   ├── auth/           # Autenticación
│   │   │   ├── kds/            # Kitchen Display System
│   │   │   ├── login/          # Login component
│   │   │   ├── pos/            # Point of Sale
│   │   │   ├── tas/            # Table Assistance Service
│   │   │   ├── totem/          # Menú para clientes
│   │   │   └── unauthorized/   # Página 403
│   │   ├── interceptors/       # Interceptores adicionales
│   │   ├── services/           # Servicios de negocio
│   │   │   └── socket/         # Servicio Socket.IO
│   │   ├── shared/             # Componentes compartidos
│   │   │   ├── components/
│   │   │   ├── directives/
│   │   │   └── pipes/
│   │   ├── store/              # State Management (Signals)
│   │   └── types/              # TypeScript types
│   ├── assets/
│   │   └── i18n/               # Archivos de traducción
│   ├── environments/           # Configuración por ambiente
│   ├── index.html
│   ├── main.ts                 # Entry point standalone
│   └── styles.scss             # Estilos globales + Tailwind
├── angular.json                # Configuración Angular CLI
├── package.json                # Dependencias
├── tailwind.config.js          # Configuración TailwindCSS
├── tsconfig.json               # TypeScript config
└── ngsw-config.json            # Service Worker config
```

### 1.2 Principios de Organización

La estructura sigue el patrón **Feature-Based Architecture** con las siguientes características:

| Principio | Implementación |
|-----------|---------------|
| **Separación de Responsabilidades** | Core, Features, Shared claramente separados |
| **Lazy Loading** | Cada feature tiene su propio archivo de rutas |
| **Standalone Components** | Sin NgModules, usando `standalone: true` |
| **Signals para Estado** | Stores reactivos sin NgRx |
| **Co-locación** | Tests, estilos y lógica juntos |

---

## 2. DEPENDENCIAS Y LIBRERÍAS

### 2.1 Análisis de package.json

```json
{
  "dependencies": {
    "@angular/animations": "^21.2.0",
    "@angular/cdk": "^21.2.3",
    "@angular/common": "^21.2.0",
    "@angular/compiler": "^21.2.0",
    "@angular/core": "^21.2.0",
    "@angular/forms": "^21.2.0",
    "@angular/material": "^21.2.3",
    "@angular/platform-browser": "^21.2.0",
    "@angular/router": "^21.2.0",
    "@angular/service-worker": "^21.2.0",
    "@casl/ability": "^6.8.0",
    "@casl/angular": "^9.0.6",
    "@disherio/shared": "file:../shared",
    "angular-i18next": "^20.0.1",
    "i18next": "^25.10.9",
    "rxjs": "~7.8.0",
    "socket.io-client": "^4.8.3",
    "tailwindcss": "^3.4.17",
    "tslib": "^2.3.0",
    "zod": "^4.3.6"
  }
}
```

### 2.2 Análisis Detallado de Dependencias

#### Framework Core (@angular/*)

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `@angular/core` | 21.2.0 | Framework base con Signals API |
| `@angular/common` | 21.2.0 | Directivas comunes (ngIf, ngFor) |
| `@angular/router` | 21.2.0 | Enrutamiento con lazy loading |
| `@angular/forms` | 21.2.0 | Formularios template-driven |
| `@angular/platform-browser` | 21.2.0 | Renderizado DOM |
| `@angular/animations` | 21.2.0 | Animaciones CSS integradas |
| `@angular/service-worker` | 21.2.0 | PWA y caché offline |

**¿Por qué Angular 21?**
- Signals API estable y madura
- Standalone components como default
- Nueva sintaxis de control flow (@if, @for)
- Mejor tree-shaking
- Compilación más rápida con esbuild

#### Angular Material (@angular/material, @angular/cdk)

**Uso específico en DisherIO:**
- Componentes UI pre-construidos
- Sistema de temas con Material 3
- Overlay CDK para modales y tooltips
- Platform CDK para detección de plataforma

#### CASL (@casl/ability, @casl/angular)

**Propósito:** Autorización basada en habilidades (Ability-Based Authorization)

```typescript
// Ejemplo de definición de habilidades
type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete';
type Subjects = 'Restaurant' | 'Staff' | 'Order' | 'Dish' | 'all';
```

**Roles implementados:**
- **ADMIN**: Acceso total (`can('manage', 'all')`)
- **POS**: Punto de venta, pedidos, pagos
- **TAS**: Servicio de mesas
- **KTS**: Kitchen Display System (cocina)

#### Socket.IO (socket.io-client)

**Características implementadas:**
- Comunicación en tiempo real
- Reconexión automática con backoff exponencial
- Buffer de eventos durante desconexiones
- Rooms por restaurante

**Casos de uso:**
- Actualizaciones KDS en tiempo real
- Notificaciones TAS
- Pedidos de clientes vía Totem

#### TailwindCSS

**Configuración personalizada:**
```javascript
// tailwind.config.js
darkMode: 'class',  // Control manual del tema oscuro
colors: {
  primary: {
    DEFAULT: '#1976d2',
    dark: '#1565c0',
  },
  surface: {
    DEFAULT: '#ffffff',
    dark: '#121212',
  }
}
```

**Clases utilitarias personalizadas definidas en styles.scss:**
- `.btn-admin`, `.btn-primary`, `.btn-secondary`, `.btn-danger`
- `.admin-container`, `.admin-header`, `.admin-title`
- `.admin-grid`, `.admin-card`, `.admin-table`

#### Zod

**Propósito:** Validación de esquemas TypeScript
- Validación de formularios
- Type-safe parsing de respuestas API
- Definición de contratos de datos

### 2.3 Dependencias de Desarrollo

| Paquete | Propósito |
|---------|-----------|
| `@angular/build` | Nuevo build system basado en esbuild |
| `@angular/cli` | Angular CLI v21 |
| `typescript` ~5.9.2 | Soporte para decoradores y tipos estrictos |
| `vitest` ^4.0.8 | Testing moderno (alternativa a Karma/Jasmine) |
| `jsdom` ^28.0.0 | Entorno DOM para tests |
| `prettier` ^3.8.1 | Formateo de código |
| `autoprefixer` + `postcss` | Procesamiento de CSS con Tailwind |

---

## 3. CONFIGURACIÓN ANGULAR

### 3.1 angular.json

```json
{
  "projects": {
    "frontend": {
      "architect": {
        "build": {
          "builder": "@angular/build:application",
          "configurations": {
            "production": {
              "budgets": [
                { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
                { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
              ],
              "serviceWorker": "ngsw-config.json"
            }
          }
        }
      }
    }
  }
}
```

**Puntos clave:**
- **Builder moderno:** `@angular/build:application` (esbuild-based)
- **Budgets:** Control de tamaño de bundle (máximo 1MB)
- **Service Worker:** Configurado para producción

### 3.2 TypeScript Configuration (tsconfig.json)

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "target": "ES2022",
    "module": "preserve"
  },
  "angularCompilerOptions": {
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  }
}
```

**Modo Strict:** TODAS las opciones estrictas habilitadas:
- `strict: true` - Type checking máximo
- `strictTemplates: true` - Type checking en templates
- `noImplicitReturns` - Todas las funciones deben retornar valor

### 3.3 Tailwind + Angular Material Integration

```scss
// styles.scss
@use '@angular/material' as mat;
@tailwind base;
@tailwind components;
@tailwind utilities;

// Material M3 Theme
html {
  @include mat.theme((
    color: (
      primary: mat.$azure-palette,
      theme-type: light,
    ),
    typography: Roboto,
    density: 0,
  ));
}

.dark {
  @include mat.theme((
    color: (
      primary: mat.$azure-palette,
      theme-type: dark,
    ),
  ));
}
```

**Estrategia de theming:**
- Material M3 para componentes Angular Material
- Tailwind para estilos custom y layout
- Clase `.dark` para toggle de tema oscuro

---

## 4. MÓDULOS Y COMPONENTES

### 4.1 Arquitectura Standalone

**NO hay AppModule tradicional.** En su lugar:

```typescript
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
```

### 4.2 App Root Component

```typescript
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    ToastComponent,
    ErrorNotificationComponent,
    OfflineIndicatorComponent,
  ],
  template: `
    <app-offline-indicator />
    <app-toast />
    <app-error-notification />
    <router-outlet />
  `
})
export class App implements OnInit {
  private updateService = inject(UpdateService);

  ngOnInit(): void {
    // Detectar nuevas versiones de la PWA
    if (this.updateService.isEnabled) {
      console.log('Service Worker: Update service initialized');
    }
  }
}
```

**Componentes globales:**
- `ToastComponent` - Notificaciones tipo toast
- `ErrorNotificationComponent` - Errores detallados
- `OfflineIndicatorComponent` - Indicador de conexión

### 4.3 App Configuration

```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Router con preloading
    provideRouter(routes, withPreloading(PreloadAllModules)),
    // Interceptores HTTP
    provideHttpClient(withInterceptors([jwtInterceptor, errorInterceptor])),
    provideAnimations(),
    // Error handler global
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    // Service Worker
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
```

### 4.4 Componentes por Feature

| Feature | Componentes | Tipo |
|---------|-------------|------|
| **Auth** | LoginComponent, UnauthorizedComponent | Público |
| **Admin** | AdminComponent (layout) + 15+ componentes | Protegido |
| **KDS** | KdsComponent | Protegido |
| **POS** | PosComponent | Protegido |
| **TAS** | TasComponent | Protegido |
| **Totem** | TotemComponent | Público (acceso QR) |

### 4.5 Ciclo de Vida y Change Detection

**Estrategia: OnPush en TODO el árbol**

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ...
})
```

**Razones:**
- Mejor rendimiento (menos detecciones de cambio)
- Compatible con Signals
- Fuerza inmutabilidad

**Patrón de uso de Signals en componentes:**

```typescript
export class ExampleComponent {
  // Input signals (Angular 16.1+)
  readonly id = input<string>('');
  
  // Estado interno
  private loading = signal(false);
  readonly isLoading = this.loading.asReadonly();
  
  // Computed
  readonly displayName = computed(() => {
    return this.formatName(this.user()?.name);
  });
  
  // Effects para side-effects
  constructor() {
    effect(() => {
      // Se ejecuta cuando cambian las dependencias
      console.log('Usuario cambió:', this.user());
    });
  }
}
```

---

## 5. SERVICIOS

### 5.1 Arquitectura de Servicios

| Capa | Servicios | Responsabilidad |
|------|-----------|-----------------|
| **Core** | i18n, theme, notification, update, restaurant | Infraestructura |
| **Business** | staff, totem, tas, menu-language | Lógica de negocio |
| **Socket** | SocketService | Comunicación en tiempo real |
| **Error** | ErrorHandlerService, GlobalErrorHandler | Manejo de errores |

### 5.2 SocketService - Análisis Profundo

**Ubicación:** `src/app/services/socket/socket.service.ts`  
**Líneas de código:** ~1422  
**Complejidad:** Alta

#### Características Arquitectónicas

```typescript
@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private connectionRefCount = 0;  // Reference counting
  // ...
}
```

**1. Reference Counting para Conexión:**

```typescript
acquireConnection(): void {
  this.connectionRefCount++;
  if (this.connectionRefCount === 1) {
    this.doConnect();
  }
}

releaseConnection(): void {
  if (this.connectionRefCount > 0) {
    this.connectionRefCount--;
    if (this.connectionRefCount === 0) {
      this.doDisconnect();
    }
  }
}
```

**Ventaja:** Múltiples componentes pueden "adquirir" la conexión sin preocuparse por desconectar a otros.

**2. Event Buffering para Recuperación:**

```typescript
private eventBuffer: Array<{ event: string; data: unknown; timestamp: number }> = [];
private readonly maxBufferSize = 100;

private bufferEvent(event: string, data: unknown): void {
  if (this.eventBuffer.length >= this.maxBufferSize) {
    this.eventBuffer.shift();  // FIFO
  }
  this.eventBuffer.push({ event, data, timestamp: Date.now() });
}
```

**3. Pending Actions Queue:**

```typescript
private pendingActions: Array<{ action: string; params: unknown }> = [];

private executePendingActions(): void {
  // Ejecuta acciones acumuladas durante desconexión
}
```

**4. Gestión de Sesiones Múltiples:**

- **TOTEM:** Sesiones de clientes por QR
- **KDS:** Sesión de cocina
- **TAS:** Sesión de servicio de mesas
- **POS:** Sesión de punto de venta

**5. Sistema de Subjects por Dominio:**

```typescript
// TOTEM
private totemItemUpdateSubject = new Subject<ItemUpdateEvent>();
public totemItemUpdate$ = this.totemItemUpdateSubject.asObservable();

// TAS
private tasItemAddedSubject = new Subject<TASItemEvent>();
public tasItemAdded$ = this.tasItemAddedSubject.asObservable();
```

### 5.3 I18nService - Sistema de Internacionalización

**Arquitectura:**

```typescript
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly _currentLang = signal<Language>('es');
  readonly currentLang = this._currentLang.asReadonly();
  
  readonly isSpanish = computed(() => this._currentLang() === 'es');
  readonly isEnglish = computed(() => this._currentLang() === 'en');
  readonly isFrench = computed(() => this._currentLang() === 'fr');
}
```

**Diccionarios:**
- **ES:** ~450 claves
- **EN:** ~450 claves
- **FR:** ~450 claves

**Prioridad de carga:**
1. Preferencias del usuario (auth store)
2. localStorage
3. Navegador del usuario
4. Español (default)

### 5.4 ThemeService

```typescript
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _currentTheme = signal<Theme>('light');
  readonly currentTheme = this._currentTheme.asReadonly();
  readonly isDark = computed(() => this._currentTheme() === 'dark');
  
  constructor() {
    // Auto-aplica tema cuando cambia
    effect(() => {
      const isDark = this.isDark();
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    });
  }
}
```

### 5.5 NotificationService

```typescript
@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly notifications = signal<Notification[]>([]);

  show(message: string, type: NotificationType = 'info', duration = 4000): void {
    const id = this._nextId++;
    this.notifications.update((list) => [...list, { id, message, type }]);
    setTimeout(() => this.dismiss(id), duration);
  }
}
```

**Tipos de notificación:**
- `success` - Verde
- `error` - Rojo  
- `warning` - Amarillo
- `info` - Azul

### 5.6 UpdateService (PWA)

```typescript
@Injectable({ providedIn: 'root' })
export class UpdateService {
  private swUpdate = inject(SwUpdate);
  
  constructor() {
    if (this.swUpdate.isEnabled) {
      // Detectar nuevas versiones
      this.swUpdate.versionUpdates
        .pipe(filter(e => e.type === 'VERSION_READY'))
        .subscribe(() => {
          this.notificationService.info('Nueva versión disponible');
        });
      
      // Check cada 30 minutos
      setInterval(() => this.checkForUpdate(), 30 * 60 * 1000);
    }
  }
}
```

---

## 6. RUTAS Y NAVEGACIÓN

### 6.1 Estrategia de Lazy Loading

```typescript
export const routes: Routes = [
  // Auth Module (lazy)
  {
    path: '',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  
  // Totem público (acceso por QR)
  {
    path: 'menu/:qr',
    loadComponent: () => import('./features/totem/totem.component').then(m => m.TotemComponent),
  },
  
  // Protected routes con layout
  {
    path: '',
    loadComponent: () => import('./shared/components/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: 'admin', loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES) },
      { path: 'pos', loadChildren: () => import('./features/pos/pos.routes').then(m => m.POS_ROUTES) },
      { path: 'kds', loadChildren: () => import('./features/kds/kds.routes').then(m => m.KDS_ROUTES) },
      { path: 'tas', loadChildren: () => import('./features/tas/tas.routes').then(m => m.TAS_ROUTES) },
    ]
  },
  
  { path: '**', redirectTo: 'login' },
];
```

### 6.2 Guards de Autenticación

**authGuard:**
```typescript
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (authStore.isAuthenticated()) return true;
  return router.createUrlTree(['/login']);
};
```

**roleGuard:**
```typescript
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const required: string[] = route.data['permissions'] || [];
  const user = authStore.user();
  if (!user) return router.createUrlTree(['/login']);
  const hasRole = required.some((p) => user.permissions.includes(p));
  if (hasRole) return true;
  return router.createUrlTree(['/unauthorized']);
};
```

### 6.3 Estrategia de Preloading

```typescript
provideRouter(routes, withPreloading(PreloadAllModules))
```

**PreloadAllModules:** Después de cargar el módulo inicial, Angular precarga todos los demás módulos lazy en segundo plano.

### 6.4 Estructura de Rutas por Feature

```
/admin
  ├── /dashboard
  ├── /dishes
  ├── /dishes/new
  ├── /dishes/:id
  ├── /categories
  ├── /categories/new
  ├── /categories/:id
  ├── /staff
  ├── /staff/new
  ├── /staff/:id
  ├── /totems
  ├── /totems/new
  ├── /totems/:id
  ├── /settings
  └── /logs

/pos - Punto de Venta
/kds - Kitchen Display System
/tas - Table Assistance Service
/menu/:qr - Menú para clientes (público)
```

---

## 7. INTERCEPTORES

### 7.1 JWT Interceptor

```typescript
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  // Enviar cookies automáticamente (HttpOnly auth_token)
  req = req.clone({ withCredentials: true });

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const errorCode = error.error?.errorCode;
      if (error.status === 401 || 
          errorCode === ErrorCode.UNAUTHORIZED ||
          errorCode === ErrorCode.INVALID_TOKEN ||
          errorCode === ErrorCode.SESSION_EXPIRED) {
        authStore.clearAuth();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
```

**Características:**
- `withCredentials: true` para cookies HttpOnly
- Manejo centralizado de 401
- Limpieza automática de auth

### 7.2 Error Interceptor

```typescript
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const errorHandler = inject(ErrorHandlerService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const errorCode = determineErrorCode(error);

      switch (error.status) {
        case 0: handleNetworkError(error, errorHandler); break;
        case 401: handleUnauthorized(error, router, errorHandler); break;
        case 403: handleForbidden(error, router, errorHandler); break;
        case 404: handleNotFound(error, errorHandler, req); break;
        case 422: handleValidationError(error, errorHandler); break;
        case 429: handleRateLimit(error, errorHandler); break;
        case 500: case 502: case 503: case 504: handleServerError(error, errorHandler); break;
        default: handleGenericError(error, errorHandler);
      }

      return throwError(() => error);
    })
  );
};
```

**Manejo por Código de Estado:**

| Código | Manejo |
|--------|--------|
| 0 | Error de red - mensaje amigable |
| 401 | Logout + redirección a login |
| 403 | Redirección a /unauthorized |
| 404 | Log + mensaje amigable |
| 422 | Extracción de errores de validación |
| 429 | Rate limit con retry-after |
| 5xx | Error de servidor + log |

### 7.3 Global Error Handler

```typescript
@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: Error | unknown): void {
    try {
      const normalizedError = this.normalizeError(error);
      this.errorHandler.handleError(normalizedError, {
        component: 'Global',
        action: 'unhandled_error',
      });
    } catch (handlerError) {
      console.error('[GlobalErrorHandler] Failed to handle error:', handlerError);
    }
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof Error) return error;
    if (typeof error === 'string') return new Error(error);
    return new Error('Unknown error occurred');
  }
}
```

---

## 8. COMPONENTES UI

### 8.1 Layout Component

```typescript
@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
      <app-header />
      <main class="flex-1">
        <router-outlet />
      </main>
    </div>
  `
})
export class LayoutComponent implements OnInit {
  private menuLangService = inject(MenuLanguageService);

  ngOnInit() {
    this.menuLangService.load();
  }
}
```

### 8.2 Header Component

**Funcionalidades:**
- Logo y nombre del restaurante
- Selector de tema (claro/oscuro)
- Selector de idioma (ES/EN/FR)
- Botón de logout

**Características técnicas:**
- `HostListener` para cerrar dropdown al click fuera
- Computed signals para flags de idioma
- Acceso a authStore para estado de usuario

### 8.3 Toast Component

```typescript
@Component({
  selector: 'app-toast',
  template: `
    <div class="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      @for (n of notificationService.notifications(); track n.id) {
        <div class="pointer-events-auto flex items-center gap-3 px-4 py-3 
                    rounded-lg shadow-lg text-white text-sm animate-slide-in"
             [class]="getColorClass(n.type)">
          <span class="material-symbols-outlined text-lg">{{ getIcon(n.type) }}</span>
          <span class="flex-1">{{ n.message }}</span>
          <button (click)="notificationService.dismiss(n.id)">
            <span class="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      }
    </div>
  `
})
```

### 8.4 LocalizedInput Component

**Propósito:** Inputs multilenguaje para carta de restaurante

```typescript
@Component({
  selector: 'app-localized-input',
  template: `
    <div>
      @if (label) {
        <label class="admin-label">{{ label }}</label>
      }

      <!-- Language tabs -->
      @if (languages().length > 1) {
        <div class="flex gap-1 mb-2 border-b">
          @for (lang of languages(); track lang._id) {
            <button (click)="activeTab.set(lang._id!)">
              {{ lang.name }}
              @if (lang.is_default && required) { <span class="text-red-500">*</span> }
            </button>
          }
        </div>
      }

      <!-- Input field -->
      @for (lang of languages(); track lang._id) {
        @if (activeTab() === lang._id || languages().length === 1) {
          <input [ngModel]="getValueForLang(lang._id!)"
                 (ngModelChange)="setValueForLang(lang._id!, $event)"
                 class="admin-input" />
        }
      }
    </div>
  `
})
```

### 8.5 Directivas

**CaslCanDirective (Autorización):**

```typescript
@Directive({ selector: '[caslCan]', standalone: true })
export class CaslCanDirective {
  action = input.required<string>({ alias: 'caslCan' });
  subject = input.required<string>({ alias: 'caslCanSubject' });

  constructor() {
    effect(() => {
      const user = authStore.user();
      const ability = defineAbilityFor(user!);
      if (ability.can(this.action() as any, this.subject() as any)) {
        this.vcr.createEmbeddedView(this.tpl);
      } else {
        this.vcr.clear();
      }
    });
  }
}
```

**Uso:**
```html
<ng-container *caslCan="'update'; subject: 'Dish'">
  <button>Editar Plato</button>
</ng-container>
```

### 8.6 Pipes

| Pipe | Propósito |
|------|-----------|
| `translate` | Traduce claves usando I18nService |
| `localize` | Obtiene valor localizado de un campo multilenguaje |
| `currencyFormat` | Formato de moneda personalizado |

**LocalizePipe:**
```typescript
@Pipe({ name: 'localize', standalone: true, pure: false })
export class LocalizePipe implements PipeTransform {
  private menuLangService = inject(MenuLanguageService);

  transform(value: LocalizedField | null | undefined): string {
    return this.menuLangService.localize(value);
  }
}
```

---

## 9. GESTIÓN DE ESTADO

### 9.1 Arquitectura Signal-Based

**NO usa NgRx, Redux, ni Akita.**  
**Usa Angular Signals nativos para estado global.**

### 9.2 Stores Disponibles

| Store | Propósito | Líneas |
|-------|-----------|--------|
| `auth.store.ts` | Autenticación de usuario | 113 |
| `cart.store.ts` | Carrito de compras POS | 175 |
| `tas.store.ts` | Estado de servicio de mesas | 254 |
| `kds.store.ts` | Estado de cocina | 92 |
| `theme.store.ts` | Tema oscuro/claro | 28 |

### 9.3 Auth Store - Análisis Detallado

```typescript
export interface AuthStore {
  user: Signal<AuthUser | null>;
  isAuthenticated: Signal<boolean>;
  hasPermission: (perm: string) => Signal<boolean>;
  preferences: Signal<UserPreferences | null>;
  setAuth: (user: AuthUser, expiresAt: number) => void;
  clearAuth: () => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
}

const _user = signal<AuthUser | null>(loadStoredUser());

export const authStore: AuthStore = {
  user: _user.asReadonly(),
  isAuthenticated: computed(() => _user() !== null),
  hasPermission: (perm: string) => computed(() => _user()?.permissions.includes(perm) ?? false),
  preferences: computed(() => _user()?.preferences ?? null),

  setAuth(user: AuthUser, expiresAt: number) {
    const data: StoredUser = { ...user, expiresAt };
    localStorage.setItem('auth_user', JSON.stringify(data));
    _user.set(user);
  },

  clearAuth() {
    localStorage.removeItem('auth_user');
    _user.set(null);
  },

  updatePreferences(prefs: Partial<UserPreferences>) {
    // Actualiza localStorage y signal
  }
};
```

**Características:**
- Signal privado `_user` (writable)
- Exposición como readonly
- Computed signals derivados
- Persistencia en localStorage
- Expiración de sesión (8 horas default)

### 9.4 Cart Store - Análisis

```typescript
export interface CartStore {
  items: Signal<CartItem[]>;
  config: Signal<RestaurantConfig>;
  totalGross: Signal<number>;
  taxAmount: Signal<number>;
  subtotal: Signal<number>;
  tipsAmount: Signal<number>;
  total: Signal<number>;
  itemCount: Signal<number>;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (dishId: string, variantId?: string) => void;
  clear: () => void;
}
```

**Cálculos automáticos:**
```typescript
totalGross: computed(() =>
  _items().reduce((total, item) => total + calculateItemTotal(item), 0)
),

taxAmount: computed(() => {
  const grossTotal = _totalGross();
  const tax = extractTaxFromTotal(grossTotal, _config().taxRate);
  return formatCurrency(tax);
}),

total: computed(() => {
  const grossTotal = _totalGross();
  // ... lógica de propinas
  return formatCurrency(grossTotal + tips);
})
```

### 9.5 TAS Store - Table Assistance

**Funcionalidades:**
- Gestión de sesiones de mesa
- Items por sesión
- Clientes por mesa
- Platoss disponibles
- Estados de items

**Reference Counting:**
```typescript
acquireReference: () => void;
releaseReference: () => void;
hasActiveReferences: () => boolean;
```

**Cuando todos los componentes sueltan la referencia, el store se limpia automáticamente.**

### 9.6 KDS Store - Kitchen Display

```typescript
export interface KdsStore {
  items: Signal<KdsItem[]>;
  ordered: Signal<KdsItem[]>;     // Computed
  onPrepare: Signal<KdsItem[]>;   // Computed
  served: Signal<KdsItem[]>;      // Computed
  setItems: (items: KdsItem[]) => void;
  addItem: (item: KdsItem) => void;
  updateItemState: (itemId: string, newState: ItemState) => void;
  removeItem: (itemId: string) => void;
  acquireReference: () => void;
  releaseReference: () => void;
}
```

---

## 10. I18N INTERNACIONALIZACIÓN

### 10.1 Arquitectura

**Dos niveles de internacionalización:**

1. **App Language** (I18nService) - ES/EN/FR
   - UI de la aplicación
   - Mensajes de sistema
   - Navegación

2. **Menu Languages** (MenuLanguageService) - Configurable por restaurante
   - Nombres de platos
   - Descripciones
   - Categorías

### 10.2 I18nService

**Diccionarios inline (no archivos JSON externos):**

```typescript
const TRANSLATIONS: Record<Language, Translations> = {
  es: { 'common.save': 'Guardar', ... },
  en: { 'common.save': 'Save', ... },
  fr: { 'common.save': 'Enregistrer', ... }
};
```

**~450 claves por idioma**

### 10.3 Estructura de Claves

```
common.*           - Elementos comunes (botones, estados)
auth.*             - Autenticación
dashboard.*        - Panel de control
admin.*            - Administración
dish.*             - Gestión de platos
category.*         - Categorías
staff.*            - Personal
totem.*            - Tótems
tas.*              - Servicio de mesas
pos.*              - Punto de venta
kds.*              - Cocina
settings.*         - Configuración
logs.*             - Logs del sistema
error.*            - Mensajes de error
validation.*       - Validaciones
```

### 10.4 Archivos de Traducción Legacy

Ubicación: `src/assets/i18n/`
- `es.json`
- `en.json`
- `fr.json`

**Nota:** Actualmente los diccionarios están inline en I18nService, pero la estructura de archivos permite carga asíncrona futura.

---

## 11. TESTS

### 11.1 Estrategia de Testing

**Framework:** Vitest + jsdom  
**Alternativa a:** Karma + Jasmine

### 11.2 Tests por Componente/Servicio

| Archivo | Test | Cobertura |
|---------|------|-----------|
| `offline-indicator.component.ts` | `offline-indicator.component.spec.ts` | Completa |
| `notification.service.ts` | `notification.service.spec.ts` | ~200 líneas |
| `restaurant.service.ts` | `restaurant.service.spec.ts` | ~190 líneas |
| `i18n.service.ts` | `i18n.service.spec.ts` | ~220 líneas |
| `theme.service.ts` | `theme.service.spec.ts` | ~120 líneas |
| `update.service.ts` | `update.service.spec.ts` | ~120 líneas |
| `socket.service.ts` | `socket.service.spec.ts` | ~260 líneas |
| `staff.service.ts` | `staff.service.spec.ts` | ~280 líneas |
| `tas.service.ts` | `tas.service.spec.ts` | ~330 líneas |
| `totem.service.ts` | `totem.service.spec.ts` | ~220 líneas |
| `menu-language.service.ts` | `menu-language.service.spec.ts` | ~250 líneas |

### 11.3 Ejemplo de Test (NotificationService)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new NotificationService();
  });

  it('should add notification', () => {
    service.show('Test message');
    expect(service.notifications().length).toBe(1);
    expect(service.notifications()[0].message).toBe('Test message');
  });

  it('should auto-dismiss after duration', () => {
    service.show('Test', 'info', 4000);
    expect(service.notifications().length).toBe(1);
    vi.advanceTimersByTime(4000);
    expect(service.notifications().length).toBe(0);
  });
});
```

### 11.4 Configuración de Tests

**tsconfig.spec.json:**
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
    "types": ["vitest/globals", "node"]
  },
  "include": ["src/**/*.spec.ts"]
}
```

---

## 12. ANÁLISIS DE SEGURIDAD

### 12.1 Autenticación

- **HttpOnly Cookies:** Token JWT almacenado en cookie HttpOnly (no accesible desde JS)
- **withCredentials:** Todas las peticiones incluyen cookies
- **Expiración:** 8 horas por defecto
- **Logout:** Limpia cookie (servidor) + localStorage (cliente)

### 12.2 Autorización

**CASL (Ability-Based):**
- Definición granular de permisos
- Directiva structural `*caslCan`
- Guards de ruta por permisos

### 12.3 Validación

- **Zod:** Validación de esquemas TypeScript
- **Validación de formularios:** Angular Forms + validación manual

### 12.4 XSS Protection

- Sanitización automática de Angular
- No uso de `innerHTML` sin sanitizar
- Template literals seguros

### 12.5 CSRF Protection

- Cookies SameSite (configurado por servidor)
- Tokens CSRF implícitos vía cookies HttpOnly

---

## 📊 RESUMEN EJECUTIVO

| Aspecto | Tecnología | Estado |
|---------|-----------|--------|
| Framework | Angular 21.2 | ✅ Moderno |
| Estado | Signals nativos | ✅ Sin NgRx |
| Componentes | Standalone | ✅ Sin NgModules |
| Estilos | Tailwind + Material M3 | ✅ Moderno |
| Testing | Vitest | ✅ Rápido |
| Build | esbuild | ✅ Rápido |
| PWA | Service Worker | ✅ Configurado |
| i18n | Sistema propio | ✅ 3 idiomas |
| Websockets | Socket.IO | ✅ Robusto |
| Auth | HttpOnly cookies | ✅ Seguro |

### Fortalezas

1. **Arquitectura moderna:** Angular 21 con Signals y Standalone
2. **Rendimiento:** OnPush + Signals = mínimo change detection
3. **Escalabilidad:** Feature-based organization
4. **UX:** PWA con offline support
5. **Seguridad:** HttpOnly cookies + CASL
6. **Mantenibilidad:** TypeScript strict + tests

### Áreas de Mejora

1. **Cobertura de tests:** Añadir tests E2E (Playwright/Cypress)
2. **Documentación:** Añadir Storybook para componentes
3. **Performance:** Implementar virtual scrolling para listas largas
4. **Accesibilidad:** Añadir ARIA labels y keyboard navigation

---

*Documento generado automáticamente por análisis de código.*
*Última actualización: 2026-04-05*
