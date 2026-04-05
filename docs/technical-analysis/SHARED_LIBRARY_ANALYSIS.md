# 📚 ANÁLISIS TÉCNICO COMPLETO: Shared Library @disherio/shared

> **Documento Académico y Profundo**  
> **Fecha de Análisis:** 2026-04-05  
> **Versión de la Librería:** 1.0.0  
> **Ubicación:** `/home/isma/Proyectos/disherio/shared/`

---

## 📋 ÍNDICE DE CONTENIDOS

1. [Visión General y Arquitectura](#1-visión-general-y-arquitectura)
2. [Estructura de Carpetas](#2-estructura-de-carpetas)
3. [Configuración del Proyecto](#3-configuración-del-proyecto)
4. [Análisis de Tipos TypeScript](#4-análisis-de-tipos-typescript)
5. [Análisis de Esquemas Zod](#5-análisis-de-esquemas-zod)
6. [Sistema de Errores](#6-sistema-de-errores)
7. [Exports e Índices](#7-exports-e-índices)
8. [Integración Backend/Frontend](#8-integración-backendfrontend)
9. [Conclusiones y Mejores Prácticas](#9-conclusiones-y-mejores-prácticas)

---

## 1. VISIÓN GENERAL Y ARQUITECTURA

### 1.1 Propósito de la Shared Library

La librería `@disherio/shared` implementa el patrón **"Single Source of Truth"** (Fuente Única de Verdad) para toda la aplicación DisherIo. Su objetivo principal es:

- **Centralizar definiciones de tipos** TypeScript puros
- **Proveer validación runtime** mediante Zod
- **Estandarizar códigos de error** entre backend y frontend
- **Eliminar duplicación de código** y garantizar consistencia
- **Facilitar el mantenimiento** mediante un único punto de modificación

### 1.2 Filosofía de Diseño

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA MONOREPO                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────────┐         ┌─────────────┐         ┌───────────┐ │
│   │   BACKEND   │◄───────►│   SHARED    │◄───────►│  FRONTEND │ │
│   │  (Node.js)  │         │   LIBRARY   │         │ (Angular) │ │
│   └─────────────┘         └─────────────┘         └───────────┘ │
│          │                       │                       │      │
│          ▼                       ▼                       ▼      │
│   ┌─────────────────────────────────────────────────────┐      │
│   │           TIPOS COMPARTIDOS (@disherio/shared)       │      │
│   │  • Interfaces TypeScript                             │      │
│   │  • Esquemas Zod (validación)                        │      │
│   │  • Códigos de Error                                 │      │
│   └─────────────────────────────────────────────────────┘      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Patrones Aplicados

| Patrón | Descripción | Implementación |
|--------|-------------|----------------|
| **Barrel Pattern** | Exportación centralizada mediante índices | `index.ts` en cada carpeta |
| **Schema-First** | Definición de tipos a partir de esquemas Zod | Uso de `z.infer<typeof Schema>` |
| **DTO Pattern** | Tipos específicos para operaciones Create/Update | `CreateDishData`, `UpdateDishData` |
| **Error as Code** | Errores como códigos tipados, no strings | `ErrorCode` enum |
| **Snapshot Pattern** | Almacenamiento de estado inmutable en órdenes | `ItemOrderVariant`, `ItemOrderExtra` |

---

## 2. ESTRUCTURA DE CARPETAS

### 2.1 Organización Completa

```
/home/isma/Proyectos/disherio/shared/
│
├── index.ts                    # Punto de entrada principal (barrel)
├── package.json                # Configuración npm
├── tsconfig.json               # Configuración TypeScript
│
├── types/                      # Tipos TypeScript puros
│   ├── index.ts                # Barrel exports
│   ├── models.type.ts          # Interfaces de dominio
│   └── localized-string.type.ts # Tipos para internacionalización
│
├── schemas/                    # Esquemas Zod (validación runtime)
│   ├── index.ts                # Barrel exports
│   ├── restaurant.schema.ts    # Esquemas de restaurante
│   ├── dish.schema.ts          # Esquemas de platos/categorías
│   ├── order.schema.ts         # Esquemas de órdenes y pagos
│   ├── staff.schema.ts         # Esquemas de personal/roles
│   ├── totem.schema.ts         # Esquemas de tótems/sesiones
│   ├── menu-language.schema.ts # Esquemas de idiomas
│   └── localized-string.schema.ts # Esquemas de strings localizados
│
├── errors/                     # Códigos de error centralizados
│   └── error-codes.ts          # Enum ErrorCode + mapeo HTTP
│
└── dist/                       # Output compilado (CommonJS + .d.ts)
    ├── index.js                # JS compilado
    ├── index.d.ts              # Declaraciones de tipos
    ├── types/                  # Tipos compilados
    ├── schemas/                # Esquemas compilados
    └── errors/                 # Errores compilados
```

### 2.2 Propósito de Cada Directorio

| Directorio | Propósito | Cuándo Modificar |
|------------|-----------|------------------|
| `types/` | Definiciones TypeScript puras (compile-time only) | Nuevos modelos de dominio |
| `schemas/` | Validación Zod (runtime validation) | Reglas de validación cambian |
| `errors/` | Códigos de error compartidos | Nuevos errores de negocio |
| `dist/` | Output compilado (generado automáticamente) | NUNCA modificar manualmente |

---

## 3. CONFIGURACIÓN DEL PROYECTO

### 3.1 package.json - Análisis Línea a Línea

```json
{
  "name": "@disherio/shared",        // Nombre del paquete con scope @disherio
  "version": "1.0.0",                 // Versión semántica
  "description": "Shared types and schemas for DisherIo",
  "main": "dist/index.js",            // Entry point CommonJS
  "types": "dist/index.d.ts",         // Entry point TypeScript declarations
  "scripts": {
    "build": "tsc",                   // Compila todo TypeScript
    "dev": "tsc --watch"              // Modo watch para desarrollo
  },
  "dependencies": {
    "zod": "^4.3.6"                   // ÚNICA dependencia: validación runtime
  },
  "devDependencies": {
    "typescript": "^5.4.5"            // Compilador TypeScript
  }
}
```

**Puntos Clave:**
- **Dependencia mínima:** Solo Zod, manteniendo la librería ligera
- **Entry point dual:** `main` para Node.js, `types` para TypeScript
- **Compilación simple:** `tsc` sin bundlers complejos

### 3.2 tsconfig.json - Análisis Detallado

```json
{
  "compilerOptions": {
    "target": "ES2022",               // JavaScript moderno (async/await nativo)
    "module": "commonjs",             // Compatibilidad Node.js
    "lib": ["ES2022"],                // APIs ES2022 disponibles
    "outDir": "./dist",               // Directorio de salida
    "rootDir": ".",                   // Raíz del código fuente
    
    // Strict Type Checking
    "strict": true,                   // Habilita todas las comprobaciones estrictas
    "noImplicitAny": true,            // Prohíbe 'any' implícito
    "strictNullChecks": true,         // Null/undefined diferenciados
    "strictFunctionTypes": true,      // Contravarianza en parámetros de función
    
    "moduleResolution": "node",       // Resolución de módulos al estilo Node
    
    // Generación de Declaraciones
    "declaration": true,              // Genera archivos .d.ts
    "declarationMap": true,           // Source maps para declaraciones
    "sourceMap": true,                // Source maps para debugging
    
    "esModuleInterop": true,          // Interoperabilidad CommonJS/ESM
    "skipLibCheck": true,             // Salta verificación de tipos en node_modules
    "forceConsistentCasingInFileNames": true  // Case-sensitive imports
  },
  "include": ["**/*.ts"],             // Incluye todos los archivos .ts
  "exclude": ["node_modules", "dist"] // Excluye dependencias y output
}
```

**Decisiones de Configuración:**

| Opción | Valor | Justificación |
|--------|-------|---------------|
| `target` | ES2022 | Aprovecha features modernos, Node.js 16+ |
| `module` | CommonJS | Compatibilidad máxima con Node.js |
| `strict` | true | Type safety máximo, catching bugs en compile-time |
| `declarationMap` | true | Permite "Go to Definition" en IDEs |

---

## 4. ANÁLISIS DE TIPOS TYPESCRIPT

### 4.1 Tipos de Estado (Enums como Union Types)

```typescript
// Archivo: types/models.type.ts (líneas 12-16)

export type ItemState = 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED';
export type ItemDishType = 'KITCHEN' | 'SERVICE';
export type TotemState = 'STARTED' | 'COMPLETE' | 'PAID';
export type DishStatus = 'ACTIVATED' | 'DESACTIVATED';
export type PaymentType = 'ALL' | 'BY_USER' | 'SHARED';
```

**Análisis:**
- Se usan **Union Types** en lugar de `enum` tradicional
- **Ventajas:** Mejor tree-shaking, no genera código JS extra, más type-safe
- **Desventajas:** No permite iteración (Object.values()) sin trucos

### 4.2 Interfaces Principales del Dominio

#### 4.2.1 MenuLanguage

```typescript
// Líneas 22-30
export interface MenuLanguage {
  _id?: string;                       // Opcional: MongoDB ID
  restaurant_id: string;              // FK a Restaurant
  name: string;                       // Nombre del idioma (ej: "Español")
  code: string;                       // Código ISO (ej: "es", "en")
  is_default: boolean;                // ¿Es el idioma por defecto?
  linked_app_lang: string | null;     // Mapeo a idiomas de la app
  order: number;                      // Orden de visualización
}
```

**Campos Clave:**
- `_id?: string` - El `?` indica opcionalidad (útil para creación)
- `linked_app_lang: string | null` - Distingue entre "no asignado" (null) y "asignado"

#### 4.2.2 Dish (Plato) - Análisis Completo

```typescript
// Líneas 61-75
export interface Dish {
  _id?: string;
  restaurant_id: string;              // FK a Restaurant
  category_id: string;                // FK a Category
  
  // Campos localizados (multi-idioma)
  disher_name: LocalizedField;        // Nombre en todos los idiomas
  disher_description?: LocalizedField; // Descripción opcional
  
  disher_price: number;               // Precio base
  disher_type: ItemDishType;          // 'KITCHEN' | 'SERVICE'
  disher_status: DishStatus;          // 'ACTIVATED' | 'DESACTIVATED'
  disher_url_image?: string;          // URL de imagen opcional
  disher_alergens: string[];          // Array de alérgenos
  
  // Configuración de variantes y extras
  disher_variant: boolean;            // ¿Tiene variantes?
  variants: Variant[];                // Array de variantes
  extras: Extra[];                    // Array de extras
}
```

**Patrones Observados:**
1. **Prefijo de entidad:** Todos los campos usan prefijo `disher_` para evitar conflictos
2. **Campos opcionales marcados:** `?` indica undefined, `| null` indica valor nulo explícito
3. **Arrays nunca undefined:** `variants: Variant[]` siempre es array (puede estar vacío)

#### 4.2.3 ItemOrder (Item de Orden) - Patrón Snapshot

```typescript
// Líneas 127-141
export interface ItemOrder {
  _id?: string;
  order_id: string;
  session_id: string;
  item_dish_id: string;               // Referencia al plato original
  
  // Patrón SNAPSHOT - datos denormalizados en el momento de la orden
  item_name_snapshot: LocalizedField; // Nombre congelado en el tiempo
  item_base_price: number;            // Precio base congelado
  item_disher_variant?: ItemOrderVariant | null;  // Variante seleccionada
  item_disher_extras: ItemOrderExtra[];           // Extras seleccionados
  
  item_state: ItemState;              // Estado actual del item
  item_disher_type: ItemDishType;     // Tipo (cocina/servicio)
  customer_id?: string;               // Quién ordenó
  customer_name?: string;             // Nombre del cliente
  createdAt?: string;                 // Timestamp de creación
}
```

**Patrón Snapshot Explicado:**
```
PROBLEMA: Si el plato cambia de precio o nombre después de ordenar,
          las órdenes históricas mostrarían datos incorrectos.

SOLUCIÓN: Al crear ItemOrder, se COPIAN los datos relevantes del Dish:
          - item_name_snapshot (nombre en ese momento)
          - item_base_price (precio en ese momento)
          - variant/extra con sus precios

RESULTADO: Las órdenes históricas son INMUTABLES y mostrarán
           siempre los datos correctos del momento de la compra.
```

### 4.3 Tipos DTO (Data Transfer Objects)

```typescript
// Líneas 204-220

// Create: Omitimos el _id (lo genera la BD)
export type CreateDishData = Omit<Dish, '_id'>;

// Update: Todos los campos opcionales
export type UpdateDishData = Partial<CreateDishData>;

// CreateStaff: Datos de entrada (con password en texto plano)
export type CreateStaffData = Omit<Staff, '_id'> & { 
  password: string; 
  pin_code: string 
};

// UpdateStaff: Parcial + campos de autenticación opcionales
export type UpdateStaffData = Partial<Omit<Staff, '_id' | 'restaurant_id'>> & { 
  password?: string; 
  pin_code?: string 
};
```

**Operadores TypeScript Utilizados:**

| Operador | Descripción | Ejemplo |
|----------|-------------|---------|
| `Omit<T, K>` | Excluye propiedades K de T | `Omit<Dish, '_id'>` |
| `Partial<T>` | Todas las propiedades opcionales | `Partial<CreateDishData>` |
| `Pick<T, K>` | Selecciona solo propiedades K | `Pick<ItemOrder, 'item_state'>` |
| `&` | Intersección de tipos | `TypeA & { extra: string }` |

### 4.4 LocalizedField - Sistema de Internacionalización

```typescript
// localized-string.type.ts

import { z } from 'zod';
import { LocalizedEntrySchema, LocalizedFieldSchema } from '../schemas/localized-string.schema';

// Tipo legacy (mantenido por compatibilidad)
export type LocalizedString = z.infer<typeof LocalizedStringSchema>;
// Resultado: { es?: string; en?: string; fr?: string; ar?: string; }

// Nuevo sistema array-based (más flexible)
export type LocalizedEntry = z.infer<typeof LocalizedEntrySchema>;
// Resultado: { lang: string; value: string; }

export type LocalizedField = z.infer<typeof LocalizedFieldSchema>;
// Resultado: LocalizedEntry[] (array de traducciones)
```

**Comparación de Enfoques:**

```typescript
// LEGACY - Objeto con claves fijas
const legacy: LocalizedString = {
  es: "Hola",
  en: "Hello"
  // fr, ar son opcionales
};

// NUEVO - Array dinámico
const modern: LocalizedField = [
  { lang: "es", value: "Hola" },
  { lang: "en", value: "Hello" },
  { lang: "fr", value: "Bonjour" }  // Idiomas ilimitados
];
```

**Ventajas del sistema array-based:**
1. **Número ilimitado de idiomas** - No restringido a es/en/fr/ar
2. **Referencia a MenuLanguage** - `lang` puede ser el `_id` del idioma
3. **Ordenamiento explícito** - El array define el orden de prioridad
4. **Fácil iteración** - Métodos de array (map, filter, find)

---

## 5. ANÁLISIS DE ESQUEMAS ZOD

### 5.1 ¿Qué es Zod?

Zod es una librería de **validación de esquemas TypeScript-first** que permite:
- Definir esquemas de validación
- Inferir tipos TypeScript automáticamente
- Validar datos en runtime
- Generar mensajes de error descriptivos

### 5.2 Esquema: localized-string.schema.ts

```typescript
// LEGACY: Objeto con idiomas fijos
export const LocalizedStringSchema = z.object({
  es: z.string().optional().default(''),
  en: z.string().optional().default(''),
  fr: z.string().optional().default(''),
  ar: z.string().optional().default(''),
});

// NUEVO: Sistema array-based
export const LocalizedEntrySchema = z.object({
  lang: z.string(),                    // Referencia al ID del idioma
  value: z.string().default(''),       // Valor traducido
});

export const LocalizedFieldSchema = z.array(LocalizedEntrySchema).default([]);
```

**Análisis de Validadores:**

| Validador | Significado | Ejemplo |
|-----------|-------------|---------|
| `z.string()` | Valor debe ser string | "hola" ✓, 123 ✗ |
| `.optional()` | Campo puede omitirse | `{ es: "Hola" }` (sin en) ✓ |
| `.default('')` | Valor por defecto si undefined | `{}` → `{ es: '', en: '' }` |
| `.default([])` | Array vacío por defecto | `undefined` → `[]` |

### 5.3 Esquema: restaurant.schema.ts

```typescript
export const SocialLinksSchema = z.object({
  facebook_url: z.string().url().optional(),    // Debe ser URL válida
  instagram_url: z.string().url().optional(),   // Debe ser URL válida
});

export const RestaurantSchema = z.object({
  restaurant_name: z.string().min(2),           // Mínimo 2 caracteres
  restaurant_url: z.string().url().optional(),  // URL opcional
  logo_image_url: z.string().url().optional(),  // URL opcional
  social_links: SocialLinksSchema.optional(),   // Objeto anidado opcional
  tax_rate: z.number().min(0).max(100),         // Porcentaje 0-100
  tips_state: z.boolean().default(false),       // Propina activada?
  tips_type: z.enum(['MANDATORY', 'VOLUNTARY']).optional(),
  tips_rate: z.number().min(0).max(100).optional(),
  default_language: z.enum(['es', 'en']).default('es'),
  default_theme: z.enum(['light', 'dark']).default('light'),
  currency: z.string().default('EUR'),          // Moneda por defecto EUR
});
```

**Validadores Numéricos:**
```typescript
z.number().min(0).max(100)  // Rango [0, 100]
z.number().positive()        // > 0
z.number().int()             // Entero
```

### 5.4 Esquema: dish.schema.ts

```typescript
// Helper reutilizable para validación de precios
const priceValidation = z.number().positive().max(999999);

export const VariantSchema = z.object({
  variant_id: z.string().optional(),            // Generado si no existe
  variant_name: LocalizedFieldSchema,           // Nombre localizado
  variant_description: LocalizedFieldSchema.optional(),
  variant_url_image: z.string().url().optional(),
  variant_price: priceValidation,               // Reutiliza helper
});

export const ExtraSchema = z.object({
  extra_id: z.string().optional(),
  extra_name: LocalizedFieldSchema,
  extra_description: LocalizedFieldSchema.optional(),
  extra_price: priceValidation,
  extra_url_image: z.string().url().optional(),
});

export const DishSchema = z.object({
  restaurant_id: z.string(),
  category_id: z.string(),
  disher_name: LocalizedFieldSchema,
  disher_description: LocalizedFieldSchema.optional(),
  disher_url_image: z.string().url().optional(),
  disher_status: z.enum(['ACTIVATED', 'DESACTIVATED']).default('ACTIVATED'),
  disher_price: priceValidation,
  disher_type: z.enum(['KITCHEN', 'SERVICE']),
  disher_alergens: z.array(z.string()).default([]),
  disher_variant: z.boolean().default(false),
  variants: z.array(VariantSchema).default([]),
  extras: z.array(ExtraSchema).default([]),
});

// Schemas específicos para operaciones API
export const CreateDishSchema = DishSchema;
export const UpdateDishSchema = CreateDishSchema.partial();

// Export de tipos inferidos
export type CreateDishInput = z.infer<typeof CreateDishSchema>;
export type UpdateDishInput = z.infer<typeof UpdateDishSchema>;
```

**Técnicas Zod Utilizadas:**

```typescript
// 1. Reutilización con .partial()
const CreateSchema = z.object({ ... });   // Todos requeridos
const UpdateSchema = CreateSchema.partial(); // Todos opcionales

// 2. Arrays con validación de elementos
z.array(z.string())        // Array de strings
z.array(VariantSchema)     // Array de objetos Variant

// 3. Enums vs Union Types
z.enum(['A', 'B'])         // Enum Zod (recomendado para strings literales)
z.union([z.literal('A'), z.literal('B')]) // Alternativa más flexible

// 4. Inferencia de tipos
z.infer<typeof DishSchema> // Extrae el tipo TypeScript
```

### 5.5 Esquema: order.schema.ts - Validación Compleja

```typescript
const VariantSnapshotSchema = z.object({
  variant_id: z.string(),
  name: z.array(LocalizedEntrySchema),  // Snapshot del nombre
  price: priceValidation,                // Snapshot del precio
}).nullable();                           // Puede ser null

const ExtraSnapshotSchema = z.object({
  extra_id: z.string(),
  name: z.array(LocalizedEntrySchema),
  price: priceValidation,
});

export const ItemOrderSchema = z.object({
  order_id: z.string(),
  session_id: z.string(),
  item_dish_id: z.string(),
  customer_id: z.string().optional(),
  customer_name: z.string().optional(),
  item_state: z.enum(['ORDERED', 'ON_PREPARE', 'SERVED', 'CANCELED'])
    .default('ORDERED'),
  item_disher_type: z.enum(['KITCHEN', 'SERVICE']),
  item_name_snapshot: z.array(LocalizedEntrySchema),
  item_base_price: priceValidation,
  item_disher_variant: VariantSnapshotSchema.optional().default(null),
  item_disher_extras: z.array(ExtraSnapshotSchema).default([]),
  version: z.number().default(0),        // Optimistic concurrency
});

// Schema para operaciones de API
export const AddItemToOrderSchema = z.object({
  order_id: z.string().min(1),           // No vacío
  session_id: z.string().min(1),
  dish_id: z.string().min(1),
  customer_id: z.string().optional(),
  variant_id: z.string().optional(),
  extras: z.array(z.string()).default([]),
});
```

**Validadores de String:**

| Validador | Significado | Ejemplo válido |
|-----------|-------------|----------------|
| `.min(1)` | Longitud mínima | "a" (1 char) |
| `.min(2)` | Longitud mínima | "ab" (2 chars) |
| `.length(4)` | Longitud exacta | "1234" |
| `.regex(/^\d{4}$/)` | Patrón regex | "1234" (4 dígitos) |

### 5.6 Esquema: staff.schema.ts - Separación de Preocupaciones

```typescript
// Schema para CREAR personal (input del usuario)
export const CreateStaffSchema = z.object({
  restaurant_id: z.string(),
  role_id: z.string(),
  staff_name: z.string().min(2),
  username: z.string().min(3),
  password: z.string().min(6),           // Contraseña en texto plano
  pin_code: z.string().length(4).regex(/^\d{4}$/),  // PIN numérico
  language: z.enum(['es', 'en']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
});

// Schema para ALMACENAR en BD (datos transformados)
export const StaffSchema = z.object({
  restaurant_id: z.string(),
  role_id: z.string(),
  staff_name: z.string().min(2),
  username: z.string().min(3),
  password_hash: z.string(),             // HASH, no texto plano
  pin_code_hash: z.string(),             // HASH del PIN
  language: z.enum(['es', 'en']).nullable().optional(),
  theme: z.enum(['light', 'dark']).nullable().optional(),
});

// Schema para ACTUALIZAR (campos parciales)
export const UpdateStaffSchema = z.object({
  staff_name: z.string().min(2).optional(),
  role_id: z.string().optional(),
  username: z.string().min(3).optional(),
  password: z.string().min(6).optional(),
  pin_code: z.string().length(4).regex(/^\d{4}$/).optional(),
  language: z.enum(['es', 'en']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
});
```

**Separación de Preocupaciones:**
```
CreateStaffSchema  →  Input de usuario (password en texto)
       ↓
   [Hashing]        →  Transformación en backend
       ↓
StaffSchema        →  Almacenamiento en BD (password_hash)
```

### 5.7 Esquema: totem.schema.ts - Estados de Sesión

```typescript
export const TotemSchema = z.object({
  restaurant_id: z.string(),
  totem_name: z.string().min(1),
  totem_qr: z.string().optional(),       // Generado automáticamente
  totem_type: z.enum(['STANDARD', 'TEMPORARY']),
  totem_start_date: z.string().datetime().optional(),  // ISO 8601
});

export const TotemSessionSchema = z.object({
  totem_id: z.string(),
  session_date_start: z.string().datetime().optional(),
  totem_state: z.enum(['STARTED', 'COMPLETE', 'PAID']).default('STARTED'),
  version: z.number().default(0),        // Para concurrencia optimista
});
```

### 5.8 Esquema: menu-language.schema.ts - Transformaciones

```typescript
export const MenuLanguageSchema = z.object({
  restaurant_id: z.string(),
  name: z.string().min(1).trim(),        // Elimina espacios
  code: z.string().min(1).trim().toLowerCase(),  // Normaliza a minúsculas
  is_default: z.boolean().default(false),
  linked_app_lang: z.enum(['es', 'en', 'fr']).nullable().default(null),
  order: z.number().default(0),
});

// Omite campos que se generan automáticamente
export const CreateMenuLanguageSchema = MenuLanguageSchema.omit({ 
  is_default: true,    // Se calcula según lógica de negocio
  order: true          // Se asigna automáticamente
});

// Todos los campos opcionales para updates
export const UpdateMenuLanguageSchema = MenuLanguageSchema.partial();
```

**Transformaciones Zod:**

| Transformación | Descripción | Ejemplo Input → Output |
|----------------|-------------|------------------------|
| `.trim()` | Elimina espacios | " es " → "es" |
| `.toLowerCase()` | Minúsculas | "ES" → "es" |
| `.default(value)` | Valor por defecto | `undefined` → `value` |
| `.omit({ key: true })` | Excluye campos | Schema sin esos campos |
| `.partial()` | Todos opcionales | Campos requeridos → opcionales |

---

## 6. SISTEMA DE ERRORES

### 6.1 ErrorCode Enum - Análisis Completo

```typescript
export enum ErrorCode {
  // ═══════════════════════════════════════════════════════
  // CATEGORÍA: Autenticación y Autorización
  // ═══════════════════════════════════════════════════════
  UNAUTHORIZED = 'UNAUTHORIZED',                    // 401 - No autenticado
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',      // 401 - Credenciales inválidas
  INVALID_PIN = 'INVALID_PIN',                      // 401 - PIN incorrecto
  INVALID_TOKEN = 'INVALID_TOKEN',                  // 401 - Token JWT inválido
  SESSION_EXPIRED = 'SESSION_EXPIRED',              // 401 - Token expirado
  FORBIDDEN = 'FORBIDDEN',                          // 403 - Sin permisos
  REQUIRES_POS_AUTHORIZATION = 'REQUIRES_POS_AUTHORIZATION',  // 403
  REQUIRES_AUTHORIZATION = 'REQUIRES_AUTHORIZATION',          // 403
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',        // 401
  SERVER_CONFIGURATION_ERROR = 'SERVER_CONFIGURATION_ERROR',  // 500

  // ═══════════════════════════════════════════════════════
  // CATEGORÍA: Rate Limiting (Protección contra abuso)
  // ═══════════════════════════════════════════════════════
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',              // 429
  AUTH_RATE_LIMIT_EXCEEDED = 'AUTH_RATE_LIMIT_EXCEEDED',    // 429
  QR_RATE_LIMIT_EXCEEDED = 'QR_RATE_LIMIT_EXCEEDED',        // 429
  QR_BRUTE_FORCE_DETECTED = 'QR_BRUTE_FORCE_DETECTED',      // 429

  // ═══════════════════════════════════════════════════════
  // CATEGORÍA: Recursos No Encontrados (404)
  // ═══════════════════════════════════════════════════════
  NOT_FOUND = 'NOT_FOUND',
  DISH_NOT_FOUND = 'DISH_NOT_FOUND',
  CATEGORY_NOT_FOUND = 'CATEGORY_NOT_FOUND',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  ITEM_NOT_FOUND = 'ITEM_NOT_FOUND',
  PAYMENT_NOT_FOUND = 'PAYMENT_NOT_FOUND',
  TICKET_NOT_FOUND = 'TICKET_NOT_FOUND',
  TOTEM_NOT_FOUND = 'TOTEM_NOT_FOUND',
  RESTAURANT_NOT_FOUND = 'RESTAURANT_NOT_FOUND',
  STAFF_NOT_FOUND = 'STAFF_NOT_FOUND',
  ROLE_NOT_FOUND = 'ROLE_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  CUSTOMER_NOT_FOUND = 'CUSTOMER_NOT_FOUND',
  TABLE_NOT_FOUND = 'TABLE_NOT_FOUND',

  // ═══════════════════════════════════════════════════════
  // CATEGORÍA: Lógica de Negocio (400)
  // ═══════════════════════════════════════════════════════
  DISH_NOT_AVAILABLE = 'DISH_NOT_AVAILABLE',           // Plato no disponible
  SESSION_NOT_ACTIVE = 'SESSION_NOT_ACTIVE',           // Sesión inactiva
  SESSION_EXPIRED_STATE = 'SESSION_EXPIRED_STATE',     // Sesión expirada
  ORDER_ALREADY_PAID = 'ORDER_ALREADY_PAID',           // Orden ya pagada
  ORDER_CANCELLED = 'ORDER_CANCELLED',                 // Orden cancelada
  NO_ITEMS_TO_PAY = 'NO_ITEMS_TO_PAY',                 // Sin items para pagar
  PAYMENT_FAILED = 'PAYMENT_FAILED',                   // Fallo en pago
  TOTEM_NOT_ACTIVE = 'TOTEM_NOT_ACTIVE',               // Tótem inactivo
  TOTEM_QR_INVALID = 'TOTEM_QR_INVALID',               // QR inválido
  RESTAURANT_NOT_ACTIVE = 'RESTAURANT_NOT_ACTIVE',     // Restaurante inactivo
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION', // Cambio estado inválido
  CANNOT_DELETE_ITEM_NOT_ORDERED = 'CANNOT_DELETE_ITEM_NOT_ORDERED',
  ITEM_NOT_FOUND_OR_ALREADY_PROCESSED = 'ITEM_NOT_FOUND_OR_ALREADY_PROCESSED',
  UPDATE_FAILED = 'UPDATE_FAILED',
  CATEGORY_HAS_DISHES = 'CATEGORY_HAS_DISHES',         // Conflicto: tiene platos

  // ═══════════════════════════════════════════════════════
  // CATEGORÍA: Validación de Datos (400)
  // ═══════════════════════════════════════════════════════
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_PRICE = 'INVALID_PRICE',
  INVALID_ID_FORMAT = 'INVALID_ID_FORMAT',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',

  // ═══════════════════════════════════════════════════════
  // CATEGORÍA: Conflictos de Datos (409)
  // ═══════════════════════════════════════════════════════
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',

  // ═══════════════════════════════════════════════════════
  // CATEGORÍA: Errores del Servidor (500)
  // ═══════════════════════════════════════════════════════
  SERVER_ERROR = 'SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  DASHBOARD_ERROR = 'DASHBOARD_ERROR',
  LOGS_ERROR = 'LOGS_ERROR',
  LOGS_USERS_ERROR = 'LOGS_USERS_ERROR',
}
```

### 6.2 Mapeo a HTTP Status Codes

```typescript
export const ERROR_HTTP_STATUS_MAP: Record<ErrorCode, number> = {
  // 401 Unauthorized
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.INVALID_CREDENTIALS]: 401,
  [ErrorCode.INVALID_PIN]: 401,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.SESSION_EXPIRED]: 401,
  [ErrorCode.AUTHENTICATION_REQUIRED]: 401,

  // 403 Forbidden
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.REQUIRES_POS_AUTHORIZATION]: 403,
  [ErrorCode.REQUIRES_AUTHORIZATION]: 403,

  // 404 Not Found
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.DISH_NOT_FOUND]: 404,
  [ErrorCode.CATEGORY_NOT_FOUND]: 404,
  // ... todos los NOT_FOUND

  // 400 Bad Request
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_PRICE]: 400,
  [ErrorCode.DISH_NOT_AVAILABLE]: 400,
  [ErrorCode.SESSION_NOT_ACTIVE]: 400,
  // ... errores de lógica de negocio

  // 409 Conflict
  [ErrorCode.USER_ALREADY_EXISTS]: 409,
  [ErrorCode.DUPLICATE_RESOURCE]: 409,
  [ErrorCode.CATEGORY_HAS_DISHES]: 409,

  // 429 Too Many Requests
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.AUTH_RATE_LIMIT_EXCEEDED]: 429,

  // 500 Internal Server Error
  [ErrorCode.SERVER_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
};
```

### 6.3 Type Guard

```typescript
/**
 * Type guard para verificar si un string es un ErrorCode válido
 * Uso: if (isErrorCode(code)) { /* code es ErrorCode aquí */ }
 */
export function isErrorCode(code: string): code is ErrorCode {
  return Object.values(ErrorCode).includes(code as ErrorCode);
}
```

### 6.4 Estrategia de Manejo de Errores

```
┌─────────────────────────────────────────────────────────────────┐
│              FLUJO DE MANEJO DE ERRORES                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. SERVICIO detecta condición de error                         │
│     ↓                                                           │
│     throw new Error(ErrorCode.DISH_NOT_FOUND)                   │
│                                                                  │
│  2. CONTROLADOR o MIDDLEWARE captura el error                   │
│     ↓                                                           │
│     ERROR_HTTP_STATUS_MAP[ErrorCode.DISH_NOT_FOUND] → 404       │
│                                                                  │
│  3. MIDDLEWARE de error formatea respuesta                      │
│     ↓                                                           │
│     {                                                           │
│       error: "El plato no fue encontrado",  // Traducido        │
│       errorCode: "DISH_NOT_FOUND",                             │
│       status: 404                                               │
│     }                                                           │
│                                                                  │
│  4. FRONTEND recibe y maneja según errorCode                    │
│     ↓                                                           │
│     if (error.errorCode === ErrorCode.DISH_NOT_FOUND)           │
│       this.showNotFoundMessage();                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. EXPORTS E ÍNDICES

### 7.1 Barrel Pattern

El proyecto utiliza el **Barrel Pattern** para centralizar exports:

```typescript
// index.ts (raíz)
export * from './schemas';      // Re-exporta todo de schemas/index.ts
export * from './types';        // Re-exporta todo de types/index.ts
export * from './errors/error-codes';  // Re-exporta errores
```

```typescript
// schemas/index.ts
export * from './localized-string.schema';
export * from './dish.schema';
export * from './order.schema';
export * from './restaurant.schema';
export * from './staff.schema';
export * from './totem.schema';
export * from './menu-language.schema';
```

```typescript
// types/index.ts
export * from './localized-string.type';
export * from './models.type';
```

### 7.2 Ventajas del Barrel Pattern

```typescript
// SIN Barrel Pattern (importaciones dispersas)
import { Dish } from '@disherio/shared/types/models.type';
import { DishSchema } from '@disherio/shared/schemas/dish.schema';
import { ErrorCode } from '@disherio/shared/errors/error-codes';

// CON Barrel Pattern (una sola importación)
import { Dish, DishSchema, ErrorCode } from '@disherio/shared';
```

### 7.3 Referencias Circulares

La estructura evita referencias circulares mediante:
1. **Jerarquía clara:** `types` no importa de `schemas`
2. **Excepción controlada:** `localized-string.type.ts` importa de `schemas` para usar `z.infer`

---

## 8. INTEGRACIÓN BACKEND/FRONTEND

### 8.1 Instalación como Dependencia Local

```json
// backend/package.json
{
  "dependencies": {
    "@disherio/shared": "file:../shared"
  }
}

// frontend/package.json
{
  "dependencies": {
    "@disherio/shared": "file:../shared"
  }
}
```

### 8.2 Uso en Backend

#### Error Handler Global
```typescript
// backend/src/middlewares/error-handler.ts
import { ErrorCode, ERROR_HTTP_STATUS_MAP, isErrorCode } from '@disherio/shared';

export function errorHandler(err: Error, req: Request, res: Response) {
  let errorCode = ErrorCode.SERVER_ERROR;
  
  if (isErrorCode(err.message)) {
    errorCode = err.message;
    statusCode = ERROR_HTTP_STATUS_MAP[err.message];
  }
  
  res.status(statusCode).json({
    error: i18next.t(`errors:${errorCode}`),
    errorCode: errorCode,
    status: statusCode,
  });
}
```

#### Re-exportación de Schemas
```typescript
// backend/src/schemas/dish.schema.ts
export {
  CreateDishSchema,
  UpdateDishSchema,
  DishSchema,
  // ...
} from '@disherio/shared';
```

#### Uso en Servicios
```typescript
// backend/src/services/dish.service.ts
import { ErrorCode } from '@disherio/shared';

async function getDish(id: string) {
  const dish = await DishModel.findById(id);
  if (!dish) {
    throw new Error(ErrorCode.DISH_NOT_FOUND);
  }
  return dish;
}
```

### 8.3 Uso en Frontend

#### Re-exportación Centralizada
```typescript
// frontend/src/app/types/index.ts
export * from '@disherio/shared';  // Todos los tipos compartidos
export * from './socket.types';    // Tipos específicos de frontend
```

#### Store con Tipos Compartidos
```typescript
// frontend/src/app/store/auth.store.ts
import { ErrorCode } from '@disherio/shared';

// Manejo de errores de autenticación
if (error.errorCode === ErrorCode.UNAUTHORIZED) {
  this.logout();
  this.router.navigate(['/login']);
}
```

#### Interceptor JWT
```typescript
// frontend/src/app/core/interceptors/jwt.interceptor.ts
import { ErrorCode } from '@disherio/shared';

catchError((error: HttpErrorResponse) => {
  const errorCode = error.error?.errorCode;
  if (
    error.status === 401 ||
    errorCode === ErrorCode.UNAUTHORIZED ||
    errorCode === ErrorCode.INVALID_TOKEN ||
    errorCode === ErrorCode.SESSION_EXPIRED
  ) {
    authStore.clearAuth();
    router.navigate(['/login']);
  }
  return throwError(() => error);
});
```

### 8.4 Ventajas de la Arquitectura Shared

| Aspecto | Sin Shared | Con @disherio/shared |
|---------|------------|----------------------|
| **Duplicación** | Tipos definidos en backend Y frontend | Definición única |
| **Consistencia** | Riesgo de desincronización | Single source of truth |
| **Validación** | Backend: Zod, Frontend: ? | Mismos esquemas Zod |
| **Errores** | Strings hardcodeados | Enum tipado compartido |
| **Refactoring** | Cambios en múltiples lugares | Cambio en un solo lugar |
| **Type Safety** | Limitado | Completo en ambos lados |

---

## 9. CONCLUSIONES Y MEJORES PRÁCTICAS

### 9.1 Fortalezas de la Implementación

1. **Single Source of Truth:** Los tipos y esquemas están definidos una sola vez
2. **Type Safety completa:** TypeScript strict mode + Zod runtime validation
3. **Arquitectura escalable:** Fácil añadir nuevos tipos y esquemas
4. **Error handling robusto:** Códigos de error centralizados con traducción
5. **Patrón Snapshot:** Preserva integridad histórica de órdenes
6. **I18N flexible:** Sistema array-based para idiomas ilimitados

### 9.2 Áreas de Mejora Potencial

1. **Tests:** Añadir tests unitarios para esquemas Zod
2. **Documentación:** JSDoc en todos los tipos públicos
3. **Versionado:** Considerar versionado semántico más estricto
4. **ESM:** Evaluar migración a ES Modules puro

### 9.3 Mejores Prácticas Documentadas

```typescript
// ✅ BUENO: Tipos en types/, validación en schemas/
// types/models.type.ts
export interface Dish { ... }

// schemas/dish.schema.ts  
export const DishSchema = z.object({ ... });

// ✅ BUENO: Uso de helpers reutilizables
const priceValidation = z.number().positive().max(999999);

// ✅ BUENO: DTOs específicos para operaciones
export type CreateDishData = Omit<Dish, '_id'>;
export type UpdateDishData = Partial<CreateDishData>;

// ✅ BUENO: Type guards para runtime safety
export function isErrorCode(code: string): code is ErrorCode { ... }

// ❌ MALO: Hardcodear strings de error
throw new Error('DISH_NOT_FOUND');

// ✅ BUENO: Usar enum tipado
import { ErrorCode } from '@disherio/shared';
throw new Error(ErrorCode.DISH_NOT_FOUND);
```

### 9.4 Resumen de Métricas

| Métrica | Valor |
|---------|-------|
| Archivos fuente TypeScript | 13 |
| Interfaces definidas | ~20 |
| Esquemas Zod | ~30 |
| Códigos de error | 60+ |
| Dependencias runtime | 1 (Zod) |
| Cobertura de tipos | 100% (strict mode) |

---

## 📎 APÉNDICES

### A. Glosario de Términos

| Término | Definición |
|---------|------------|
| **SSOT** | Single Source of Truth - Fuente única de verdad |
| **DTO** | Data Transfer Object - Objeto para transferencia de datos |
| **FK** | Foreign Key - Clave foránea |
| **I18N** | Internationalization - Internacionalización |
| **Barrel** | Archivo índice que re-exporta módulos |
| **Snapshot** | Copia inmutable de datos en un momento dado |

### B. Referencias

- [Zod Documentation](https://zod.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Architecture Decision Records (ADR)](./adr/)

---

*Documento generado automáticamente el 2026-04-05*  
*Análisis realizado por agente especializado en arquitectura de software*
