# Frontend Debug Report - DisherIO

**Fecha:** 2026-03-26  
**Scope:** `/frontend/src` - Angular + Signals + Standalone Components  
**Autor:** Frontend Developer Agent

---

## 🐛 BUGS ENCONTRADOS

### 1. **Falta de manejo de errores en peticiones HTTP**

**Ubicación:** Múltiples archivos

| Archivo | Línea | Problema |
|---------|-------|----------|
| `category-list.component.ts` | L49-51 | `loadCategories()` sin manejo de error |
| `category-list.component.ts` | L53-57 | `deleteCategory()` sin manejo de error |
| `category-form.component.ts` | L73-75 | `loadCategory()` sin manejo de error |
| `category-form.component.ts` | L85-89 | `save()` sin manejo de error |
| `dish-form.component.ts` | L97-99 | `loadCategories()` sin manejo de error |
| `dish-form.component.ts` | L102-104 | `loadDish()` sin manejo de error |
| `dish-form.component.ts` | L122-126 | `save()` sin manejo de error |
| `settings.component.ts` | L84-86 | `ngOnInit()` sin manejo de error |
| `settings.component.ts` | L94-96 | `save()` sin manejo de error |

**Ejemplo del problema:**
```typescript
// category-list.component.ts:49-51
loadCategories() {
  this.http.get<any[]>(`${environment.apiUrl}/dishes/categories`).subscribe(res => {
    this.categories.set(res);
  });  // ← Sin error handler, si falla no hay feedback al usuario
}
```

**Impacto:**
- Si el servidor está caído o devuelve error, el usuario no recibe feedback
- La UI se queda en estado de "cargando" indefinidamente
- Errores silenciados dificultan el debugging

---

### 2. **Memory Leaks - Suscripciones no canceladas**

**Ubicación:** Múltiples componentes

| Archivo | Línea | Problema |
|---------|-------|----------|
| `category-list.component.ts` | L49 | Suscripción HTTP sin `takeUntilDestroyed` |
| `category-form.component.ts` | L73 | Suscripción HTTP sin cleanup |
| `dish-form.component.ts` | L97, L102 | Suscripciones HTTP sin cleanup |
| `settings.component.ts` | L84 | Suscripción HTTP sin cleanup |

**Ejemplo del problema:**
```typescript
// category-list.component.ts
export class CategoryListComponent implements OnInit {
  private http = inject(HttpClient);
  // ...
  loadCategories() {
    this.http.get<any[]>(...).subscribe(res => {
      this.categories.set(res);
    });  // ← Suscripción permanece activa si el componente se destruye
  }
}
```

**Impacto:**
- Si el usuario navega rápidamente entre páginas, las suscripciones permanecen activas
- Potencial memory leak en aplicaciones de larga duración
- Callbacks ejecutándose en componentes destruidos

---

### 3. **Problema en environment.prod.ts - WebSocket URL vacía**

**Ubicación:** `environments/environment.prod.ts:4`

```typescript
export const environment = {
  production: true,
  apiUrl: '/api',
  wsUrl: '',  // ← Vacío en producción - los WebSockets fallarán
};
```

**Impacto:**
- En producción, los WebSockets no funcionarán
- El KDS (Kitchen Display System) no recibirá actualizaciones en tiempo real
- El socket.io intentará conectar a URL vacía

---

### 4. **Interceptor JWT - No maneja errores de token expirado**

**Ubicación:** `core/interceptors/jwt.interceptor.ts`

```typescript
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const token = authStore.token();
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req);  // ← No maneja 401/403, no refresca token
};
```

**Problemas:**
1. No intercepta errores 401 (token expirado)
2. No redirige al login cuando el token es inválido
3. No hay mecanismo de refresh token
4. El decodeJwt no valida la expiración del token

---

### 5. **Auth Store - No valida expiración del token**

**Ubicación:** `store/auth.store.ts:15-27`

```typescript
export function decodeJwt(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.staffId || !payload.restaurantId) return null;
    // ← No valida payload.exp (expiración)
    return { ... };
  } catch {
    return null;
  }
}
```

