import { Subject } from 'rxjs';
import { Socket } from 'socket.io-client';
import { kdsStore } from '../../store/kds.store';
import { tasStore } from '../../store/tas.store';
import type {
  ItemDeletedPayload,
  ItemStateChangedPayload,
  ItemUpdateEvent,
  KdsNewItem,
  SocketError,
  TASBillEvent,
  TASCustomerBillRequestEvent,
  TASHelpRequest,
  TASItemEvent,
  TASItemStateEvent,
  TASNewCustomerOrderEvent,
  TotemBillRequestConfirmedEvent,
  TotemCustomerJoinedEvent,
  TotemCustomerLeftEvent,
  TotemForceDisconnectEvent,
  TotemHelpRequestConfirmedEvent,
  TotemItemsAddedEvent,
  TotemMyOrdersEvent,
  TotemOrderConfirmedEvent,
  TotemSessionClosedEvent,
  TotemTableInfoEvent,
  TotemTableOrderUpdateEvent,
  WaiterNotification,
} from '../../types/socket.types';

export interface SocketEventState {
  isBuffering(): boolean;
  buffer(event: string, payload: unknown): void;
  markInsufficientPermissions(): void;
  setTotemSession(sessionId: string, customerName?: string): void;
  clearTotemSession(sessionId: string): void;
  markTotemClosed(): void;
  leaveTotemSession(): void;
}

interface InternalListener {
  event: string;
  callback: (payload: unknown) => void;
}

export class SocketEventHub {
  private readonly totemItemUpdate = new Subject<ItemUpdateEvent>();
  private readonly totemItemsAdded = new Subject<TotemItemsAddedEvent>();
  private readonly totemMyOrders = new Subject<TotemMyOrdersEvent>();
  private readonly totemWaiterNotification = new Subject<WaiterNotification>();
  private readonly totemOrderConfirmed = new Subject<TotemOrderConfirmedEvent>();
  private readonly totemHelpRequestConfirmed = new Subject<TotemHelpRequestConfirmedEvent>();
  private readonly totemBillRequestConfirmed = new Subject<TotemBillRequestConfirmedEvent>();
  private readonly totemCustomerJoined = new Subject<TotemCustomerJoinedEvent>();
  private readonly totemCustomerLeft = new Subject<TotemCustomerLeftEvent>();
  private readonly totemTableOrderUpdate = new Subject<TotemTableOrderUpdateEvent>();
  private readonly totemTableInfo = new Subject<TotemTableInfoEvent>();
  private readonly totemSessionClosed = new Subject<TotemSessionClosedEvent>();
  private readonly totemForceDisconnect = new Subject<TotemForceDisconnectEvent>();
  private readonly totemError = new Subject<SocketError>();
  private readonly kdsNewItem = new Subject<KdsNewItem>();
  private readonly tasItemAdded = new Subject<TASItemEvent>();
  private readonly tasItemServed = new Subject<TASItemStateEvent>();
  private readonly tasItemCanceled = new Subject<TASItemStateEvent>();
  private readonly tasBillRequested = new Subject<TASBillEvent>();
  private readonly tasHelpRequested = new Subject<TASHelpRequest>();
  private readonly tasNewCustomerOrder = new Subject<TASNewCustomerOrderEvent>();
  private readonly tasCustomerBillRequest = new Subject<TASCustomerBillRequestEvent>();
  private readonly tasNotification = new Subject<WaiterNotification>();
  private readonly tasError = new Subject<SocketError>();
  private tasListeners: InternalListener[] = [];

