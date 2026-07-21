// ============================================
// Socket-specific types for frontend
// These extend shared types with socket event payloads
// ============================================

import {
  ItemOrder,
  ItemState,
  LocalizedField,
  PaymentType,
} from './models.type';

// Re-export types from shared for convenience
export type { ItemState } from './models.type';

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
export interface KdsNewItem extends ItemOrder {
  totem_name?: string;
  batch_id?: string;
  order_date?: string;
  order_number?: number;
  updatedAt?: string;
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

export interface TotemMyOrdersEvent {
  sessionId: string;
  customerId: string;
  orders: ItemOrder[];
  totalOrders: number;
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
// Inbound Socket Payload Types (client -> server)
// ============================================

/**
 * Payload for socket events that reference a single item by id
 * (kds:item_prepare, kds:item_serve, tas:serve_service_item)
 */
export interface ItemIdPayload {
  itemId: string;
}

/**
 * Payload for item cancellation socket events
 * (kds:item_cancel, tas:cancel_item)
 */
export interface ItemCancelPayload {
  itemId: string;
  reason?: string;
}

/**
 * Payload for the tas:request_bill socket event
 */
export interface TASRequestBillPayload {
  sessionId: string;
  requestedBy: 'waiter' | 'customer';
  customerId?: string;
  splitType?: PaymentType;
}

/**
 * Payload for the tas:call_waiter_response socket event
 */
export interface TASCallWaiterResponsePayload {
  sessionId: string;
  customerId?: string;
  tableId?: string;
  acknowledged: boolean;
  message?: string;
}

/**
 * Payload for the tas:notify_customers socket event
 */
export interface TASNotifyCustomersPayload {
  sessionId: string;
  message: string;
  type?: WaiterNotification['type'];
}

/**
 * Payload for the totem:join_session socket event.
 * Validated at runtime by TotemJoinSessionPayloadSchema (shared/schemas/totem.schema.ts)
 */
export interface TotemJoinSessionPayload {
  sessionId: string;
  qr: string;
  customerName?: string;
  customerId?: string;
  sessionToken?: string;
}

/**
 * Payload for the totem:call_waiter socket event.
 * Validated at runtime by TotemCallWaiterPayloadSchema (shared/schemas/totem.schema.ts)
 */
export interface TotemCallWaiterPayload {
  sessionId: string;
  tableId?: string;
  message?: string;
}

/**
 * Payload for the totem:request_bill socket event.
 * Validated at runtime by TotemRequestBillPayloadSchema (shared/schemas/totem.schema.ts)
 */
export interface TotemRequestBillPayload {
  sessionId: string;
  splitType?: PaymentType;
}

/**
 * Payload for totem socket events that only carry a session id
 * (totem:subscribe_items, totem:get_table_info, totem:get_my_orders).
 * Validated at runtime by TotemSessionIdPayloadSchema (shared/schemas/totem.schema.ts)
 */
export interface TotemSessionIdPayload {
  sessionId: string;
}

