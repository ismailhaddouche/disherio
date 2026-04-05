# 📊 Análisis Técnico del Modelo de Datos - DisherIo

> **Documento:** Análisis Completo del Modelo de Datos MongoDB/Mongoose  
> **Versión:** 1.0.0  
> **Fecha:** 2026-04-05  
> **Arquitecto:** Agente de Análisis de Datos  

---

## 📋 Índice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura de Base de Datos](#2-arquitectura-de-base-de-datos)
3. [Modelos Mongoose - Análisis Detallado](#3-modelos-mongoose---análisis-detallado)
4. [Diagrama Entidad-Relación](#4-diagrama-entidad-relación)
5. [Documentación de Entidades](#5-documentación-de-entidades)
6. [Relaciones entre Entidades](#6-relaciones-entre-entidades)
7. [Índices y Optimizaciones](#7-índices-y-optimizaciones)
8. [Inicialización y Seeds](#8-inicialización-y-seeds)
9. [Validaciones y Esquemas](#9-validaciones-y-esquemas)
10. [Recomendaciones](#10-recomendaciones)

---

## 1. Resumen Ejecutivo

### 1.1 Visión General

DisherIo utiliza **MongoDB** como base de datos principal con **Mongoose** como ODM (Object Document Mapper). La arquitectura está diseñada para soportar un sistema de gestión de restaurantes multi-tenant con las siguientes características:

| Característica | Valor |
|---------------|-------|
| **Base de Datos** | MongoDB 6.0+ |
| **ODM** | Mongoose 8.x |
| **Patrón de Diseño** | Multi-tenant por restaurante |
| **Número de Colecciones** | 13 |
| **Tipo de Relaciones** | Referencias (ObjectId) |
| **Estrategia de Localización** | Array-based (lang + value) |

### 1.2 Colecciones Principales

```
┌─────────────────────────────────────────────────────────────────┐
│                    COLECCIONES DISHERIO                         │
├─────────────────────────────────────────────────────────────────┤
│  CORE              OPERACIONAL         CONFIGURACIÓN            │
│  ─────────         ───────────         ─────────────            │
│  • restaurants     • orders            • menulanguages          │
│  • customers       • itemorders        • roles                  │
│  • staff           • payments                                 │
│  • dishes          • totems                                   │
│  • categories      • totemsessions                            │
│  • sessioncustomers                                             │
│  • printers                                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Arquitectura de Base de Datos

### 2.1 Configuración de Conexión

**Archivo:** `backend/src/config/db.ts`

```typescript
// Configuración de conexión MongoDB
const getConnectionOptions = (): mongoose.ConnectOptions => ({
  // Pool de conexiones
  maxPoolSize: 50,        // Máximo de conexiones en pool
  minPoolSize: 5,         // Mínimo de conexiones mantenidas
  
  // Timeouts
  serverSelectionTimeoutMS: 30000,  // Timeout de selección de servidor
  socketTimeoutMS: 45000,           // Timeout de socket
  connectTimeoutMS: 10000,          // Timeout de conexión
  
  // Heartbeat
  heartbeatFrequencyMS: 10000,      // Frecuencia de heartbeat
  
  // Retry
  retryWrites: true,
  retryReads: true,
  bufferCommands: false,            // Fail-fast sin buffering
});
```

### 2.2 Variables de Entorno

| Variable | Valor por Defecto | Descripción |
|----------|-------------------|-------------|
| `MONGODB_URI` | `mongodb://localhost:27017/disherio` | URI de conexión |
| `MONGODB_MAX_POOL_SIZE` | `50` | Tamaño máximo del pool |
| `MONGODB_SERVER_SELECTION_TIMEOUT` | `30000` | Timeout de selección (ms) |
| `MONGODB_SOCKET_TIMEOUT` | `45000` | Timeout de socket (ms) |

### 2.3 Estados de Conexión

```
Estados de Mongoose:
├── 0: disconnected    (Desconectado)
├── 1: connected       (Conectado) ✓
├── 2: connecting      (Conectando)
└── 3: disconnecting   (Desconectando)
```

### 2.4 Lógica de Reconexión

- **Máximo de reintentos:** 5
- **Backoff exponencial:** 1s, 2s, 4s, 8s, 16s
- **Jitter aleatorio:** 0-1000ms
- **Cap máximo:** 30 segundos

---

## 3. Modelos Mongoose - Análisis Detallado

### 3.1 RESTAURANT (restaurants)

**Archivo:** `backend/src/models/restaurant.model.ts`

#### Interface TypeScript

```typescript
interface IRestaurant extends Document {
  restaurant_name: string;           // Nombre del restaurante
  restaurant_url?: string;           // URL personalizada
  logo_image_url?: string;           // Logo del restaurante
  social_links?: {                   // Redes sociales
    facebook_url?: string;
    instagram_url?: string;
  };
  tax_rate: number;                  // Tasa de impuestos (%)
  tips_state: boolean;               // Propinas activadas
  tips_type?: 'MANDATORY' | 'VOLUNTARY';  // Tipo de propina
  tips_rate?: number;                // Porcentaje de propina
  default_language: 'es' | 'en';     // Idioma por defecto
  default_theme: 'light' | 'dark';   // Tema por defecto
  currency: string;                  // Moneda (EUR, USD, etc.)
}
```

#### Esquema Mongoose

```typescript
const RestaurantSchema = new Schema<IRestaurant>(
  {
    restaurant_name: { type: String, required: true },
    restaurant_url: String,
    logo_image_url: String,
    social_links: {
      facebook_url: String,
      instagram_url: String,
    },
    tax_rate: { type: Number, required: true, default: 0 },
    tips_state: { type: Boolean, default: false },
    tips_type: { type: String, enum: ['MANDATORY', 'VOLUNTARY'] },
    tips_rate: Number,
    default_language: { type: String, enum: ['es', 'en'], default: 'es' },
    default_theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    currency: { type: String, default: 'EUR' },
  },
  { timestamps: true }
);
```

#### Análisis de Campos

| Campo | Tipo | Requerido | Default | Validaciones |
|-------|------|-----------|---------|--------------|
| `restaurant_name` | String | ✅ | - | - |
| `restaurant_url` | String | ❌ | - | - |
| `logo_image_url` | String | ❌ | - | - |
| `social_links.facebook_url` | String | ❌ | - | - |
| `social_links.instagram_url` | String | ❌ | - | - |
| `tax_rate` | Number | ✅ | `0` | - |
| `tips_state` | Boolean | ❌ | `false` | - |
| `tips_type` | String | ❌ | - | Enum: MANDATORY, VOLUNTARY |
| `tips_rate` | Number | ❌ | - | - |
| `default_language` | String | ❌ | `es` | Enum: es, en |
| `default_theme` | String | ❌ | `light` | Enum: light, dark |
| `currency` | String | ❌ | `EUR` | - |
| `createdAt` | Date | Auto | now | timestamps |
| `updatedAt` | Date | Auto | now | timestamps |

---

### 3.2 PRINTER (printers)

**Archivo:** `backend/src/models/restaurant.model.ts` (mismo archivo)

#### Interface

```typescript
interface IPrinter extends Document {
  restaurant_id: Types.ObjectId;     // Referencia al restaurante
  printer_name: string;              // Nombre de la impresora
  printer_ip: string;                // Dirección IP
  printer_connection: 'TCP' | 'BLUETOOTH' | 'USB';  // Tipo de conexión
}
```

#### Esquema

```typescript
const PrinterSchema = new Schema<IPrinter>(
  {
    restaurant_id: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    printer_name: { type: String, required: true },
    printer_ip: { type: String, required: true },
    printer_connection: { 
      type: String, 
      enum: ['TCP', 'BLUETOOTH', 'USB'], 
      required: true 
    },
  },
  { timestamps: true }
);
```

---

### 3.3 ROLE (roles)

**Archivo:** `backend/src/models/staff.model.ts`

#### Interface

```typescript
interface IRole extends Document {
  restaurant_id: Types.ObjectId;     // Referencia al restaurante
  role_name: string;                 // Nombre del rol
  permissions: string[];             // Array de permisos
}
```

#### Esquema

```typescript
const RoleSchema = new Schema<IRole>(
  {
    restaurant_id: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    role_name: { type: String, required: true },
    permissions: [{ type: String }],
  },
  { timestamps: true }
);

// Índice para búsquedas por restaurante
RoleSchema.index({ restaurant_id: 1 });
```

#### Roles por Defecto (Seed)

| Rol | Permisos | Descripción |
|-----|----------|-------------|
| `Admin` | `['ADMIN']` | Administrador completo |
| `KTS` | `['KTS']` | Kitchen Table Service |
| `POS` | `['POS']` | Point of Sale |
| `TAS` | `['TAS']` | Table Assistance Service |

---

### 3.4 STAFF (staff)

**Archivo:** `backend/src/models/staff.model.ts`

#### Interface

```typescript
interface IStaff extends Document {
  restaurant_id: Types.ObjectId;     // Referencia al restaurante
  role_id: Types.ObjectId;           // Referencia al rol
  staff_name: string;                // Nombre del empleado
  username: string;                  // Nombre de usuario (login)
  password_hash: string;             // Hash de contraseña (bcrypt)
  pin_code_hash: string;             // Hash de PIN (bcrypt)
  language?: 'es' | 'en';            // Preferencia de idioma
  theme?: 'light' | 'dark';          // Preferencia de tema
}
```

#### Esquema

```typescript
const StaffSchema = new Schema<IStaff>(
  {
    restaurant_id: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    role_id: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    staff_name: { type: String, required: true },
    username: { type: String, required: true, lowercase: true },
    password_hash: { type: String, required: true },
    pin_code_hash: { type: String, required: true },
    language: { type: String, enum: ['es', 'en'], default: null },
    theme: { type: String, enum: ['light', 'dark'], default: null },
  },
  { timestamps: true }
);

// Índices
StaffSchema.index({ restaurant_id: 1 });
StaffSchema.index({ restaurant_id: 1, username: 1 }, { unique: true });
```

#### Índices

| Índice | Tipo | Propósito |
|--------|------|-----------|
| `{ restaurant_id: 1 }` | Simple | Búsquedas por restaurante |
| `{ restaurant_id: 1, username: 1 }` | Único | Username único por restaurante |

> **Nota:** No existe índice en `pin_code_hash` porque bcrypt genera hashes diferentes para el mismo PIN debido al salt. La autenticación por PIN requiere iterar sobre los empleados del restaurante.

---

### 3.5 CUSTOMER (customers)

**Archivo:** `backend/src/models/customer.model.ts`

#### Interface

```typescript
interface ICustomer extends Document {
  restaurant_id: Types.ObjectId;     // Referencia al restaurante
  customer_name: string;             // Nombre del cliente
  customer_email?: string;           // Email del cliente
  customer_phone?: string;           // Teléfono del cliente
  created_at: Date;                  // Fecha de creación
}
```

#### Esquema

```typescript
const CustomerSchema = new Schema<ICustomer>(
  {
    restaurant_id: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    customer_name: { type: String, required: true },
    customer_email: { type: String },
    customer_phone: { type: String },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

// Índices compuestos únicos
CustomerSchema.index({ restaurant_id: 1, customer_email: 1 }, { unique: true, sparse: true });
CustomerSchema.index({ restaurant_id: 1, customer_phone: 1 }, { unique: true, sparse: true });
CustomerSchema.index({ restaurant_id: 1, created_at: -1 });
CustomerSchema.index({ restaurant_id: 1, customer_name: 1 });
```

#### Índices

| Índice | Tipo | Propósito |
|--------|------|-----------|
| `{ restaurant_id: 1, customer_email: 1 }` | Único + Sparse | Email único por restaurante |
| `{ restaurant_id: 1, customer_phone: 1 }` | Único + Sparse | Teléfono único por restaurante |
| `{ restaurant_id: 1, created_at: -1 }` | Simple | Listado de clientes ordenado |
| `{ restaurant_id: 1, customer_name: 1 }` | Simple | Búsqueda por nombre |

---

### 3.6 MENU LANGUAGE (menulanguages)

**Archivo:** `backend/src/models/menu-language.model.ts`

#### Interface

```typescript
interface IMenuLanguage extends Document {
  restaurant_id: Types.ObjectId;     // Referencia al restaurante
  name: string;                      // Nombre del idioma (ej: "Español")
  code: string;                      // Código ISO (ej: "es", "en")
  is_default: boolean;               // Es el idioma por defecto
  linked_app_lang: string | null;    // Idioma vinculado de la app
  order: number;                     // Orden de visualización
}
```

#### Esquema

```typescript
const MenuLanguageSchema = new Schema<IMenuLanguage>(
  {
    restaurant_id: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, lowercase: true },
    is_default: { type: Boolean, default: false },
    linked_app_lang: { type: String, enum: ['es', 'en', 'fr', null], default: null },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

MenuLanguageSchema.index({ restaurant_id: 1, code: 1 }, { unique: true });
```

#### Índices

| Índice | Tipo | Propósito |
|--------|------|-----------|
| `{ restaurant_id: 1, code: 1 }` | Único | Código de idioma único por restaurante |

---

### 3.7 CATEGORY (categories)

**Archivo:** `backend/src/models/dish.model.ts`

#### Interface

```typescript
interface ICategory extends Document {
  restaurant_id: Types.ObjectId;                    // Referencia al restaurante
  category_name: ILocalizedEntry[];                 // Nombre localizado
  category_order: number;                           // Orden de visualización
  category_description?: ILocalizedEntry[];         // Descripción localizada
  category_image_url?: string;                      // URL de imagen
}
```

#### Esquema de Campo Localizado

```typescript
const LocalizedFieldSchema = [
  {
    lang: { type: String, required: true },    // ID del MenuLanguage
    value: { type: String, default: '' },      // Valor traducido
    _id: false,
  },
];
```

#### Esquema

```typescript
const CategorySchema = new Schema<ICategory>(
  {
    restaurant_id: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    category_name: LocalizedFieldSchema,
    category_order: { type: Number, default: 0 },
    category_description: LocalizedFieldSchema,
    category_image_url: String,
  },
  { timestamps: true }
);

CategorySchema.index({ restaurant_id: 1, category_order: 1 });
```

#### Ejemplo de Documento

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "restaurant_id": "507f1f77bcf86cd799439010",
  "category_name": [
    { "lang": "lang_001", "value": "Entrantes" },
    { "lang": "lang_002", "value": "Starters" }
  ],
  "category_order": 1,
  "category_description": [
    { "lang": "lang_001", "value": "Platos para empezar" },
    { "lang": "lang_002", "value": "Dishes to start" }
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

---

### 3.8 DISH (dishes)

**Archivo:** `backend/src/models/dish.model.ts`

#### Sub-esquemas: Variant y Extra

```typescript
const VariantSubSchema = new Schema(
  {
    variant_name: LocalizedFieldSchema,
    variant_description: LocalizedFieldSchema,
    variant_url_image: String,
    variant_price: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const ExtraSubSchema = new Schema(
  {
    extra_name: LocalizedFieldSchema,
    extra_description: LocalizedFieldSchema,
    extra_price: { type: Number, required: true, min: 0 },
    extra_url_image: String,
  },
  { _id: true }
);
```

#### Interface

```typescript
interface IDish extends Document {
  restaurant_id: Types.ObjectId;                    // Referencia al restaurante
  category_id: Types.ObjectId;                      // Referencia a categoría
  disher_name: ILocalizedEntry[];                   // Nombre localizado
  disher_description?: ILocalizedEntry[];           // Descripción localizada
  disher_url_image?: string;                        // URL de imagen
  disher_status: 'ACTIVATED' | 'DESACTIVATED';      // Estado del plato
  disher_price: number;                             // Precio base
  disher_type: 'KITCHEN' | 'SERVICE';               // Tipo: Cocina o Servicio
  disher_alergens: string[];                        // Lista de alérgenos
  disher_variant: boolean;                          // Tiene variantes
  variants: IVariant[];                             // Array de variantes
  extras: IExtra[];                                 // Array de extras
}
```

#### Esquema

```typescript
const DishSchema = new Schema<IDish>(
  {
    restaurant_id: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    category_id: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    disher_name: LocalizedFieldSchema,
    disher_description: LocalizedFieldSchema,
    disher_url_image: String,
    disher_status: { 
      type: String, 
      enum: ['ACTIVATED', 'DESACTIVATED'], 
      default: 'ACTIVATED' 
    },
    disher_price: { type: Number, required: true, min: 0 },
    disher_type: { 
      type: String, 
      enum: ['KITCHEN', 'SERVICE'], 
      required: true 
    },
    disher_alergens: [{ type: String }],
    disher_variant: { type: Boolean, default: false },
    variants: [VariantSubSchema],
    extras: [ExtraSubSchema],
  },
  { timestamps: true }
);
```

#### Índices

| Índice | Tipo | Propósito |
|--------|------|-----------|
| `{ category_id: 1, disher_status: 1 }` | Simple | Búsqueda por categoría con filtro de estado |
| `{ restaurant_id: 1, disher_status: 1 }` | Simple | Listado de platos por restaurante |
| `{ 'disher_name.value': 'text' }` | Texto | Búsqueda full-text por nombre |
| `{ disher_type: 1, disher_status: 1 }` | Simple | Filtrado por tipo (KITCHEN/SERVICE) |

#### Ejemplo de Documento

```json
{
  "_id": "507f1f77bcf86cd799439020",
  "restaurant_id": "507f1f77bcf86cd799439010",
  "category_id": "507f1f77bcf86cd799439011",
  "disher_name": [
    { "lang": "lang_001", "value": "Paella Valenciana" },
    { "lang": "lang_002", "value": "Valencian Paella" }
  ],
  "disher_description": [
    { "lang": "lang_001", "value": "Arroz con pollo y marisco" },
    { "lang": "lang_002", "value": "Rice with chicken and seafood" }
  ],
  "disher_url_image": "https://cdn.disherio.com/dishes/paella.jpg",
  "disher_status": "ACTIVATED",
  "disher_price": 18.50,
  "disher_type": "KITCHEN",
  "disher_alergens": ["gluten", "marisco"],
  "disher_variant": true,
  "variants": [
    {
      "_id": "var_001",
      "variant_name": [
        { "lang": "lang_001", "value": "Para 2 personas" },
        { "lang": "lang_002", "value": "For 2 people" }
      ],
      "variant_price": 35.00
    }
  ],
  "extras": [
    {
      "_id": "ext_001",
      "extra_name": [
        { "lang": "lang_001", "value": "Extra gambas" },
        { "lang": "lang_002", "value": "Extra prawns" }
      ],
      "extra_price": 5.00
    }
  ]
}
```

---

### 3.9 TOTEM (totems)

**Archivo:** `backend/src/models/totem.model.ts`

#### Interface

```typescript
interface ITotem extends Document {
  restaurant_id: Types.ObjectId;                    // Referencia al restaurante
  totem_name: string;                               // Nombre del totem
  totem_qr: string;                                 // Código QR único
  totem_type: 'STANDARD' | 'TEMPORARY';             // Tipo de totem
  totem_start_date: Date;                           // Fecha de inicio
}
```

#### Esquema

```typescript
const TotemSchema = new Schema<ITotem>(
  {
    restaurant_id: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    totem_name: { type: String, required: true },
    totem_qr: { type: String, unique: true },
    totem_type: { 
      type: String, 
      enum: ['STANDARD', 'TEMPORARY'], 
      required: true 
    },
    totem_start_date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

TotemSchema.index({ restaurant_id: 1, totem_type: 1 });
TotemSchema.index({ totem_qr: 1 }, { unique: true, sparse: true });
```

#### Índices

| Índice | Tipo | Propósito |
|--------|------|-----------|
| `{ restaurant_id: 1, totem_type: 1 }` | Simple | Búsqueda por restaurante y tipo |
| `{ totem_qr: 1 }` | Único + Sparse | Búsqueda única por QR |

---

### 3.10 TOTEM SESSION (totemsessions)

**Archivo:** `backend/src/models/totem.model.ts`

#### Interface

```typescript
interface ITotemSession extends Document {
  totem_id: Types.ObjectId;                         // Referencia al totem
  session_date_start: Date;                         // Fecha de inicio
  totem_state: 'STARTED' | 'COMPLETE' | 'PAID';     // Estado de la sesión
  version: number;                                  // Versión para optimistic locking
}
```

#### Esquema

```typescript
const TotemSessionSchema = new Schema<ITotemSession>(
  {
    totem_id: { type: Schema.Types.ObjectId, ref: 'Totem', required: true },
    session_date_start: { type: Date, default: Date.now },
    totem_state: { 
      type: String, 
      enum: ['STARTED', 'COMPLETE', 'PAID'], 
      default: 'STARTED' 
    },
    version: { type: Number, default: 0 },
  },
  { 
    timestamps: true,
    optimisticConcurrency: true 
  }
);

TotemSessionSchema.index({ totem_id: 1, totem_state: 1 });
TotemSessionSchema.index({ totem_state: 1, createdAt: -1 });
TotemSessionSchema.index({ _id: 1, version: 1 });
```

#### Estados de Sesión

```
STARTED  →  COMPLETE  →  PAID
   │           │           │
   │           │           └─ Sesión pagada, cerrada
   │           └─ Pedido completado, pendiente de pago
   └─ Sesión activa, aceptando pedidos
```

#### Índices

| Índice | Tipo | Propósito |
|--------|------|-----------|
| `{ totem_id: 1, totem_state: 1 }` | Simple | Búsqueda de sesiones por totem |
| `{ totem_state: 1, createdAt: -1 }` | Simple | Sesiones activas ordenadas |
| `{ _id: 1, version: 1 }` | Simple | Optimistic locking |

---

### 3.11 SESSION CUSTOMER (sessioncustomers)

**Archivo:** `backend/src/models/totem.model.ts`

#### Interface

```typescript
interface ISessionCustomer extends Document {
  customer_name: string;                            // Nombre del cliente
  session_id: Types.ObjectId;                       // Referencia a la sesión
}
```

#### Esquema

```typescript
const SessionCustomerSchema = new Schema<ISessionCustomer>(
  {
    customer_name: { type: String, required: true },
    session_id: { type: Schema.Types.ObjectId, ref: 'TotemSession', required: true },
  },
  { timestamps: true }
);

SessionCustomerSchema.index({ session_id: 1 });
```

> **Nota:** Los `SessionCustomer` son diferentes de `Customer`. Los primeros son clientes temporales de una sesión específica, mientras que `Customer` representa clientes registrados del restaurante.

---

### 3.12 ORDER (orders)

**Archivo:** `backend/src/models/order.model.ts`

#### Interface

```typescript
interface IOrder extends Document {
  session_id: Types.ObjectId;                       // Referencia a sesión
  customer_id?: Types.ObjectId;                     // Referencia a cliente (opcional)
  staff_id?: Types.ObjectId;                        // Referencia a staff (opcional)
  order_date: Date;                                 // Fecha del pedido
}
```

#### Esquema

```typescript
const OrderSchema = new Schema<IOrder>(
  {
    session_id: { type: Schema.Types.ObjectId, ref: 'TotemSession', required: true },
    customer_id: { type: Schema.Types.ObjectId, ref: 'Customer' },
    staff_id: { type: Schema.Types.ObjectId, ref: 'Staff' },
    order_date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

OrderSchema.index({ session_id: 1, order_date: -1 });
OrderSchema.index({ customer_id: 1, order_date: -1 });
OrderSchema.index({ staff_id: 1, order_date: -1 });
OrderSchema.index({ order_date: -1 });
```

#### Índices

| Índice | Tipo | Propósito |
|--------|------|-----------|
| `{ session_id: 1, order_date: -1 }` | Simple | Pedidos por sesión ordenados |
| `{ customer_id: 1, order_date: -1 }` | Simple | Historial de pedidos por cliente |
| `{ staff_id: 1, order_date: -1 }` | Simple | Pedidos por empleado |
| `{ order_date: -1 }` | Simple | Consultas por rango de fechas |

---

### 3.13 ITEM ORDER (itemorders)

**Archivo:** `backend/src/models/order.model.ts`

#### Interface

```typescript
interface IItemOrder extends Document {
  order_id: Types.ObjectId;                         // Referencia al pedido
  session_id: Types.ObjectId;                       // Referencia a sesión
  item_dish_id: Types.ObjectId;                     // Referencia al plato
  customer_id?: Types.ObjectId;                     // Cliente que ordenó
  customer_name?: string;                           // Nombre del cliente (snapshot)
  item_state: 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED';
  item_disher_type: 'KITCHEN' | 'SERVICE';
  item_name_snapshot: ILocalizedSnapshot[];         // Snapshot del nombre
  item_base_price: number;                          // Precio base
  item_disher_variant?: {                           // Variante seleccionada
    variant_id: string;
    name: ILocalizedSnapshot[];
    price: number;
  } | null;
  item_disher_extras: {                             // Extras seleccionados
    extra_id: string;
    name: ILocalizedSnapshot[];
    price: number;
  }[];
  version: number;                                  // Optimistic locking
}
```

#### Esquema

```typescript
const ItemOrderSchema = new Schema<IItemOrder>(
  {
    order_id: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    session_id: { type: Schema.Types.ObjectId, ref: 'TotemSession', required: true, index: true },
    item_dish_id: { type: Schema.Types.ObjectId, ref: 'Dish', required: true, index: true },
    customer_id: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
    customer_name: String,
    item_state: {
      type: String,
      enum: ['ORDERED', 'ON_PREPARE', 'SERVED', 'CANCELED'],
      default: 'ORDERED',
      index: true,
    },
    item_disher_type: { type: String, enum: ['KITCHEN', 'SERVICE'], required: true, index: true },
    item_name_snapshot: LocalizedFieldSnapshotSchema,
    item_base_price: { type: Number, required: true, min: 0 },
    item_disher_variant: {
      variant_id: String,
      name: LocalizedFieldSnapshotSchema,
      price: Number,
    },
    item_disher_extras: [
      {
        extra_id: String,
        name: LocalizedFieldSnapshotSchema,
        price: Number,
      },
    ],
    version: { type: Number, default: 0 },
  },
  { 
    timestamps: true,
    optimisticConcurrency: true 
  }
);
```

#### Estados de Item

```
┌──────────┐    ┌────────────┐    ┌─────────┐
│ ORDERED  │───→│ ON_PREPARE │───→│ SERVED  │
└──────────┘    └────────────┘    └─────────┘
       │
       ↓
┌──────────┐
│ CANCELED │
└──────────┘
```

#### Índices

| Índice | Tipo | Propósito |
|--------|------|-----------|
| `{ session_id: 1, item_disher_type: 1, item_state: 1 }` | Compuesto | Queries de cocina/servicio (KDS) |
| `{ order_id: 1, item_state: 1 }` | Compuesto | Items por pedido con estado |
| `{ customer_id: 1, createdAt: -1 }` | Compuesto | Items por cliente |
| `{ item_disher_type: 1, item_state: 1, createdAt: 1 }` | Compuesto | KDS con orden temporal |
| `{ session_id: 1, item_state: 1, createdAt: 1 }` | Compuesto | Items activos por sesión |
| `{ item_dish_id: 1, item_state: 1, createdAt: -1 }` | Compuesto | Estadísticas de ventas |
| `{ _id: 1, version: 1 }` | Compuesto | Optimistic locking |

---

### 3.14 PAYMENT (payments)

**Archivo:** `backend/src/models/order.model.ts`

#### Interface

```typescript
interface IPayment extends Document {
  session_id: Types.ObjectId;                       // Referencia a sesión
  payment_type: 'ALL' | 'BY_USER' | 'SHARED';       // Tipo de pago
  payment_total: number;                            // Total a pagar
  payment_date: Date;                               // Fecha de pago
  tickets: {                                        // Tickets de pago
    ticket_id?: Types.ObjectId;
    ticket_part: number;                            // Número de parte
    ticket_total_parts: number;                     // Total de partes
    ticket_amount: number;                          // Monto de esta parte
    ticket_customer_name?: string;                  // Nombre del cliente
    paid: boolean;                                  // Estado de pago
  }[];
}
```

#### Esquema

```typescript
const PaymentSchema = new Schema<IPayment>(
  {
    session_id: { type: Schema.Types.ObjectId, ref: 'TotemSession', required: true, index: true },
    payment_type: { type: String, enum: ['ALL', 'BY_USER', 'SHARED'], required: true },
    payment_total: { type: Number, required: true, min: 0 },
    payment_date: { type: Date, default: Date.now },
    tickets: [
      {
        ticket_part: { type: Number, required: true },
        ticket_total_parts: { type: Number, required: true },
        ticket_amount: { type: Number, required: true, min: 0 },
        ticket_customer_name: String,
        paid: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);
```

#### Tipos de Pago

| Tipo | Descripción |
|------|-------------|
| `ALL` | Pago único de toda la cuenta |
| `BY_USER` | Pago por cliente individual |
| `SHARED` | Pago dividido entre varios |

#### Índices

| Índice | Tipo | Propósito |
|--------|------|-----------|
| `{ session_id: 1, payment_date: -1 }` | Compuesto | Pagos por sesión |
| `{ payment_date: -1, session_id: 1 }` | Compuesto | Estadísticas de pagos |
| `{ _id: 1, 'tickets.ticket_part': 1 }` | Compuesto | Búsqueda de tickets |

---

## 4. Diagrama Entidad-Relación

### 4.1 Diagrama Completo (Texto)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         DIAGRAMA ENTIDAD-RELACIÓN DISHERIO                      │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   RESTAURANT    │         │    CUSTOMER     │         │  MENU LANGUAGE  │
├─────────────────┤         ├─────────────────┤         ├─────────────────┤
│ PK _id          │◄───────┼│ FK restaurant_id│         │ PK _id          │
│    restaurant_  │         │    customer_name│         │ FK restaurant_id│◄────┐
│    _name        │         │    customer_    │         │    name         │     │
│    tax_rate     │         │    _email       │         │    code         │     │
│    currency     │         │    customer_    │         │    is_default   │     │
│    default_lang │         │    _phone       │         │    order        │     │
└────────┬────────┘         └─────────────────┘         └─────────────────┘     │
         │                                                                       │
         │         ┌─────────────────┐         ┌─────────────────┐              │
         │         │     PRINTER     │         │  SESSION CUSTOMER              │
         │         ├─────────────────┤         ├─────────────────┤              │
         │         │ PK _id          │         │ PK _id          │              │
         │         │ FK restaurant_id│◄────────┤    customer_name│              │
         │         │    printer_name │         │ FK session_id   │──────────────┤
         │         │    printer_ip   │         └─────────────────┘              │
         │         │    printer_conn │                                          │
         │         └─────────────────┘                                          │
         │                                                                      │
         │         ┌─────────────────┐         ┌─────────────────┐              │
         │         │      STAFF      │         │   TOTEM SESSION │              │
         │         ├─────────────────┤         ├─────────────────┤              │
         │         │ PK _id          │         │ PK _id          │              │
         └────────►│ FK restaurant_id│         │ FK totem_id     │◄─────────────┤
                   │ FK role_id      │◄────────┤    session_date │              │
                   │    staff_name   │         │    totem_state  │              │
                   │    username     │         │    version      │              │
                   │    password_    │         └────────┬────────┘              │
                   │    _hash        │                  │                       │
                   │    pin_code_    │                  │                       │
                   │    _hash        │                  │                       │
                   └─────────────────┘                  │                       │
                                                        │                       │
                              ┌─────────────────┐       │                       │
                              │      ROLE       │       │                       │
                              ├─────────────────┤       │                       │
                              │ PK _id          │       │                       │
                              │ FK restaurant_id│◄──────┘                       │
                              │    role_name    │                              │
                              │    permissions  │                              │
                              └─────────────────┘                              │
                                                                               │
         ┌─────────────────┐         ┌─────────────────┐         ┌─────────────┘
         │    CATEGORY     │         │      DISH       │         │
         ├─────────────────┤         ├─────────────────┤         │
         │ PK _id          │◄────────┤ FK category_id  │         │
         │ FK restaurant_id│◄────────┤ FK restaurant_id│◄────────┘
         │    category_name│         │    disher_name  │
         │    category_    │         │    disher_price │
         │    _order       │         │    disher_status│
         │    category_    │         │    disher_type  │
         │    _desc        │         │    variants[]   │
         │    category_    │         │    extras[]     │
         │    _image_url   │         │    disher_      │
         └─────────────────┘         │    _alergens    │
                                     └─────────────────┘
                                              │
                                              │
         ┌─────────────────┐         ┌────────┴────────┐         ┌─────────────────┐
         │      ORDER      │         │   ITEM ORDER    │         │     PAYMENT     │
         ├─────────────────┤         ├─────────────────┤         ├─────────────────┤
         │ PK _id          │◄────────┤ FK order_id     │         │ PK _id          │
         │ FK session_id   │◄────────┤ FK session_id   │◄────────┤ FK session_id   │
         │ FK customer_id  │         │ FK item_dish_id │         │    payment_type │
         │ FK staff_id     │         │ FK customer_id  │         │    payment_total│
         │    order_date   │         │    item_state   │         │    payment_date │
         └─────────────────┘         │    item_name_   │         │    tickets[]    │
                                     │    _snapshot    │         └─────────────────┘
                                     │    item_base_   │
                                     │    _price       │
                                     │    item_variant │
                                     │    item_extras  │
                                     │    version      │
                                     └─────────────────┘


### 4.2 Cardinalidad de Relaciones

| Entidad Origen | Relación | Entidad Destino | Cardinalidad | Tipo |
|----------------|----------|-----------------|--------------|------|
| Restaurant | tiene | Staff | 1:N | Referencia |
| Restaurant | tiene | Customer | 1:N | Referencia |
| Restaurant | tiene | MenuLanguage | 1:N | Referencia |
| Restaurant | tiene | Category | 1:N | Referencia |
| Restaurant | tiene | Printer | 1:N | Referencia |
| Restaurant | tiene | Role | 1:N | Referencia |
| Restaurant | tiene | Dish | 1:N | Referencia |
| Restaurant | tiene | Totem | 1:N | Referencia |
| Role | asignado a | Staff | 1:N | Referencia |
| Category | contiene | Dish | 1:N | Referencia |
| Totem | tiene sesiones | TotemSession | 1:N | Referencia |
| TotemSession | tiene | SessionCustomer | 1:N | Referencia |
| TotemSession | tiene | Order | 1:N | Referencia |
| TotemSession | tiene | ItemOrder | 1:N | Referencia |
| TotemSession | tiene | Payment | 1:N | Referencia |
| Order | contiene | ItemOrder | 1:N | Referencia |
| Customer | realiza | Order | 1:N | Referencia |
| Customer | ordena | ItemOrder | 1:N | Referencia |
| Staff | procesa | Order | 1:N | Referencia |
| Dish | aparece en | ItemOrder | 1:N | Referencia |

---

## 5. Documentación de Entidades

### 5.1 RESTAURANT

**Colección:** `restaurants`

**Propósito:** Entidad principal que representa un restaurante en el sistema. Actúa como tenant padre para todas las demás entidades.

| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `_id` | ObjectId | Auto | Generado | Identificador único |
| `restaurant_name` | String | ✅ | - | Nombre comercial |
| `restaurant_url` | String | ❌ | null | URL personalizada |
| `logo_image_url` | String | ❌ | null | Logo del restaurante |
| `social_links` | Object | ❌ | {} | Redes sociales |
| `social_links.facebook_url` | String | ❌ | null | URL Facebook |
| `social_links.instagram_url` | String | ❌ | null | URL Instagram |
| `tax_rate` | Number | ✅ | 0 | Tasa de impuestos (%) |
| `tips_state` | Boolean | ❌ | false | Propinas habilitadas |
| `tips_type` | String | ❌ | null | Tipo: MANDATORY/VOLUNTARY |
| `tips_rate` | Number | ❌ | null | % de propina |
| `default_language` | String | ❌ | 'es' | Idioma por defecto |
| `default_theme` | String | ❌ | 'light' | Tema por defecto |
| `currency` | String | ❌ | 'EUR' | Código de moneda |
| `createdAt` | Date | Auto | now | Fecha de creación |
| `updatedAt` | Date | Auto | now | Última actualización |

**Ejemplo:**
```json
{
  "_id": "507f1f77bcf86cd799439010",
  "restaurant_name": "Restaurante La Plaza",
  "restaurant_url": "https://lapaza.disherio.com",
  "logo_image_url": "https://cdn.disherio.com/logos/laplaza.png",
  "social_links": {
    "facebook_url": "https://facebook.com/laplaza",
    "instagram_url": "https://instagram.com/laplaza"
  },
  "tax_rate": 10,
  "tips_state": true,
  "tips_type": "VOLUNTARY",
  "tips_rate": 5,
  "default_language": "es",
  "default_theme": "light",
  "currency": "EUR",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-03-15T12:30:00Z"
}
```

---

### 5.2 DISH

**Colección:** `dishes`

**Propósito:** Representa los platos/productos disponibles en el menú del restaurante. Soporta localización, variantes y extras.

| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `_id` | ObjectId | Auto | Generado | Identificador único |
| `restaurant_id` | ObjectId | ✅ | - | Referencia al restaurante |
| `category_id` | ObjectId | ✅ | - | Referencia a categoría |
| `disher_name` | Array | ✅ | [] | Nombre localizado |
| `disher_description` | Array | ❌ | [] | Descripción localizada |
| `disher_url_image` | String | ❌ | null | Imagen del plato |
| `disher_status` | String | ❌ | 'ACTIVATED' | Estado del plato |
| `disher_price` | Number | ✅ | - | Precio base |
| `disher_type` | String | ✅ | - | KITCHEN/SERVICE |
| `disher_alergens` | Array | ❌ | [] | Lista de alérgenos |
| `disher_variant` | Boolean | ❌ | false | Tiene variantes |
| `variants` | Array | ❌ | [] | Array de variantes |
| `variants[].variant_name` | Array | ✅ | - | Nombre de variante |
| `variants[].variant_price` | Number | ✅ | - | Precio de variante |
| `extras` | Array | ❌ | [] | Array de extras |
| `extras[].extra_name` | Array | ✅ | - | Nombre de extra |
| `extras[].extra_price` | Number | ✅ | - | Precio de extra |
| `createdAt` | Date | Auto | now | Fecha de creación |
| `updatedAt` | Date | Auto | now | Última actualización |

**Validaciones:**
- `disher_price`: min 0
- `disher_status`: enum ['ACTIVATED', 'DESACTIVATED']
- `disher_type`: enum ['KITCHEN', 'SERVICE']

**Ejemplo:**
```json
{
  "_id": "dish_001",
  "restaurant_id": "rest_001",
  "category_id": "cat_001",
  "disher_name": [
    { "lang": "lang_es", "value": "Hamburguesa Clásica" },
    { "lang": "lang_en", "value": "Classic Burger" }
  ],
  "disher_price": 12.50,
  "disher_type": "KITCHEN",
  "disher_status": "ACTIVATED",
  "disher_variant": true,
  "variants": [
    {
      "_id": "var_001",
      "variant_name": [
        { "lang": "lang_es", "value": "Doble Carne" },
        { "lang": "lang_en", "value": "Double Meat" }
      ],
      "variant_price": 16.00
    }
  ],
  "extras": [
    {
      "_id": "ext_001",
      "extra_name": [
        { "lang": "lang_es", "value": "Queso Extra" },
        { "lang": "lang_en", "value": "Extra Cheese" }
      ],
      "extra_price": 2.00
    }
  ]
}
```

---

### 5.3 ORDER

**Colección:** `orders`

**Propósito:** Agrupa ítems de pedido realizados en una sesión. Representa una orden completa.

| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `_id` | ObjectId | Auto | Generado | Identificador único |
| `session_id` | ObjectId | ✅ | - | Referencia a sesión |
| `customer_id` | ObjectId | ❌ | null | Cliente (opcional) |
| `staff_id` | ObjectId | ❌ | null | Empleado que atendió |
| `order_date` | Date | ❌ | now | Fecha del pedido |
| `createdAt` | Date | Auto | now | Fecha de creación |
| `updatedAt` | Date | Auto | now | Última actualización |

**Ejemplo:**
```json
{
  "_id": "order_001",
  "session_id": "session_001",
  "customer_id": "cust_001",
  "staff_id": "staff_001",
  "order_date": "2024-03-15T19:30:00Z",
  "createdAt": "2024-03-15T19:30:00Z"
}
```

---

### 5.4 ITEM ORDER

**Colección:** `itemorders`

**Propósito:** Representa un ítem individual dentro de un pedido. Contiene snapshots de datos para preservar el historial aunque el plato cambie.

| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `_id` | ObjectId | Auto | Generado | Identificador único |
| `order_id` | ObjectId | ✅ | - | Referencia al pedido |
| `session_id` | ObjectId | ✅ | - | Referencia a sesión |
| `item_dish_id` | ObjectId | ✅ | - | Referencia al plato |
| `customer_id` | ObjectId | ❌ | null | Cliente que ordenó |
| `customer_name` | String | ❌ | null | Nombre (snapshot) |
| `item_state` | String | ❌ | 'ORDERED' | Estado del ítem |
| `item_disher_type` | String | ✅ | - | KITCHEN/SERVICE |
| `item_name_snapshot` | Array | ✅ | - | Nombre del plato (snapshot) |
| `item_base_price` | Number | ✅ | - | Precio base |
| `item_disher_variant` | Object | ❌ | null | Variante seleccionada |
| `item_disher_extras` | Array | ❌ | [] | Extras seleccionados |
| `version` | Number | ❌ | 0 | Versión (optimistic locking) |
| `createdAt` | Date | Auto | now | Fecha de creación |
| `updatedAt` | Date | Auto | now | Última actualización |

**Validaciones:**
- `item_state`: enum ['ORDERED', 'ON_PREPARE', 'SERVED', 'CANCELED']
- `item_base_price`: min 0
- `optimisticConcurrency`: true

**Ejemplo:**
```json
{
  "_id": "item_001",
  "order_id": "order_001",
  "session_id": "session_001",
  "item_dish_id": "dish_001",
  "customer_id": "cust_001",
  "item_state": "ON_PREPARE",
  "item_disher_type": "KITCHEN",
  "item_name_snapshot": [
    { "lang": "lang_es", "value": "Hamburguesa Clásica" }
  ],
  "item_base_price": 12.50,
  "item_disher_variant": {
    "variant_id": "var_001",
    "name": [{ "lang": "lang_es", "value": "Doble Carne" }],
    "price": 16.00
  },
  "item_disher_extras": [
    {
      "extra_id": "ext_001",
      "name": [{ "lang": "lang_es", "value": "Queso Extra" }],
      "price": 2.00
    }
  ],
  "version": 2
}
```

---

### 5.5 TOTEM SESSION

**Colección:** `totemsessions`

**Propósito:** Representa una sesión activa en un totem/mesa. Agrupa órdenes y pagos.

| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `_id` | ObjectId | Auto | Generado | Identificador único |
| `totem_id` | ObjectId | ✅ | - | Referencia al totem |
| `session_date_start` | Date | ❌ | now | Fecha de inicio |
| `totem_state` | String | ❌ | 'STARTED' | Estado de la sesión |
| `version` | Number | ❌ | 0 | Versión (optimistic locking) |
| `createdAt` | Date | Auto | now | Fecha de creación |
| `updatedAt` | Date | Auto | now | Última actualización |

**Validaciones:**
- `totem_state`: enum ['STARTED', 'COMPLETE', 'PAID']
- `optimisticConcurrency`: true

**Ejemplo:**
```json
{
  "_id": "session_001",
  "totem_id": "totem_001",
  "session_date_start": "2024-03-15T19:00:00Z",
  "totem_state": "STARTED",
  "version": 0
}
```

---

## 6. Relaciones entre Entidades

### 6.1 Tipos de Relaciones Implementadas

| Tipo | Descripción | Ejemplos |
|------|-------------|----------|
| **Referencia (ObjectId)** | Referencia a documento en otra colección | `restaurant_id`, `category_id` |
| **Embedding** | Documento anidado dentro de otro | `variants[]`, `extras[]` en Dish |
| **Snapshot** | Copia de datos en momento específico | `item_name_snapshot` en ItemOrder |

### 6.2 Patrón Multi-tenant

Todas las entidades (excepto Restaurant) contienen un campo `restaurant_id` que implementa el aislamiento de datos:

```typescript
// Ejemplo de patrón en todos los modelos
restaurant_id: { 
  type: Schema.Types.ObjectId, 
  ref: 'Restaurant', 
  required: true,
  index: true  // Índice para queries eficientes
}
```

### 6.3 Snapshot Pattern

Los `ItemOrder` utilizan el patrón snapshot para preservar el estado del plato en el momento del pedido:

```typescript
// Datos que se snapshottean
item_name_snapshot: ILocalizedSnapshot[]  // Nombre del plato
item_base_price: number                   // Precio base
item_disher_variant: {...}               // Variante seleccionada
item_disher_extras: [...]                // Extras seleccionados
```

Esto permite:
- Mantener historial preciso aunque el plato cambie
- Reportes consistentes de ventas
- Facturación basada en precios históricos

---

## 7. Índices y Optimizaciones

### 7.1 Resumen de Índices por Colección

| Colección | Nº Índices | Índices Únicos | Índices Compuestos |
|-----------|------------|----------------|-------------------|
| restaurants | 1 (default) | 0 | 0 |
| customers | 5 | 2 | 4 |
| staff | 3 | 1 | 2 |
| roles | 2 | 0 | 1 |
| menulanguages | 2 | 1 | 1 |
| categories | 2 | 0 | 1 |
| dishes | 5 | 0 | 4 |
| totems | 3 | 1 | 1 |
| totemsessions | 4 | 0 | 3 |
| sessioncustomers | 2 | 0 | 1 |
| orders | 5 | 0 | 4 |
| itemorders | 10 | 0 | 9 |
| payments | 4 | 0 | 3 |

### 7.2 Índices Críticos para Performance

#### Búsquedas de KDS (Kitchen Display System)

```javascript
// Índice para queries de cocina
ItemOrderSchema.index({ 
  session_id: 1, 
  item_disher_type: 1, 
  item_state: 1 
});
```

**Uso típico:** Filtrar items de cocina en estado ORDERED para una sesión específica.

#### Búsquedas Full-Text

```javascript
// Índice de texto para búsqueda de platos
DishSchema.index({ 'disher_name.value': 'text' });
```

**Uso típico:** Búsqueda por nombre de plato en múltiples idiomas.

#### Unicidad Compuesta

```javascript
// Email único por restaurante
CustomerSchema.index({ 
  restaurant_id: 1, 
  customer_email: 1 
}, { unique: true, sparse: true });
```

**Ventaja:** Permite el mismo email en diferentes restaurantes pero único dentro de uno.

### 7.3 Optimistic Locking

Implementado en modelos con alta contención:

```typescript
// Modelos con optimisticConcurrency
TotemSessionSchema
ItemOrderSchema

// Campo version requerido
version: { type: Number, default: 0 }

// Índice para locking
Schema.index({ _id: 1, version: 1 });
```

**Funcionamiento:**
1. Se lee el documento con su versión
2. Se modifica y se guarda incrementando versión
3. Si otro proceso modificó el documento, la versión no coincide → error

---

## 8. Inicialización y Seeds

### 8.1 Script de Seed

**Archivo:** `backend/src/seeders/index.ts`

#### Flujo de Inicialización

```
1. Conectar a MongoDB
   └── mongodb://localhost:27017/disherio
   
2. Crear Restaurant por defecto
   └── restaurant_name: 'DisherIo'
   └── tax_rate: 10
   └── currency: 'EUR'
   
3. Crear Roles por defecto
   ├── Admin → ['ADMIN']
   ├── KTS   → ['KTS']
   ├── POS   → ['POS']
   └── TAS   → ['TAS']
   
4. Crear/Actualizar Admin User
   └── username: ADMIN_USERNAME (env)
   └── password: bcrypt(ADMIN_PASSWORD)
   └── pin_code: bcrypt(ADMIN_PIN)
   └── role: Admin
```

### 8.2 Variables de Entorno para Seed

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `MONGODB_URI` | ❌ | URI de MongoDB (default: localhost) |
| `ADMIN_USERNAME` | ❌ | Username admin (default: 'admin') |
| `ADMIN_PASSWORD` | ✅ | Contraseña admin |
| `ADMIN_PIN` | ✅ | PIN de 4 dígitos |
| `APP_LANG` | ❌ | Idioma default (default: 'es') |

### 8.3 Comando de Ejecución

```bash
# Desarrollo
npm run seed

# O directamente
npx ts-node src/seeders/index.ts
```

### 8.4 Datos Iniciales

#### Restaurante por Defecto

```json
{
  "restaurant_name": "DisherIo",
  "tax_rate": 10,
  "currency": "EUR",
  "default_language": "es",
  "default_theme": "light"
}
```

#### Roles por Defecto

```javascript
const defaultRoles = [
  { role_name: 'Admin', permissions: ['ADMIN'] },
  { role_name: 'KTS',   permissions: ['KTS'] },    // Kitchen Table Service
  { role_name: 'POS',   permissions: ['POS'] },    // Point of Sale
  { role_name: 'TAS',   permissions: ['TAS'] },    // Table Assistance Service
];
```

#### Permisos del Sistema

| Permiso | Descripción |
|---------|-------------|
| `ADMIN` | Acceso completo al sistema |
| `KTS`   | Gestión de cocina y servicio de mesa |
| `POS`   | Punto de venta y cobros |
| `TAS`   | Asistencia en mesa y atención al cliente |

---

## 9. Validaciones y Esquemas

### 9.1 Esquemas Zod (Shared Package)

Los esquemas de validación están centralizados en `/shared/schemas/`:

#### dish.schema.ts

```typescript
export const DishSchema = z.object({
  restaurant_id: z.string(),
  category_id: z.string(),
  disher_name: LocalizedFieldSchema,
  disher_description: LocalizedFieldSchema.optional(),
  disher_url_image: z.string().url().optional(),
  disher_status: z.enum(['ACTIVATED', 'DESACTIVATED']).default('ACTIVATED'),
  disher_price: z.number().positive().max(999999),
  disher_type: z.enum(['KITCHEN', 'SERVICE']),
  disher_alergens: z.array(z.string()).default([]),
  disher_variant: z.boolean().default(false),
  variants: z.array(VariantSchema).default([]),
  extras: z.array(ExtraSchema).default([]),
});
```

#### order.schema.ts

```typescript
export const ItemOrderSchema = z.object({
  order_id: z.string(),
  session_id: z.string(),
  item_dish_id: z.string(),
  customer_id: z.string().optional(),
  customer_name: z.string().optional(),
  item_state: z.enum(['ORDERED', 'ON_PREPARE', 'SERVED', 'CANCELED']).default('ORDERED'),
  item_disher_type: z.enum(['KITCHEN', 'SERVICE']),
  item_base_price: z.number().positive().max(999999),
  // ... más campos
});
```

### 9.2 Campos Localizados

El sistema utiliza un nuevo patrón de localización basado en arrays:

```typescript
// Nuevo patrón (actual)
export const LocalizedEntrySchema = z.object({
  lang: z.string(),      // ID del MenuLanguage
  value: z.string().default(''),
});

export const LocalizedFieldSchema = z.array(LocalizedEntrySchema).default([]);

// Ejemplo
[
  { "lang": "lang_001", "value": "Hamburguesa" },
  { "lang": "lang_002", "value": "Burger" }
]
```

### 9.3 Validaciones de Precio

```typescript
// Helper de validación de precios
const priceValidation = z.number().positive().max(999999);

// Aplicado en:
// - disher_price
// - variant_price
// - extra_price
// - item_base_price
// - payment_total
```

---

## 10. Recomendaciones

### 10.1 Optimizaciones Recomendadas

#### A. Índices Adicionales Sugeridos

```javascript
// Para reportes de ventas por fecha
ItemOrderSchema.index({ 
  restaurant_id: 1, 
  createdAt: -1,
  item_state: 1 
});

// Para búsqueda de clientes por nombre/email
CustomerSchema.index({ 
  restaurant_id: 1, 
  customer_name: 'text',
  customer_email: 'text' 
});

// Para estadísticas de platos más vendidos
DishSchema.index({ 
  restaurant_id: 1, 
  disher_status: 1 
});
```

#### B. TTL Index para Sesiones Completadas

```javascript
// Auto-eliminación de sesiones pagadas después de 90 días
TotemSessionSchema.index({ 
  updatedAt: 1 
}, { 
  expireAfterSeconds: 7776000,  // 90 días
  partialFilterExpression: { totem_state: 'PAID' }
});
```

#### C. Sharding (para escala masiva)

```javascript
// Shard key recomendada para distribución
sh.shardCollection("disherio.itemorders", { 
  restaurant_id: 1, 
  _id: 1 
});
```

### 10.2 Mejores Prácticas

| Área | Recomendación |
|------|---------------|
| **Backups** | Implementar backups diarios con mongodump |
| **Monitoreo** | Habilitar MongoDB Atlas o instalar PMM |
| **Índices** | Revisar slow queries mensualmente |
| **Paginación** | Usar cursor-based para colecciones grandes |
| **Transacciones** | Usar para operaciones multi-documento |
| **Validación** | Habilitar schema validation en MongoDB |

### 10.3 Limitaciones Conocidas

1. **PIN Authentication:** No tiene índice por `pin_code_hash` debido a bcrypt salting
   - **Solución:** Considerar agregar un campo `pin_salt` para búsqueda más rápida

2. **Localized Fields:** El índice de texto en `disher_name.value` puede ser costoso
   - **Solución:** Considerar materializar un campo `search_keywords`

3. **SessionCustomer vs Customer:** Posible confusión de nombres
   - **Nota:** `SessionCustomer` es temporal por sesión, `Customer` es persistente

---

## 11. Anexos

### 11.1 Tipos de Datos Enum

```typescript
// Estados de ítem
type ItemState = 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED';

// Tipos de plato
type ItemDishType = 'KITCHEN' | 'SERVICE';

// Estados de sesión
type TotemState = 'STARTED' | 'COMPLETE' | 'PAID';

// Estados de plato
type DishStatus = 'ACTIVATED' | 'DESACTIVATED';

// Tipos de pago
type PaymentType = 'ALL' | 'BY_USER' | 'SHARED';

// Tipos de totem
type TotemType = 'STANDARD' | 'TEMPORARY';

// Tipos de conexión de impresora
type PrinterConnection = 'TCP' | 'BLUETOOTH' | 'USB';

// Tipos de propina
type TipsType = 'MANDATORY' | 'VOLUNTARY';
```

### 11.2 Estructura de Directorios

```
backend/src/
├── models/
│   ├── customer.model.ts      # Customer
│   ├── dish.model.ts          # Category, Dish
│   ├── menu-language.model.ts # MenuLanguage
│   ├── order.model.ts         # Order, ItemOrder, Payment
│   ├── restaurant.model.ts    # Restaurant, Printer
│   ├── staff.model.ts         # Role, Staff
│   └── totem.model.ts         # Totem, TotemSession, SessionCustomer
├── schemas/
│   ├── auth.schema.ts         # LoginSchema, PinSchema
│   ├── dish.schema.ts         # Re-exports de shared
│   └── order.schema.ts        # Re-exports de shared
├── seeders/
│   └── index.ts               # Datos iniciales
└── config/
    └── db.ts                  # Configuración de conexión

shared/
└── schemas/
    ├── localized-string.schema.ts  # LocalizedFieldSchema
    ├── dish.schema.ts              # DishSchema, VariantSchema, ExtraSchema
    ├── order.schema.ts             # OrderSchema, ItemOrderSchema, PaymentSchema
    ├── restaurant.schema.ts        # RestaurantSchema, PrinterSchema
    ├── staff.schema.ts             # StaffSchema, RoleSchema
    ├── totem.schema.ts             # TotemSchema, TotemSessionSchema
    └── menu-language.schema.ts     # MenuLanguageSchema
```

### 11.3 Glosario

| Término | Definición |
|---------|------------|
| **KDS** | Kitchen Display System - Sistema de visualización para cocina |
| **POS** | Point of Sale - Punto de venta |
| **TAS** | Table Assistance Service - Servicio de asistencia en mesa |
| **KTS** | Kitchen Table Service - Servicio de cocina y mesa |
| **Totem** | Dispositivo físico en mesa para pedidos QR |
| **Snapshot** | Copia de datos en un momento específico |
| **Multi-tenant** | Arquitectura donde múltiples clientes comparten infraestructura |
| **Optimistic Locking** | Estrategia de concurrencia que verifica conflictos al guardar |

---

## 12. Referencias

- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [MongoDB Indexing Strategies](https://docs.mongodb.com/manual/indexes/)
- [MongoDB Schema Design Patterns](https://www.mongodb.com/blog/post/building-with-patterns-a-summary)
- [Zod Documentation](https://zod.dev/)

---

*Documento generado automáticamente el 2026-04-05*
*Versión 1.0.0 - DisherIo Data Model Analysis*
