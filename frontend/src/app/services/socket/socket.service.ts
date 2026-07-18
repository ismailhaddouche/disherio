import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { authStore } from '../../store/auth.store';
import type { TASAddItemData } from '../../types/socket.types';
import { SocketEventHub, SocketEventState } from './socket-event-hub';

type SocketEventCallback<T> = (data: T) => void;

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly daemonRetryDelay = 15000; // ms to wait before re-attempting after max reconnects
  private hasReachedMaxReconnects = false;
  private connectionRefCount = 0;
  private insufficientPermissions = false;
  private daemonRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private activeListeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private readonly eventHub = new SocketEventHub();

  // Event buffering for disconnection recovery
  private eventBuffer: Array<{ event: string; data: unknown; timestamp: number }> = [];
  private readonly maxBufferSize = 100;
  private isBuffering = false;

  private currentTotemSessionId: string | null = null;
  private currentTotemQr: string | null = null;
  private currentCustomerId: string | null = null;
  private currentCustomerName: string | null = null;
  private currentSessionToken: string | null = null;
  private isTotemSessionClosed = false;
  // Tracks whether the live socket was opened with public totem handshake
  // auth (QR) rather than a staff JWT. Avoids reaching into socket.io opts.
  private isPublicTotemConnection = false;
  private connectedTotemQr: string | null = null;
  private joinedTotemSessionId: string | null = null;

  private currentTasSessionId: string | null = null;
  private currentPosSessionId: string | null = null;
  private currentKdsSessionIds = new Set<string>();

  private readonly eventState: SocketEventState = {
    isBuffering: () => this.isBuffering,
    buffer: (event, payload) => this.bufferEvent(event, payload),
    markInsufficientPermissions: () => { this.insufficientPermissions = true; },
    setTotemSession: (sessionId, customerName) => {
      this.currentTotemSessionId = sessionId;
      if (customerName) this.currentCustomerName = customerName;
    },
    clearTotemSession: (sessionId) => {
      if (this.currentTotemSessionId === sessionId) this.currentTotemSessionId = null;
    },
    markTotemClosed: () => { this.isTotemSessionClosed = true; },
    leaveTotemSession: () => this.leaveTotemSession(),
  };

  readonly totemItemUpdate$ = this.eventHub.totemItemUpdate$;
  readonly totemItemsAdded$ = this.eventHub.totemItemsAdded$;
  readonly totemMyOrders$ = this.eventHub.totemMyOrders$;
  readonly totemWaiterNotification$ = this.eventHub.totemWaiterNotification$;
  readonly totemOrderConfirmed$ = this.eventHub.totemOrderConfirmed$;
  readonly totemHelpRequestConfirmed$ = this.eventHub.totemHelpRequestConfirmed$;
  readonly totemBillRequestConfirmed$ = this.eventHub.totemBillRequestConfirmed$;
  readonly totemCustomerJoined$ = this.eventHub.totemCustomerJoined$;
  readonly totemCustomerLeft$ = this.eventHub.totemCustomerLeft$;
  readonly totemTableOrderUpdate$ = this.eventHub.totemTableOrderUpdate$;
  readonly totemTableInfo$ = this.eventHub.totemTableInfo$;
  readonly totemSessionClosed$ = this.eventHub.totemSessionClosed$;
  readonly totemForceDisconnect$ = this.eventHub.totemForceDisconnect$;
  readonly totemError$ = this.eventHub.totemError$;
  readonly kdsNewItem$ = this.eventHub.kdsNewItem$;
  readonly tasItemAdded$ = this.eventHub.tasItemAdded$;
  readonly tasItemServed$ = this.eventHub.tasItemServed$;
  readonly tasItemCanceled$ = this.eventHub.tasItemCanceled$;
  readonly tasBillRequested$ = this.eventHub.tasBillRequested$;
  readonly tasHelpRequested$ = this.eventHub.tasHelpRequested$;
  readonly tasNewCustomerOrder$ = this.eventHub.tasNewCustomerOrder$;
  readonly tasCustomerBillRequest$ = this.eventHub.tasCustomerBillRequest$;
  readonly tasNotification$ = this.eventHub.tasNotification$;
  readonly tasError$ = this.eventHub.tasError$;

  /**
   * Register TAS-specific listeners.
   * Called by TAS component when it initializes.
   */
  registerTasListeners(): void {
    if (!this.socket) return;

    // Re-registration must be idempotent because the shared socket can remain
    // connected while the TAS component is destroyed and created again.
    this.unregisterTasListeners();
    this.setupTasListeners();
  }

  /**
   * Unregister TAS-specific listeners.
   * Called by TAS component when it destroys.
   */
  unregisterTasListeners(): void {
    this.eventHub.unregisterTasListeners(this.socket);
  }

  /**
   * Acquire a connection reference. Must be paired with releaseConnection().
   * Uses reference counting to prevent one component from disconnecting socket
   * that other components are still using.
   */
  acquireConnection(publicTotemQr?: string): void {
    if (publicTotemQr) {
      this.currentTotemQr = publicTotemQr;
    }
    this.connectionRefCount++;

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

      if (this.connectionRefCount === 0) {
        this.doDisconnect();
        // Reset refCount only here, after disconnecting
        // This ensures the count stays synchronized
      }
    }
  }

  private doConnect(): void {
    if (this.socket?.connected) return;

    // Public totem customers authenticate with their QR token at handshake
    // time instead of a staff JWT. Staff sessions send no `auth` field here
    // and fall through to cookie-based JWT auth on the server.
    const isPublic = !!this.currentTotemQr;
    const auth = isPublic
      ? { publicTotem: true, qr: this.currentTotemQr }
      : undefined;

    try {
      this.socket = io(environment.wsUrl, {
        withCredentials: true,
        transports: ['websocket'],
        upgrade: false,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        auth,
      });
      this.isPublicTotemConnection = isPublic;
      this.connectedTotemQr = isPublic ? this.currentTotemQr : null;

      this.socket.on('connect', () => {
        this.reconnectAttempts = 0;
        this.isBuffering = false;

        this.joinedTotemSessionId = null;

        // Rejoin active sessions after reconnecting.
        if (this.currentTotemSessionId && this.currentTotemQr && this.socket) {
          this.socket.emit('totem:join_session', {
            sessionId: this.currentTotemSessionId,
            qr: this.currentTotemQr,
            customerName: this.currentCustomerName,
            customerId: this.currentCustomerId,
            sessionToken: this.currentSessionToken ?? undefined,
          });
          this.joinedTotemSessionId = this.currentTotemSessionId;
        }

        if (this.currentTasSessionId && this.socket) {
          this.socket.emit('tas:join', this.currentTasSessionId);
        }
        if (this.currentPosSessionId && this.socket) {
          this.socket.emit('pos:join', this.currentPosSessionId);
        }

        if (this.socket) {
          for (const sessionId of this.currentKdsSessionIds) {
            this.socket.emit('kds:join', sessionId);
          }
        }

        // Replay events buffered during the disconnection.
        this.replayBufferedEvents();
      });

      this.socket.on('connect_error', (err: Error) => {
        this.isBuffering = true;
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
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
                this.hasReachedMaxReconnects = false;
                this.reconnectAttempts = 0;
                this.doConnect();
              }
            }, this.daemonRetryDelay);
          }
        }
      });

      this.socket.on('disconnect', (reason: Socket.DisconnectReason) => {
        if (reason === 'io server disconnect' && !this.insufficientPermissions && this.socket?.io.opts.reconnection) {
          this.socket.connect();
        }
      });

      // Setup all listeners
      this.setupKdsListeners();
      this.setupPermissionListeners();
      this.unregisterTasListeners();
      this.setupTasListeners();
      this.setupTotemListeners();
      this.attachConsumerListeners();

    } catch {
      this.isBuffering = true;
      this.eventHub.notifyConnectionFailed();
    }
  }

  private setupKdsListeners(): void {
    if (this.socket) this.eventHub.setupKdsListeners(this.socket, this.eventState);
  }

  private setupPermissionListeners(): void {
    if (this.socket) this.eventHub.setupPermissionListeners(this.socket, this.eventState);
  }

  private setupTasListeners(): void {
    if (this.socket) this.eventHub.setupTasListeners(this.socket, this.eventState);
  }

  private setupTotemListeners(): void {
    if (this.socket) this.eventHub.setupTotemListeners(this.socket, this.eventState);
  }

  /**
   * Join a session with permission verification.
   * @param sessionId - The session ID to join
   * @param sessionType - Optional specific session type to join. If not provided, joins all types the user has permission for.
   */
  joinSession(sessionId: string, sessionType?: 'TOTEM' | 'KDS' | 'TAS' | 'POS'): void {
    const userPermissions = authStore.user()?.permissions || [];
    if (sessionType === 'POS') {
      const requiredPermission = this.getRequiredPermission('POS');
      if (requiredPermission
        && !userPermissions.includes(requiredPermission)
        && !userPermissions.includes('ADMIN')) return;
      if (this.currentPosSessionId === sessionId) return;
      const previousSessionId = this.currentPosSessionId;
      this.currentPosSessionId = sessionId;
      if (!this.socket?.connected) return;
      if (previousSessionId) this.socket.emit('pos:leave', previousSessionId);
      this.socket.emit('pos:join', sessionId);
      return;
    }

    if (!this.socket?.connected) {
      return;
    }

    if (sessionType) {
      // Join specific session type with permission check
      const requiredPermission = this.getRequiredPermission(sessionType);
      if (requiredPermission
        && !userPermissions.includes(requiredPermission)
        && !userPermissions.includes('ADMIN')) {
        return;
      }

      switch (sessionType) {
        case 'KDS':
          this.currentKdsSessionIds.add(sessionId);
          this.socket.emit('kds:join', sessionId);
          break;
        case 'TAS':
          this.socket.emit('tas:join', sessionId);
          break;
        case 'TOTEM':
          // Totem sessions use a different method
          break;
      }
    } else {
      // Legacy mode: join all session types the user has permission for
      const posPermission = this.getRequiredPermission('POS');
      const kdsPermission = this.getRequiredPermission('KDS');
      const tasPermission = this.getRequiredPermission('TAS');

      if (!posPermission || userPermissions.includes(posPermission)) {
        this.socket.emit('pos:join', sessionId);
      }

      if (!kdsPermission || userPermissions.includes(kdsPermission)) {
        this.currentKdsSessionIds.add(sessionId);
        this.socket.emit('kds:join', sessionId);
      }

      if (!tasPermission || userPermissions.includes(tasPermission)) {
        this.socket.emit('tas:join', sessionId);
      }
    }
  }

  /**
   * Get the required permission for a given session type.
   * @param sessionType - The session type
   * @returns The required permission string or null if no permission required
   */
  private getRequiredPermission(sessionType: string): string | null {
    switch (sessionType) {
      case 'KDS': return 'KTS';
      case 'TOTEM': return null;
      case 'TAS': return 'TAS';
      case 'POS': return 'POS';
      default: return null;
    }
  }

  leaveSession(sessionId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('pos:leave', sessionId);
      this.socket.emit('tas:leave', sessionId);
    }
    if (this.currentPosSessionId === sessionId) this.currentPosSessionId = null;
  }

  joinTasSession(sessionId: string): void {
    if (this.currentTasSessionId === sessionId) return;
    const previousSessionId = this.currentTasSessionId;
    this.currentTasSessionId = sessionId;
    if (!this.socket?.connected) {
      return;
    }
    if (previousSessionId) {
      this.socket.emit('tas:leave', previousSessionId);
    }
    this.socket.emit('tas:join', sessionId);
  }

  leaveTasSession(sessionId: string): void {
    if (this.socket?.connected) this.socket.emit('tas:leave', sessionId);
    if (this.currentTasSessionId === sessionId) {
      this.currentTasSessionId = null;
    }
  }

  tasAddItem(data: TASAddItemData): void {
    if (!this.socket?.connected) {
      return;
    }
    this.socket.emit('tas:add_item', data);
  }

  tasServeServiceItem(itemId: string): void {
    if (!this.socket?.connected) {
      return;
    }
    this.socket.emit('tas:serve_service_item', { itemId });
  }

  tasCancelItem(itemId: string, reason?: string): void {
    if (!this.socket?.connected) {
      return;
    }
    this.socket.emit('tas:cancel_item', { itemId, reason });
  }

  tasRequestBill(sessionId: string, options?: {
    requestedBy?: 'waiter' | 'customer';
    customerId?: string;
    splitType?: 'ALL' | 'BY_USER' | 'SHARED';
  }): void {
    if (!this.socket?.connected) {
      return;
    }
    this.socket.emit('tas:request_bill', {
      sessionId,
      requestedBy: options?.requestedBy || 'waiter',
      customerId: options?.customerId,
      splitType: options?.splitType || 'ALL',
    });
  }

  tasAcknowledgeCustomerCall(sessionId: string, message?: string): void {
    if (!this.socket?.connected) {
      return;
    }
    this.socket.emit('tas:call_waiter_response', {
      sessionId,
      acknowledged: true,
      message,
    });
  }

  tasNotifyCustomers(sessionId: string, message: string, type: 'info' | 'warning' | 'success' = 'info'): void {
    if (!this.socket?.connected) {
      return;
    }
    this.socket.emit('tas:notify_customers', {
      sessionId,
      message,
      type,
    });
  }

  joinTotemSession(
    sessionId: string,
    qr: string,
    customerName?: string,
    customerId?: string,
    sessionToken?: string
  ): void {
    this.isTotemSessionClosed = false;
    this.currentTotemSessionId = sessionId;
    this.currentTotemQr = qr;
    this.currentCustomerId = customerId ?? null;
    if (customerName) {
      this.currentCustomerName = customerName;
    }
    if (sessionToken) {
      this.currentSessionToken = sessionToken;
    }

    // Public totem clients must present the QR at handshake. If the current
    // socket was opened without it (or with a different QR, or has no socket
    // yet), (re)connect so the server validates the QR before accepting the join.
    const needsPublicReconnect = !this.socket
      || !this.isPublicTotemConnection
      || this.connectedTotemQr !== qr;
    if (needsPublicReconnect) {
      this.ensurePublicConnection();
      return;
    }

    if (!sessionId || this.joinedTotemSessionId === sessionId) return;
    this.socket!.emit('totem:join_session', { sessionId, qr, customerName, customerId, sessionToken });
    this.joinedTotemSessionId = sessionId;
  }

  /**
   * Establish (or re-establish) a socket connection carrying the public totem
   * QR handshake auth. Used by the totem customer flow which has no staff JWT.
   */
  private ensurePublicConnection(): void {
    if (this.socket?.connected) {
      // Already connected but with the wrong auth — disconnect so doConnect
      // rebuilds the socket with the current QR.
      const sessionState = {
        sessionId: this.currentTotemSessionId,
        customerName: this.currentCustomerName,
        customerId: this.currentCustomerId,
        sessionToken: this.currentSessionToken,
      };
      this.doDisconnect();
      this.currentTotemSessionId = sessionState.sessionId;
      this.currentCustomerName = sessionState.customerName;
      this.currentCustomerId = sessionState.customerId;
      this.currentSessionToken = sessionState.sessionToken;
    }
    this.doConnect();
  }

  leaveTotemSession(): void {
    if (this.socket?.connected && this.currentTotemSessionId) {
      this.socket.emit('totem:leave_session');
    }
    this.currentTotemSessionId = null;
    this.currentTotemQr = null;
    this.currentCustomerId = null;
    this.currentSessionToken = null;
    this.currentCustomerName = null;
    this.joinedTotemSessionId = null;
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

  totemSubscribeToItems(): void {
    if (!this.socket?.connected) {
      return;
    }
    if (!this.currentTotemSessionId) {
      return;
    }

    this.socket.emit('totem:subscribe_items', { sessionId: this.currentTotemSessionId });
  }

  totemCallWaiter(message?: string): void {
    if (!this.socket?.connected) {
      return;
    }
    if (!this.currentTotemSessionId) {
      return;
    }

    this.socket.emit('totem:call_waiter', {
      sessionId: this.currentTotemSessionId,
      message,
    });
  }

  totemRequestBill(splitType?: 'ALL' | 'BY_USER' | 'SHARED'): void {
    if (!this.socket?.connected) {
      return;
    }
    if (!this.currentTotemSessionId) {
      return;
    }

    this.socket.emit('totem:request_bill', {
      sessionId: this.currentTotemSessionId,
      splitType: splitType || 'ALL',
    });
  }

  totemGetTableInfo(): void {
    if (!this.socket?.connected) {
      return;
    }
    if (!this.currentTotemSessionId) {
      return;
    }

    this.socket.emit('totem:get_table_info', { sessionId: this.currentTotemSessionId });
  }

  totemGetMyOrders(): void {
    if (!this.socket?.connected) {
      return;
    }
    if (!this.currentTotemSessionId) {
      return;
    }

    this.socket.emit('totem:get_my_orders', { sessionId: this.currentTotemSessionId });
  }

  joinKdsSession(sessionId: string): void {
    if (this.currentKdsSessionIds.has(sessionId)) return;
    this.currentKdsSessionIds.add(sessionId);
    if (!this.socket?.connected) {
      return;
    }
    this.socket.emit('kds:join', sessionId);
  }

  leaveKdsSession(sessionId: string): void {
    if (this.socket?.connected) this.socket.emit('kds:leave', sessionId);
    this.currentKdsSessionIds.delete(sessionId);
  }

  kdsItemPrepare(itemId: string): void {
    if (!this.socket?.connected) {
      return;
    }
    this.socket.emit('kds:item_prepare', { itemId });
  }

  kdsItemServe(itemId: string): void {
    if (!this.socket?.connected) {
      return;
    }
    this.socket.emit('kds:item_serve', { itemId });
  }

  emit<T = unknown>(event: string, data: T): boolean {
    if (!this.socket?.connected) {
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

  private attachConsumerListeners(): void {
    if (!this.socket) return;
    this.activeListeners.forEach((callbacks, event) => {
      callbacks.forEach(callback => this.socket?.on(event, callback));
    });
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

  private doDisconnect(): void {
    this.insufficientPermissions = false;

    // Clear reconnect timers.
    if (this.daemonRetryTimer !== null) {
      clearTimeout(this.daemonRetryTimer);
      this.daemonRetryTimer = null;
    }

    // Remove the socket and its listeners.
    if (this.socket) {
      this.eventHub.unregisterTasListeners(this.socket);
      this.activeListeners.forEach((callbacks, event) => {
        callbacks.forEach(callback => this.socket?.off(event, callback));
      });

      this.socket.io.opts.reconnection = false;
      this.socket.close();
      this.socket = null;
    }
    this.activeListeners.clear();

    // Reset connection flags
    this.reconnectAttempts = 0;
    this.hasReachedMaxReconnects = false;
    this.isPublicTotemConnection = false;
    this.connectedTotemQr = null;

    // Clear session state
    this.resetSessionState();
  }

  /**
   * Reset session state when disconnected
   */
  private resetSessionState(): void {
    // Clear totem state.
    if (this.currentTotemSessionId) {
      this.currentTotemSessionId = null;
    }
    this.currentCustomerName = null;
    this.isTotemSessionClosed = false;

    // Clear TAS state.
    if (this.currentTasSessionId) {
      this.currentTasSessionId = null;
    }

    this.eventHub.notifyConnectionLost();
  }

  /**
   * Buffer an event for later replay after reconnection
   */
  private bufferEvent(event: string, data: unknown): void {
    if (this.eventBuffer.length >= this.maxBufferSize) {
      this.eventBuffer.shift();
    }

    this.eventBuffer.push({
      event,
      data,
      timestamp: Date.now(),
    });

  }

  /**
   * Replay buffered events after reconnection
   */
  private replayBufferedEvents(): void {
    if (this.eventBuffer.length === 0) return;


    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes max

    // Discard stale events.
    const validEvents = this.eventBuffer.filter(
      e => now - e.timestamp < maxAge
    );

    // Route buffered events to their corresponding subjects.
    for (const buffered of validEvents) {
      // Emit to the corresponding subjects based on event type
      this.eventHub.routeBufferedEvent(buffered.event, buffered.data, this.eventState);
    }

    // Clear the event buffer.
    this.eventBuffer = [];
  }

  /**
   * Clear the event buffer manually
   */
  clearEventBuffer(): void {
    this.eventBuffer = [];
  }

  /**
   * Get current buffer size (for debugging)
   */
  getBufferSize(): number {
    return this.eventBuffer.length;
  }

  ngOnDestroy(): void {
    this.connectionRefCount = 0;
    this.doDisconnect();
    this.eventHub.complete();
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  resetConnection(): void {
    // Notify all holders that the connection will be reset

    // Force disconnect regardless of refCount
    this.doDisconnect();

    // Reset connection flags without changing the reference count.
    this.hasReachedMaxReconnects = false;
    // Components should handle reconnection
  }

  hasConnectionFailed(): boolean {
    return this.hasReachedMaxReconnects;
  }

}