**Impacto:**
- Un token expirado se considera válido
- Las peticiones fallan silenciosamente con 401
- El usuario no es redirigido al login

---

### 6. **Login Component - Error handling muy básico**

**Ubicación:** `features/login/login.component.ts:55-58`

```typescript
error: (err) => {
  this.error.set(err.status === 401 ? 'Credenciales incorrectas' : 'Error del servidor');
  this.loading.set(false);
},  // ← No muestra detalles del error, no loguea
```

**Problemas:**
- No distingue entre tipos de errores (404, 500, timeout, CORS)
- No hay logging para debugging
- Mensaje genérico "Error del servidor" para cualquier cosa

---

### 7. **KDS Component - Error handler vacío**

**Ubicación:** `features/kds/kds.component.ts:45-48`

```typescript
this.http.get<any[]>(`${environment.apiUrl}/orders/kitchen`).subscribe({
  next: (items) => kdsStore.setItems(items),
  error: () => { /* already connected, silently skip if token expired */ },
});  // ← Error silenciado, no hay feedback si la carga inicial falla
```

**Impacto:**
- Si el endpoint `/orders/kitchen` falla, el KDS se queda vacío sin indicar por qué
- El usuario no sabe si no hay pedidos o si hay un error

---

### 8. **Socket Service - No maneja errores de conexión**

**Ubicación:** `services/socket/socket.service.ts`

```typescript
connect(): void {
  if (this.socket?.connected) return;
  this.socket = io(environment.wsUrl, { withCredentials: true });
  this.socket.on('item:state_changed', ...);
  this.socket.on('kds:new_item', ...);
  // ← Falta: on('connect_error'), on('disconnect'), reconexión
}
```

**Problemas:**
- No maneja errores de conexión
- No hay reconexión automática
- No hay feedback al usuario si WebSocket falla

---

### 9. **Settings Component - Uso de `alert()` nativo**

**Ubicación:** `features/admin/settings/settings.component.ts:94-96`

```typescript
save() {
  this.http.patch(...).subscribe(() => {
    alert('Configuración guardada correctamente');  // ← alert() bloquea el hilo
  });
}
```

**Problemas:**
- `alert()` bloquea el hilo de ejecución
- Mala experiencia de usuario en móviles
- No se puede estilizar

---

### 10. **Image Uploader - Manejo de errores con alert()**

**Ubicación:** `shared/components/image-uploader/image-uploader.component.ts:60-63`

```typescript
error: () => {
  alert('Error al subir la imagen');
  this.uploading.set(false);
}
```

---

## 🔧 FIXES PROPUESTOS

### Fix 1: Crear servicio de manejo de errores

```typescript
// core/services/error-handler.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { authStore } from '../../store/auth.store';

@Injectable({ providedIn: 'root' })
export class ErrorHandlerService {
  private router = inject(Router);

  handleHttpError(error: HttpErrorResponse, context?: string): string {
    console.error(`[${context}] HTTP Error:`, error);
    
    if (error.status === 401) {
      authStore.clearAuth();
      this.router.navigate(['/login']);
      return 'Sesión expirada. Por favor, inicia sesión de nuevo.';
    }
    
    if (error.status === 403) {
      return 'No tienes permisos para realizar esta acción.';
    }
    
    if (error.status === 404) {
      return 'Recurso no encontrado.';
    }
    
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor. Verifica tu conexión.';
    }
    
    return error.error?.message || 'Ha ocurrido un error. Inténtalo de nuevo.';
  }
}
```

### Fix 2: Agregar `takeUntilDestroyed` a todas las suscripciones

```typescript
// category-list.component.ts
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export class CategoryListComponent implements OnInit {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);
  
  loadCategories() {
    this.http.get<any[]>(`${environment.apiUrl}/dishes/categories`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.categories.set(res),
        error: (err) => {
          this.error.set(this.errorHandler.handleHttpError(err, 'loadCategories'));
        }
      });
  }
}
```

### Fix 3: Corregir environment.prod.ts

