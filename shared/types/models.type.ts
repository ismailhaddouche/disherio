// ============================================
// Pure TypeScript types (no Zod dependency for runtime)
// These are the single source of truth for all models
// ============================================

import { LocalizedField } from './localized-string.type';

// ============================================
// State enums and types
// ============================================

export type ItemState = 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED';
export type ItemDishType = 'KITCHEN' | 'SERVICE';
export type TotemState = 'STARTED' | 'COMPLETE' | 'PAID' | 'CANCELLED';
export type DishStatus = 'ACTIVATED' | 'DESACTIVATED';
export type PaymentType = 'ALL' | 'BY_USER' | 'SHARED';

export interface SessionClosedEvent {
  sessionId: string;
  state: 'COMPLETE' | 'CANCELLED';
  closedBy?: string;
  timestamp: string;
}

export interface SessionReopenedEvent {
  sessionId: string;
  reopenedBy?: string;
  timestamp: string;
}

export interface SessionArchivedEvent {
  sessionId: string;
  paymentTotal: number;
  paymentType: PaymentType;
  timestamp: string;
}

// Localized entry (lang + value pair)
export type { LocalizedField };

// Variant
export interface Variant {
  _id?: string;
  variant_name: LocalizedField;
  variant_description?: LocalizedField;
  variant_price: number;
  variant_url_image?: string;
}

// Extra
export interface Extra {
  _id?: string;
  extra_name: LocalizedField;
  extra_description?: LocalizedField;
  extra_price: number;
  extra_url_image?: string;
}

// Category
export interface Category {
  _id?: string;
  restaurant_id: string;
  category_name: LocalizedField;
  category_description?: LocalizedField;
  category_order: number;
  category_image_url?: string;
  unlimited_orders?: boolean;
}

// Dish
export interface Dish {
  _id?: string;
  restaurant_id: string;
  category_id: string | Category;
  disher_name: LocalizedField;
  disher_description?: LocalizedField;
  disher_price: number;
  disher_type: ItemDishType;
  disher_status: DishStatus;
  disher_url_image?: string;
  disher_alergens: string[];
  disher_variant: boolean;
  variants: Variant[];
  extras: Extra[];
}

// Totem
export interface Totem {
  _id?: string;
  restaurant_id: string;
  totem_name: string;
  totem_qr: string;
  totem_type: 'STANDARD' | 'TEMPORARY';
  totem_start_date?: string;
}

export interface OrderLimitStatus {
  interval_minutes: number;
  max_orders_per_session: number;
  limited_order_count: number;
  remaining_limited_orders: number | null;
  next_limited_order_at: string | null;
}

// Totem Session
export interface TotemSession {
  _id?: string;
  totem_id: string;
  restaurant_id?: string;
  totem_snapshot?: Pick<Totem, '_id' | 'totem_name' | 'totem_type'>;
  session_date_start: string;
  totem_state: TotemState;
  /** Number of non-cancelled items included in staff-facing session lists. */
  item_count?: number;
  /** Ephemeral per-session credential required for public totem access. */
  session_token?: string;
  totem?: Totem;
  order_limit_status?: OrderLimitStatus;
}

// Customer
export interface Customer {
  _id?: string;
  session_id: string;
  customer_name: string;
}

// Order
export interface Order {
  _id?: string;
  session_id: string;
  customer_id?: string;
  staff_id?: string;
  order_number: number;
  order_date: string;
}

// Item Order Variant Snapshot
export interface ItemOrderVariant {
  variant_id: string;
  name: LocalizedField;
  price: number;
}

// Item Order Extra Snapshot
export interface ItemOrderExtra {
  extra_id: string;
  name: LocalizedField;
  price: number;
}

// Item Order
export interface ItemOrder {
  _id?: string;
  order_id: string;
  session_id: string;
  item_dish_id: string;
  customer_id?: string;
  customer_name?: string;
  order_number?: number;
  item_state: ItemState;
  item_disher_type: ItemDishType;
  item_name_snapshot: LocalizedField;
  item_base_price: number;
  item_disher_variant?: ItemOrderVariant | null;
  item_disher_extras: ItemOrderExtra[];
  unlimited_order_item?: boolean;
  batch_id?: string;
  createdAt?: string;
}

// Payment Ticket
export interface PaymentTicket {
  ticket_id?: string;
  ticket_part: number;
  ticket_total_parts: number;
  ticket_amount: number;
  ticket_customer_name?: string;
  paid?: boolean;
}

// Payment
export interface Payment {
  _id?: string;
  session_id: string;
  restaurant_id: string;
  totem_snapshot: {
    totem_id: string;
    totem_name: string;
    totem_type: 'STANDARD' | 'TEMPORARY';
  };
  payment_type: PaymentType;
  payment_total: number;
  payment_date: string;
  tickets: PaymentTicket[];
}

// Restaurant
export interface Restaurant {
  _id?: string;
  restaurant_name: string;
  restaurant_url?: string;
  logo_image_url?: string;
  social_links?: {
    facebook_url?: string;
    instagram_url?: string;
  };
  tax_rate: number;
  tips_state: boolean;
  tips_type?: 'MANDATORY' | 'VOLUNTARY';
  tips_rate?: number;
  default_language: 'es' | 'en' | 'fr';
  default_theme: 'light' | 'dark';
  /** Interface languages enabled for this restaurant. */
  enabled_languages: ('es' | 'en' | 'fr')[];
  currency: string;
  order_interval_minutes?: number;
  max_orders_per_session?: number;
}

// Role
export interface Role {
  _id?: string;
  role_name: string;
  permissions: string[];
}

// Staff
export interface Staff {
  _id?: string;
  restaurant_id: string;
  role_id: string;
  staff_name: string;
  username: string;
  language?: 'es' | 'en' | 'fr';
  theme?: 'light' | 'dark';
}

// ============================================
// DTO Types for Create/Update Operations
// ============================================

export type CreateDishData = Omit<Dish, '_id' | 'category_id'> & { category_id: string };
export type UpdateDishData = Partial<CreateDishData>;

export type CreateCategoryData = Omit<Category, '_id'>;
export type UpdateCategoryData = Partial<CreateCategoryData>;

export type CreateTotemData = Omit<Totem, '_id' | 'totem_qr'>;
export type UpdateTotemData = Partial<CreateTotemData>;

