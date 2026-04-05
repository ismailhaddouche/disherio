# 📊 ANÁLISIS TÉCNICO UI/UX - DISHERIO

> **Documento Académico y Profundo**  
> **Fecha de Análisis:** Abril 2026  
> **Versión Frontend:** Angular 17+ con Signals

---

## 📑 ÍNDICE

1. [Análisis de Vistas y Pantallas](#1-análisis-de-vistas-y-pantallas)
2. [Features del Sistema](#2-features-del-sistema)
3. [Componentes UI](#3-componentes-ui)
4. [Sistema de Diseño](#4-sistema-de-diseño)
5. [Navegación y UX](#5-navegación-y-ux)
6. [Formularios y Validación](#6-formularios-y-validación)
7. [Notificaciones y Feedback](#7-notificaciones-y-feedback)
8. [Responsive Design](#8-responsive-design)
9. [Accesibilidad](#9-accesibilidad)
10. [I18N (Internacionalización)](#10-i18n-internacionalización)
11. [Animaciones y Transiciones](#11-animaciones-y-transiciones)

---

## 1. ANÁLISIS DE VISTAS Y PANTALLAS

### 1.1 Estructura de Rutas

```
/                           → Auth Routes (redirect to /login)
├── login                   → LoginComponent (página de autenticación)
├── unauthorized            → UnauthorizedComponent (acceso denegado)
│
├── menu/:qr                → TotemComponent (menú público por QR)
│
├── admin/*                 → AdminModule (protegido, rol ADMIN)
│   ├── dashboard           → DashboardComponent
│   ├── dishes              → DishListComponent
│   ├── dishes/new          → DishFormComponent (crear)
│   ├── dishes/:id          → DishFormComponent (editar)
│   ├── categories          → CategoryListComponent
│   ├── categories/new      → CategoryFormComponent
│   ├── categories/:id      → CategoryFormComponent
│   ├── totems              → TotemListComponent
│   ├── totems/new          → TotemFormComponent
│   ├── totems/:id          → TotemFormComponent
│   ├── staff               → StaffListComponent
│   ├── staff/new           → StaffFormComponent
│   ├── staff/:id           → StaffFormComponent
│   ├── logs                → LogsViewerComponent
│   └── settings            → SettingsComponent
│
├── pos/*                   → PosModule (protegido, roles POS/ADMIN)
│   └── (index)             → PosComponent
│
├── kds/*                   → KdsModule (protegido, roles KTS/ADMIN)
│   └── (index)             → KdsComponent
│
└── tas/*                   → TasModule (protegido, roles TAS/POS/ADMIN)
    └── (index)             → TasComponent
```

### 1.2 Descripción Detallada de Vistas

#### 🔐 Autenticación

| Vista | Componente | Props/Datos | Descripción |
|-------|------------|-------------|-------------|
| **Login** | `LoginComponent` | `username`, `password`, `loading` | Formulario de inicio de sesión con validación básica. Redirección automática según rol. |
| **Unauthorized** | `UnauthorizedComponent` | N/A | Página de acceso denegado con icono y mensaje amigable. |

#### 👨‍💼 Administración

| Vista | Componente | Props/Datos | Descripción |
|-------|------------|-------------|-------------|
| **Dashboard** | `DashboardComponent` | `data: DashboardData`, `loading`, `dateFrom`, `dateTo` | Panel de control con KPIs, gráficos de ventas, estado de pedidos. Filtros por fecha. |
| **Dish List** | `DishListComponent` | `dishes: Dish[]` | Grid de platos con imágenes, estado (activo/inactivo), precios. Acciones rápidas. |
| **Dish Form** | `DishFormComponent` | `dish: Dish`, `isEdit`, `categories` | Formulario completo con imágenes, variantes, extras, alérgenos. Validación reactiva. |
| **Category List** | `CategoryListComponent` | `categories: Category[]` | Grid de categorías con orden de visualización. |
| **Category Form** | `CategoryFormComponent` | `category: Category`, `isEdit` | Formulario de categorías con soporte multiidioma. |
| **Totem List** | `TotemListComponent` | `totems: Totem[]`, `loading` | Tabla de tótems con QR, tipo, fecha. Acciones de regenerar QR. |
| **Totem Form** | `TotemFormComponent` | `totem: Totem`, `isEdit` | Creación/edición de tótems estándar/temporales. |
| **Staff List** | `StaffListComponent` | `staff: Staff[]`, `loading` | Tabla de personal con avatares, roles, acciones. |
| **Staff Form** | `StaffFormComponent` | `staffForm: FormGroup`, `roles: Role[]` | Formulario reactivo con validación de contraseña y PIN. |
| **Logs** | `LogsViewerComponent` | `logs: LogEntry[]`, `filters` | Visor de logs con filtros por fecha, tipo, usuario. Tabla detallada. |
| **Settings** | `SettingsComponent` | `settings: RestaurantSettings` | Configuración del restaurante, idiomas de carta, preferencias. |

#### 🛒 POS (Point of Sale)

| Vista | Componente | Props/Datos | Descripción |
|-------|------------|-------------|-------------|
| **POS** | `PosComponent` | `sessions`, `selectedSession`, `cart`, `paymentModal` | Interfaz de tres paneles: mesas, pedidos, ticket. Sistema de cobro completo. |

#### 👨‍🍳 KDS (Kitchen Display System)

| Vista | Componente | Props/Datos | Descripción |
|-------|------------|-------------|-------------|
| **KDS** | `KdsComponent` | `ordered: KdsItem[]`, `onPrepare: KdsItem[]` | Pantalla de cocina dividida en dos columnas: pedidos nuevos y en preparación. |

#### 🍽️ TAS (Table Assistance Service)

| Vista | Componente | Props/Datos | Descripción |
|-------|------------|-------------|-------------|
| **TAS** | `TasComponent` | `sessions`, `selectedSession`, `customers`, `menu` | Gestión de mesas con sistema de clientes, asignación de items, pedidos en tiempo real. |

#### 📱 Totem (Self-Service)

| Vista | Componente | Props/Datos | Descripción |
|-------|------------|-------------|-------------|
| **Totem** | `TotemComponent` | `categories`, `dishes`, `cart`, `customerInfo` | Menú público para clientes. Tres tabs: Menú, Mis Pedidos, Pedidos de Mesa. |

---

## 2. FEATURES DEL SISTEMA

### 2.1 TAS (Table Assistance Service) - Servicio de Mesas

**Arquitectura UI:**
```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER: Título + Estado de Conexión                            │
├────────────────┬──────────────────────────┬─────────────────────┤
│                │                          │                     │
│  SESIONES      │  DETALLE DE SESIÓN       │  MENÚ (opcional)    │
│  ACTIVAS       │  - Tabs de clientes      │  - Categorías       │
│  - Lista       │  - Items por cliente     │  - Grid de platos   │
│  - Totems      │  - Estados (colores)     │  - Variantes/Extras │
│  disponibles   │  - Acciones              │                     │
│                │                          │                     │
│  [+ Mesa Temp] │  [+ Añadir Pedido]       │                     │
│                │                          │                     │
└────────────────┴──────────────────────────┴─────────────────────┘
```

**Características UI:**
- **Panel izquierdo (280px):** Sesiones activas con indicadores de tipo (ESTÁNDAR/TEMPORAL). Totems disponibles para iniciar sesión.
- **Panel central (flexible):** Detalle de sesión seleccionada con tabs de clientes. Items agrupados por tipo (COCINA/BARRA).
- **Panel derecho (384px - opcional):** Menú de platos filtrable por categoría. Modal para variantes y extras.
- **Estados visuales:** ORDERED (amarillo), ON_PREPARE (azul), SERVED (verde), CANCELED (rojo).

**Integración en tiempo real:**
- WebSocket para sincronización entre TAS, KDS y POS.
- Notificaciones toast para eventos: nuevo pedido, cambio de estado, pago recibido.

### 2.2 KDS (Kitchen Display System) - Pantalla de Cocina

**Arquitectura UI:**
```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER: KDS + Estado Conexión + Contador + Refresh             │
├────────────────────────────┬────────────────────────────────────┤
│                            │                                    │
│   📋 NUEVOS PEDIDOS        │   👨‍🍳 EN PREPARACIÓN              │
│   (bg-yellow)              │   (bg-blue)                        │
│                            │                                    │
│   ┌─ Mesa: TERRAZA 1 ─┐    │   ┌─ Mesa: BAR 2 ──────┐          │
│   │ • Paella Valenciana│    │   │ • Hamburguesa     │          │
│   │   Juan · 14:30     │    │   │   María · 14:35   │          │
│   │   [Preparar][✕]    │    │   │   [Servido]       │          │
│   └────────────────────┘    │   └────────────────────┘          │
│                            │                                    │
│   ┌─ Mesa: MESA 5 ────┐    │   ┌─ Mesa: TERRAZA 3 ──┐          │
│   │ • Ensalada César   │    │   │ • Filete          │          │
│   │   Ana · 14:32      │    │   │   Pedro · 14:36   │          │
│   │   [Preparar][✕]    │    │   │   [Servido]       │          │
│   └────────────────────┘    │   └────────────────────┘          │
│                            │                                    │
└────────────────────────────┴────────────────────────────────────┘
```

**Características UI:**
- **Diseño de dos columnas:** 50% - 50% para nuevos pedidos vs. en preparación.
- **Agrupación por mesa:** Los items se agrupan visualmente por totem_name.
- **Acciones rápidas:** Botones grandes "Preparar" (naranja → azul) y "Servido" (azul → verde).
- **Indicadores visuales:** Número de items por mesa, timestamp, cliente, extras.
- **Empty states:** Iconos grandes cuando no hay pedidos.

### 2.3 Totem (Self-Service) - Menú Cliente

**Arquitectura UI:**
```
┌─────────────────────────────────────────┐
│  RESTAURANTE NAME      [☀️/🌙] [🛒 2]   │
├─────────────────────────────────────────┤
│  [TODOS] [ENTRANTES] [PRINCIPALES] ...  │
├─────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐        │
│  │  [IMG]     │  │  [IMG]     │        │
│  │  Paella    │  │  Hamburg.  │        │
│  │  12.50 €   │  │  8.90 €    │        │
│  └────────────┘  └────────────┘        │
│  ┌────────────┐  ┌────────────┐        │
│  │  [IMG]     │  │  [IMG]     │        │
│  │  Ensalada  │  │  Bebida    │        │
│  │  6.50 €    │  │  2.00 €    │        │
│  └────────────┘  └────────────┘        │
│                                         │
├─────────────────────────────────────────┤
│  [🍽️ MENÚ] [👤 MIS PEDIDOS] [👥 TODOS]  │
└─────────────────────────────────────────┘
```

**Características UI:**
- **Header fijo:** Nombre del restaurante, toggle tema, botón carrito con badge.
- **Categorías scrollable horizontal:** Filtro rápido de platos.
- **Grid 2 columnas:** Cards de platos con imagen, nombre, precio.
- **Bottom navigation:** 3 tabs - Menú, Mis Pedidos, Pedidos de Mesa.
- **Drawer carrito:** Slide desde derecha con resumen y checkout.
- **Modal nombre:** Al iniciar, solicita nombre del cliente.

### 2.4 POS (Point of Sale) - Caja

**Arquitectura UI:**
```
┌────────────────────────────────────────────────────────────────────────┐
│  MESAS              ● CONECTADO                                        │
├──────────┬────────────────────────────────────┬────────────────────────┤
│          │                                    │                        │
│  TERRAZA │  [TERRAZA 1]           [TODOS]    │  TICKET                │
│  1    ●  │  [Juan] [María] [Pedro] [+Cliente] │  ────────────────────  │
│  MESA 2  │                                    │  Paella        12.50€  │
│  BAR 3   │  Paella Valenciana        12.50€   │  Hamburguesa    8.90€  │
│  [+ Temp]│  → En preparación                 │  Bebida         2.00€  │
│          │                                    │  ────────────────────  │
│  ─────── │  Hamburguesa               8.90€   │  SUBTOTAL      23.40€  │
│          │  → Pedido                         │  IVA (10%)      2.34€  │
│  NUEVA   │                                    │  ────────────────────  │
│  MESA    │  [+ AÑADIR AL PEDIDO]              │  TOTAL         25.74€  │
│          │                                    │                        │
│          │                                    │  [💳 COBRAR]           │
│          │                                    │                        │
└──────────┴────────────────────────────────────┴────────────────────────┘
```

**Características UI:**
- **Panel izquierdo (256px):** Lista de sesiones activas con totems disponibles. Creación de mesas temporales.
- **Panel central (flexible):** Header con tabs de clientes. Lista de items con estados y asignación.
- **Panel derecho (288px):** Ticket/Billing con subtotal, impuestos, total. Botón de cobro grande.
- **Modal pago:** Opciones de pago completo, dividir equitativamente, pagar por consumo.

### 2.5 Dashboard Administrativo

**Arquitectura UI:**
```
┌────────────────────────────────────────────────────────────────────────┐
│  DASHBOARD                                      [Desde] [Hasta] [🔄]   │
├────────────────────────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐          │
│  │  💰        │ │  📄        │ │  📈        │ │  ✅        │          │
│  │  INGRESOS  │ │  PEDIDOS   │ │  TICKET    │ │  SERVIDOS  │          │
│  │  1,250.50€ │ │  45        │ │  27.90€    │ │  38        │          │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘          │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  🍳 ESTADO COCINA                                               │  │
│  │  [🟡 Pendientes: 5] [🔵 Preparando: 3] [🟢 Listos: 12]          │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌────────────────────────────┐  ┌─────────────────────────────────┐   │
│  │  🍽️ PLATOS POPULARES       │  │  📂 POR CATEGORÍA              │   │
│  │  1. Paella Valenciana      │  │  Principales     450.00€       │   │
│  │     15 pedidos · 180.00€   │  │  Entrantes       125.50€       │   │
│  │  2. Hamburguesa BBQ        │  │  Bebidas          89.00€       │   │
│  │     12 pedidos · 142.80€   │  │  Postres          67.50€       │   │
│  │  3. ...                    │  │                                │   │
│  └────────────────────────────┘  └─────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

**Características UI:**
- **KPI Cards:** 4 métricas principales con iconos y colores distintivos.
- **Filtros de fecha:** Selector de rango para análisis temporal.
- **Estado de cocina:** Visualización rápida del flujo de trabajo.
- **Top listados:** Platos más vendidos y ventas por categoría.

---

## 3. COMPONENTES UI

### 3.1 Layout Components

| Componente | Ubicación | Descripción |
|------------|-----------|-------------|
| **LayoutComponent** | `shared/components/layout.component.ts` | Layout principal con header y router-outlet. Carga MenuLanguageService. |
| **HeaderComponent** | `shared/components/header.component.ts` | Header sticky con logo, selector tema, selector idioma, logout. |
| **AdminComponent** | `features/admin/admin.component.ts` | Layout de admin con sidebar fijo (224px) y área de contenido. |

### 3.2 Form Components

| Componente | Props | Descripción |
|------------|-------|-------------|
| **LocalizedInputComponent** | `value`, `label`, `placeholder`, `required`, `multiline` | Input multiidioma con tabs por idioma de carta. Indicador visual de contenido. |
| **ImageUploaderComponent** | `folder`, `currentImage`, `(imageUploaded)` | Zona de drop/upload con preview. Soporta: dishes, categories, restaurant. |
| **DishOptionListComponent** | `title`, `subtitle`, `items`, `variant`, `(add)`, `(remove)` | Lista editable de variantes/extras con inputs localizados. |

### 3.3 Table Components

Patrón de tabla administrativa consistente:

```scss
// Estructura CSS compartida
.admin-table-container  // Wrapper con sombra y bordes redondeados
.admin-table            // Tabla full-width
.admin-th               // Header con fondo gris, uppercase
.admin-td               // Celdas con hover effects
```

### 3.4 Card Components

```scss
// Patrón de card administrativa
.admin-card {
  @apply bg-white dark:bg-gray-800 
         rounded-2xl shadow-sm 
         border border-gray-100 dark:border-gray-700 
         overflow-hidden flex flex-col;
}
```

### 3.5 Pipes

| Pipe | Propósito | Ejemplo |
|------|-----------|---------|
| **translate** | Traducción de claves i18n | `{{ 'common.save' \| translate }}` |
| **localize** | Localización de campos multiidioma | `{{ dish.disher_name \| localize }}` |
| **currencyFormat** | Formato de moneda | `{{ price \| currencyFormat }}` → "12.50 €" |

### 3.6 Directivas

| Directiva | Selector | Funcionalidad |
|-----------|----------|---------------|
| **CaslCanDirective** | `*caslCan` | Control de permisos basado en CASL. Ej: `*caslCan="'create'; subject:'Payment'"` |

---

## 4. SISTEMA DE DISEÑO

### 4.1 TailwindCSS Configuración

```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class',           // Control manual vía clase .dark
  content: ['./src/**/*.{html,ts,scss}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1976d2',  // Azul Material
          dark: '#1565c0',
        },
        surface: {
          DEFAULT: '#ffffff',
          dark: '#121212',
        },
      },
    },
  },
}
```

### 4.2 Paleta de Colores

#### Modo Claro
```
Background:    #ffffff (white)
Surface:       #ffffff
Primary:       #1976d2 (blue-700)
Text Primary:  #111827 (gray-900)
Text Secondary:#6b7280 (gray-500)
Border:        #e5e7eb (gray-200)
```

#### Modo Oscuro
```
Background:    #030712 (gray-950)
Surface:       #1f2937 (gray-800)
Primary:       #1976d2 (blue-700)
Text Primary:  #f9fafb (gray-50)
Text Secondary:#9ca3af (gray-400)
Border:        #374151 (gray-700)
```

### 4.3 Estados Semánticos

| Estado | Claro | Oscuro | Uso |
|--------|-------|--------|-----|
| **Success** | `bg-green-100 text-green-800` | `bg-green-900/30 text-green-300` | Acciones exitosas |
| **Error** | `bg-red-100 text-red-800` | `bg-red-900/30 text-red-300` | Errores, cancelaciones |
| **Warning** | `bg-yellow-100 text-yellow-800` | `bg-yellow-900/30 text-yellow-300` | Advertencias |
| **Info** | `bg-blue-100 text-blue-800` | `bg-blue-900/30 text-blue-300` | Información |
| **Primary** | `bg-primary text-white` | `bg-primary text-white` | Acciones principales |

### 4.4 Tipografía

```scss
// Font Family
font-family: 'Roboto', sans-serif;

// Jerarquía
.admin-title { @apply text-2xl font-bold; }      // 24px bold
h1 { @apply text-xl font-bold; }                 // 20px bold
h2 { @apply text-lg font-bold; }                // 18px bold
body { @apply text-sm; }                         // 14px regular
small { @apply text-xs; }                        // 12px regular
```

### 4.5 Espaciado

```scss
// Container
.admin-container { @apply p-6 max-w-[1600px] mx-auto; }

// Grid gaps
.admin-grid { @apply grid gap-6; }               // 24px entre items

// Component spacing
.admin-card { @apply p-5; }                      // 20px padding
.admin-filters { @apply p-4; }                   // 16px padding
```

### 4.6 Componentes Reutilizables (CSS)

```scss
// Botones
.btn-admin { @apply px-4 py-2 rounded-lg font-bold flex items-center gap-2; }
.btn-primary { @apply bg-primary text-white; }
.btn-secondary { @apply bg-gray-100 dark:bg-gray-700; }
.btn-icon { @apply w-10 h-10 flex items-center justify-center rounded-lg; }

// Inputs
.admin-input { 
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 
         rounded-lg bg-white dark:bg-gray-700;
}

// Labels
.admin-label { @apply block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5; }
```

---

## 5. NAVEGACIÓN Y UX

### 5.1 Menú de Navegación (Admin Sidebar)

```typescript
// Estructura de navegación
const adminMenu = [
  { icon: 'dashboard', label: 'Dashboard', route: 'dashboard' },
  { icon: 'restaurant_menu', label: 'Platos', route: 'dishes' },
  { icon: 'category', label: 'Categorías', route: 'categories' },
  { icon: 'qr_code_scanner', label: 'Tótems', route: 'totems' },
  { icon: 'badge', label: 'Personal', route: 'staff' },
  { icon: 'receipt_long', label: 'Logs', route: 'logs' },
  { icon: 'settings', label: 'Ajustes', route: 'settings' },
];
```

**Características:**
- Ancho fijo: 224px (`w-56`)
- Iconos: Material Symbols
- Estado activo: `bg-primary text-white`
- Hover: `hover:bg-gray-100 dark:hover:bg-gray-700`

### 5.2 Flujo de Navegación por Rol

```
┌─────────────────────────────────────────────────────────────────┐
│                         SIN AUTENTICAR                          │
│                              │                                  │
│                              ▼                                  │
│                         ┌──────────┐                            │
│                         │ /login   │                            │
│                         └──────────┘                            │
├─────────────────────────────────────────────────────────────────┤
│                           AUTENTICADO                           │
│                              │                                  │
│          ┌───────────────────┼───────────────────┐              │
│          ▼                   ▼                   ▼              │
│    ┌──────────┐       ┌──────────┐       ┌──────────┐          │
│    │  ADMIN   │       │   KDS    │       │   TAS    │          │
│    │ /admin/* │       │ /kds     │       │ /tas     │          │
│    └──────────┘       └──────────┘       └──────────┘          │
│          │                   │                   │              │
│          ▼                   ▼                   ▼              │
│    ┌──────────┐       ┌──────────┐       ┌──────────┐          │
│    │   POS    │       │          │       │          │          │
│    │ /pos     │       │          │       │          │          │
│    └──────────┘       └──────────┘       └──────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Estados de Carga

**Patrones consistentes:**

```scss
// Spinner estándar
.animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent

// Esqueleto de carga
<div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded">
```

**Ubicaciones:**
- Dashboard: Spinner centrado en contenedor
- Tablas: Spinner reemplaza tabla
- Botones: Spinner inline con texto

### 5.4 Estados de Error

**Tipos de errores UI:**

1. **Inline Validation:** Borde rojo + mensaje debajo del input
2. **Toast Notification:** Error global vía NotificationService
3. **Error Detail Component:** Panel expandible con detalles técnicos
4. **Offline Indicator:** Banner superior cuando no hay conexión

### 5.5 Empty States

Patrón consistente:

```html
<div class="text-center py-20">
  <span class="material-symbols-outlined text-7xl opacity-20">icon</span>
  <h3 class="text-xl font-bold">Título</h3>
  <p class="text-gray-500">Descripción de ayuda</p>
  <a class="btn-admin btn-primary">Acción principal</a>
</div>
```

---

## 6. FORMULARIOS Y VALIDACIÓN

### 6.1 Librería de Formularios

**Enfoque dual:**

1. **Template-driven (FormsModule):**
   - Usado en: TAS, POS, Totem (formularios simples)
   - Binding: `[(ngModel)]`

2. **Reactive Forms (ReactiveFormsModule):**
   - Usado en: StaffForm (validaciones complejas)
   - Construcción: `FormBuilder`, `Validators`

### 6.2 Validaciones

| Campo | Validaciones | Mensaje de Error |
|-------|--------------|------------------|
| **Nombre Staff** | `required`, `minLength(2)` | `staff.name_required` |
| **Username** | `required`, `minLength(3)`, `pattern(^[a-z0-9.]+$)` | `staff.username_required` |
| **Password** | `required`, `minLength(6)` | `staff.password_min` |
| **PIN** | `required`, `pattern(^\d{4}$)` | `staff.pin_invalid` |
| **Precio Plato** | `> 0` | `validation.price_required` |
| **Categoría** | `required` | `validation.category_required` |

### 6.3 Mensajes de Error

```html
<!-- Patrón de mensaje de error -->
@if (staffForm.get('field')?.invalid && staffForm.get('field')?.touched) {
  <div class="text-red-500 text-sm mt-1">
    {{ 'error.key' | translate }}
  </div>
}
```

### 6.4 File Upload (Imágenes)

**ImageUploaderComponent:**

```typescript
// Props
folder: 'dishes' | 'restaurant' | 'categories'
currentImage: string | null
imageUploaded: EventEmitter<string>

// Features
- Preview inmediato vía FileReader
- Upload progresivo con indicador
- Endpoints específicos por carpeta
- Tipos permitidos: image/*
```

---

## 7. NOTIFICACIONES Y FEEDBACK

### 7.1 Sistema de Toast

**NotificationService (Signal-based):**

```typescript
interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

// API
notify.success(message, duration?)  // Verde, 4000ms
notify.error(message, duration?)    // Rojo, 4000ms
notify.warning(message, duration?)  // Amarillo, 4000ms
notify.info(message, duration?)     // Azul, 4000ms
notify.dismiss(id)
```

**ToastComponent:**
- Posición: `fixed top-4 right-4 z-[9999]`
- Animación: `slideIn` desde derecha
- Auto-cierre: 4000ms por defecto
- Máximo: ilimitado (cola vertical)

### 7.2 Colores por Tipo

| Tipo | Color BG | Icono |
|------|----------|-------|
| Success | `bg-green-600` | `check_circle` |
| Error | `bg-red-600` | `error` |
| Warning | `bg-yellow-500` | `warning` |
| Info | `bg-blue-600` | `info` |

### 7.3 Error Notification Component

Características avanzadas:
- Panel expandible con detalles técnicos
- Timestamp de ocurrencia
- Auto-cierre con barra de progreso (5000ms)
- Posición: `fixed bottom-4 right-4`

### 7.4 Feedback Visual de Acciones

```scss
// Botones
.active:scale-95        // Efecto de presión
.disabled:opacity-50    // Estado deshabilitado
.animate-spin           // Spinner en carga

// Items
.opacity-50             // Durante procesamiento
```

---

## 8. RESPONSIVE DESIGN

### 8.1 Breakpoints

| Breakpoint | Tailwind | Uso Principal |
|------------|----------|---------------|
| **Mobile** | Default | Totem (cliente), acceso QR |
| **sm** | 640px | Ajustes menores |
| **md** | 768px | Sidebar colapsable en admin |
| **lg** | 1024px | Grid de 3 columnas en dishes |
| **xl** | 1280px | Grid de 4 columnas |
| **2xl** | 1536px | Máximo ancho admin (1600px) |

### 8.2 Mobile-First Approach

```scss
// Ejemplo de patrón responsive
.admin-grid {
  @apply grid grid-cols-1        // Mobile: 1 columna
         md:grid-cols-2          // Tablet: 2 columnas
         lg:grid-cols-3          // Desktop: 3 columnas
         xl:grid-cols-4;         // Wide: 4 columnas
}
```

### 8.3 Adaptaciones por Feature

#### Totem (Mobile-Only)
- Diseño optimizado para smartphones
- Touch targets mínimos 44x44px
- Bottom navigation nativa
- Grid de 2 columnas para platos

#### KDS (Desktop/Tablet)
- Layout de dos columnas fijo
- Optimizado para pantallas táctiles de cocina
- Botones grandes para uso con guantes

#### Admin (Desktop)
- Sidebar fija de 224px
- Tablas con scroll horizontal
- Forms en grid de 2 columnas

---

## 9. ACCESIBILIDAD

### 9.1 ARIA Labels

```html
<!-- Botón con aria-label -->
<button aria-label="Cerrar notificación">
  <span class="material-symbols-outlined">close</span>
</button>

<!-- Toggle con aria-expanded -->
<button [attr.aria-expanded]="showDetails"
        [attr.aria-label]="showDetails ? 'Ocultar' : 'Mostrar'">
```

### 9.2 Navegación por Teclado

- Todos los inputs tienen `focus:ring-2`
- Botones accesibles vía Tab
- Modal cierra con Escape (implícito)
- Enter para submit de formularios

### 9.3 Contraste de Colores

| Elemento | Color | Ratio WCAG |
|----------|-------|------------|
| Texto primario | gray-900 / gray-50 | 16.1:1 |
| Texto secundario | gray-600 / gray-400 | 6.3:1 |
| Primary button | #1976d2 on white | 5.4:1 (AA) |
| Error text | red-600 | 5.8:1 (AA) |

### 9.4 Offline Indicator Accesibilidad

```html
<div role="alert" aria-live="polite">
  <!-- Contenido dinámico -->
</div>
```

---

## 10. I18N (INTERNACIONALIZACIÓN)

### 10.1 Arquitectura

**I18nService:**
```typescript
// Idiomas soportados
type Language = 'es' | 'en' | 'fr';

// Storage: localStorage (disherio-language)
// Default: 'es'
```

### 10.2 Sistema de Traducción

**Diccionarios en código (no JSON):**

```typescript
const TRANSLATIONS: Record<Language, Translations> = {
  es: { 'common.save': 'Guardar', ... },
  en: { 'common.save': 'Save', ... },
  fr: { 'common.save': 'Enregistrer', ... }
};
```

**Pipe translate:**
```html
{{ 'common.save' | translate }}
```

### 10.3 Idiomas de Carta (Menu Languages)

**MenuLanguageService:**
- Idiomas personalizables por restaurante
- Vinculación con idiomas de app
- Idioma por defecto configurable
- Soporte para campos localizados en platos/categorías

### 10.4 LocalizedInput Component

```typescript
// Props
@Input() value: LocalizedEntry[] = []  // [{lang: 'es', value: '...'}, ...]
@Input() multiline: boolean            // input vs textarea
@Input() required: boolean

// Features
- Tabs por idioma disponible
- Indicador visual de idioma con contenido
- Validación de idioma por defecto
```

### 10.5 Formato de Moneda

**CurrencyFormatPipe:**
```typescript
// Default: EUR, es-ES
// Salida: "12.50 €"
transform(value: number, currency = 'EUR', locale = 'es-ES')
```

---

## 11. ANIMACIONES Y TRANSICIONES

### 11.1 Transiciones de Página

**Angular Router:** Sin animaciones configuradas (instantáneas)

### 11.2 Loading Spinners

```scss
// Spinner CSS puro
.animate-spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

**Variantes:**
- Botones: `h-3 w-3` (pequeño)
- Loading states: `h-5 w-5` (mediano)
- Full page: `h-10 w-10 border-4` (grande)

### 11.3 Animaciones de UI

| Animación | CSS | Uso |
|-----------|-----|-----|
| **Slide In** | `@keyframes slideIn { from { translateX(100%) } }` | Toast notifications |
| **Slide Up** | `@keyframes slideUp { from { translateY(100%) } }` | Error notifications |
| **Progress** | `@keyframes progress { from { width: 100% } to { width: 0% } }` | Auto-close bar |
| **Pulse** | `animate-pulse` | Uploading indicator |
| **Scale Press** | `active:scale-95` | Button press effect |

### 11.4 Transiciones Suaves

```scss
// Default transition
@apply transition-colors;        // Para cambios de color
@apply transition-all;           // Para múltiples propiedades
@apply duration-300;             // 300ms por defecto
```

### 11.5 Micro-interacciones

```scss
// Hover effects
@apply hover:bg-gray-100 dark:hover:bg-gray-700;
@apply hover:brightness-110;
@apply hover:text-primary;

// Focus states
@apply focus:ring-2 focus:ring-primary/20 focus:border-primary;
```

---

## 📊 RESUMEN EJECUTIVO

### Métricas de UI

| Métrica | Valor |
|---------|-------|
| **Total de Vistas** | 18+ páginas principales |
| **Features** | 5 módulos funcionales (Admin, POS, KDS, TAS, Totem) |
| **Componentes Compartidos** | 8 componentes reutilizables |
| **Pipes** | 3 pipes personalizados |
| **Directivas** | 1 directiva de permisos |
| **Idiomas UI** | 3 (es, en, fr) |
| **Idiomas Carta** | Dinámicos (configurables) |

### Fortalezas UI/UX

1. **Consistencia Visual:** Sistema de diseño unificado con clases CSS reutilizables
2. **Dark Mode:** Implementación completa con Tailwind `dark:`
3. **Multiidioma:** Soporte robusto para i18n + idiomas de carta personalizables
4. **Real-time:** WebSocket para sincronización instantánea entre módulos
5. **Accesibilidad:** ARIA labels, focus states, contraste WCAG AA
6. **Responsive:** Adaptaciones específicas por tipo de dispositivo/rol
7. **Feedback:** Sistema completo de notificaciones toast y errores

### Áreas de Mejora Identificadas

1. **Breadcrumbs:** No implementados actualmente
2. **Animaciones de página:** Transiciones entre rutas
3. **Skeleton screens:** Para carga progresiva de contenido
4. **Virtual scrolling:** Para listas largas (logs, historial)
5. **Keyboard shortcuts:** Atajos para operadores frecuentes

---

*Documento generado automáticamente por análisis de código.*  
*Sistema DisherIO - Frontend Angular 17+*  
*Fecha: Abril 2026*
