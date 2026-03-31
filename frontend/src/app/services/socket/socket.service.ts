import { Injectable, OnDestroy, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { kdsStore } from '../../store/kds.store';
import { authStore } from '../../store/auth.store';
import { tasStore } from '../../store/tas.store';
import { Subject, Observable, BehaviorSubject } from 'rxjs';

// ==================== PAYLOAD TYPES ====================

interface ItemStateChangedPayload {
  itemId: string;
  newState: string;
}

interface ItemDeletedPayload {
  itemId: string;
}

interface KdsNewItem {
  _id: string;
  [key: string]: unknown;
}

// Totem/Customer types
export interface OrderItem {
  dishId: string;
  dishName: any;
  quantity: number;
  price: number;
  dishType: 'KITCHEN' | 'SERVICE';
  variantId?: string;
  variantName?: any;
  extras?: Array<{ extraId: string; extraName: any; price: number }>;
}

export interface ItemUpdateEvent {
  itemId: string;
  newState: 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED';
  itemName?: any;
  timestamp: string;
}

export interface WaiterNotification {
  message: string;
  from: string;
  type: 'info' | 'warning' | 'success';
  timestamp: string;
}

export interface SessionClosedEvent {
  sessionId: string;
  closedBy: 'customer' | 'waiter' | 'pos' | 'system';
  closedByName?: string;
  totalAmount?: number;
  reason?: string;
  message: string;
  timestamp: string;
}

// TAS types
export interface TASItemEvent {
  item: any;
  sessionId: string;
  addedBy?: string;
  timestamp: string;
}

export interface TASItemStateEvent {
  itemId: string;
  sessionId: string;
  newState: 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED';
  servedBy?: string;
  canceledBy?: string;
  reason?: string;
  timestamp: string;
}

export interface TASBillEvent {
  sessionId: string;
  requestedBy: 'waiter' | 'customer';
  requestedByStaff?: string;
  customerId?: string;
  splitType?: 'ALL' | 'BY_USER' | 'SHARED';
  timestamp: string;
}

export interface TASHelpRequest {
  sessionId: string;
  customerId?: string;
  customerName?: string;
  tableId?: string;
  timestamp: string;
}

type SocketEventCallback<T> = (data: T) => void;

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly daemonRetryDelay = 15000; // ms to wait before re-attempting after max reconnects
  private hasReachedMaxReconnects = false;
  private connectionRefCount = 0;
  private daemonRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private activeListeners: Map<string, Set<(data: unknown) => void>> = new Map();

  // ==================== TOTEM/CUSTOMER STATE ====================
  private currentTotemSessionId: string | null = null;
  private currentCustomerName: string | null = null;
  private isTotemSessionClosed = false;
  
  // Totem event subjects
  private totemItemUpdateSubject = new Subject<ItemUpdateEvent>();
  private totemItemsAddedSubject = new Subject<{ items: any[]; addedBy: string; addedByCustomerId?: string }>();
  private totemWaiterNotificationSubject = new Subject<WaiterNotification>();
  private totemOrderConfirmedSubject = new Subject<any>();
  private totemHelpRequestConfirmedSubject = new Subject<any>();
  private totemBillRequestConfirmedSubject = new Subject<any>();
  private totemCustomerJoinedSubject = new Subject<{ customerId?: string; customerName: string; joinedAt: string }>();
  private totemCustomerLeftSubject = new Subject<{ customerId?: string; customerName: string; leftAt: string }>();
  private totemTableOrderUpdateSubject = new Subject<any>();
  private totemTableInfoSubject = new Subject<any>();
  private totemSessionClosedSubject = new Subject<SessionClosedEvent>();
  private totemForceDisconnectSubject = new Subject<{ reason: string; message: string }>();
  private totemErrorSubject = new Subject<any>();

  // Totem observables
  public totemItemUpdate$ = this.totemItemUpdateSubject.asObservable();
  public totemItemsAdded$ = this.totemItemsAddedSubject.asObservable();
  public totemWaiterNotification$ = this.totemWaiterNotificationSubject.asObservable();
  public totemOrderConfirmed$ = this.totemOrderConfirmedSubject.asObservable();
  public totemHelpRequestConfirmed$ = this.totemHelpRequestConfirmedSubject.asObservable();
  public totemBillRequestConfirmed$ = this.totemBillRequestConfirmedSubject.asObservable();
  public totemCustomerJoined$ = this.totemCustomerJoinedSubject.asObservable();
  public totemCustomerLeft$ = this.totemCustomerLeftSubject.asObservable();
  public totemTableOrderUpdate$ = this.totemTableOrderUpdateSubject.asObservable();
  public totemTableInfo$ = this.totemTableInfoSubject.asObservable();
  public totemSessionClosed$ = this.totemSessionClosedSubject.asObservable();
  public totemForceDisconnect$ = this.totemForceDisconnectSubject.asObservable();
  public totemError$ = this.totemErrorSubject.asObservable();

  // ==================== TAS STATE ====================
  private currentTasSessionId: string | null = null;
  
  // TAS event subjects
  private tasItemAddedSubject = new Subject<TASItemEvent>();
  private tasItemServedSubject = new Subject<TASItemStateEvent>();
  private tasItemCanceledSubject = new Subject<TASItemStateEvent>();
  private tasBillRequestedSubject = new Subject<TASBillEvent>();
  private tasBillPaidSubject = new Subject<any>();
  private tasHelpRequestedSubject = new Subject<TASHelpRequest>();
  private tasNewCustomerOrderSubject = new Subject<any>();
  private tasCustomerBillRequestSubject = new Subject<any>();
  private tasNotificationSubject = new Subject<any>();
  private tasErrorSubject = new Subject<any>();

  // TAS observables
  public tasItemAdded$ = this.tasItemAddedSubject.asObservable();
  public tasItemServed$ = this.tasItemServedSubject.asObservable();
  public tasItemCanceled$ = this.tasItemCanceledSubject.asObservable();
  public tasBillRequested$ = this.tasBillRequestedSubject.asObservable();
  public tasBillPaid$ = this.tasBillPaidSubject.asObservable();
  public tasHelpRequested$ = this.tasHelpRequestedSubject.asObservable();
  public tasNewCustomerOrder$ = this.tasNewCustomerOrderSubject.asObservable();
  public tasCustomerBillRequest$ = this.tasCustomerBillRequestSubject.asObservable();
  public tasNotification$ = this.tasNotificationSubject.asObservable();
  public tasError$ = this.tasErrorSubject.asObservable();

  // ==================== TAS LISTENER REGISTRATION (Public API) ====================

  /**
   * Register TAS-specific listeners.
   * Called by TAS component when it initializes.
   */
  registerTasListeners(): void {
    // Listeners are already set up in doConnect/setupTasListeners
    // This method exists for API compatibility with components
  }

  /**
   * Unregister TAS-specific listeners.
   * Called by TAS component when it destroys.
   */
  unregisterTasListeners(): void {
    // Remove TAS-specific listeners
    this.off('tas:item_added');
    this.off('tas:service_item_served');
    this.off('tas:item_canceled');
    this.off('tas:bill_requested');
    this.off('tas:bill_paid');
    this.off('tas:help_requested');
    this.off('tas:new_customer_order');
    this.off('tas:customer_bill_request');
    this.off('notification:from_waiter');
    this.off('tas:error');
    this.off('tas:joined');
    this.off('tas:left');
    this.off('tas:item_added_confirm');
    this.off('tas:item_served_confirm');
    this.off('tas:item_canceled_confirm');
    this.off('tas:bill_request_confirm');
    this.off('tas:bill_paid_confirm');
    this.off('tas:call_acknowledged_confirm');
    this.off('tas:notify_confirm');
  }

  // ==================== CONNECTION MANAGEMENT ====================

  /**
   * Acquire a connection reference. Must be paired with releaseConnection().
   * Uses reference counting to prevent one component from disconnecting socket
   * that other components are still using.
   */
  acquireConnection(): void {
    this.connectionRefCount++;
    console.log(`[Socket] Connection acquired. Ref count: ${this.connectionRefCount}`);
    
    if (this.connectionRefCount === 1) {
      this.doConnect();
    }
  }

  /**
   * Release a connection reference. When count reaches 0, socket disconnects.
   */
  releaseConnection(): void {
    if (this.connectionRefCount > 0) {
      this.connectionRefCount--;
      console.log(`[Socket] Connection released. Ref count: ${this.connectionRefCount}`);
      
      if (this.connectionRefCount === 0) {
        this.doDisconnect();
      }
    }
  }

  private doConnect(): void {
    if (this.socket?.connected) return;
    
    try {
      this.socket = io(environment.wsUrl, { 
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      this.socket.on('connect', () => {
        console.log('[Socket] Connected');
        this.reconnectAttempts = 0;
      });

      this.socket.on('connect_error', (err: Error) => {
        console.error('[Socket] Connection error:', err.message);
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('[Socket] Max reconnection attempts reached, scheduling daemon retry in', this.daemonRetryDelay, 'ms');
          this.hasReachedMaxReconnects = true;
          if (this.socket) {
            this.socket.io.opts.reconnection = false;
            this.socket.close();
          }
          this.socket = null;
          if (this.connectionRefCount > 0) {
            this.daemonRetryTimer = setTimeout(() => {
              this.daemonRetryTimer = null;
              if (this.connectionRefCount > 0) {
                console.log('[Socket] Daemon retry attempt...');
                this.hasReachedMaxReconnects = false;
                this.reconnectAttempts = 0;
                this.doConnect();
              }
            }, this.daemonRetryDelay);
          }
        }
      });

      this.socket.on('disconnect', (reason: Socket.DisconnectReason) => {
        console.log('[Socket] Disconnected:', reason);
        if (reason === 'io server disconnect' && this.socket?.io.opts.reconnection) {
          this.socket.connect();
        }
      });

      this.socket.on('error', (err: Error) => {
        console.error('[Socket] Error:', err);
      });

      // Setup all listeners
      this.setupKdsListeners();
      this.setupTasListeners();
      this.setupTotemListeners();

    } catch (err) {
      console.error('[Socket] Failed to initialize:', err);
    }
  }

  // ==================== KDS LISTENERS ====================

  private setupKdsListeners(): void {
    if (!this.socket) return;

    this.socket.on('item:state_changed', ({ itemId, newState }: ItemStateChangedPayload) => {
      kdsStore.updateItemState(itemId, newState as 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED');
    });
    
    this.socket.on('kds:new_item', (item: KdsNewItem) => {
      kdsStore.addItem(item as unknown as Parameters<typeof kdsStore.addItem>[0]);
    });

    this.socket.on('item:deleted', ({ itemId }: ItemDeletedPayload) => {
      kdsStore.removeItem(itemId);
    });
  }

  // ==================== TAS LISTENERS ====================

  private setupTasListeners(): void {
    if (!this.socket) return;

    this.socket.on('tas:item_added', (data: TASItemEvent) => {
      console.log('[TAS] Item added:', data);
      tasStore.addItem(data.item);
      this.tasItemAddedSubject.next(data);
    });

    this.socket.on('tas:service_item_served', (data: TASItemStateEvent) => {
      console.log('[TAS] Service item served:', data);
      tasStore.updateItemState(data.itemId, 'SERVED');
      this.tasItemServedSubject.next(data);
    });

    this.socket.on('tas:item_canceled', (data: TASItemStateEvent) => {
      console.log('[TAS] Item canceled:', data);
      tasStore.updateItemState(data.itemId, 'CANCELED');
      this.tasItemCanceledSubject.next(data);
    });

    this.socket.on('tas:bill_requested', (data: TASBillEvent) => {
      console.log('[TAS] Bill requested:', data);
      this.tasBillRequestedSubject.next(data);
    });

    this.socket.on('tas:bill_paid', (data: any) => {
      console.log('[TAS] Bill paid:', data);
      this.tasBillPaidSubject.next(data);
    });

    this.socket.on('tas:help_requested', (data: TASHelpRequest) => {
      console.log('[TAS] Help requested:', data);
      this.tasHelpRequestedSubject.next(data);
    });

    this.socket.on('tas:new_customer_order', (data: any) => {
      console.log('[TAS] New customer order:', data);
      if (data.item) {
        tasStore.addItem(data.item);
      }
      this.tasNewCustomerOrderSubject.next(data);
    });

    this.socket.on('tas:customer_bill_request', (data: any) => {
      console.log('[TAS] Customer bill request:', data);
      this.tasCustomerBillRequestSubject.next(data);
    });

    this.socket.on('notification:from_waiter', (data: any) => {
      console.log('[TAS] Notification:', data);
      this.tasNotificationSubject.next(data);
    });

    this.socket.on('tas:error', (error: any) => {
      console.error('[TAS] Error:', error);
      this.tasErrorSubject.next(error);
    });

    // Confirmations
    this.socket.on('tas:joined', (data: { sessionId: string; timestamp: string }) => {
      console.log('[TAS] Joined session:', data.sessionId);
    });

    this.socket.on('tas:left', (data: { sessionId: string }) => {
      console.log('[TAS] Left session:', data.sessionId);
    });

    this.socket.on('tas:item_added_confirm', (data: { success: boolean; sessionId: string }) => {
      console.log('[TAS] Item added confirmed:', data);
    });

    this.socket.on('tas:item_served_confirm', (data: { success: boolean; itemId: string; newState: string }) => {
      console.log('[TAS] Item served confirmed:', data);
    });

    this.socket.on('tas:item_canceled_confirm', (data: { success: boolean; itemId: string }) => {
      console.log('[TAS] Item canceled confirmed:', data);
    });

    this.socket.on('tas:bill_request_confirm', (data: { success: boolean; sessionId: string }) => {
      console.log('[TAS] Bill request confirmed:', data);
    });

    this.socket.on('tas:bill_paid_confirm', (data: { success: boolean; sessionId: string }) => {
      console.log('[TAS] Bill paid confirmed:', data);
    });

    this.socket.on('tas:call_acknowledged_confirm', (data: { success: boolean; sessionId: string }) => {
      console.log('[TAS] Call acknowledged:', data);
    });

    this.socket.on('tas:notify_confirm', (data: { success: boolean; sessionId: string }) => {
      console.log('[TAS] Notification confirmed:', data);
    });
  }

  // ==================== TOTEM LISTENERS ====================

  private setupTotemListeners(): void {
    if (!this.socket) return;

    this.socket.on('totem:session_joined', (data: { 
      sessionId: string; 
      customerName?: string; 
      customerId?: string;
      otherCustomersAtTable?: Array<{ customerId?: string; customerName: string; joinedAt: string }>;
      timestamp: string;
    }) => {
      console.log('[Totem] Session joined:', data.sessionId);
      this.currentTotemSessionId = data.sessionId;
      if (data.customerName) {
        this.currentCustomerName = data.customerName;
      }
    });

    this.socket.on('totem:customer_joined_table', (data: { 
      sessionId: string;
      customerId?: string; 
      customerName: string; 
      joinedAt: string;
    }) => {
      console.log('[Totem] Customer joined table:', data.customerName);
      this.totemCustomerJoinedSubject.next(data);
    });

    this.socket.on('totem:customer_left_table', (data: { 
      sessionId: string;
      customerId?: string; 
      customerName: string; 
      leftAt: string;
    }) => {
      console.log('[Totem] Customer left table:', data.customerName);
      this.totemCustomerLeftSubject.next(data);
    });

    this.socket.on('totem:table_info', (data: {
      sessionId: string;
      customersAtTable: Array<{ customerId?: string; customerName: string; joinedAt: string }>;
      totalCustomers: number;
      myCustomerId?: string;
      myCustomerName?: string;
      timestamp: string;
    }) => {
      console.log('[Totem] Table info received:', data);
      this.totemTableInfoSubject.next(data);
    });

    this.socket.on('totem:table_order_update', (data: {
      type: string;
      items: any[];
      orderedBy: string;
      orderedByCustomerId?: string;
      totalItemsAtTable: number;
      timestamp: string;
    }) => {
      console.log('[Totem] Table order update:', data);
      this.totemTableOrderUpdateSubject.next(data);
    });

    this.socket.on('totem:session_left', (data: { sessionId: string }) => {
      console.log('[Totem] Session left:', data.sessionId);
      if (this.currentTotemSessionId === data.sessionId) {
        this.currentTotemSessionId = null;
      }
    });

    this.socket.on('totem:order_placed', (data: { success: boolean; sessionId: string; itemCount: number; timestamp: string }) => {
      console.log('[Totem] Order placed:', data);
      this.totemOrderConfirmedSubject.next(data);
    });

    this.socket.on('totem:item_added', (data: { success: boolean; sessionId: string; timestamp: string }) => {
      console.log('[Totem] Item added:', data);
    });

    this.socket.on('order:item_update', (data: ItemUpdateEvent) => {
      console.log('[Totem] Item update:', data);
      this.totemItemUpdateSubject.next(data);
    });

    this.socket.on('order:items_added', (data: { items: any[]; addedBy: string; addedByCustomerId?: string; timestamp: string }) => {
      console.log('[Totem] Items added to order:', data);
      this.totemItemsAddedSubject.next(data);
    });

    this.socket.on('item:state_changed', (data: { itemId: string; newState: string }) => {
      console.log('[Totem] Item state changed:', data);
      this.totemItemUpdateSubject.next({
        itemId: data.itemId,
        newState: data.newState as any,
        timestamp: new Date().toISOString(),
      });
    });

    this.socket.on('totem:help_request_sent', (data: { success: boolean; message: string; timestamp: string }) => {
      console.log('[Totem] Help request sent:', data);
      this.totemHelpRequestConfirmedSubject.next(data);
    });

    this.socket.on('totem:bill_request_sent', (data: { success: boolean; message: string; timestamp: string }) => {
      console.log('[Totem] Bill request sent:', data);
      this.totemBillRequestConfirmedSubject.next(data);
    });

    this.socket.on('notification:from_waiter', (data: WaiterNotification) => {
      console.log('[Totem] Notification from waiter:', data);
      this.totemWaiterNotificationSubject.next(data);
    });

    this.socket.on('totem:session_closed', (data: SessionClosedEvent) => {
      console.log('[Totem] Session closed:', data);
      this.isTotemSessionClosed = true;
      this.totemSessionClosedSubject.next(data);
    });

    this.socket.on('totem:force_disconnect', (data: { reason: string; message: string }) => {
      console.log('[Totem] Force disconnect:', data);
      this.isTotemSessionClosed = true;
      this.totemForceDisconnectSubject.next(data);
      this.leaveTotemSession();
    });

    this.socket.on('totem:error', (error: any) => {
      console.error('[Totem] Error:', error);
      if (error.message === 'SESSION_CLOSED' || error.message === 'SESSION_ALREADY_CLOSED') {
        this.isTotemSessionClosed = true;
      }
      this.totemErrorSubject.next(error);
    });

    this.socket.on('totem:items_subscribed', (data: { sessionId: string }) => {
      console.log('[Totem] Subscribed to items:', data.sessionId);
    });
  }

  // ==================== SESSION JOIN/LEAVE ====================

  joinSession(sessionId: string): void {
    if (!this.socket?.connected) {
      console.warn('[Socket] Cannot join session: not connected');
      return;
    }
    this.socket.emit('pos:join', sessionId);
    this.socket.emit('kds:join', sessionId);
    this.socket.emit('tas:join', sessionId);
    console.log(`[Socket] Joined session: ${sessionId}`);
  }

  leaveSession(sessionId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('pos:leave', sessionId);
    this.socket.emit('tas:leave', sessionId);
    console.log(`[Socket] Left session: ${sessionId}`);
  }

  // ==================== TAS METHODS ====================

  joinTasSession(sessionId: string): void {
    if (!this.socket?.connected) {
      console.warn('[TAS] Cannot join session: socket not connected');
      return;
    }
    if (this.currentTasSessionId && this.currentTasSessionId !== sessionId) {
      this.leaveTasSession(this.currentTasSessionId);
    }
    this.currentTasSessionId = sessionId;
    this.socket.emit('tas:join', sessionId);
    console.log(`[TAS] Joined session: ${sessionId}`);
  }

  leaveTasSession(sessionId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('tas:leave', sessionId);
    if (this.currentTasSessionId === sessionId) {
      this.currentTasSessionId = null;
    }
  }

  tasAddItem(data: {
    sessionId: string;
    orderId: string;
    dishId: string;
    customerId?: string;
    variantId?: string;
    extras?: string[];
    itemData: any;
  }): void {
    if (!this.socket?.connected) {
      console.warn('[TAS] Cannot add item: socket not connected');
      return;
    }
    this.socket.emit('tas:add_item', data);
    console.log(`[TAS] Adding item to session ${data.sessionId}`);
  }

  tasServeServiceItem(itemId: string): void {
    if (!this.socket?.connected) {
      console.warn('[TAS] Cannot serve item: socket not connected');
      return;
    }
    this.socket.emit('tas:serve_service_item', { itemId });
    console.log(`[TAS] Serving service item: ${itemId}`);
  }

  tasCancelItem(itemId: string, reason?: string): void {
    if (!this.socket?.connected) {
      console.warn('[TAS] Cannot cancel item: socket not connected');
      return;
    }
    this.socket.emit('tas:cancel_item', { itemId, reason });
    console.log(`[TAS] Canceling item: ${itemId}`);
  }

  tasRequestBill(sessionId: string, options?: {
    requestedBy?: 'waiter' | 'customer';
    customerId?: string;
    splitType?: 'ALL' | 'BY_USER' | 'SHARED';
  }): void {
    if (!this.socket?.connected) {
      console.warn('[TAS] Cannot request bill: socket not connected');
      return;
    }
    this.socket.emit('tas:request_bill', {
      sessionId,
      requestedBy: options?.requestedBy || 'waiter',
      customerId: options?.customerId,
      splitType: options?.splitType || 'ALL',
    });
    console.log(`[TAS] Requesting bill for session: ${sessionId}`);
  }

  tasMarkBillAsPaid(sessionId: string, paymentData: {
    paymentTotal: number;
    paymentType: 'ALL' | 'BY_USER' | 'SHARED';
    tickets: any[];
  }): void {
    if (!this.socket?.connected) {
      console.warn('[TAS] Cannot mark bill paid: socket not connected');
      return;
    }
    this.socket.emit('tas:bill_paid', {
      sessionId,
      ...paymentData,
    });
    console.log(`[TAS] Marking bill as paid for session: ${sessionId}`);
  }

  tasAcknowledgeCustomerCall(sessionId: string, message?: string): void {
    if (!this.socket?.connected) {
      console.warn('[TAS] Cannot acknowledge call: socket not connected');
      return;
    }
    this.socket.emit('tas:call_waiter_response', {
      sessionId,
      acknowledged: true,
      message,
    });
    console.log(`[TAS] Acknowledging customer call for session: ${sessionId}`);
  }

  tasNotifyCustomers(sessionId: string, message: string, type: 'info' | 'warning' | 'success' = 'info'): void {
    if (!this.socket?.connected) {
      console.warn('[TAS] Cannot notify customers: socket not connected');
      return;
    }
    this.socket.emit('tas:notify_customers', {
      sessionId,
      message,
      type,
    });
    console.log(`[TAS] Notifying customers in session: ${sessionId}`);
  }

  // ==================== TOTEM/CUSTOMER METHODS ====================

  joinTotemSession(sessionId: string, customerName?: string, customerId?: string): void {
    if (!this.socket?.connected) {
      console.warn('[Totem] Cannot join session: socket not connected');
      return;
    }
    if (!sessionId) return;
    
    this.isTotemSessionClosed = false;
    this.currentTotemSessionId = sessionId;
    if (customerName) {
      this.currentCustomerName = customerName;
    }
    
    this.socket.emit('totem:join_session', { sessionId, customerName, customerId });
    console.log(`[Totem] Joining session: ${sessionId}`);
  }

  leaveTotemSession(): void {
    if (!this.socket?.connected) return;
    this.socket.emit('totem:leave_session');
    console.log('[Totem] Leaving session');
    this.currentTotemSessionId = null;
  }

  getTotemSessionId(): string | null {
    return this.currentTotemSessionId;
  }

  getTotemCustomerName(): string | null {
    return this.currentCustomerName;
  }

  isTotemSessionClosedState(): boolean {
    return this.isTotemSessionClosed;
  }

  totemPlaceOrder(orderId: string, items: OrderItem[], notes?: string): void {
    if (!this.socket?.connected) {
      console.warn('[Totem] Cannot place order: socket not connected');
      return;
    }
    if (!this.currentTotemSessionId) {
      console.warn('[Totem] Cannot place order: not in session');
      return;
    }

    this.socket.emit('totem:place_order', {
      sessionId: this.currentTotemSessionId,
      orderId,
      items,
      customerName: this.currentCustomerName,
      notes,
    });
    console.log(`[Totem] Placing order with ${items.length} items`);
  }

  totemAddItem(orderId: string, item: OrderItem): void {
    if (!this.socket?.connected) {
      console.warn('[Totem] Cannot add item: socket not connected');
      return;
    }
    if (!this.currentTotemSessionId) {
      console.warn('[Totem] Cannot add item: not in session');
      return;
    }

    this.socket.emit('totem:add_item', {
      sessionId: this.currentTotemSessionId,
      orderId,
      item,
      customerName: this.currentCustomerName,
    });
    console.log('[Totem] Adding item to order');
  }

  totemSubscribeToItems(): void {
    if (!this.socket?.connected) {
      console.warn('[Totem] Cannot subscribe: socket not connected');
      return;
    }
    if (!this.currentTotemSessionId) {
      console.warn('[Totem] Cannot subscribe: not in session');
      return;
    }

    this.socket.emit('totem:subscribe_items', { sessionId: this.currentTotemSessionId });
    console.log('[Totem] Subscribing to item updates');
  }

  totemCallWaiter(message?: string): void {
    if (!this.socket?.connected) {
      console.warn('[Totem] Cannot call waiter: socket not connected');
      return;
    }
    if (!this.currentTotemSessionId) {
      console.warn('[Totem] Cannot call waiter: not in session');
      return;
    }

    this.socket.emit('totem:call_waiter', {
      sessionId: this.currentTotemSessionId,
      customerName: this.currentCustomerName,
      message,
    });
    console.log('[Totem] Calling waiter');
  }

  totemRequestBill(splitType?: 'ALL' | 'BY_USER' | 'SHARED'): void {
    if (!this.socket?.connected) {
      console.warn('[Totem] Cannot request bill: socket not connected');
      return;
    }
    if (!this.currentTotemSessionId) {
      console.warn('[Totem] Cannot request bill: not in session');
      return;
    }

    this.socket.emit('totem:request_bill', {
      sessionId: this.currentTotemSessionId,
      customerName: this.currentCustomerName,
      splitType: splitType || 'ALL',
    });
    console.log('[Totem] Requesting bill');
  }

  totemGetTableInfo(): void {
    if (!this.socket?.connected) {
      console.warn('[Totem] Cannot get table info: socket not connected');
      return;
    }
    if (!this.currentTotemSessionId) {
      console.warn('[Totem] Cannot get table info: not in session');
      return;
    }
    
    this.socket.emit('totem:get_table_info', { sessionId: this.currentTotemSessionId });
    console.log('[Totem] Getting table info');
  }

  totemGetMyOrders(): void {
    if (!this.socket?.connected) {
      console.warn('[Totem] Cannot get my orders: socket not connected');
      return;
    }
    if (!this.currentTotemSessionId) {
      console.warn('[Totem] Cannot get my orders: not in session');
      return;
    }
    
    this.socket.emit('totem:get_my_orders', { sessionId: this.currentTotemSessionId });
    console.log('[Totem] Getting my orders');
  }

  // ==================== KDS METHODS ====================

  joinKdsSession(sessionId: string): void {
    if (!this.socket?.connected) {
      console.warn('[KDS] Cannot join session: socket not connected');
      return;
    }
    this.socket.emit('kds:join', sessionId);
    console.log(`[KDS] Joined session: ${sessionId}`);
  }

  leaveKdsSession(sessionId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('kds:leave', sessionId);
    console.log(`[KDS] Left session: ${sessionId}`);
  }

  kdsItemPrepare(itemId: string): void {
    if (!this.socket?.connected) {
      console.warn('[KDS] Cannot prepare item: socket not connected');
      return;
    }
    this.socket.emit('kds:item_prepare', { itemId });
    console.log(`[KDS] Preparing item: ${itemId}`);
  }

  kdsItemServe(itemId: string): void {
    if (!this.socket?.connected) {
      console.warn('[KDS] Cannot serve item: socket not connected');
      return;
    }
    this.socket.emit('kds:item_serve', { itemId });
    console.log(`[KDS] Serving item: ${itemId}`);
  }

  // ==================== GENERIC EMIT/ON ====================

  emit<T = unknown>(event: string, data: T): boolean {
    if (!this.socket?.connected) {
      console.warn(`[Socket] Cannot emit ${event}: socket not connected`);
      return false;
    }
    this.socket.emit(event, data);
    return true;
  }

  on<T = unknown>(event: string, callback: SocketEventCallback<T>): () => void {
    const wrappedCallback = callback as (data: unknown) => void;
    this.socket?.on(event, wrappedCallback);
    
    if (!this.activeListeners.has(event)) {
      this.activeListeners.set(event, new Set());
    }
    this.activeListeners.get(event)!.add(wrappedCallback);
    
    return () => this.off(event, callback);
  }

  off<T = unknown>(event: string, callback?: SocketEventCallback<T>): void {
    const wrappedCallback = callback as (data: unknown) => void | undefined;
    if (wrappedCallback) {
      this.socket?.off(event, wrappedCallback);
      this.activeListeners.get(event)?.delete(wrappedCallback);
    } else {
      this.socket?.off(event);
      this.activeListeners.delete(event);
    }
  }

  // ==================== LIFECYCLE ====================

  private doDisconnect(): void {
    if (this.daemonRetryTimer !== null) {
      clearTimeout(this.daemonRetryTimer);
      this.daemonRetryTimer = null;
    }
    if (this.socket) {
      this.activeListeners.forEach((callbacks, event) => {
        callbacks.forEach(callback => this.socket?.off(event, callback));
      });
      this.activeListeners.clear();

      this.socket.io.opts.reconnection = false;
      this.socket.close();
      this.socket = null;
    }
    this.reconnectAttempts = 0;
    this.hasReachedMaxReconnects = false;
    this.connectionRefCount = 0;
    this.currentTotemSessionId = null;
    this.currentTasSessionId = null;
    this.currentCustomerName = null;
  }

  ngOnDestroy(): void {
    this.connectionRefCount = 0;
    this.doDisconnect();
    
    // Complete all subjects
    this.totemItemUpdateSubject.complete();
    this.totemItemsAddedSubject.complete();
    this.totemWaiterNotificationSubject.complete();
    this.totemOrderConfirmedSubject.complete();
    this.totemHelpRequestConfirmedSubject.complete();
    this.totemBillRequestConfirmedSubject.complete();
    this.totemCustomerJoinedSubject.complete();
    this.totemCustomerLeftSubject.complete();
    this.totemTableOrderUpdateSubject.complete();
    this.totemTableInfoSubject.complete();
    this.totemSessionClosedSubject.complete();
    this.totemForceDisconnectSubject.complete();
    this.totemErrorSubject.complete();
    this.tasItemAddedSubject.complete();
    this.tasItemServedSubject.complete();
    this.tasItemCanceledSubject.complete();
    this.tasBillRequestedSubject.complete();
    this.tasBillPaidSubject.complete();
    this.tasHelpRequestedSubject.complete();
    this.tasNewCustomerOrderSubject.complete();
    this.tasCustomerBillRequestSubject.complete();
    this.tasNotificationSubject.complete();
    this.tasErrorSubject.complete();
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  resetConnection(): void {
    this.doDisconnect();
    this.hasReachedMaxReconnects = false;
    this.connectionRefCount = 0;
    this.acquireConnection();
  }

  hasConnectionFailed(): boolean {
    return this.hasReachedMaxReconnects;
  }

  // ==================== DEPRECATED METHODS ====================

  /** @deprecated Use acquireConnection() instead */
  connect(): void {
    console.warn('[SocketService] connect() is deprecated. Use acquireConnection() instead.');
    this.acquireConnection();
  }

  /** @deprecated Use releaseConnection() instead */
  disconnect(): void {
    console.warn('[SocketService] disconnect() is deprecated. Use releaseConnection() instead.');
    this.releaseConnection();
  }
}
