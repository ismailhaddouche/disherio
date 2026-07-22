import { Component, OnInit, OnDestroy, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { catchError, switchMap, takeUntil } from 'rxjs/operators';
import { ErrorCode } from '@disherio/shared/errors';
import { TasService } from '../../core/services/tas.service';
import { SocketConnectionService } from '../../core/services/socket/socket-connection.service';
import { TasSocketService } from '../../core/services/socket/tas-socket.service';
import { tasStore } from '../../store/tas.store';
import type {
  TotemSession,
  ItemOrder,
  Customer,
  Dish,
} from '../../types';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { getActiveItemTotal } from '../../shared/utils/order-item.utils';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { OrderWorkspaceState } from '../../store/order-workspace.state';
import { TasSocketCoordinator } from './tas-socket.coordinator';
import { TasSessionActionsService } from './tas-session-actions.service';
import { TasTablesSidebarComponent } from './tas-tables-sidebar.component';
import { TasSessionHeaderComponent } from './tas-session-header.component';
import { TasCustomersBarComponent } from './tas-customers-bar.component';
import { TasSessionItemsComponent } from './tas-session-items.component';
import { TasDishGridComponent } from './tas-dish-grid.component';
import { TasCartSidebarComponent } from './tas-cart-sidebar.component';
import { TasDishModalComponent } from './tas-dish-modal.component';
import { TasQrModalComponent } from './tas-qr-modal.component';
import { TasPaymentModalComponent } from './tas-payment-modal.component';

@Component({
  selector: 'app-tas',
  standalone: true,
  imports: [
    TranslatePipe,
    TasTablesSidebarComponent,
    TasSessionHeaderComponent,
    TasCustomersBarComponent,
    TasSessionItemsComponent,
    TasDishGridComponent,
    TasCartSidebarComponent,
    TasDishModalComponent,
    TasQrModalComponent,
    TasPaymentModalComponent,
  ],
  providers: [TasSocketCoordinator, TasSessionActionsService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tas.component.html',
})
export class TasComponent extends OrderWorkspaceState implements OnInit, OnDestroy {
  private tasService = inject(TasService);
  private connection = inject(SocketConnectionService);
  private tasSocket = inject(TasSocketService);
  protected i18n = inject(I18nService);
  private notify = inject(NotificationService);
  private confirmation = inject(ConfirmationService);
  private socketCoordinator = inject(TasSocketCoordinator);
  protected readonly sessionActions = inject(TasSessionActionsService);
  private destroy$ = new Subject<void>();
  private connectionStatusInitialized = false;

  /** Workspace state passed down to the extracted presentational children. */
  readonly workspace: OrderWorkspaceState = this;

  // Local state signals
  showAddCustomer = signal(false);
  newCustomerName = signal('');
  showMenu = signal(false);
  isSendingOrder = signal(false);

  // Layout signals
  tablesSidebarOpen = signal(true);
  cartSidebarOpen = signal(false);
  editingPendingIndex = signal<number | null>(null);
  showQrModal = signal(false);
  qrModalSession = signal<TotemSession | null>(null);

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

  // Computed - Use store computed for consistency
  activeSessions = tasStore.activeSessions;
  availableTotems = tasStore.availableTotems;
  hasOpenSession = computed(() => this.activeSessions().length > 0);

  sessionTotal = computed(() =>
    getActiveItemTotal(this.sessionItems())
  );

  constructor() {
    super();
    this.sessionActions.init({
      selectSession: session => this.selectSession(session),
    });
  }

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
    this.connection.acquireConnection();

    this.loadData();
    this.setupSocketListeners();
    this.checkConnection();
    const connInterval = setInterval(() => this.checkConnection(), 2000);
    this.destroy$.subscribe(() => clearInterval(connInterval));
  }

  private checkConnection() {
    const wasConnected = this.isConnected();
    const connected = this.connection.isConnected();
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
      this.tasSocket.leaveTasSession(this.selectedSession()!._id!);
    }

    // Release references (store auto-clears when count reaches 0)
    tasStore.releaseReference();
    this.connection.releaseConnection();
  }

  private loadData() {
    tasStore.setLoading(true);

    // Load active sessions
    this.tasService.getActiveSessions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sessions) => {
          tasStore.setSessions(sessions);
          this.sessionActions.refreshTotemSessions(sessions);
          const sessionsById = new Map(sessions.map(session => [session._id, session]));
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
          this.sessionActions.setTotems(validTotems);
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
      isCancellingSession: () => this.sessionActions.isCancellingSession(),
      isClosingSession: () => this.sessionActions.isClosingSession(),
      isReopeningSession: () => this.sessionActions.isReopeningSession(),
      isArchivingSession: () => this.sessionActions.isArchivingSession(),
      isProcessingPayment: () => this.isProcessingPayment(),
      markSessionComplete: sessionId => this.sessionActions.markSessionComplete(sessionId),
      markSessionStarted: sessionId => this.sessionActions.markSessionStarted(sessionId),
      removeSession: sessionId => this.sessionActions.removeSessionFromActiveView(sessionId),
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
    this.tasSocket.joinTasSession(sessionId);
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
        // If the payment was already persisted (e.g. archive failed after a
        // successful charge and the user retried), do not charge again:
        // treat ORDER_ALREADY_PAID as success and only redo the archive step.
        catchError((err) => {
          if (err.error?.errorCode === ErrorCode.ORDER_ALREADY_PAID) return of(null);
          return throwError(() => err);
        }),
        switchMap(() => this.tasService.archiveSession(session._id!)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (updated) => {
          this.isProcessingPayment.set(false);
          this.closePaymentModal();
          this.sessionActions.removeSessionFromActiveView(session._id!, updated);
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
    // Single channel: the socket handler persists the cancellation, notifies
    // KDS/customers/POS with the reason, and broadcasts tas:item_canceled
    // back to this room (the store updates from that event; the success
    // notification arrives via tas:item_canceled_confirm). The previous
    // additional HTTP DELETE raced the socket: whichever landed second failed
    // (CANCELED items cannot be deleted) and surfaced a bogus SERVER_ERROR
    // even though the cancellation had succeeded.
    this.tasSocket.tasCancelItem(itemId, 'Canceled by waiter');
  }

  markServiceItemServed(itemId: string) {
    // Use WebSocket for real-time update
    this.tasSocket.tasServeServiceItem(itemId);

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
}
