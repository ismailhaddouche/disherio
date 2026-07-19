import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { TasService } from '../../core/services/tas.service';
import { SocketConnectionService } from '../../core/services/socket/socket-connection.service';
import { PosSocketService } from '../../core/services/socket/pos-socket.service';
import { cartStore } from '../../store/cart.store';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { getActiveItemTotal } from '../../shared/utils/order-item.utils';
import { OrderWorkspaceState } from '../../store/order-workspace.state';
import { PosTicketHistoryService } from './pos-ticket-history.service';
import { PosSessionActionsService } from './pos-session-actions.service';
import { PosSessionsSidebarComponent } from './pos-sessions-sidebar.component';
import { PosTicketHistoryPanelComponent } from './pos-ticket-history-panel.component';
import { PosSessionPanelComponent } from './pos-session-panel.component';
import { PosMenuPanelComponent } from './pos-menu-panel.component';
import { PosTicketPanelComponent } from './pos-ticket-panel.component';
import { PosDishModalComponent } from './pos-dish-modal.component';
import { PosPaymentModalComponent } from './pos-payment-modal.component';
import type {
  TotemSession,
  ItemOrder,
  Customer,
  Dish,
  LocalizedField,
  SessionArchivedEvent,
  SessionClosedEvent,
  SessionReopenedEvent,
} from '../../types';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [
    TranslatePipe,
    PosSessionsSidebarComponent,
    PosTicketHistoryPanelComponent,
    PosSessionPanelComponent,
    PosMenuPanelComponent,
    PosTicketPanelComponent,
    PosDishModalComponent,
    PosPaymentModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pos.component.html',
  providers: [PosTicketHistoryService, PosSessionActionsService],
})
export class PosComponent extends OrderWorkspaceState implements OnInit, OnDestroy {
  private tasService = inject(TasService);
  private connection = inject(SocketConnectionService);
  private posSocket = inject(PosSocketService);
  private i18n = inject(I18nService);
  private notify = inject(NotificationService);
  private ticketHistoryState = inject(PosTicketHistoryService);
  protected readonly sessionActions = inject(PosSessionActionsService);
  private destroy$ = new Subject<void>();
  private socketListenerDisposers: Array<() => void> = [];
  private connectionStatusInitialized = false;

  /** Workspace state passed down to the extracted presentational children. */
  readonly workspace: OrderWorkspaceState = this;

  // State
  isLoading = signal(false);
  isConnected = signal(false);
  sessions = signal<TotemSession[]>([]);
  selectedSession = signal<TotemSession | null>(null);
  sessionItems = signal<ItemOrder[]>([]);
  customers = signal<Customer[]>([]);
  showAddCustomer = signal(false);
  newCustomerName = signal('');

  // Menu data
  showMenu = signal(false);
  dishes = signal<Dish[]>([]);
  categories = signal<Array<{ _id: string; category_name: LocalizedField }>>([]);
  isSendingOrder = signal(false);

  // Ticket history state
  showTicketHistory = this.ticketHistoryState.isOpen;

  // Cart (from store, for manual POS items)
  cartItems = cartStore.items;
  subtotal = cartStore.subtotal;
  total = cartStore.total;

  activeSessions = computed(() =>
    this.sessions().filter(s => s.totem_state === 'STARTED')
  );

  closedSessions = computed(() =>
    this.sessions().filter(s => s.totem_state === 'COMPLETE')
  );

  isSessionClosed = computed(() => this.selectedSession()?.totem_state === 'COMPLETE');

  hasOpenSession = computed(() => this.activeSessions().length > 0);

  availableTotems = computed(() => {
    const activeTotemIds = new Set(
      this.activeSessions().map(s => s.totem_id?.toString())
    );
    return this.sessionActions.allTotems().filter(t => t.totem_type === 'STANDARD' && !activeTotemIds.has(t._id?.toString()));
  });

  sessionTotal = computed(() =>
    getActiveItemTotal(this.sessionItems())
  );

