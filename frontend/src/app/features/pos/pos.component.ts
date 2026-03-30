import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TasService } from '../../services/tas.service';
import { SocketService } from '../../services/socket/socket.service';
import { cartStore } from '../../store/cart.store';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { CaslCanDirective } from '../../shared/directives/casl.directive';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { LocalizePipe } from '../../shared/pipes/localize.pipe';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import type { TotemSession, ItemOrder } from '../../types';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, CurrencyFormatPipe, CaslCanDirective, TranslatePipe, LocalizePipe],
  template: `
    <div class="h-screen flex bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white overflow-hidden">

      <!-- LEFT PANEL: Sessions & Totems -->
      <aside class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <header class="p-3 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <h2 class="font-bold flex items-center gap-1">
              <span class="material-symbols-outlined">table_restaurant</span>
              {{ 'pos.tables' | translate }}
            </h2>
            <span class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  [class.bg-green-100]="isConnected()"
                  [class.text-green-700]="isConnected()"
                  [class.bg-red-100]="!isConnected()"
                  [class.text-red-700]="!isConnected()">
              <span class="w-1.5 h-1.5 rounded-full" [class.bg-green-500]="isConnected()" [class.bg-red-500]="!isConnected()"></span>
              {{ isConnected() ? ('kds.connected' | translate) : ('kds.disconnected' | translate) }}
            </span>
          </div>
        </header>

        <div class="flex-1 overflow-auto flex flex-col">
          <!-- Active sessions -->
          <div class="p-3 flex-1">
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">{{ 'tas.active_sessions' | translate }}</p>
            @if (isLoading()) {
              <div class="text-sm text-gray-400 text-center py-4">...</div>
            } @else if (activeSessions().length === 0) {
              <p class="text-sm text-gray-500 dark:text-gray-400 text-center py-4">{{ 'pos.no_active_sessions' | translate }}</p>
            }
            @for (session of activeSessions(); track session._id) {
              <div
                (click)="selectSession(session)"
                class="p-2.5 rounded-lg border cursor-pointer transition-colors mb-1.5 text-sm"
                [class.border-primary]="selectedSession()?._id === session._id"
                [class.bg-primary-50]="selectedSession()?._id === session._id"
                [class.border-gray-200]="selectedSession()?._id !== session._id"
                [class.dark:border-gray-600]="selectedSession()?._id !== session._id"
                [class.bg-white]="selectedSession()?._id !== session._id"
                [class.dark:bg-gray-700]="selectedSession()?._id !== session._id"
              >
                <div class="flex items-center justify-between">
                  <span class="font-medium truncate">{{ session.totem?.totem_name || ('tas.table' | translate) }}</span>
                  <span class="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    {{ 'tas.active_sessions' | translate }}
                  </span>
                </div>
                <p class="text-xs text-gray-500 mt-0.5">
                  {{ getSessionItemCount(session._id!) }} items
                </p>
              </div>
            }
          </div>

          <!-- Available STANDARD totems (no active session) -->
          @if (availableTotems().length > 0) {
            <div class="p-3 border-t border-gray-200 dark:border-gray-700">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">{{ 'tas.available_tables' | translate }}</p>
              @for (totem of availableTotems(); track totem._id) {
                <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700 mb-1 text-sm">
                  <span class="truncate text-gray-900 dark:text-white">{{ totem.totem_name }}</span>
                  <button
                    (click)="startSession(totem._id)"
                    class="text-xs px-2 py-1 bg-green-500 text-white rounded ml-2 whitespace-nowrap"
                  >
                    {{ 'tas.session.open' | translate }}
                  </button>
                </div>
              }
            </div>
          }
        </div>
      </aside>

      <!-- CENTER PANEL: Session items -->
      <main class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header class="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <span class="material-symbols-outlined text-2xl">point_of_sale</span>
          <div>
            <h1 class="text-xl font-bold">
              @if (selectedSession()) {
                {{ selectedSession()!.totem?.totem_name || ('tas.table' | translate) }}
              } @else {
                {{ 'pos.title' | translate }}
              }
            </h1>
            @if (selectedSession()) {
              <p class="text-sm text-gray-500">{{ sessionItems().length }} items</p>
            }
          </div>
        </header>

        <div class="flex-1 overflow-auto p-4">
          @if (selectedSession()) {
            @if (sessionItems().length === 0) {
              <div class="flex flex-col items-center justify-center py-16 text-gray-400">
                <span class="material-symbols-outlined text-5xl mb-3">receipt_long</span>
                <p>{{ 'pos.empty_cart' | translate }}</p>
              </div>
            }
            @for (item of sessionItems(); track item._id) {
              @if (item.item_state !== 'CANCELED') {
                <div class="bg-white dark:bg-gray-800 rounded-lg p-3 mb-2 border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-sm truncate">{{ item.item_name_snapshot | localize }}</p>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span class="text-xs px-2 py-0.5 rounded-full"
                        [class.bg-yellow-100]="item.item_state === 'ORDERED'"
                        [class.text-yellow-700]="item.item_state === 'ORDERED'"
                        [class.bg-blue-100]="item.item_state === 'ON_PREPARE'"
                        [class.text-blue-700]="item.item_state === 'ON_PREPARE'"
                        [class.bg-green-100]="item.item_state === 'SERVED'"
                        [class.text-green-700]="item.item_state === 'SERVED'"
                      >
                        {{ item.item_state }}
                      </span>
                      @if (item.customer_name) {
                        <span class="text-xs text-gray-500">{{ item.customer_name }}</span>
                      }
                    </div>
                  </div>
                  <span class="font-bold text-sm ml-4">{{ getItemTotal(item) | currencyFormat }}</span>
                </div>
              }
            }
          } @else {
            <div class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
              <span class="material-symbols-outlined text-6xl mb-4">table_restaurant</span>
              <p class="text-lg">{{ 'pos.select_table' | translate }}</p>
            </div>
          }
        </div>
      </main>

      <!-- RIGHT PANEL: Ticket / Billing -->
      <aside class="w-72 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col p-4">
        <h2 class="font-bold text-lg flex items-center gap-1 mb-3">
          <span class="material-symbols-outlined">receipt_long</span> {{ 'pos.ticket' | translate }}
        </h2>
        <div class="flex-1 overflow-auto flex flex-col gap-2">
          @for (item of cartItems(); track item.dishId) {
            <div class="flex justify-between items-center text-sm">
              <span>{{ item.name }} x{{ item.quantity }}</span>
              <span>{{ (item.price * item.quantity) | currencyFormat }}</span>
            </div>
          }
          @if (!cartItems().length && selectedSession()) {
            <div class="text-sm text-gray-500 text-center mt-4">
              <p>{{ sessionTotal() | currencyFormat }}</p>
              <p class="text-xs mt-1">{{ sessionItems().length }} items activos</p>
            </div>
          }
          @if (!cartItems().length && !selectedSession()) {
            <p class="text-sm text-gray-500 text-center mt-4">{{ 'pos.empty_cart' | translate }}</p>
          }
        </div>
        <div class="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3 flex flex-col gap-1 text-sm">
          <div class="flex justify-between text-gray-600 dark:text-gray-400">
            <span>{{ 'pos.subtotal' | translate }}</span>
            <span>{{ (selectedSession() ? sessionTotal() : subtotal()) | currencyFormat }}</span>
          </div>
          <div class="flex justify-between font-bold text-base mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <span>{{ 'pos.total' | translate }}</span>
            <span>{{ (selectedSession() ? sessionTotal() : total()) | currencyFormat }}</span>
          </div>
          <button
            *caslCan="'create'; subject:'Payment'"
            [disabled]="!selectedSession()"
            class="mt-3 w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-lg py-2 font-bold active:scale-95 transition-transform flex items-center justify-center gap-1"
          >
            <span class="material-symbols-outlined">payments</span> {{ 'pos.charge' | translate }}
          </button>
        </div>
      </aside>
    </div>
  `,
})
export class PosComponent implements OnInit, OnDestroy {
  private tasService = inject(TasService);
  private socketService = inject(SocketService);
  private i18n = inject(I18nService);
  private notify = inject(NotificationService);
  private destroy$ = new Subject<void>();

