import { Injectable, inject } from '@angular/core';
import { SocketConnectionService, TotemEventDelegate } from './socket-connection.service';

@Injectable({ providedIn: 'root' })
export class TotemSocketService implements TotemEventDelegate {
  private readonly connection = inject(SocketConnectionService);

  private currentTotemSessionId: string | null = null;
  private currentTotemQr: string | null = null;
  private currentCustomerId: string | null = null;
  private currentCustomerName: string | null = null;
  private currentSessionToken: string | null = null;
  private isTotemSessionClosed = false;
  private joinedTotemSessionId: string | null = null;

  constructor() {
    this.connection.registerTotemEventDelegate(this);
    this.connection.registerReconnectHandler(async (socket) => {
      this.joinedTotemSessionId = null;
      // Rejoin the totem session after reconnecting.
      if (this.currentTotemSessionId && this.currentTotemQr) {
        const joined = await this.connection.emitReconnectJoin(socket, 'totem:join_session', {
          sessionId: this.currentTotemSessionId,
          qr: this.currentTotemQr,
          customerName: this.currentCustomerName,
          customerId: this.currentCustomerId,
          sessionToken: this.currentSessionToken ?? undefined,
        });
        if (joined) this.joinedTotemSessionId = this.currentTotemSessionId;
      }
    });
    this.connection.registerResetHandler(() => {
      this.currentTotemSessionId = null;
      this.currentCustomerName = null;
      this.isTotemSessionClosed = false;
    });
  }

  // ---- TotemEventDelegate (server-pushed events via SocketEventHub) --------

  setTotemSession(sessionId: string, customerName?: string): void {
    this.currentTotemSessionId = sessionId;
    if (customerName) this.currentCustomerName = customerName;
  }

  clearTotemSession(sessionId: string): void {
    if (this.currentTotemSessionId === sessionId) this.currentTotemSessionId = null;
  }

  markTotemClosed(): void {
    this.isTotemSessionClosed = true;
  }

  // ---- Session join/leave ----------------------------------------------------

  joinTotemSession(
    sessionId: string,
    qr: string,
    customerName?: string,
    customerId?: string,
    sessionToken?: string
  ): void {
    const credentialsChanged = this.currentTotemSessionId !== sessionId
      || this.currentCustomerId !== (customerId ?? null)
      || this.currentSessionToken !== (sessionToken ?? null);
    this.isTotemSessionClosed = false;
    this.currentTotemSessionId = sessionId;
    this.currentTotemQr = qr;
    this.connection.setPublicTotemQr(qr);
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
    const needsPublicReconnect = !this.connection.hasSocket()
      || !this.connection.getIsPublicTotemConnection()
      || this.connection.getConnectedTotemQr() !== qr;
    if (needsPublicReconnect) {
      this.ensurePublicConnection();
      return;
    }

    if (!sessionId || (!credentialsChanged && this.joinedTotemSessionId === sessionId)) return;
    // Do not queue a second Socket.IO packet while the Manager is connecting:
    // the reconnect handler owns that join and waits for its acknowledgement.
    if (!this.connection.isConnected()) return;
    if (this.connection.emit('totem:join_session', { sessionId, qr, customerName, customerId, sessionToken })) {
      this.joinedTotemSessionId = sessionId;
    }
  }

  /**
   * Establish (or re-establish) a socket connection carrying the public totem
   * QR handshake auth. Used by the totem customer flow which has no staff JWT.
   */
  private ensurePublicConnection(): void {
    if (this.connection.hasSocket()) {
      // A socket that is connected OR still reconnecting may carry the wrong
      // handshake auth. Tear it down before rebuilding so two Managers cannot
      // race and join with different QR credentials. disconnect() runs reset
      // handlers, so snapshot and restore the session state around it.
      const sessionState = {
        sessionId: this.currentTotemSessionId,
        customerName: this.currentCustomerName,
        customerId: this.currentCustomerId,
        sessionToken: this.currentSessionToken,
      };
      this.connection.disconnect();
      this.currentTotemSessionId = sessionState.sessionId;
      this.currentCustomerName = sessionState.customerName;
      this.currentCustomerId = sessionState.customerId;
      this.currentSessionToken = sessionState.sessionToken;
    }
    this.connection.connect();
  }

  leaveTotemSession(): void {
    if (this.connection.isConnected() && this.currentTotemSessionId) {
      this.connection.emit('totem:leave_session');
    }
    this.currentTotemSessionId = null;
    this.currentTotemQr = null;
    this.connection.setPublicTotemQr(null);
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

  // ---- Emits ------------------------------------------------------------------

  totemSubscribeToItems(): void {
    if (!this.currentTotemSessionId) {
      return;
    }
    this.connection.emit('totem:subscribe_items', { sessionId: this.currentTotemSessionId });
  }

  totemCallWaiter(message?: string): void {
    if (!this.currentTotemSessionId) {
      return;
    }
    this.connection.emit('totem:call_waiter', {
      sessionId: this.currentTotemSessionId,
      message,
    });
  }

  totemRequestBill(splitType?: 'ALL' | 'BY_USER' | 'SHARED'): void {
    if (!this.currentTotemSessionId) {
      return;
    }
    this.connection.emit('totem:request_bill', {
      sessionId: this.currentTotemSessionId,
      splitType: splitType || 'ALL',
    });
  }

  totemGetTableInfo(): void {
    if (!this.currentTotemSessionId) {
      return;
    }
    this.connection.emit('totem:get_table_info', { sessionId: this.currentTotemSessionId });
  }

  totemGetMyOrders(): void {
    if (!this.currentTotemSessionId) {
      return;
    }
    this.connection.emit('totem:get_my_orders', { sessionId: this.currentTotemSessionId });
  }
}
