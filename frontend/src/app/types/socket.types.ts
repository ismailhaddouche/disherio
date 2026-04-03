// ============================================
// Socket-specific types for frontend
// These extend shared types with socket event payloads
// ============================================

import { 
  LocalizedField, 
  ItemOrder, 
  PaymentTicket, 
  ItemState, 
  ItemDishType, 
  PaymentType 
} from '@disherio/shared';

// Re-export types from shared for convenience
export type { ItemState } from '@disherio/shared';

// ============================================
// Socket Error Types
// ============================================

/**
 * Socket error payload received from server
 */
export interface SocketError {
  message: string;
  details?: string;
  code?: string;
}

// ============================================
// Order Item Types (for customer/totem orders)
// ============================================

/**
 * Extra item in an order (from customer/totem perspective)
 */
export interface OrderItemExtra {
  extraId: string;
  extraName: LocalizedField;
  price: number;
}

/**
 * Item in a customer/totem order
 */
export interface OrderItem {
  dishId: string;
  dishName: LocalizedField;
  quantity: number;
  price: number;
  dishType: ItemDishType;
  variantId?: string;
  variantName?: LocalizedField;
  extras?: OrderItemExtra[];
}

// ============================================
// Item Update Event Types
// ============================================

/**
 * Event emitted when an item's state changes
 */
export interface ItemUpdateEvent {
  itemId: string;
  newState: ItemState;
  itemName?: LocalizedField;
  timestamp: string;
}

// ============================================
// Waiter Notification Types
// ============================================

/**
 * Notification sent from waiter to customers
 */
export interface WaiterNotification {
  message: string;
  from: string;
  type: 'info' | 'warning' | 'success';
  timestamp: string;
}

// ============================================
// TAS (Table Assigned Staff) Event Types
// ============================================

/**
 * Event when an item is added to a TAS session
 */
export interface TASItemEvent {
  item: ItemOrder;
  sessionId: string;
  addedBy?: string;
  timestamp: string;
}

/**
 * Event when an item's state changes in TAS
 */
export interface TASItemStateEvent {
  itemId: string;
  sessionId: string;
  newState: ItemState;
  servedBy?: string;
  canceledBy?: string;
  reason?: string;
  timestamp: string;
}

/**
 * Event when a bill is requested
 */
export interface TASBillEvent {
  sessionId: string;
  requestedBy: 'waiter' | 'customer';
  requestedByStaff?: string;
  customerId?: string;
  splitType?: PaymentType;
  timestamp: string;
}

/**
 * Event when a bill is paid
 */
export interface TASBillPaidEvent {
  sessionId: string;
  paidBy?: string;
  totalAmount?: number;
  timestamp: string;
}

/**
 * Event when a customer requests help
 */
export interface TASHelpRequest {
  sessionId: string;
  customerId?: string;
  customerName?: string;
  tableId?: string;
  timestamp: string;
}

/**
 * Event when a customer places a new order
 */
export interface TASNewCustomerOrderEvent {
  item?: ItemOrder;
  sessionId: string;
  customerId?: string;
  customerName?: string;
  timestamp: string;
}

/**
 * Event when a customer requests the bill
 */
export interface TASCustomerBillRequestEvent {
  sessionId: string;
  customerId?: string;
  customerName?: string;
  splitType?: PaymentType;
  timestamp: string;
}

// ============================================
// KDS (Kitchen Display System) Event Types
// ============================================

/**
 * New item received in KDS
 */
export interface KdsNewItem {
  _id: string;
  [key: string]: unknown;
}

/**
 * Item state changed payload
 */
export interface ItemStateChangedPayload {
  itemId: string;
  newState: ItemState;
}

/**
 * Item deleted payload
 */
export interface ItemDeletedPayload {
  itemId: string;
}

// ============================================
// Totem/Customer Event Types
// ============================================

/**
 * Event when items are added to an order
 */
export interface TotemItemsAddedEvent {
  items: ItemOrder[];
  addedBy: string;
  addedByCustomerId?: string;
  timestamp: string;
}

/**
 * Event when a customer joins the table
 */
export interface TotemCustomerJoinedEvent {
  customerId?: string;
  customerName: string;
  joinedAt: string;
}

/**
 * Event when a customer leaves the table
 */
export interface TotemCustomerLeftEvent {
  customerId?: string;
  customerName: string;
  leftAt: string;
}

/**
 * Event when table info is updated
 */
export interface TotemTableInfoEvent {
  sessionId: string;
  customersAtTable: Array<{
    customerId?: string;
    customerName: string;
    joinedAt: string;
  }>;
  totalCustomers: number;
  myCustomerId?: string;
  myCustomerName?: string;
  timestamp: string;
}

/**
 * Event when table order is updated
 */
export interface TotemTableOrderUpdateEvent {
  type: string;
  items: ItemOrder[];
  orderedBy: string;
  orderedByCustomerId?: string;
  totalItemsAtTable: number;
  timestamp: string;
}

/**
 * Event when a totem session is closed
 */
export interface TotemSessionClosedEvent {
  sessionId: string;
  closedBy: 'customer' | 'waiter' | 'pos' | 'system';
  closedByName?: string;
  totalAmount?: number;
  reason?: string;
  message: string;
  timestamp: string;
}

/**
 * Event when totem is forcefully disconnected
 */
export interface TotemForceDisconnectEvent {
  reason: string;
  message: string;
}

/**
 * Order confirmation event
 */
export interface TotemOrderConfirmedEvent {
  success: boolean;
  sessionId: string;
  itemCount: number;
  timestamp: string;
}

/**
 * Help request confirmation event
 */
export interface TotemHelpRequestConfirmedEvent {
  success: boolean;
  message: string;
  timestamp: string;
}

/**
 * Bill request confirmation event
 */
export interface TotemBillRequestConfirmedEvent {
  success: boolean;
  message: string;
  timestamp: string;
}

// ============================================
// Payment Types
// ============================================

/**
 * Payment data for TAS mark bill as paid
 */
export interface TASPaymentData {
  paymentTotal: number;
  paymentType: PaymentType;
  tickets: PaymentTicket[];
}

/**
 * Data for adding an item via TAS
 */
export interface TASAddItemData {
  sessionId: string;
  orderId: string;
  dishId: string;
  customerId?: string;
  variantId?: string;
  extras?: string[];
  itemData: Partial<ItemOrder>;
}

// ============================================
// POS Event Types
// ============================================

/**
 * Event when an item is added by POS
 */
export interface PosItemAddedEvent {
  item: ItemOrder;
  addedBy?: string;
  waiterName?: string;
}

/**
 * Event when an item is canceled by POS
 */
export interface PosItemCanceledEvent {
  itemId: string;
  itemName?: LocalizedField;
  canceledByName?: string;
  reason?: string;
}

/**
 * Event when a bill is requested by POS
 */
export interface PosBillRequestedEvent {
  sessionId: string;
  requestedBy?: string;
}

/**
 * Event when a bill is paid by POS
 */
export interface PosBillPaidEvent {
  sessionId: string;
  paidBy?: string;
  timestamp: string;
}

/**
 * Event when a session is closed by POS
 */
export interface PosSessionClosedEvent {
  sessionId: string;
  timestamp: string;
}

// ============================================
// API Response Types
// ============================================

/**
 * Generic API list response
 */
export interface ApiListResponse<T> {
  data: T[];
  total?: number;
  page?: number;
  limit?: number;
}

/**
 * Generic API single item response
 */
export interface ApiItemResponse<T> {
  data: T;
  message?: string;
}

/**
 * Generic API error response
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  details?: string;
  code?: string;
}