  // State
  isLoading = signal(false);
  isConnected = signal(false);
  sessions = signal<TotemSession[]>([]);
  selectedSession = signal<TotemSession | null>(null);
  sessionItems = signal<ItemOrder[]>([]);
  allTotems = signal<Array<{ _id: string; totem_name: string; totem_type: string }>>([]);

  // Cart (from store, for manual POS items)
  cartItems = cartStore.items;
  subtotal = cartStore.subtotal;
  total = cartStore.total;

  activeSessions = computed(() =>
    this.sessions().filter(s => s.totem_state === 'STARTED')
  );

  availableTotems = computed(() => {
    const activeTotemIds = new Set(this.sessions().map(s => s.totem_id));
    return this.allTotems().filter(t => t.totem_type === 'STANDARD' && !activeTotemIds.has(t._id));
  });

  sessionTotal = computed(() =>
    this.sessionItems()
      .filter(i => i.item_state !== 'CANCELED')
      .reduce((sum, item) => sum + this.getItemTotal(item), 0)
  );

  ngOnInit() {
    this.loadData();
    this.setupSocketListeners();
    this.checkConnection();
    const connInterval = setInterval(() => this.checkConnection(), 2000);
    this.destroy$.subscribe(() => clearInterval(connInterval));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.socketService.releaseConnection();
  }

