// ============================================
// Pure TypeScript types (no Zod dependency for runtime)
// These are the single source of truth for all models
// ============================================

import { LocalizedString } from './localized-string.type';

// Variant
export interface Variant {
  _id?: string;
  variant_name: LocalizedString;
  variant_description?: LocalizedString;
  variant_price: number;
  variant_url_image?: string;
}

// Extra
export interface Extra {
  _id?: string;
  extra_name: LocalizedString;
  extra_description?: LocalizedString;
  extra_price: number;
  extra_url_image?: string;
}

// Category
export interface Category {
  _id?: string;
  restaurant_id: string;
  category_name: LocalizedString;
  category_description?: LocalizedString;
  category_order: number;
  category_image_url?: string;
}

// Dish
export interface Dish {
  _id?: string;
  restaurant_id: string;
  category_id: string;
  disher_name: LocalizedString;
  disher_description?: LocalizedString;
  disher_price: number;
  disher_type: 'KITCHEN' | 'SERVICE';
  disher_status: 'ACTIVATED' | 'DESACTIVATED';
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
  totem_state: 'STARTED' | 'COMPLETE' | 'PAID';
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
  name: LocalizedString;
  price: number;
}

// Item Order Extra Snapshot
export interface ItemOrderExtra {
  extra_id: string;
  name: LocalizedString;
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
  item_state: 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED';
  item_disher_type: 'KITCHEN' | 'SERVICE';
  item_name_snapshot: LocalizedString;
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
  payment_type: 'ALL' | 'BY_USER' | 'SHARED';
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