```typescript
// environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: '/api',
  wsUrl: window.location.origin,  // ← Usar el mismo origen
};
```

### Fix 4: Mejorar interceptor JWT con manejo de errores

```typescript
// core/interceptors/jwt.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { authStore } from '../../store/auth.store';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = authStore.token();
  
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        authStore.clearAuth();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
```

### Fix 5: Validar expiración en decodeJwt

```typescript
// store/auth.store.ts
export function decodeJwt(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.staffId || !payload.restaurantId) return null;
    
    // Validar expiración
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }
    
    return { ... };
  } catch {
    return null;
  }
}
```

### Fix 6: Mejorar manejo de errores en Login

```typescript
// features/login/login.component.ts
error: (err: HttpErrorResponse) => {
  let message = 'Error del servidor';
  
  if (err.status === 401) {
    message = 'Credenciales incorrectas';
  } else if (err.status === 404) {
    message = 'Servicio no disponible';
  } else if (err.status === 0) {
    message = 'No se pudo conectar con el servidor';
  } else if (err.error?.message) {
    message = err.error.message;
  }
  
  this.error.set(message);
  console.error('[Login] Error:', err);
  this.loading.set(false);
}
```

### Fix 7: Crear sistema de notificaciones toast

```typescript
// core/services/toast.service.ts
import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<Toast[]>([]);

  show(message: string, type: Toast['type'] = 'info', duration = 3000) {
    const id = Math.random().toString(36).substring(2);
    const toast: Toast = { id, message, type, duration };
    
    this.toasts.update(t => [...t, toast]);
    
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }

  dismiss(id: string) {
    this.toasts.update(t => t.filter(toast => toast.id !== id));
  }
}
```

### Fix 8: Mejorar Socket Service con reconexión

```typescript
// services/socket/socket.service.ts
import { Injectable, OnDestroy, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { kdsStore } from '../../store/kds.store';
import { ToastService } from '../../core/services/toast.service';

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private toastService = inject(ToastService);

  connect(): void {
    if (this.socket?.connected) return;
    
    this.socket = io(environment.wsUrl, { 
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.toastService.show('Error de conexión en tiempo real', 'error');
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('item:state_changed', ({ itemId, newState }) => {
      kdsStore.updateItemState(itemId, newState);
    });

    this.socket.on('kds:new_item', (item) => {
      kdsStore.addItem(item);
    });
  }

  // ... resto del servicio
}
```

---

## 📋 RESUMEN EJECUTIVO

| Categoría | Cantidad | Severidad |
|-----------|----------|-----------|
| Falta de manejo de errores HTTP | 9 componentes | 🔴 Alta |
| Memory leaks (suscripciones) | 6 componentes | 🟡 Media |
| Configuración de producción | 1 archivo | 🔴 Alta |
| Interceptor JWT incompleto | 1 archivo | 🔴 Alta |
| Validación de token | 1 archivo | 🟡 Media |
| UX (alert nativo) | 2 componentes | 🟢 Baja |

### Prioridad de fixes:

1. **🔴 CRÍTICO:** Corregir `environment.prod.ts` (WebSocket URL vacía)
2. **🔴 CRÍTICO:** Agregar manejo de errores al interceptor JWT
3. **🔴 CRÍTICO:** Agregar manejo de errores a todas las peticiones HTTP
4. **🟡 MEDIO:** Agregar `takeUntilDestroyed` para prevenir memory leaks
5. **🟡 MEDIO:** Validar expiración de JWT en `decodeJwt`
6. **🟢 BAJO:** Reemplazar `alert()` por sistema de notificaciones toast

---

## 🛠️ CÓDIGO DE REFERENCIA: Patrón recomendado para componentes

```typescript
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({...})
export class EjemploComponent implements OnInit {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);

  data = signal<any[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  loadData() {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<any[]>(`/api/data`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.data.set(res);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(this.errorHandler.handleHttpError(err, 'loadData'));
          this.toast.show('Error al cargar datos', 'error');
          this.loading.set(false);
        }
      });
  }
}
```
