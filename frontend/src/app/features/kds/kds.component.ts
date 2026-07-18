import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs';
import { kdsStore, type KdsItem } from '../../store/kds.store';
import { SocketService } from '../../services/socket/socket.service';
import { LocalizePipe } from '../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { NotificationService } from '../../core/services/notification.service';
import { I18nService } from '../../core/services/i18n.service';
import type { SocketError } from '../../types';
import { KdsService } from '../../services/kds.service';
import { DishService } from '../../services/dish.service';
import { ConfirmationService } from '../../core/services/confirmation.service';

interface OrderGroup {
  key: string;
  number: number | null;
  createdAt?: string;
  items: KdsItem[];
}

interface SessionGroup {
  sessionId: string;
  tableName: string;
  orders: OrderGroup[];
  itemCount: number;
  orderedCount: number;
  onPrepareCount: number;
  servedCount: number;
}

function groupBySessionAndOrder(items: KdsItem[]): SessionGroup[] {
  const sessionMap = new Map<string, Map<string, OrderGroup>>();

  for (const item of items) {
    const sessionId = item.session_id?.toString() || 'unknown';
    const orderKey = item.order_id || item.batch_id || item._id || 'unknown';
    const orderMap = sessionMap.get(sessionId) ?? new Map<string, OrderGroup>();
    const order: OrderGroup = orderMap.get(orderKey) ?? {
      key: orderKey,
      number: item.order_number ?? null,
      createdAt: item.order_date || item.createdAt,
      items: [],
    };

    order.items.push(item);
    order.number = order.number ?? item.order_number ?? null;
    order.createdAt = order.createdAt || item.order_date || item.createdAt;
    orderMap.set(orderKey, order);
    sessionMap.set(sessionId, orderMap);
  }

  return Array.from(sessionMap.entries()).map(([sessionId, orderMap]) => {
    const orders = Array.from(orderMap.values()).sort((a, b) => {
      if (a.number !== null && b.number !== null && a.number !== b.number) {
        return a.number - b.number;
      }
      return Date.parse(a.createdAt ?? '') - Date.parse(b.createdAt ?? '');
    });

    const allItems = orders.flatMap(o => o.items);
    const firstItem = allItems[0];

    return {
      sessionId,
      tableName: firstItem?.totem_name || '—',
      orders,
      itemCount: allItems.length,
      orderedCount: allItems.filter(i => i.item_state === 'ORDERED').length,
      onPrepareCount: allItems.filter(i => i.item_state === 'ON_PREPARE').length,
      servedCount: allItems.filter(i => i.item_state === 'SERVED').length,
    };
  });
}

