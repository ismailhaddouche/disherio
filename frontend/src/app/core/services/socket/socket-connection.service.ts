import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../../environments/environment';
import { SocketEventHub, SocketEventState } from './socket-event-hub';

type SocketEventCallback<T> = (data: T) => void;

/** Re-emits domain joins after a (re)connect. Registered by domain socket services. */
export type ReconnectHandler = (socket: Socket) => void;

/**
 * Callbacks the SocketEventHub invokes when totem server events arrive.
 * Registered by TotemSocketService at construction. Optional-safe: totem
 * server events can only target a client that joined a totem session, which
 * implies TotemSocketService was instantiated.
 */
export interface TotemEventDelegate {
  setTotemSession(sessionId: string, customerName?: string): void;
  clearTotemSession(sessionId: string): void;
  markTotemClosed(): void;
  leaveTotemSession(): void;
}

@Injectable({ providedIn: 'root' })
export class SocketConnectionService implements OnDestroy {
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

  // Public-totem handshake auth state. Connection-level: it selects the auth
  // payload sent at io() time.
  private currentTotemQr: string | null = null;
  // Tracks whether the live socket was opened with public totem handshake
  // auth (QR) rather than a staff JWT. Avoids reaching into socket.io opts.
  private isPublicTotemConnection = false;
  private connectedTotemQr: string | null = null;

  // Domain hooks. Domain socket services register these at construction to
  // rejoin their sessions on reconnect and to drop their session state on a
  // manual disconnect, without the connection service depending on them.
  private readonly reconnectHandlers: ReconnectHandler[] = [];
  private readonly resetHandlers: Array<() => void> = [];
  private totemEventDelegate: TotemEventDelegate | null = null;

  private readonly eventState: SocketEventState = {
    isBuffering: () => this.isBuffering,
    buffer: (event, payload) => this.bufferEvent(event, payload),
    markInsufficientPermissions: () => { this.insufficientPermissions = true; },
    setTotemSession: (sessionId, customerName) => this.totemEventDelegate?.setTotemSession(sessionId, customerName),
    clearTotemSession: (sessionId) => this.totemEventDelegate?.clearTotemSession(sessionId),
    markTotemClosed: () => this.totemEventDelegate?.markTotemClosed(),
    leaveTotemSession: () => this.totemEventDelegate?.leaveTotemSession(),
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

  // ---- Domain hooks --------------------------------------------------------

  registerReconnectHandler(handler: ReconnectHandler): void {
    this.reconnectHandlers.push(handler);
  }

  registerResetHandler(handler: () => void): void {
    this.resetHandlers.push(handler);
  }

  registerTotemEventDelegate(delegate: TotemEventDelegate): void {
    this.totemEventDelegate = delegate;
  }

  // ---- Connection lifecycle ------------------------------------------------

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
      }
    }
  }

  /** Public wrapper used by TotemSocketService.ensurePublicConnection. */
  connect(): void {
    this.doConnect();
  }

  /** Public wrapper used by TotemSocketService.ensurePublicConnection. */
  disconnect(): void {
    this.doDisconnect();
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

        // Rejoin active sessions after reconnecting (domain handlers run in
        // registration order, before the buffered-event replay — same order
        // as the old monolith).
        for (const handler of this.reconnectHandlers) {
          handler(this.socket!);
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
   * Re-attaches TAS listeners on the live socket. Idempotent: the shared
   * socket can remain connected while the TAS component is destroyed and
   * created again.
   */
  reregisterTasListeners(): void {
    if (!this.socket) return;
    this.eventHub.unregisterTasListeners(this.socket);
    this.eventHub.setupTasListeners(this.socket, this.eventState);
  }

  unregisterTasListeners(): void {
    this.eventHub.unregisterTasListeners(this.socket);
  }

  // ---- Public-totem handshake state ----------------------------------------

  /** Sets the QR used for the public totem handshake auth on the next connect. */
  setPublicTotemQr(qr: string | null): void {
    this.currentTotemQr = qr;
  }

  getIsPublicTotemConnection(): boolean {
    return this.isPublicTotemConnection;
  }

  getConnectedTotemQr(): string | null {
    return this.connectedTotemQr;
  }

  hasSocket(): boolean {
    return this.socket !== null;
  }

  // ---- Generic emit / listener registry ------------------------------------

  emit<T = unknown>(event: string, data?: T): boolean {
    if (!this.socket?.connected) {
      return false;
    }
    if (data === undefined) {
      this.socket.emit(event);
    } else {
      this.socket.emit(event, data);
    }
    return true;
  }

  /**
   * Emits on the live socket without a connected-check (socket.io buffers
   * while reconnecting). Matches the old `this.socket!.emit(...)` behavior in
   * joinTotemSession, where the socket exists but may be mid-reconnect.
   */
  emitRaw<T = unknown>(event: string, data: T): void {
    this.socket?.emit(event, data);
  }

  on<T = unknown>(event: string, callback: SocketEventCallback<T>): () => void {
    const wrappedCallback = callback as (data: unknown) => void;

    if (!this.activeListeners.has(event)) {
      this.activeListeners.set(event, new Set());
    }
    const listeners = this.activeListeners.get(event)!;
    if (listeners.has(wrappedCallback)) {
      return () => this.off(event, callback);
    }

    this.socket?.on(event, wrappedCallback);
    listeners.add(wrappedCallback);

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
   * Reset session state when disconnected. Domain services registered reset
   * handlers for the state the old monolith cleared here; POS/KDS session ids
   * intentionally survive (unchanged behavior).
   */
  private resetSessionState(): void {
    for (const handler of this.resetHandlers) {
      handler();
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