  readonly totemItemUpdate$ = this.totemItemUpdate.asObservable();
  readonly totemItemsAdded$ = this.totemItemsAdded.asObservable();
  readonly totemMyOrders$ = this.totemMyOrders.asObservable();
  readonly totemWaiterNotification$ = this.totemWaiterNotification.asObservable();
  readonly totemOrderConfirmed$ = this.totemOrderConfirmed.asObservable();
  readonly totemHelpRequestConfirmed$ = this.totemHelpRequestConfirmed.asObservable();
  readonly totemBillRequestConfirmed$ = this.totemBillRequestConfirmed.asObservable();
  readonly totemCustomerJoined$ = this.totemCustomerJoined.asObservable();
  readonly totemCustomerLeft$ = this.totemCustomerLeft.asObservable();
  readonly totemTableOrderUpdate$ = this.totemTableOrderUpdate.asObservable();
  readonly totemTableInfo$ = this.totemTableInfo.asObservable();
  readonly totemSessionClosed$ = this.totemSessionClosed.asObservable();
  readonly totemForceDisconnect$ = this.totemForceDisconnect.asObservable();
  readonly totemError$ = this.totemError.asObservable();
  readonly kdsNewItem$ = this.kdsNewItem.asObservable();
  readonly tasItemAdded$ = this.tasItemAdded.asObservable();
  readonly tasItemServed$ = this.tasItemServed.asObservable();
  readonly tasItemCanceled$ = this.tasItemCanceled.asObservable();
  readonly tasBillRequested$ = this.tasBillRequested.asObservable();
  readonly tasHelpRequested$ = this.tasHelpRequested.asObservable();
  readonly tasNewCustomerOrder$ = this.tasNewCustomerOrder.asObservable();
  readonly tasCustomerBillRequest$ = this.tasCustomerBillRequest.asObservable();
  readonly tasNotification$ = this.tasNotification.asObservable();
  readonly tasError$ = this.tasError.asObservable();

  setupKdsListeners(socket: Socket, state: SocketEventState): void {
    socket.on('item:state_changed', (payload: ItemStateChangedPayload) => {
      if (state.isBuffering()) {
        state.buffer('item:state_changed', payload);
        return;
      }
      this.applyItemStateChanged(payload);
    });
    socket.on('kds:new_item', (item: KdsNewItem) => {
      if (state.isBuffering()) {
        state.buffer('kds:new_item', item);
        return;
      }
      kdsStore.addItem(item);
      this.kdsNewItem.next(item);
    });
    socket.on('item:deleted', (payload: ItemDeletedPayload) => {
      if (state.isBuffering()) {
        state.buffer('item:deleted', payload);
        return;
      }
      kdsStore.removeItem(payload.itemId);
    });
  }

  setupPermissionListeners(socket: Socket, state: SocketEventState): void {
    for (const event of ['kds:error', 'pos:error']) {
      socket.on(event, (error: SocketError) => {
        if (error.message === 'INSUFFICIENT_PERMISSIONS') state.markInsufficientPermissions();
      });
    }
  }

  setupTasListeners(socket: Socket, state: SocketEventState): void {
    this.addTasListener(socket, 'tas:item_added', (event: TASItemEvent) => {
      tasStore.addItem(event.item);
      this.tasItemAdded.next(event);
    });
    this.addTasListener(socket, 'tas:service_item_served', (event: TASItemStateEvent) => {
      tasStore.updateItemState(event.itemId, 'SERVED');
      this.tasItemServed.next(event);
    });
    this.addTasListener(socket, 'tas:item_canceled', (event: TASItemStateEvent) => {
      tasStore.updateItemState(event.itemId, 'CANCELED');
      this.tasItemCanceled.next(event);
    });
    this.addTasListener(socket, 'tas:bill_requested', (event: TASBillEvent) => {
      this.tasBillRequested.next(event);
    });
    this.addTasListener(socket, 'tas:help_requested', (event: TASHelpRequest) => {
      this.tasHelpRequested.next(event);
    });
    this.addTasListener(socket, 'tas:new_customer_order', (event: TASNewCustomerOrderEvent) => {
      if (event.item) tasStore.addItem(event.item);
      this.tasNewCustomerOrder.next(event);
    });
    this.addTasListener(socket, 'tas:customer_bill_request', (event: TASCustomerBillRequestEvent) => {
      this.tasCustomerBillRequest.next(event);
    });
    this.addTasListener(socket, 'tas:error', (error: SocketError) => {
      if (error.message === 'INSUFFICIENT_PERMISSIONS') state.markInsufficientPermissions();
      this.tasError.next(error);
    });
  }

  unregisterTasListeners(socket: Socket | null): void {
    for (const { event, callback } of this.tasListeners) socket?.off(event, callback);
    this.tasListeners = [];
  }

