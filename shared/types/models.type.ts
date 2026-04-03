// ============================================
// Pure TypeScript types (no Zod dependency for runtime)
// These are the single source of truth for all models
// ============================================

import { LocalizedField } from './localized-string.type';

// ============================================
// Enums y Tipos de Estado
// ============================================

export type ItemState = 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED';
export type ItemDishType = 'KITCHEN' | 'SERVICE';
export type TotemState = 'STARTED' | 'COMPLETE' | 'PAID';
export type DishStatus = 'ACTIVATED' | 'DESACTIVATED';
export type PaymentType = 'ALL' | 'BY_USER' | 'SHARED';

// Localized entry (lang + value pair)
export type { LocalizedField };

// Menu Language
export interface MenuLanguage {
  _id?: string;
  restaurant_id: string;
  name: string;
  code: string;
  is_default: boolean;
  linked_app_lang: string | null;
  order: number;
}

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
}

// Dish
export interface Dish {
  _id?: string;
  restaurant_id: string;
  category_id: string;
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

// Totem Session
export interface TotemSession {
  _id?: string;
  totem_id: string;
  session_date_start: string;
  totem_state: TotemState;
  totem?: Totem;
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
  item_state: ItemState;
  item_disher_type: ItemDishType;
  item_name_snapshot: LocalizedField;
  item_base_price: number;
  item_disher_variant?: ItemOrderVariant | null;
  item_disher_extras: ItemOrderExtra[];
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
  default_language: 'es' | 'en';
  default_theme: 'light' | 'dark';
  currency: string;
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
  language?: 'es' | 'en';
  theme?: 'light' | 'dark';
}

// ============================================
// DTO Types for Create/Update Operations
// ============================================

export type CreateDishData = Omit<Dish, '_id'>;
export type UpdateDishData = Partial<CreateDishData>;

export type CreateCategoryData = Omit<Category, '_id'>;
export type UpdateCategoryData = Partial<CreateCategoryData>;

export type CreateTotemData = Omit<Totem, '_id' | 'totem_qr'>;
export type UpdateTotemData = Partial<CreateTotemData>;

export type CreateOrderData = Omit<Order, '_id' | 'order_date'>;
export type UpdateOrderData = Partial<CreateOrderData>;

export type CreateItemOrderData = Omit<ItemOrder, '_id' | 'createdAt'>;
export type UpdateItemOrderData = Partial<Pick<ItemOrder, 'item_state' | 'customer_id'>>;

export type CreateStaffData = Omit<Staff, '_id'> & { password: string; pin_code: string };
export type UpdateStaffData = Partial<Omit<Staff, '_id' | 'restaurant_id'>> & { password?: string; pin_code?: string };
