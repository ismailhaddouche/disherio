import { Component, OnInit, OnDestroy, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { TasService } from '../../services/tas.service';
import { SocketService } from '../../services/socket/socket.service';
import { tasStore } from '../../store/tas.store';
import type {
  TotemSession,
  ItemOrder,
  Customer,
  Dish,
} from '../../types';
import { LocalizePipe } from '../../shared/pipes/localize.pipe';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { QrCodeComponent } from '../../shared/components/qr-code.component';
import { getActiveItemTotal, getSessionListItemCount } from '../../shared/utils/order-item.utils';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { OrderWorkspaceState } from '../../shared/state/order-workspace.state';
import {
  removeOperationalSession,
  removeTemporaryTotem,
  replaceOperationalSession,
  setOperationalSessionState,
} from '../../shared/utils/operational-session.utils';
import { TasSocketCoordinator } from './tas-socket.coordinator';

@Component({
  selector: 'app-tas',
  standalone: true,
  imports: [CommonModule, FormsModule, A11yModule, LocalizePipe, CurrencyFormatPipe, TranslatePipe, QrCodeComponent],
  providers: [TasSocketCoordinator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tas.component.html',
})
export class TasComponent extends OrderWorkspaceState implements OnInit, OnDestroy {
  private tasService = inject(TasService);
  private socketService = inject(SocketService);
  protected i18n = inject(I18nService);
  private notify = inject(NotificationService);
  private confirmation = inject(ConfirmationService);
  private socketCoordinator = inject(TasSocketCoordinator);
  private destroy$ = new Subject<void>();
  private connectionStatusInitialized = false;

  // Local state signals
  newTotemName = signal('');
  isCreatingTotem = signal(false);
  showAddCustomer = signal(false);
  newCustomerName = signal('');
  showMenu = signal(false);
  isSendingOrder = signal(false);

  // Layout signals
  tablesSidebarOpen = signal(true);
  cartSidebarOpen = signal(false);
  editingPendingIndex = signal<number | null>(null);
  showQrModal = signal(false);
  isStartingSession = signal(false);
  isClosingSession = signal(false);
  isReopeningSession = signal(false);
  isArchivingSession = signal(false);
  isCancellingSession = signal(false);
  qrModalSession = signal<TotemSession | null>(null);

  // Totem sessions: all sessions for selected totem (STARTED + COMPLETE, not PAID)
  totemSessions = signal<TotemSession[]>([]);
  selectedTotemId = signal<string | null>(null);
  isSessionClosed = computed(() => {
    const s = this.selectedSession();
    return s?.totem_state === 'COMPLETE';
  });

  isConnected = signal(false);

  // Store signals
  sessions = tasStore.sessions;
  selectedSession = tasStore.selectedSession;
  sessionItems = tasStore.sessionItems;
  customers = tasStore.customers;
  dishes = tasStore.dishes;
  categories = tasStore.categories;
  isLoading = tasStore.isLoading;

  // Local state for all totems (synced with store)
  allTotems = signal<Array<{ _id: string; totem_name: string; totem_type: string }>>([]);

  // Computed - Use store computed for consistency
  activeSessions = tasStore.activeSessions;
  availableTotems = tasStore.availableTotems;
  hasOpenSession = computed(() => this.activeSessions().length > 0);

  kitchenItems = computed(() =>
    this.sessionItems().filter(i => i.item_disher_type === 'KITCHEN')
  );

  serviceItemsSession = computed(() =>
    this.sessionItems().filter(i => i.item_disher_type === 'SERVICE')
  );

  sessionTotal = computed(() =>
    getActiveItemTotal(this.sessionItems())
  );

  protected override getWorkspaceItems(): ItemOrder[] {
    return this.sessionItems();
  }

  protected override getWorkspaceCustomers(): Customer[] {
    return this.customers();
  }

  protected override getWorkspaceDishes(): Dish[] {
    return this.dishes();
  }

  protected override getWorkspaceTotal(): number {
    return this.sessionTotal();
  }

  protected override getFallbackCustomerName(part: number): string {
    return `${this.i18n.translate('logs.customer_label')} ${part}`;
  }

  ngOnInit() {
    // Acquire store reference (auto-clears on destroy for memory optimization)
    tasStore.acquireReference();
    this.socketService.acquireConnection();

    this.loadData();
    this.setupSocketListeners();
    this.checkConnection();
    const connInterval = setInterval(() => this.checkConnection(), 2000);
    this.destroy$.subscribe(() => clearInterval(connInterval));
  }

  private checkConnection() {
    const wasConnected = this.isConnected();
    const connected = this.socketService.isConnected();
    this.isConnected.set(connected);
    if (this.connectionStatusInitialized && !wasConnected && connected) {
      this.loadData();
    }
    this.connectionStatusInitialized = true;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();

    this.socketCoordinator.dispose();

    // Leave TAS session if active
    if (this.selectedSession()?._id) {
      this.socketService.leaveTasSession(this.selectedSession()!._id!);
    }

    // Release references (store auto-clears when count reaches 0)
    tasStore.releaseReference();
    this.socketService.releaseConnection();
  }

  private loadData() {
    tasStore.setLoading(true);

    // Load active sessions
    this.tasService.getActiveSessions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sessions) => {
          tasStore.setSessions(sessions);
          const sessionsById = new Map(sessions.map(session => [session._id, session]));
          this.totemSessions.update(current => current
            .filter(session => sessionsById.has(session._id))
            .map(session => {
              const refreshed = sessionsById.get(session._id);
              return refreshed ? { ...session, ...refreshed } : session;
            }));
          const selected = this.selectedSession();
          if (selected?._id) {
            const refreshed = sessionsById.get(selected._id);
            if (refreshed) {
              this.selectSession({ ...selected, ...refreshed });
            } else {
              tasStore.selectSession(null);
              tasStore.setSessionItems([]);
              tasStore.setCustomers([]);
            }
          }
          tasStore.setLoading(false);
        },
        error: () => tasStore.setLoading(false),
      });

    // Load all totems
    this.tasService.getTotems()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (totems) => {
          const validTotems = totems
            .filter((t): t is typeof t & { _id: string } => !!t._id)
            .map(t => ({ _id: t._id, totem_name: t.totem_name, totem_type: t.totem_type }));
          this.allTotems.set(validTotems);
          tasStore.setAllTotems(validTotems);
        },
        error: () => undefined,
      });

    // Load dishes
    this.tasService.getDishes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ dishes, categories }) => {
          tasStore.setDishes(dishes, categories);
        },
        error: () => undefined,
      });

  }

  private setupSocketListeners(): void {
    this.socketCoordinator.register({
      selectedSessionId: () => this.selectedSession()?._id,
      isCancellingSession: () => this.isCancellingSession(),
      isClosingSession: () => this.isClosingSession(),
      isReopeningSession: () => this.isReopeningSession(),
      isArchivingSession: () => this.isArchivingSession(),
      isProcessingPayment: () => this.isProcessingPayment(),
      markSessionComplete: sessionId => this.markSessionComplete(sessionId),
      markSessionStarted: sessionId => this.markSessionStarted(sessionId),
      removeSession: sessionId => this.removeSessionFromActiveView(sessionId),
    });
  }

  selectSession(session: TotemSession) {
    const sessionId = session._id!;
    tasStore.selectSession(session);

    // Load session items
    this.tasService.getSessionItems(sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          if (this.selectedSession()?._id === sessionId) tasStore.setSessionItems(items);
        },
        error: () => undefined,
      });

    // Load customers for this session
    this.tasService.getCustomers(sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (customers) => {
          if (this.selectedSession()?._id === sessionId) tasStore.setCustomers(customers);
        },
        error: () => undefined,
      });

    // Join socket rooms
    this.socketService.joinTasSession(sessionId);
  }

  loadTotemSessions(totemId: string) {
    this.selectedTotemId.set(totemId);
    this.tasService.getTotemSessions(totemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sessions) => {
          // Filter out PAID and CANCELLED sessions — those are archived
          this.totemSessions.set(sessions.filter(s => s.totem_state !== 'PAID' && s.totem_state !== 'CANCELLED'));
        },
        error: () => undefined,
      });
  }

  createTemporaryTotem() {
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
        tasStore.setAllTotems([...this.allTotems()]);
        this.newTotemName.set('');
        this.isCreatingTotem.set(false);
        this.notify.success(this.i18n.translate('tas.totem_created'));

        // Auto-start session
        this.startSession(totem._id!);
      },
      error: (err) => {
        this.isCreatingTotem.set(false);
        this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
      },
    });
  }

  startSession(totemId: string) {
    if (this.isStartingSession()) return;
    this.isStartingSession.set(true);

    this.tasService.startSession(totemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          // Attach totem info so the name displays immediately (backend may not populate it)
          const totem = this.allTotems().find(t => t._id === totemId);
          if (totem && !session.totem) {
            session.totem = {
              _id: totem._id,
              restaurant_id: '',
              totem_name: totem.totem_name,
              totem_qr: '',
              totem_type: totem.totem_type as 'STANDARD' | 'TEMPORARY',
            };
          }
          tasStore.setSessions([...this.sessions(), session]);
          this.selectSession(session);
          this.isStartingSession.set(false);
          this.notify.success(this.i18n.translate('tas.session_started'));
        },
        error: (err) => {
          this.isStartingSession.set(false);
          const code = err.error?.errorCode;
          if (code === 'SESSION_NOT_ACTIVE') {
            this.notify.error(this.i18n.translate('tas.session_already_closed'));
          } else {
            this.notify.error(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
          }
        },
      });
  }

  closeTemporaryTotem(totemId: string) {
    this.confirmation.confirm(this.i18n.translate('tas.close_temp_table') + '?', { destructive: true })
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmed => {
        if (confirmed) this.closeTemporaryTotemConfirmed(totemId);
      });
  }

  private closeTemporaryTotemConfirmed(totemId: string): void {
    this.tasService.deleteTotem(totemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Remove from sessions if active
          tasStore.setSessions(this.sessions().filter(s => s.totem_id !== totemId));
          this.allTotems.update(current => current.filter(t => t._id !== totemId));
          tasStore.setAllTotems([...this.allTotems()]);

          if (this.selectedSession()?.totem_id === totemId) {
            tasStore.selectSession(null);
          }
          this.notify.success(this.i18n.translate('tas.totem_closed'));
        },
        error: (err) => {
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  addCustomer() {
    const name = this.newCustomerName().trim();
    if (!name || !this.selectedSession()) return;

    this.tasService.createCustomer(this.selectedSession()!._id!, name)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (customer) => {
          tasStore.addCustomer(customer);
          this.newCustomerName.set('');
          this.showAddCustomer.set(false);
          this.notify.success(this.i18n.translate('tas.customer_added'));
        },
        error: (err) => {
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  toggleTablesSidebar() {
    this.tablesSidebarOpen.update(v => !v);
  }

  toggleCartSidebar() {
    this.cartSidebarOpen.update(v => !v);
  }

  openQrModal(session: TotemSession) {
    this.qrModalSession.set(session);
    this.showQrModal.set(true);
  }

  closeQrModal() {
    this.showQrModal.set(false);
    this.qrModalSession.set(null);
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    this.notify.info(this.i18n.translate('common.copied'));
  }

  getQrUrl(qr: string): string {
    return `${window.location.origin}/menu/${qr}`;
  }

  /**
   * Remove a temporary totem from the sidebar after its session reaches a
   * terminal state (PAID or CANCELLED). The backend already deletes it; this
   * keeps the UI in sync without a full reload.
   */
  private removeTemporaryTotemIfAny(totemId: string | undefined): void {
    this.allTotems.update(current => removeTemporaryTotem(current, totemId));
    tasStore.setAllTotems([...this.allTotems()]);
  }

  private markSessionComplete(sessionId: string, updated?: TotemSession): void {
    tasStore.setSessions(setOperationalSessionState(this.sessions(), sessionId, 'COMPLETE', updated));
    this.totemSessions.update(sessions => setOperationalSessionState(
      sessions,
      sessionId,
      'COMPLETE',
      updated
    ));
    const selected = this.selectedSession();
    if (selected?._id === sessionId) {
      tasStore.selectSession({ ...selected, ...updated, totem_state: 'COMPLETE' });
    }
  }

  private markSessionStarted(sessionId: string): void {
    tasStore.setSessions(setOperationalSessionState(this.sessions(), sessionId, 'STARTED'));
    this.totemSessions.update(sessions => setOperationalSessionState(sessions, sessionId, 'STARTED'));
    const selected = this.selectedSession();
    if (selected?._id === sessionId) {
      tasStore.selectSession({ ...selected, totem_state: 'STARTED' });
    }
  }

  private removeSessionFromActiveView(sessionId: string, updated?: TotemSession): void {
    const session = this.sessions().find(candidate => candidate._id === sessionId)
      ?? this.totemSessions().find(candidate => candidate._id === sessionId)
      ?? updated;
    tasStore.removeSession(sessionId);
    this.totemSessions.update(sessions => removeOperationalSession(sessions, sessionId));
    this.socketService.leaveTasSession(sessionId);
    this.removeTemporaryTotemIfAny(session?.totem_id?.toString());
  }

  closeSession(sessionId: string) {
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
          const code = err.error?.errorCode;
          if (code === 'SESSION_NOT_ACTIVE') {
            this.notify.error(this.i18n.translate('tas.session_already_closed'));
          } else {
            this.notify.error(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
          }
        },
      });
  }

  reopenSession(sessionId: string, totemId: string) {
    if (this.isReopeningSession()) return;
    this.isReopeningSession.set(true);

    this.tasService.reopenSession(sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          const totem = this.allTotems().find(t => t._id === totemId);
          if (totem && !session.totem) {
            session.totem = {
              _id: totem._id, restaurant_id: '', totem_name: totem.totem_name, totem_qr: '', totem_type: totem.totem_type as 'STANDARD' | 'TEMPORARY',
            };
          }
          // Replace any existing session with the same id, or add the reopened one.
          tasStore.setSessions(replaceOperationalSession(this.sessions(), session));
          this.selectSession(session);
          this.isReopeningSession.set(false);
          this.notify.success(this.i18n.translate('tas.session_reopened'));
        },
        error: (err) => {
          this.isReopeningSession.set(false);
          this.notify.error(err.error?.message || this.i18n.translate('tas.session_reopen_error'));
        },
      });
  }

  archiveSession(sessionId: string) {
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
        error: (err) => {
          this.isArchivingSession.set(false);
          this.notify.error(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  cancelSession(sessionId: string) {
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
        error: (err) => {
          this.isCancellingSession.set(false);
          this.notify.error(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  processPayment() {
    const session = this.selectedSession();
    if (!session || !this.paymentType()) return;

    this.isProcessingPayment.set(true);
    const paymentType = this.paymentType()!;

    this.tasService.createPayment({
      session_id: session._id!,
      payment_type: paymentType,
      parts: paymentType === 'SHARED' ? this.splitCount() : 1,
    })
      .pipe(
        switchMap(() => this.tasService.archiveSession(session._id!)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (updated) => {
          this.isProcessingPayment.set(false);
          this.closePaymentModal();
          this.removeSessionFromActiveView(session._id!, updated);
          this.notify.success(this.i18n.translate('pos.payment.success'));
        },
        error: (err) => {
          this.isProcessingPayment.set(false);
          this.notify.error(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  sendOrder() {
    const session = this.selectedSession();
    if (!session || this.pendingItems().length === 0) return;

    this.isSendingOrder.set(true);

    const batchItems = this.pendingItems().map(p => ({
      dishId: p.dish._id!,
      quantity: p.quantity,
      customerId: p.customerId || undefined,
      variantId: p.variantId || undefined,
      extras: p.extras,
    }));

    const asServed = this.isSessionClosed();

    this.tasService.addBatchItems(session._id!, batchItems, asServed)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          // Add all items to store — backend already notifies KDS/TAS/POS
          // via socket from addBatchItems(), so we do NOT emit tasAddItem here
          for (const item of result.items) {
            tasStore.addItem(item);
          }

          this.pendingItems.set([]);
          this.isSendingOrder.set(false);
          this.showMenu.set(false);
          this.selectedDish.set(null);
          this.notify.success(
            this.i18n.translate('tas.order_sent') + ` (${result.items.length} ${this.i18n.translate('common.items')})`
          );
        },
        error: (err) => {
          this.isSendingOrder.set(false);
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  deleteItem(itemId: string) {
    this.confirmation.confirm(this.i18n.translate('common.delete') + '?', { destructive: true })
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmed => {
        if (confirmed) this.deleteItemConfirmed(itemId);
      });
  }

  private deleteItemConfirmed(itemId: string): void {
    // Use WebSocket to cancel item (emits to all connected clients)
    this.socketService.tasCancelItem(itemId, 'Canceled by waiter');

    // Optimistically update UI
    tasStore.updateItemState(itemId, 'CANCELED');

    // Also persist via HTTP
    this.tasService.deleteItem(itemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notify.info(this.i18n.translate('tas.item_deleted'));
        },
        error: (err) => {
          // Revert on error - reload session items from server
          this.tasService.getSessionItems(this.selectedSession()!._id!)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (items) => tasStore.loadSessionItems(items),
              error: () => this.notify.error(this.i18n.translate('errors.SERVER_ERROR')),
            });
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  markServiceItemServed(itemId: string) {
    // Use WebSocket for real-time update
    this.socketService.tasServeServiceItem(itemId);

    // Optimistically update UI
    tasStore.updateItemState(itemId, 'SERVED');

    // The confirmation will come via WebSocket (tas:item_served_confirm)
  }

  assignItemToCustomer(itemId: string, customerId: string | null) {
    this.tasService.assignItemToCustomer(itemId, customerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          tasStore.assignItemToCustomer(itemId, customerId);
          this.notify.info(this.i18n.translate('tas.item_assigned'));
        },
        error: (err) => {
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  getStateLabel(state: ItemOrder['item_state']): string {
    const keyMap: Record<string, string> = {
      ORDERED: 'tas.state.ordered',
      ON_PREPARE: 'tas.state.on_prepare',
      SERVED: 'tas.state.served',
      CANCELED: 'tas.state.canceled',
    };
    return keyMap[state] ? this.i18n.translate(keyMap[state]) : state;
  }

  formatOrderLimit(session: TotemSession): string {
    const status = session.order_limit_status;
    if (!status) return '0';
    const liveLimitedOrders = new Set(
      this.sessionItems()
        .filter(item => item.item_state !== 'CANCELED' && !item.unlimited_order_item)
        .map(item => item.order_id)
    ).size;
    const count = Math.max(status.limited_order_count, liveLimitedOrders);
    if (status.max_orders_per_session > 0) {
      return `${count}/${status.max_orders_per_session}`;
    }
    return `${count}`;
  }

  getSessionItemCount(session: TotemSession): number {
    return getSessionListItemCount(session, this.selectedSession()?._id, this.sessionItems());
  }

  getSessionTotal(session: TotemSession): number {
    return this.selectedSession()?._id === session._id
      ? getActiveItemTotal(this.sessionItems())
      : 0;
  }

  protected readonly Math = Math;
}