  setupTotemListeners(socket: Socket, state: SocketEventState): void {
    socket.on('totem:session_joined', (event: { sessionId: string; customerName?: string }) => {
      state.setTotemSession(event.sessionId, event.customerName);
    });
    socket.on('totem:customer_joined_table', (event: TotemCustomerJoinedEvent) => {
      this.totemCustomerJoined.next(event);
    });
    socket.on('totem:customer_left_table', (event: TotemCustomerLeftEvent) => {
      this.totemCustomerLeft.next(event);
    });
    socket.on('totem:table_info', (event: TotemTableInfoEvent) => this.totemTableInfo.next(event));
    socket.on('totem:table_order_update', (event: TotemTableOrderUpdateEvent) => {
      this.totemTableOrderUpdate.next(event);
    });
    socket.on('totem:session_left', (event: { sessionId: string }) => {
      state.clearTotemSession(event.sessionId);
    });
    socket.on('totem:order_placed', (event: TotemOrderConfirmedEvent) => {
      this.totemOrderConfirmed.next(event);
    });
    socket.on('order:item_update', (event: ItemUpdateEvent) => this.totemItemUpdate.next(event));
    socket.on('order:items_added', (event: TotemItemsAddedEvent) => this.totemItemsAdded.next(event));
    socket.on('totem:my_orders', (event: TotemMyOrdersEvent) => this.totemMyOrders.next(event));
    socket.on('totem:help_request_sent', (event: TotemHelpRequestConfirmedEvent) => {
      this.totemHelpRequestConfirmed.next(event);
    });
    socket.on('totem:bill_request_sent', (event: TotemBillRequestConfirmedEvent) => {
      this.totemBillRequestConfirmed.next(event);
    });
    socket.on('notification:from_waiter', (event: WaiterNotification) => {
      this.tasNotification.next(event);
      this.totemWaiterNotification.next(event);
    });
    socket.on('totem:session_closed', (event: TotemSessionClosedEvent) => {
      state.markTotemClosed();
      this.totemSessionClosed.next(event);
    });
    socket.on('totem:force_disconnect', (event: TotemForceDisconnectEvent) => {
      state.markTotemClosed();
      this.totemForceDisconnect.next(event);
      state.leaveTotemSession();
    });
    socket.on('totem:error', (error: SocketError) => {
      if (error.message === 'SESSION_CLOSED' || error.message === 'SESSION_ALREADY_CLOSED') {
        state.markTotemClosed();
      }
      this.totemError.next(error);
    });
  }

