import { Injectable, inject } from '@angular/core';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { SocketConnectionService } from '../../core/services/socket/socket-connection.service';
import { TasSocketService } from '../../core/services/socket/tas-socket.service';
import { authStore } from '../../store/auth.store';
import { tasStore } from '../../store/tas.store';
import type {
  ItemOrder,
  LocalizedField,
  SessionArchivedEvent,
  SessionClosedEvent,
  SessionReopenedEvent,
} from '../../types';

export interface TasSocketContext {
  selectedSessionId(): string | undefined;
  isCancellingSession(): boolean;
  isClosingSession(): boolean;
  isReopeningSession(): boolean;
  isArchivingSession(): boolean;
  isProcessingPayment(): boolean;
  markSessionComplete(sessionId: string): void;
  markSessionStarted(sessionId: string): void;
  removeSession(sessionId: string): void;
}

@Injectable()
export class TasSocketCoordinator {
  private readonly connection = inject(SocketConnectionService);
  private readonly tasSocket = inject(TasSocketService);
  private readonly i18n = inject(I18nService);
  private readonly notification = inject(NotificationService);
  private disposers: Array<() => void> = [];

  register(context: TasSocketContext): void {
    this.disposeConsumers();
    this.tasSocket.registerTasListeners();

    this.listen('kds:new_item', (item: ItemOrder) => {
      if (item.session_id !== context.selectedSessionId()) return;
      if (tasStore.sessionItems().some(existing => existing._id === item._id)) return;

      tasStore.addItem(item);
      if (item.item_disher_type === 'KITCHEN') {
        this.notification.info(this.i18n.translate('tas.new_kitchen_item'));
      }
    });

    this.listen('item:state_changed', ({ itemId, newState, updatedBy }: {
      itemId: string;
      newState: ItemOrder['item_state'];
      updatedBy?: string;
    }) => {
      tasStore.updateItemState(itemId, newState);
      if (newState === 'ON_PREPARE') {
        this.notification.info(this.i18n.translate('tas.item_in_preparation'));
      } else if (newState === 'SERVED' && updatedBy !== 'TAS') {
        this.notification.success(this.i18n.translate('tas.item_served_by_kitchen'));
      }
    });

    this.listen('kds:item_canceled', ({ itemId }: {
      itemId: string;
      itemName?: LocalizedField;
      reason?: string;
    }) => {
      tasStore.updateItemState(itemId, 'CANCELED');
      this.notification.warning(this.i18n.translate('tas.item_canceled_by_kitchen'));
    });

    this.listen('tas:kitchen_item_update', (data: {
      itemId: string;
      itemName?: LocalizedField;
      newState: ItemOrder['item_state'];
      updatedBy?: string;
      updatedByName?: string;
      timestamp: string;
    }) => {
      if (!context.selectedSessionId()) return;

      tasStore.updateItemState(data.itemId, data.newState);
      const messageKeys: Partial<Record<ItemOrder['item_state'], string>> = {
        ON_PREPARE: 'tas.item_started_preparation',
        SERVED: 'tas.item_ready_to_serve',
        CANCELED: 'tas.item_canceled_by_kitchen',
      };
      const messageKey = messageKeys[data.newState];
      if (!messageKey) return;

      if (data.newState === 'SERVED') {
        this.notification.success(this.i18n.translate(messageKey));
      } else if (data.newState === 'CANCELED') {
        this.notification.warning(this.i18n.translate(messageKey));
      } else {
        this.notification.info(this.i18n.translate(messageKey));
      }
    });

    this.listen('tas:session_closed', (data: SessionClosedEvent) => {
      const wasSelected = data.sessionId === context.selectedSessionId();
      if (data.state === 'CANCELLED') {
        context.removeSession(data.sessionId);
        if (wasSelected && !context.isCancellingSession()) {
          this.notification.warning(this.i18n.translate('tas.session_cancelled'));
        }
        return;
      }

      context.markSessionComplete(data.sessionId);
      if (wasSelected && !context.isClosingSession()) {
        this.notification.warning(this.i18n.translate('tas.session_closed_by_pos'));
      }
    });

    this.listen('tas:session_reopened', (data: SessionReopenedEvent) => {
      const wasSelected = data.sessionId === context.selectedSessionId();
      context.markSessionStarted(data.sessionId);
      if (wasSelected && !context.isReopeningSession()) {
        this.notification.info(this.i18n.translate('tas.session_reopened'));
      }
    });

    this.listen('tas:session_archived', (data: SessionArchivedEvent) => {
      const wasSelected = data.sessionId === context.selectedSessionId();
      context.removeSession(data.sessionId);
      if (wasSelected && !context.isArchivingSession() && !context.isProcessingPayment()) {
        this.notification.success(this.i18n.translate('tas.session_archived'));
      }
    });

    this.listen('tas:ticket_paid', (data: { sessionId: string }) => {
      if (data.sessionId === context.selectedSessionId()) {
        this.notification.info(this.i18n.translate('tas.ticket_paid'));
      }
    });

    this.listen('item:deleted', ({ itemId }: { itemId: string }) => {
      tasStore.removeItem(itemId);
    });

    this.listen('item:customer_assigned', ({ itemId, customerId }: {
      itemId: string;
      customerId: string | null;
    }) => {
      tasStore.assignItemToCustomer(itemId, customerId);
    });

    this.listen('item:added', (data: { item: ItemOrder; sessionId: string }) => {
      this.addItemForSelectedSession(data, context);
    });

    this.listen('item:canceled', (data: { itemId: string; sessionId: string }) => {
      if (data.sessionId === context.selectedSessionId()) {
        tasStore.updateItemState(data.itemId, 'CANCELED');
      }
    });

    this.listen('tas:item_added', (data: {
      item: ItemOrder;
      sessionId: string;
      addedBy?: string;
      addedByName?: string;
    }) => {
      if (data.sessionId !== context.selectedSessionId()) return;

      this.addItemIfMissing(data.item);
      if (data.addedBy && data.addedBy !== authStore.user()?.staffId) {
        this.notification.info(this.i18n.translate('tas.item_added_by_waiter'));
      }
    });

    this.listen('tas:service_item_served', (data: { itemId: string; sessionId: string }) => {
      if (data.sessionId === context.selectedSessionId()) {
        tasStore.updateItemState(data.itemId, 'SERVED');
      }
    });

    this.listen('tas:item_canceled', (data: {
      itemId: string;
      sessionId: string;
      canceledBy?: string;
      canceledByName?: string;
      reason?: string;
    }) => {
      if (data.sessionId !== context.selectedSessionId()) return;

      tasStore.updateItemState(data.itemId, 'CANCELED');
      if (data.canceledBy && data.canceledBy !== authStore.user()?.staffId) {
        this.notification.info(this.i18n.translate('tas.item_canceled_by_waiter'));
      }
    });

    this.listen('tas:bill_requested', (data: {
      sessionId: string;
      requestedBy: string;
      requestedByStaff?: string;
    }) => {
      if (data.sessionId === context.selectedSessionId()
          && data.requestedByStaff !== authStore.user()?.staffId) {
        this.notification.info(this.i18n.translate('tas.bill_requested_by_waiter'));
      }
    });

    this.listen('tas:help_requested', (data: { sessionId: string }) => {
      if (data.sessionId === context.selectedSessionId()) {
        this.notification.warning(this.i18n.translate('tas.help_requested'));
      }
    });

    this.listen('tas:new_customer_order', (data: { item: ItemOrder; sessionId: string }) => {
      if (data.sessionId !== context.selectedSessionId()) return;
      if (this.addItemIfMissing(data.item)) {
        this.notification.info(this.i18n.translate('tas.new_customer_order'));
      }
    });

    this.listen('tas:customer_bill_request', (data: { sessionId: string }) => {
      if (data.sessionId === context.selectedSessionId()) {
        this.notification.info(this.i18n.translate('tas.customer_requests_bill'));
      }
    });

    this.listen('tas:item_served_confirm', ({ success }: { success: boolean }) => {
      if (success) this.notification.success(this.i18n.translate('tas.item_served'));
    });

    this.listen('tas:item_canceled_confirm', ({ success }: { success: boolean }) => {
      if (success) this.notification.success(this.i18n.translate('tas.item_canceled_success'));
    });

    this.listen('tas:bill_request_confirm', ({ success }: { success: boolean }) => {
      if (success) this.notification.success(this.i18n.translate('tas.bill_requested'));
    });
  }

  dispose(): void {
    this.disposeConsumers();
    this.tasSocket.unregisterTasListeners();
  }

  private listen<T>(event: string, callback: (data: T) => void): void {
    this.disposers.push(this.connection.on(event, callback));
  }

  private disposeConsumers(): void {
    this.disposers.forEach(dispose => dispose());
    this.disposers = [];
  }

  private addItemForSelectedSession(
    data: { item: ItemOrder; sessionId: string },
    context: TasSocketContext,
  ): void {
    if (data.sessionId === context.selectedSessionId()) this.addItemIfMissing(data.item);
  }

  private addItemIfMissing(item: ItemOrder): boolean {
    if (tasStore.sessionItems().some(existing => existing._id === item._id)) return false;
    tasStore.addItem(item);
    return true;
  }
}
