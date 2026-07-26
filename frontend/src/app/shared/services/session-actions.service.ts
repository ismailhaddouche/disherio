import { Injectable, OnDestroy, inject, signal, type Signal, type WritableSignal } from '@angular/core';
import { Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { TasService } from '../../core/services/tas.service';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { removeTemporaryTotem } from '../utils/operational-session.utils';
import type { PaymentType, PendingOrderItem } from '../../store/order-workspace.state';
import type { Customer, ItemOrder, TotemSession } from '../../types';

export type SessionTotemRef = { _id: string; totem_name: string; totem_type: string };

/**
 * Host state the shared flows need from the screen using the service.
 * POS binds its local signals; TAS binds the equivalent ones from its
 * component (backed by tasStore).
 */
export interface SessionActionsContext {
  selectSession(session: TotemSession): void;
  newCustomerName: WritableSignal<string>;
  showAddCustomer: WritableSignal<boolean>;
  pendingItems: WritableSignal<PendingOrderItem[]>;
  isSendingOrder: WritableSignal<boolean>;
  showMenu: WritableSignal<boolean>;
  isSessionClosed: Signal<boolean>;
  paymentType: Signal<PaymentType | null>;
  splitCount: Signal<number>;
  isProcessingPayment: WritableSignal<boolean>;
  closePaymentModal(): void;
  /** Extra cleanup after an order is sent (TAS clears the selected dish). */
  afterOrderSent?(): void;
}

/**
 * Shared session lifecycle and order/customer/payment flows for the POS and
 * TAS workspaces. Subclasses provide state storage (POS keeps local signals,
 * TAS syncs tasStore) through the hooks at the bottom; anything that behaves
 * differently per screen stays in the subclass.
 *
 * HTTP errors are already surfaced by the global error interceptor, so error
 * callbacks here only reset local state — they must not notify again.
 */
@Injectable()
export abstract class SessionActionsService implements OnDestroy {
  protected readonly tasService = inject(TasService);
  protected readonly i18n = inject(I18nService);
  protected readonly notify = inject(NotificationService);
  protected readonly confirmation = inject(ConfirmationService);
  protected readonly destroy$ = new Subject<void>();
  protected context!: SessionActionsContext;

  // Temporary totem creation
  readonly newTotemName = signal('');
  readonly isCreatingTotem = signal(false);
  readonly isStartingSession = signal(false);
  readonly isClosingSession = signal(false);
  readonly isReopeningSession = signal(false);
  readonly isArchivingSession = signal(false);
  readonly isCancellingSession = signal(false);

  readonly allTotems = signal<SessionTotemRef[]>([]);

  init(context: SessionActionsContext): void {
    this.context = context;
  }

  setTotems(totems: SessionTotemRef[]): void {
    this.allTotems.set(totems);
    this.syncAllTotems();
  }

  startSession(totemId: string): void {
    if (this.isStartingSession()) return;
    this.isStartingSession.set(true);

    this.tasService.startSession(totemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          this.decorateStartedSession(session, totemId);
          this.addSessionToList(session);
          this.context.selectSession(session);
          this.isStartingSession.set(false);
          this.notify.success(this.i18n.translate('tas.session_started'));
        },
        error: (err) => {
          this.isStartingSession.set(false);
          this.handleStartSessionError(err);
        },
      });
  }

  closeSession(sessionId: string): void {
    if (this.isClosingSession()) return;
    this.isClosingSession.set(true);

    this.tasService.closeSession(sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.markSessionComplete(sessionId, updated);
          this.isClosingSession.set(false);
          this.notify.success(this.i18n.translate('tas.session_closed'));
        },
        error: (err) => {
          this.isClosingSession.set(false);
          // Business-specific message kept on purpose: "already closed" is
          // clearer than the backend's localized SESSION_NOT_ACTIVE error.
          if (err.error?.errorCode === 'SESSION_NOT_ACTIVE') {
            this.notify.error(this.i18n.translate('tas.session_already_closed'));
          }
        },
      });
  }

  reopenSession(sessionId: string, totemId?: string): void {
    if (this.isReopeningSession()) return;
    this.isReopeningSession.set(true);

    this.tasService.reopenSession(sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          this.applyReopenedSession(session, totemId);
          this.isReopeningSession.set(false);
          this.notify.success(this.i18n.translate('tas.session_reopened'));
        },
        error: (err) => {
          this.isReopeningSession.set(false);
          // Business-specific fallback kept on purpose on top of the
          // interceptor message.
          this.notify.error(err.error?.message || this.i18n.translate('tas.session_reopen_error'));
        },
      });
  }

  archiveSession(sessionId: string): void {
    if (this.isArchivingSession()) return;
    this.confirmation.confirm(this.i18n.translate('tas.confirm_archive_session'), { destructive: true })
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmed => {
        if (confirmed) this.archiveSessionConfirmed(sessionId);
      });
  }

  private archiveSessionConfirmed(sessionId: string): void {
    if (this.isArchivingSession()) return;
    this.isArchivingSession.set(true);
    this.tasService.archiveSession(sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.isArchivingSession.set(false);
          this.removeSessionFromActiveView(sessionId, updated);
          this.notify.success(this.i18n.translate('tas.session_archived'));
        },
        error: () => this.isArchivingSession.set(false),
      });
  }

  cancelSession(sessionId: string): void {
    if (this.isCancellingSession()) return;
    this.confirmation.confirm(this.i18n.translate('tas.confirm_cancel_session') + '?', { destructive: true })
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmed => {
        if (confirmed) this.cancelSessionConfirmed(sessionId);
      });
  }

  private cancelSessionConfirmed(sessionId: string): void {
    if (this.isCancellingSession()) return;
    this.isCancellingSession.set(true);
    this.tasService.cancelSession(sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.isCancellingSession.set(false);
          this.removeSessionFromActiveView(sessionId, updated);
          this.notify.success(this.i18n.translate('tas.session_cancelled'));
        },
        error: () => this.isCancellingSession.set(false),
      });
  }

  createTemporaryTotem(): void {
    const name = this.newTotemName().trim();
    if (!name) return;

    this.isCreatingTotem.set(true);
    this.tasService.createTotem({
      totem_name: name,
      totem_type: 'TEMPORARY',
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (totem) => {
        this.allTotems.update(current => [...current, { ...totem, totem_type: 'TEMPORARY' }]);
        this.syncAllTotems();
        this.newTotemName.set('');
        this.isCreatingTotem.set(false);
        this.notify.success(this.i18n.translate('tas.totem_created'));

        // Auto-start session
        this.startSession(totem._id!);
      },
      error: () => this.isCreatingTotem.set(false),
    });
  }

  addCustomer(): void {
    const name = this.context.newCustomerName().trim();
    const session = this.getSelectedSession();
    if (!name || !session) return;

    this.tasService.createCustomer(session._id!, name)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (customer) => {
          this.addCustomerToWorkspace(customer);
          this.context.newCustomerName.set('');
          this.context.showAddCustomer.set(false);
          this.notify.success(this.i18n.translate('tas.customer_added'));
        },
        error: () => undefined,
      });
  }

  assignItemToCustomer(itemId: string, customerId: string | null): void {
    this.tasService.assignItemToCustomer(itemId, customerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.assignItemInWorkspace(itemId, customerId);
          this.notify.info(this.i18n.translate('tas.item_assigned'));
        },
        error: () => undefined,
      });
  }

  sendOrder(): void {
    const session = this.getSelectedSession();
    const pending = this.context.pendingItems();
    if (!session || pending.length === 0) return;

    this.context.isSendingOrder.set(true);
    const batchItems = pending.map(item => ({
      dishId: item.dish._id!,
      quantity: item.quantity,
      customerId: item.customerId || undefined,
      variantId: item.variantId || undefined,
      extras: item.extras,
    }));

    this.tasService.addBatchItems(session._id!, batchItems, this.context.isSessionClosed())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.applySentItems(result.items);
          this.context.pendingItems.set([]);
          this.context.isSendingOrder.set(false);
          this.context.showMenu.set(false);
          this.context.afterOrderSent?.();
          this.notify.success(this.orderSentMessage(result.items.length));
        },
        error: () => this.context.isSendingOrder.set(false),
      });
  }

  processPayment(): void {
    const session = this.getSelectedSession();
    const paymentType = this.context.paymentType();
    if (!session || !paymentType) return;

    this.context.isProcessingPayment.set(true);

    this.tasService.createPayment({
      session_id: session._id!,
      payment_type: paymentType,
      parts: paymentType === 'SHARED' ? this.context.splitCount() : 1,
    })
    .pipe(
      switchMap(() => this.tasService.archiveSession(session._id!)),
      takeUntil(this.destroy$)
    )
    .subscribe({
      next: (updated) => {
        this.context.isProcessingPayment.set(false);
        this.removeSessionFromActiveView(session._id!, updated);
        this.notify.success(this.i18n.translate('pos.payment.success'));
        this.context.closePaymentModal();
      },
      error: () => this.context.isProcessingPayment.set(false),
    });
  }

  markSessionComplete(sessionId: string, updated?: TotemSession): void {
    this.setSessionStateInLists(sessionId, 'COMPLETE', updated);
    const selected = this.getSelectedSession();
    if (selected?._id === sessionId) {
      this.setSelectedSession({ ...selected, ...updated, totem_state: 'COMPLETE' });
    }
  }

  markSessionStarted(sessionId: string): void {
    this.setSessionStateInLists(sessionId, 'STARTED');
    const selected = this.getSelectedSession();
    if (selected?._id === sessionId) {
      this.setSelectedSession({ ...selected, totem_state: 'STARTED' });
    }
  }

  removeSessionFromActiveView(sessionId: string, updated?: TotemSession): void {
    const session = this.findSession(sessionId) ?? updated;
    this.removeSessionFromLists(sessionId);
    this.leaveSocketSession(sessionId);
    this.removeTemporaryTotemIfAny(session?.totem_id?.toString());
  }

  /**
   * Remove a temporary totem from the sidebar after its session reaches a
   * terminal state. The backend already deletes it; this keeps the UI in sync.
   */
  private removeTemporaryTotemIfAny(totemId: string | undefined): void {
    this.allTotems.update(current => removeTemporaryTotem(current, totemId));
    this.syncAllTotems();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── State hooks (implemented per screen) ──────────────────────

  protected abstract getSessions(): TotemSession[];
  protected abstract addSessionToList(session: TotemSession): void;
  protected abstract replaceSessionInList(session: TotemSession): void;
  protected abstract setSessionStateInLists(
    sessionId: string,
    state: TotemSession['totem_state'],
    updated?: TotemSession
  ): void;
  protected abstract getSelectedSession(): TotemSession | null;
  protected abstract setSelectedSession(session: TotemSession | null): void;
  protected abstract removeSessionFromLists(sessionId: string): void;
  protected abstract leaveSocketSession(sessionId: string): void;
  protected abstract applyReopenedSession(session: TotemSession, totemId?: string): void;
  protected abstract addCustomerToWorkspace(customer: Customer): void;
  protected abstract assignItemInWorkspace(itemId: string, customerId: string | null): void;
  protected abstract applySentItems(items: ItemOrder[]): void;

  /** Sync the totem list into any external store (TAS only). */
  protected syncAllTotems(): void {}

  /** Attach extra data to a freshly started session (TAS only). */
  protected decorateStartedSession(_session: TotemSession, _totemId: string): void {}

  /** Extra error handling for a failed session start (TAS only). */
  protected handleStartSessionError(_err: { error?: { errorCode?: string } }): void {}

  /** Locate a session before removal; TAS also checks its per-totem list. */
  protected findSession(sessionId: string): TotemSession | undefined {
    return this.getSessions().find(candidate => candidate._id === sessionId);
  }

  /** Success message for a sent order; TAS appends the item count. */
  protected orderSentMessage(_itemCount: number): string {
    return this.i18n.translate('tas.order_sent');
  }
}