  routeBufferedEvent(event: string, payload: unknown, state: SocketEventState): void {
    switch (event) {
      case 'kds:new_item': {
        const item = payload as KdsNewItem;
        kdsStore.addItem(item);
        this.kdsNewItem.next(item);
        break;
      }
      case 'item:state_changed':
        this.applyItemStateChanged(payload as ItemStateChangedPayload);
        break;
      case 'item:deleted':
        kdsStore.removeItem((payload as ItemDeletedPayload).itemId);
        break;
      case 'tas:item_added': {
        const typed = payload as TASItemEvent;
        tasStore.addItem(typed.item);
        this.tasItemAdded.next(typed);
        break;
      }
      case 'tas:service_item_served': {
        const typed = payload as TASItemStateEvent;
        tasStore.updateItemState(typed.itemId, 'SERVED');
        this.tasItemServed.next(typed);
        break;
      }
      case 'tas:item_canceled': {
        const typed = payload as TASItemStateEvent;
        tasStore.updateItemState(typed.itemId, 'CANCELED');
        this.tasItemCanceled.next(typed);
        break;
      }
      case 'tas:bill_requested': this.tasBillRequested.next(payload as TASBillEvent); break;
      case 'tas:help_requested': this.tasHelpRequested.next(payload as TASHelpRequest); break;
      case 'tas:new_customer_order': {
        const typed = payload as TASNewCustomerOrderEvent;
        if (typed.item) tasStore.addItem(typed.item);
        this.tasNewCustomerOrder.next(typed);
        break;
      }
      case 'tas:customer_bill_request':
        this.tasCustomerBillRequest.next(payload as TASCustomerBillRequestEvent);
        break;
      case 'notification:from_waiter':
        this.tasNotification.next(payload as WaiterNotification);
        this.totemWaiterNotification.next(payload as WaiterNotification);
        break;
      case 'tas:error': this.tasError.next(payload as SocketError); break;
      case 'totem:session_joined': {
        const typed = payload as { sessionId: string; customerName?: string };
        state.setTotemSession(typed.sessionId, typed.customerName);
        break;
      }
      case 'totem:customer_joined_table':
        this.totemCustomerJoined.next(payload as TotemCustomerJoinedEvent);
        break;
      case 'totem:customer_left_table':
        this.totemCustomerLeft.next(payload as TotemCustomerLeftEvent);
        break;
      case 'totem:table_info': this.totemTableInfo.next(payload as TotemTableInfoEvent); break;
      case 'totem:table_order_update':
        this.totemTableOrderUpdate.next(payload as TotemTableOrderUpdateEvent);
        break;
      case 'totem:session_left':
        state.clearTotemSession((payload as { sessionId: string }).sessionId);
        break;
      case 'totem:order_placed':
        this.totemOrderConfirmed.next(payload as TotemOrderConfirmedEvent);
        break;
      case 'order:item_update': this.totemItemUpdate.next(payload as ItemUpdateEvent); break;
      case 'order:items_added': this.totemItemsAdded.next(payload as TotemItemsAddedEvent); break;
      case 'totem:my_orders': this.totemMyOrders.next(payload as TotemMyOrdersEvent); break;
      case 'totem:help_request_sent':
        this.totemHelpRequestConfirmed.next(payload as TotemHelpRequestConfirmedEvent);
        break;
      case 'totem:bill_request_sent':
        this.totemBillRequestConfirmed.next(payload as TotemBillRequestConfirmedEvent);
        break;
      case 'totem:session_closed':
        state.markTotemClosed();
        this.totemSessionClosed.next(payload as TotemSessionClosedEvent);
        break;
      case 'totem:force_disconnect':
        state.markTotemClosed();
        this.totemForceDisconnect.next(payload as TotemForceDisconnectEvent);
        break;
      case 'totem:error': {
        const error = payload as SocketError;
        if (error.message === 'SESSION_CLOSED' || error.message === 'SESSION_ALREADY_CLOSED') {
          state.markTotemClosed();
        }
        this.totemError.next(error);
        break;
      }
      default:
    }
  }

  notifyConnectionFailed(): void {
    this.totemError.next({ message: 'CONNECTION_FAILED' });
    this.tasError.next({ message: 'CONNECTION_FAILED' });
  }

  notifyConnectionLost(): void {
    this.totemError.next({ message: 'CONNECTION_LOST' });
    this.tasError.next({ message: 'CONNECTION_LOST' });
  }

  complete(): void {
    for (const subject of [
      this.totemItemUpdate,
      this.totemItemsAdded,
      this.totemMyOrders,
      this.totemWaiterNotification,
      this.totemOrderConfirmed,
      this.totemHelpRequestConfirmed,
      this.totemBillRequestConfirmed,
      this.totemCustomerJoined,
      this.totemCustomerLeft,
      this.totemTableOrderUpdate,
      this.totemTableInfo,
      this.totemSessionClosed,
      this.totemForceDisconnect,
      this.totemError,
      this.kdsNewItem,
      this.tasItemAdded,
      this.tasItemServed,
      this.tasItemCanceled,
      this.tasBillRequested,
      this.tasHelpRequested,
      this.tasNewCustomerOrder,
      this.tasCustomerBillRequest,
      this.tasNotification,
      this.tasError,
    ]) {
      subject.complete();
    }
  }

  private addTasListener<T>(socket: Socket, event: string, callback: (payload: T) => void): void {
    const wrapped = callback as (payload: unknown) => void;
    socket.on(event, wrapped);
    this.tasListeners.push({ event, callback: wrapped });
  }

  private applyItemStateChanged(payload: ItemStateChangedPayload): void {
    kdsStore.updateItemState(payload.itemId, payload.newState);
    this.totemItemUpdate.next({
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }
}