  private checkConnection() {
    this.isConnected.set(this.socketService.isConnected());
  }

  private loadData() {
    this.isLoading.set(true);

    this.tasService.getActiveSessions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sessions) => {
          this.sessions.set(sessions);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });

    this.tasService.getTotems()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (totems) => this.allTotems.set(totems),
        error: (err) => console.error('[POS] Error loading totems:', err),
      });

    this.socketService.acquireConnection();
  }

  private setupSocketListeners() {
    this.socketService.on('item:state_changed', (data: { itemId: string; newState: string }) => {
      this.sessionItems.update(items =>
        items.map(i => i._id === data.itemId ? { ...i, item_state: data.newState as ItemOrder['item_state'] } : i)
      );
    });

    this.socketService.on('kds:new_item', (item: any) => {
      if (item.session_id === this.selectedSession()?._id) {
        this.sessionItems.update(items => [...items, item]);
      }
    });

    this.socketService.on('pos:session_closed', (data: { sessionId: string }) => {
      if (data.sessionId === this.selectedSession()?._id) {
        this.selectedSession.set(null);
        this.sessionItems.set([]);
        this.notify.warning(this.i18n.translate('tas.session_closed_by_pos'));
      }
      this.sessions.update(s => s.filter(x => x._id !== data.sessionId));
    });
  }

  selectSession(session: TotemSession) {
    this.selectedSession.set(session);
    this.sessionItems.set([]);

    this.tasService.getSessionItems(session._id!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => this.sessionItems.set(items),
        error: (err) => console.error('[POS] Error loading session items:', err),
      });

    this.socketService.joinSession(session._id!);
  }

  startSession(totemId: string) {
    this.tasService.startSession(totemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          this.sessions.update(s => [...s, session]);
          this.selectSession(session);
          this.notify.success(this.i18n.translate('tas.session_started'));
        },
        error: (err) => {
          console.error('[POS] Error starting session:', err);
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  getSessionItemCount(sessionId: string): number {
    if (this.selectedSession()?._id === sessionId) {
      return this.sessionItems().filter(i => i.item_state !== 'CANCELED').length;
    }
    return 0;
  }

  getItemTotal(item: ItemOrder): number {
    const variantPrice = item.item_disher_variant?.price || 0;
    const extrasPrice = item.item_disher_extras.reduce((sum, e) => sum + e.price, 0);
    return item.item_base_price + variantPrice + extrasPrice;
  }
}
