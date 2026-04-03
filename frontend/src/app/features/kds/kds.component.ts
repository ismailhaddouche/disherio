import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { kdsStore, type KdsItem } from '../../store/kds.store';
import { SocketService } from '../../services/socket/socket.service';
import { LocalizePipe } from '../../shared/pipes/localize.pipe';
import { environment } from '../../../environments/environment';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { NotificationService } from '../../core/services/notification.service';
import { I18nService } from '../../core/services/i18n.service';
import type { SocketError } from '../../types';

interface TableGroup {
  name: string;
  items: KdsItem[];
}

function groupByTable(items: KdsItem[]): TableGroup[] {
  const map = new Map<string, KdsItem[]>();
  for (const item of items) {
    const key = item.totem_name || '—';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries()).map(([name, its]) => ({ name, items: its }));
}

const SPINNER = `<svg class="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>`;

@Component({
  selector: 'app-kds',
  standalone: true,
  imports: [CommonModule, LocalizePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 p-3 gap-3">

      <!-- Header -->
      <header class="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl px-4 py-2.5 shadow-sm shrink-0">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-2xl text-primary">restaurant</span>
          <div>
            <h1 class="font-bold text-base text-gray-900 dark:text-white leading-tight">{{ 'kds.title' | translate }}</h1>
            <p class="text-xs text-gray-500">{{ ordered().length + onPrepare().length }} {{ 'kds.pending' | translate }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                [class.bg-green-100]="isConnected()" [class.text-green-700]="isConnected()"
                [class.bg-red-100]="!isConnected()" [class.text-red-700]="!isConnected()">
            <span class="w-1.5 h-1.5 rounded-full" [class.bg-green-500]="isConnected()" [class.bg-red-500]="!isConnected()"></span>
            {{ isConnected() ? ('kds.connected' | translate) : ('kds.disconnected' | translate) }}
          </span>
          <button (click)="loadItems()" [disabled]="loading()"
                  class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 disabled:opacity-40">
            <span class="material-symbols-outlined text-lg" [class.animate-spin]="loading()">refresh</span>
          </button>
        </div>
      </header>

      <!-- Two columns -->
      <div class="grid grid-cols-2 gap-3 flex-1 min-h-0">

        <!-- ── ORDERED ── -->
        <div class="flex flex-col min-h-0">
          <div class="flex items-center gap-2 mb-2 px-1 shrink-0">
            <span class="material-symbols-outlined text-base text-yellow-600">pending</span>
            <span class="font-bold text-sm text-yellow-700 dark:text-yellow-400">{{ 'kds.new_orders' | translate }}</span>
            <span class="ml-auto bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 text-xs font-bold px-2 py-0.5 rounded-full">
              {{ ordered().length }}
            </span>
          </div>

          <div class="flex-1 overflow-y-auto space-y-2 pr-1">
            @for (group of orderedByTable(); track group.name) {
              <div class="rounded-xl overflow-hidden shadow-sm border border-yellow-200 dark:border-yellow-900/40 bg-white dark:bg-gray-800">
                <!-- Mesa header -->
                <div class="flex items-center justify-between px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20">
                  <span class="flex items-center gap-1 font-bold text-xs text-yellow-800 dark:text-yellow-300">
                    <span class="material-symbols-outlined" style="font-size:14px">table_restaurant</span>
                    {{ group.name }}
                  </span>
                  <span class="text-xs text-yellow-600 dark:text-yellow-400">{{ group.items.length }}</span>
                </div>
                <!-- Items -->
                <div class="divide-y divide-gray-100 dark:divide-gray-700/60">
                  @for (item of group.items; track item._id) {
                    <div class="flex items-center gap-2 px-3 py-2" [class.opacity-50]="processingItem() === item._id">
                      <div class="flex-1 min-w-0">
                        <p class="font-semibold text-sm text-gray-900 dark:text-white truncate leading-tight">
                          {{ item.item_name_snapshot | localize }}
                        </p>
                        @if (item.item_disher_variant) {
                          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 leading-tight">{{ item.item_disher_variant.name }}</p>
                        }
                        <p class="text-xs text-gray-400 leading-tight mt-0.5 truncate">
                          @if (item.customer_name) {<span>{{ item.customer_name }} · </span>}{{ item.createdAt | date:'HH:mm' }}@if (item.item_disher_extras?.length) {<span> · +{{ item.item_disher_extras!.length }} {{ 'kds.extra' | translate }}</span>}
                        </p>
                      </div>
                      <div class="flex gap-1 shrink-0">
                        <button (click)="prepareItem(item._id!)"
                                [disabled]="processingItem() === item._id || !isConnected()"
                                class="flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-40 active:scale-95 transition-transform min-w-[60px]">
                          @if (processingItem() === item._id && processingAction() === 'prepare') {
                            <svg class="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                          } @else {
                            <span class="material-symbols-outlined" style="font-size:14px">play_arrow</span>
                            {{ 'kds.prepare' | translate }}
                          }
                        </button>
                        <button (click)="cancelItem(item._id!)"
                                [disabled]="processingItem() === item._id || !isConnected()"
                                class="flex items-center justify-center p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 disabled:opacity-40 active:scale-95 transition-transform">
                          @if (processingItem() === item._id && processingAction() === 'cancel') {
                            <svg class="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                          } @else {
                            <span class="material-symbols-outlined" style="font-size:16px">close</span>
                          }
                        </button>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
            @if (ordered().length === 0) {
              <div class="flex flex-col items-center justify-center py-16 text-gray-300 dark:text-gray-600">
                <span class="material-symbols-outlined text-5xl mb-2">check_circle</span>
                <p class="text-sm font-medium">{{ 'kds.no_new_orders' | translate }}</p>
              </div>
            }
          </div>
        </div>

        <!-- ── ON_PREPARE ── -->
        <div class="flex flex-col min-h-0">
          <div class="flex items-center gap-2 mb-2 px-1 shrink-0">
            <span class="material-symbols-outlined text-base text-blue-600">cooking</span>
            <span class="font-bold text-sm text-blue-700 dark:text-blue-400">{{ 'kds.in_preparation' | translate }}</span>
            <span class="ml-auto bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold px-2 py-0.5 rounded-full">
              {{ onPrepare().length }}
            </span>
          </div>

          <div class="flex-1 overflow-y-auto space-y-2 pr-1">
            @for (group of onPrepareByTable(); track group.name) {
              <div class="rounded-xl overflow-hidden shadow-sm border border-blue-200 dark:border-blue-900/40 bg-white dark:bg-gray-800">
                <!-- Mesa header -->
                <div class="flex items-center justify-between px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20">
                  <span class="flex items-center gap-1 font-bold text-xs text-blue-800 dark:text-blue-300">
                    <span class="material-symbols-outlined" style="font-size:14px">table_restaurant</span>
                    {{ group.name }}
                  </span>
                  <span class="text-xs text-blue-600 dark:text-blue-400">{{ group.items.length }}</span>
                </div>
                <!-- Items -->
                <div class="divide-y divide-gray-100 dark:divide-gray-700/60">
                  @for (item of group.items; track item._id) {
                    <div class="flex items-center gap-2 px-3 py-2" [class.opacity-50]="processingItem() === item._id">
                      <div class="flex-1 min-w-0">
                        <p class="font-semibold text-sm text-gray-900 dark:text-white truncate leading-tight">
                          {{ item.item_name_snapshot | localize }}
                        </p>
                        @if (item.item_disher_variant) {
                          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 leading-tight">{{ item.item_disher_variant.name }}</p>
                        }
                        <p class="text-xs text-gray-400 leading-tight mt-0.5 truncate">
                          @if (item.customer_name) {<span>{{ item.customer_name }} · </span>}{{ item.createdAt | date:'HH:mm' }}@if (item.item_disher_extras?.length) {<span> · +{{ item.item_disher_extras!.length }} {{ 'kds.extra' | translate }}</span>}
                        </p>
                      </div>
                      <button (click)="serveItem(item._id!)"
                              [disabled]="processingItem() === item._id || !isConnected()"
                              class="flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold disabled:opacity-40 active:scale-95 transition-transform min-w-[60px] shrink-0">
                        @if (processingItem() === item._id && processingAction() === 'serve') {
                          <svg class="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        } @else {
                          <span class="material-symbols-outlined" style="font-size:14px">done_all</span>
                          {{ 'kds.serve' | translate }}
                        }
                      </button>
                    </div>
                  }
                </div>
              </div>
            }
            @if (onPrepare().length === 0) {
              <div class="flex flex-col items-center justify-center py-16 text-gray-300 dark:text-gray-600">
                <span class="material-symbols-outlined text-5xl mb-2">soup_kitchen</span>
                <p class="text-sm font-medium">{{ 'kds.no_preparing' | translate }}</p>
              </div>
            }
          </div>
        </div>

      </div>
    </div>
  `,
})
export class KdsComponent implements OnInit, OnDestroy {
  private socketService = inject(SocketService);
  private http = inject(HttpClient);
  private notify = inject(NotificationService);
  private i18n = inject(I18nService);
  private destroy$ = new Subject<void>();

  ordered = kdsStore.ordered;
  onPrepare = kdsStore.onPrepare;

  orderedByTable = computed(() => groupByTable(this.ordered()));
  onPrepareByTable = computed(() => groupByTable(this.onPrepare()));

  processingItem = signal<string | null>(null);
  processingAction = signal<'prepare' | 'serve' | 'cancel' | null>(null);
  isConnected = signal(false);
  loading = signal(false);
  private activeTimeouts: ReturnType<typeof setTimeout>[] = [];

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
    this.socketService.releaseConnection();
    kdsStore.releaseReference();
    this.activeTimeouts.forEach(timeout => clearTimeout(timeout));
    this.activeTimeouts = [];
  }

  private checkConnection() {
    this.isConnected.set(this.socketService.isConnected());
  }

  loadItems() {
    this.loading.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/orders/kitchen`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          kdsStore.setItems(items);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('[KDS] Error loading kitchen items:', err);
          this.loading.set(false);
          this.notify.error(this.i18n.translate('kds.load_error'));
        },
      });
  }

  private setupSocketListeners() {
    this.socketService.on('kds:error', (error: SocketError) => {
      this.processingItem.set(null);
      this.processingAction.set(null);
      this.notify.error(error.message || error.details || this.i18n.translate('kds.error_generic'));
    });

    this.socketService.on('kds:item_prepared', (data: { itemId: string }) => {
      this.processingItem.set(null);
      this.processingAction.set(null);
      kdsStore.updateItemState(data.itemId, 'ON_PREPARE');
      this.notify.success(this.i18n.translate('kds.item_moved_to_preparing'));
    });

    this.socketService.on('kds:item_served', (data: { itemId: string }) => {
      this.processingItem.set(null);
      this.processingAction.set(null);
      kdsStore.updateItemState(data.itemId, 'SERVED');
      this.notify.success(this.i18n.translate('kds.item_served'));
    });

    this.socketService.on('kds:item_canceled', (data: { itemId: string }) => {
      this.processingItem.set(null);
      this.processingAction.set(null);
      kdsStore.updateItemState(data.itemId, 'CANCELED');
      this.notify.success(this.i18n.translate('kds.item_canceled'));
    });

    this.socketService.on('item:state_changed', (data: { itemId: string; newState: string }) => {
      kdsStore.updateItemState(data.itemId, data.newState as KdsItem['item_state']);
    });

    this.socketService.on('kds:new_item', (item: KdsItem) => {
      kdsStore.addItem(item);
      this.notify.info(this.i18n.translate('kds.new_item_received'));
    });

    this.socketService.on('item:deleted', (data: { itemId: string }) => {
      kdsStore.removeItem(data.itemId);
    });
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
    if (!confirm(this.i18n.translate('kds.confirm_cancel'))) return;
    this.processingItem.set(itemId);
    this.processingAction.set('cancel');
    this.emitWithTimeout(itemId, 'cancel');
    this.socketService.emit('kds:item_cancel', { itemId, reason: this.i18n.translate('kds.cancel_reason_kitchen') });
  }
}