@Component({
  selector: 'app-kds',
  standalone: true,
  imports: [CommonModule, LocalizePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kds.component.html',
})
export class KdsComponent implements OnInit, OnDestroy {
  private socketService = inject(SocketService);
  private kdsService = inject(KdsService);
  private dishService = inject(DishService);
  private confirmation = inject(ConfirmationService);
  private notify = inject(NotificationService);
  private i18n = inject(I18nService);
  private destroy$ = new Subject<void>();
  private socketListenerDisposers: Array<() => void> = [];

  ordered = kdsStore.ordered;
  onPrepare = kdsStore.onPrepare;
  served = kdsStore.served;

  processingItem = signal<string | null>(null);
  processingAction = signal<'prepare' | 'serve' | 'cancel' | null>(null);
  isConnected = signal(false);
  loading = signal(false);
  private activeTimeouts: ReturnType<typeof setTimeout>[] = [];

  // Stock control
  showStockPanel = signal(false);
  dishes = signal<DishListItem[]>([]);
  loadingDishes = signal(false);
  activeTab = signal<'ordered' | 'preparing' | 'served'>('ordered');

  // Collapse state — persisted across tab switches
  private collapsedSessions = signal<Set<string>>(new Set());
  private collapsedOrders = signal<Set<string>>(new Set());

  // Combined view: all active items grouped by session
  private allActiveItems = computed(() => {
    const tab = this.activeTab();
    if (tab === 'ordered') return this.ordered();
    if (tab === 'preparing') return this.onPrepare();
    return this.served();
  });

  sessionGroups = computed(() => groupBySessionAndOrder(this.allActiveItems()));

  // Combined active sessions (ordered + on_prepare) for the top overview
  activeSessionGroups = computed(() => {
    const combined = [...this.ordered(), ...this.onPrepare()];
    return groupBySessionAndOrder(combined);
  });

  ngOnInit() {
    kdsStore.acquireReference();
    this.socketService.acquireConnection();

    this.checkConnection();
    const connectionInterval = setInterval(() => this.checkConnection(), 2000);
    this.destroy$.subscribe(() => clearInterval(connectionInterval));

    this.setupSocketListeners();
    this.loadItems();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.disposeSocketListeners();
    this.socketService.releaseConnection();
    kdsStore.releaseReference();
    this.activeTimeouts.forEach(timeout => clearTimeout(timeout));
    this.activeTimeouts = [];
  }

  private listen<T>(event: string, callback: (data: T) => void): void {
    this.socketListenerDisposers.push(this.socketService.on(event, callback));
  }

  private disposeSocketListeners(): void {
    this.socketListenerDisposers.forEach(dispose => dispose());
    this.socketListenerDisposers = [];
  }

  private checkConnection() {
    this.isConnected.set(this.socketService.isConnected());
  }

  loadItems() {
    this.loading.set(true);
    this.kdsService.getKitchenItems()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          kdsStore.setItems(items);
          this.joinItemSessions(items);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.notify.error(this.i18n.translate('kds.load_error'));
        },
      });
  }

  private setupSocketListeners() {
    this.socketService.kdsNewItem$
      .pipe(takeUntil(this.destroy$))
      .subscribe(item => {
        const sessionId = item['session_id']?.toString();
        if (sessionId) this.socketService.joinKdsSession(sessionId);
        this.notify.info(this.i18n.translate('kds.new_item_received'));
      });

    this.listen('kds:error', (error: SocketError) => {
      this.processingItem.set(null);
      this.processingAction.set(null);
      this.notify.error(error.message || error.details || this.i18n.translate('kds.error_generic'));
    });

    this.listen('kds:item_prepared', (data: { itemId: string }) => {
      this.processingItem.set(null);
      this.processingAction.set(null);
      kdsStore.updateItemState(data.itemId, 'ON_PREPARE');
      this.notify.success(this.i18n.translate('kds.item_moved_to_preparing'));
    });

    this.listen('kds:item_served', (data: { itemId: string }) => {
      this.processingItem.set(null);
      this.processingAction.set(null);
      kdsStore.updateItemState(data.itemId, 'SERVED');
      this.notify.success(this.i18n.translate('kds.item_served'));
    });

    this.listen('kds:item_canceled', (data: { itemId: string }) => {
      this.processingItem.set(null);
      this.processingAction.set(null);
      kdsStore.updateItemState(data.itemId, 'CANCELED');
      this.notify.success(this.i18n.translate('kds.item_canceled'));
    });

    this.listen('item:state_changed', (data: { itemId: string; newState: string }) => {
      kdsStore.updateItemState(data.itemId, data.newState as KdsItem['item_state']);
    });

    this.listen('item:deleted', (data: { itemId: string }) => {
      kdsStore.removeItem(data.itemId);
    });
  }

  private joinItemSessions(items: KdsItem[]) {
    const sessionIds = new Set(
      items
        .map(item => item.session_id?.toString())
        .filter((sessionId): sessionId is string => !!sessionId)
    );

    sessionIds.forEach(sessionId => this.socketService.joinKdsSession(sessionId));
  }

  private emitWithTimeout(itemId: string, action: 'prepare' | 'serve' | 'cancel') {
    const timeout = setTimeout(() => {
      if (this.processingItem() === itemId) {
        this.processingItem.set(null);
        this.processingAction.set(null);
        this.loadItems();
      }
      const index = this.activeTimeouts.indexOf(timeout);
      if (index > -1) {
        this.activeTimeouts.splice(index, 1);
      }
    }, 5000);
    this.activeTimeouts.push(timeout);
  }

  prepareItem(itemId: string) {
    if (!this.isConnected()) { this.notify.error(this.i18n.translate('kds.not_connected')); return; }
    this.processingItem.set(itemId);
    this.processingAction.set('prepare');
    this.emitWithTimeout(itemId, 'prepare');
    this.socketService.emit('kds:item_prepare', { itemId });
  }

  serveItem(itemId: string) {
    if (!this.isConnected()) { this.notify.error(this.i18n.translate('kds.not_connected')); return; }
    this.processingItem.set(itemId);
    this.processingAction.set('serve');
    this.emitWithTimeout(itemId, 'serve');
    this.socketService.emit('kds:item_serve', { itemId });
  }

  cancelItem(itemId: string) {
    if (!this.isConnected()) { this.notify.error(this.i18n.translate('kds.not_connected')); return; }
    this.confirmation.confirm(this.i18n.translate('kds.confirm_cancel'), { destructive: true })
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmed => {
        if (confirmed) this.cancelItemConfirmed(itemId);
      });
  }

  private cancelItemConfirmed(itemId: string): void {
    if (!this.isConnected() || this.processingItem()) return;
    this.processingItem.set(itemId);
    this.processingAction.set('cancel');
    this.emitWithTimeout(itemId, 'cancel');
    this.socketService.emit('kds:item_cancel', { itemId, reason: this.i18n.translate('kds.cancel_reason_kitchen') });
  }

  loadDishes() {
    this.loadingDishes.set(true);
    this.dishService.list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resp) => {
          this.dishes.set(resp.data as DishListItem[]);
          this.loadingDishes.set(false);
        },
        error: () => {
          this.loadingDishes.set(false);
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  toggleDishStatus(dish: DishListItem) {
    this.dishService.toggleStatus(dish._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.dishes.update(items =>
            items.map(d => d._id === dish._id
              ? { ...d, disher_status: d.disher_status === 'ACTIVATED' ? 'DESACTIVATED' : 'ACTIVATED' }
              : d
            )
          );
          this.notify.success(
            dish.disher_status === 'ACTIVATED'
              ? this.i18n.translate('kds.dish_disabled')
              : this.i18n.translate('kds.dish_enabled')
          );
        },
        error: () => {
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  toggleStockPanel() {
    this.showStockPanel.update(v => !v);
    if (this.showStockPanel() && this.dishes().length === 0) {
      this.loadDishes();
    }
  }

  // ── Collapse helpers ──────────────────────────────────────────

  isSessionCollapsed(sessionId: string): boolean {
    return this.collapsedSessions().has(sessionId);
  }

  toggleSession(sessionId: string): void {
    this.collapsedSessions.update(set => {
      const next = new Set(set);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }

  isOrderCollapsed(orderKey: string): boolean {
    return this.collapsedOrders().has(orderKey);
  }

  toggleOrder(orderKey: string): void {
    this.collapsedOrders.update(set => {
      const next = new Set(set);
      if (next.has(orderKey)) next.delete(orderKey);
      else next.add(orderKey);
      return next;
    });
  }
}

interface DishListItem {
  _id: string;
  disher_name: { lang: string; value: string }[];
  disher_status: 'ACTIVATED' | 'DESACTIVATED';
  disher_price: number;
  disher_type: 'KITCHEN' | 'SERVICE';
}
