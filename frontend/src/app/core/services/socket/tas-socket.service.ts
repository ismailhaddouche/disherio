import { Injectable, inject } from '@angular/core';
import { SocketConnectionService } from './socket-connection.service';
import type { TASAddItemData } from '../../../types/socket.types';
import { createRequestId } from '../../utils/request-id';

@Injectable({ providedIn: 'root' })
export class TasSocketService {
  private readonly connection = inject(SocketConnectionService);
  private currentTasSessionId: string | null = null;

  constructor() {
    this.connection.registerReconnectHandler((socket) => {
      if (this.currentTasSessionId) {
        socket.emit('tas:join', this.currentTasSessionId);
      }
    });
    this.connection.registerResetHandler(() => {
      this.currentTasSessionId = null;
    });
  }

  /**
   * Re-registers TAS listeners. Called by the TAS coordinator on init.
   * Idempotent — see SocketConnectionService.reregisterTasListeners.
   */
  registerTasListeners(): void {
    this.connection.reregisterTasListeners();
  }

  unregisterTasListeners(): void {
    this.connection.unregisterTasListeners();
  }

  joinTasSession(sessionId: string): void {
    if (this.currentTasSessionId === sessionId) return;
    const previousSessionId = this.currentTasSessionId;
    this.currentTasSessionId = sessionId;
    if (!this.connection.isConnected()) {
      return;
    }
    if (previousSessionId) {
      this.connection.emit('tas:leave', previousSessionId);
    }
    this.connection.emit('tas:join', sessionId);
  }

  leaveTasSession(sessionId: string): void {
    if (this.connection.isConnected()) this.connection.emit('tas:leave', sessionId);
    if (this.currentTasSessionId === sessionId) {
      this.currentTasSessionId = null;
    }
  }

  tasAddItem(data: TASAddItemData): void {
    this.connection.emit('tas:add_item', {
      ...data,
      requestId: data.requestId ?? createRequestId(),
    });
  }

  tasServeServiceItem(itemId: string): void {
    this.connection.emit('tas:serve_service_item', { itemId });
  }

  tasCancelItem(itemId: string, reason?: string): void {
    this.connection.emit('tas:cancel_item', { itemId, reason });
  }

  tasRequestBill(sessionId: string, options?: {
    requestedBy?: 'waiter' | 'customer';
    customerId?: string;
    splitType?: 'ALL' | 'BY_USER' | 'SHARED';
  }): void {
    this.connection.emit('tas:request_bill', {
      sessionId,
      requestedBy: options?.requestedBy || 'waiter',
      customerId: options?.customerId,
      splitType: options?.splitType || 'ALL',
    });
  }

  tasAcknowledgeCustomerCall(sessionId: string, message?: string): void {
    this.connection.emit('tas:call_waiter_response', {
      sessionId,
      acknowledged: true,
      message,
    });
  }

  tasNotifyCustomers(sessionId: string, message: string, type: 'info' | 'warning' | 'success' = 'info'): void {
    this.connection.emit('tas:notify_customers', {
      sessionId,
      message,
      type,
    });
  }
}