  constructor() {
    super();
    this.sessionActions.init({
      sessions: this.sessions,
      selectedSession: this.selectedSession,
      sessionItems: this.sessionItems,
      customers: this.customers,
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

  protected override canQueueDish(): boolean {
    return this.selectedSession() !== null;
  }

  protected override afterDishQueued(): void {
    this.selectedDish.set(null);
    this.notify.success(this.i18n.translate('totem.item_added_to_cart'));
  }

  ngOnInit() {
    this.connection.acquireConnection();
    this.loadData();
    this.setupSocketListeners();
    this.checkConnection();
    const connInterval = setInterval(() => this.checkConnection(), 2000);
    this.destroy$.subscribe(() => clearInterval(connInterval));
  }

  ngOnDestroy() {
    const selectedSessionId = this.selectedSession()?._id;
    if (selectedSessionId) this.posSocket.leaveSession(selectedSessionId);
    this.destroy$.next();
    this.destroy$.complete();
    this.disposeSocketListeners();
    this.connection.releaseConnection();
  }

  private listen<T>(event: string, callback: (data: T) => void): void {
    this.socketListenerDisposers.push(this.connection.on(event, callback));
  }

  private disposeSocketListeners(): void {
    this.socketListenerDisposers.forEach(dispose => dispose());
    this.socketListenerDisposers = [];
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

  private loadData() {
    this.isLoading.set(true);

    this.tasService.getActiveSessions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sessions) => {
          this.sessions.set(sessions);
          const selected = this.selectedSession();
          if (selected?._id) {
            const refreshed = sessions.find(session => session._id === selected._id);
            if (refreshed) {
              this.loadSessionDetails({ ...selected, ...refreshed });
            } else {
              this.selectedSession.set(null);
              this.sessionItems.set([]);
              this.customers.set([]);
            }
          }
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });

    // Refresh totems so terminal temporary tables disappear after reconnect.
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

    // Load dishes and categories
    this.tasService.getDishes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ dishes, categories }) => {
          this.dishes.set(dishes);
          this.categories.set(categories);
        },
        error: () => undefined,
      });

  }

  private setupSocketListeners() {
    this.listen('item:state_changed', (data: { itemId: string; newState: string }) => {
      this.sessionItems.update(items =>
        items.map(i => i._id === data.itemId ? { ...i, item_state: data.newState as ItemOrder['item_state'] } : i)
      );
    });

    this.listen('kds:new_item', (item: ItemOrder) => {
      if (item.session_id === this.selectedSession()?._id) {
        this.sessionItems.update(items => [...items, item]);
      }
    });

    this.listen('pos:session_closed', (data: SessionClosedEvent) => {
      const wasSelected = data.sessionId === this.selectedSession()?._id;
      if (data.state === 'CANCELLED') {
        this.sessionActions.removeSessionFromActiveView(data.sessionId);
        if (wasSelected && !this.sessionActions.isCancellingSession()) {
          this.notify.warning(this.i18n.translate('tas.session_cancelled'));
        }
      } else {
        this.sessionActions.markSessionComplete(data.sessionId);
        if (wasSelected && !this.sessionActions.isClosingSession()) {
          this.notify.warning(this.i18n.translate('tas.session_closed_by_pos'));
        }
      }
    });

    this.listen('pos:session_reopened', (data: SessionReopenedEvent) => {
      const wasSelected = data.sessionId === this.selectedSession()?._id;
      this.sessionActions.markSessionStarted(data.sessionId);
      if (wasSelected && !this.sessionActions.isReopeningSession()) {
        this.notify.info(this.i18n.translate('tas.session_reopened'));
      }
    });

    this.listen('pos:session_archived', (data: SessionArchivedEvent) => {
      const wasSelected = data.sessionId === this.selectedSession()?._id;
      this.sessionActions.removeSessionFromActiveView(data.sessionId);
      if (wasSelected && !this.sessionActions.isArchivingSession() && !this.isProcessingPayment()) {
        this.notify.success(this.i18n.translate('tas.session_archived'));
      }
    });

    // Listen for customer assignments
    this.listen('item:customer_assigned', ({ itemId, customerId }: { itemId: string; customerId: string | null }) => {
      this.sessionItems.update(items =>
        items.map(i => (i._id === itemId ? { ...i, customer_id: customerId || undefined } : i))
      );
    });

    this.listen('pos:item_canceled', ({ itemId }: { itemId: string }) => {
      this.sessionItems.update(items =>
        items.map(item => item._id === itemId ? { ...item, item_state: 'CANCELED' } : item)
      );
    });

    this.listen('pos:ticket_paid', ({ sessionId }: { sessionId: string }) => {
      const selected = this.selectedSession();
      if (selected?._id === sessionId) {
        this.loadSessionDetails(selected);
      }
    });

    this.listen('pos:bill_requested', ({ sessionId }: { sessionId: string }) => {
      this.sessionActions.markSessionComplete(sessionId);
    });
  }

  selectSession(session: TotemSession) {
    this.showTicketHistory.set(false);
    this.showMenu.set(false);
    this.selectedCustomerId.set(null);
    this.loadSessionDetails(session);
  }

  private loadSessionDetails(session: TotemSession): void {
    const sessionId = session._id!;
    this.selectedSession.set(session);
    this.sessionItems.set([]);
    this.customers.set([]);

    this.tasService.getSessionItems(sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          if (this.selectedSession()?._id === sessionId) this.sessionItems.set(items);
        },
        error: () => undefined,
      });

    // Load customers for this session
    this.tasService.getCustomers(sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (customers) => {
          if (this.selectedSession()?._id === sessionId) this.customers.set(customers);
        },
        error: () => undefined,
      });

    this.posSocket.joinSession(sessionId, 'POS');
  }

  openTicketHistory() {
    this.showMenu.set(false);
    this.selectedSession.set(null);
    this.sessionItems.set([]);
    this.customers.set([]);
    this.ticketHistoryState.open();
  }

  addCustomer() {
    const name = this.newCustomerName().trim();
    if (!name || !this.selectedSession()) return;

    this.tasService.createCustomer(this.selectedSession()!._id!, name)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (customer) => {
          this.customers.update(current => [...current, customer]);
          this.newCustomerName.set('');
          this.showAddCustomer.set(false);
          this.notify.success(this.i18n.translate('tas.customer_added'));
        },
        error: (err) => {
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  assignItemToCustomer(itemId: string, customerId: string | null) {
    this.tasService.assignItemToCustomer(itemId, customerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.sessionItems.update(items =>
            items.map(i => (i._id === itemId ? { ...i, customer_id: customerId || undefined } : i))
          );
          this.notify.info(this.i18n.translate('tas.item_assigned'));
        },
        error: (err) => {
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  assignItemFromSelect(itemId: string, event: Event): void {
    const customerId = (event.target as HTMLSelectElement | null)?.value || null;
    this.assignItemToCustomer(itemId, customerId);
  }

  sendOrder() {
    const session = this.selectedSession();
    if (!session || this.pendingItems().length === 0) return;

    this.isSendingOrder.set(true);
    const batchItems = this.pendingItems().map(item => ({
      dishId: item.dish._id!,
      quantity: item.quantity,
      customerId: item.customerId || undefined,
      variantId: item.variantId || undefined,
      extras: item.extras,
    }));

    this.tasService.addBatchItems(session._id!, batchItems, this.isSessionClosed())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.sessionItems.update(items => [...items, ...result.items]);
          this.pendingItems.set([]);
          this.isSendingOrder.set(false);
          this.showMenu.set(false);
          this.notify.success(this.i18n.translate('tas.order_sent'));
        },
        error: (err) => {
          this.isSendingOrder.set(false);
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  processPayment() {
    const session = this.selectedSession();
    if (!session || !this.paymentType()) return;

    this.isProcessingPayment.set(true);

    const paymentType = this.paymentType()!;
    const parts = paymentType === 'SHARED' ? this.splitCount() : 1;

    this.tasService.createPayment({
      session_id: session._id!,
      payment_type: paymentType,
      parts,
    })
    .pipe(
      switchMap(() => this.tasService.archiveSession(session._id!)),
      takeUntil(this.destroy$)
    )
    .subscribe({
      next: (updated) => {
        this.isProcessingPayment.set(false);
        this.sessionActions.removeSessionFromActiveView(session._id!, updated);
        this.notify.success(this.i18n.translate('pos.payment.success'));
        this.closePaymentModal();
      },
      error: (err) => {
        this.isProcessingPayment.set(false);
        this.notify.error(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
      },
    });
  }
}
