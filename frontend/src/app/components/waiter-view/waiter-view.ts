import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { CommunicationService } from '../../services/communication.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { filter, Subscription, firstValueFrom } from 'rxjs';
import { NotifyService } from '../../services/notify.service';

interface TotemWithStatus {
  id: number;
  name: string;
  active: boolean;
  isVirtual?: boolean;
  currentSessionId?: string;
  order?: any; // Active order for this table if any
}

@Component({
  selector: 'app-waiter-view',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, TranslateModule],
  template: `
    <div class="md-page-shell waiter-container animate-fade-in">
      <header class="section-header-md3">
        <div class="header-content">
          <div class="title-with-icon">
            <div class="icon-box-md3 primary">
              <lucide-icon name="hand-platter" [size]="24"></lucide-icon>
            </div>
            <div>
              <h1 class="text-headline-medium">{{ 'WAITER.PANEL' | translate }}</h1>
              <p class="text-body-small opacity-60">{{ 'WAITER.DESC' | translate }}</p>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <div class="stat-chip-md3">
            <span class="text-title-large">{{ occupiedCount() }}</span>
            <span class="text-label-small opacity-60">{{ 'WAITER.ACTIVE_BADGE' | translate }}</span>
          </div>
          <button class="btn-primary" (click)="showAddModal.set(true)">
            <lucide-icon name="plus" [size]="18"></lucide-icon>
            {{ 'WAITER.ADD_VIRTUAL' | translate }}
          </button>
        </div>
      </header>

      <div class="tables-grid">
        @if (loading()) {
          @for (i of [1,2,3,4,5,6,7,8]; track i) {
            <div class="md-card table-card-skeleton">
              <div class="skeleton-icon-circle"></div>
              <div class="skeleton-content">
                <div class="skeleton-bar w40"></div>
                <div class="skeleton-bar w70"></div>
              </div>
            </div>
          }
        } @else {
          @for (totem of enrichedTotems(); track totem.id) {
            <div class="md-card-elevated table-item-md3"
                 [class.is-occupied]="!!totem.order"
                 [class.is-urgent]="isUrgent(totem.order?.createdAt)"
                 (click)="goToTable(totem.id)">

              <div class="item-header-row">
                <div class="status-indicators">
                  @if (totem.isVirtual) {
                    <span class="chip chip-outline primary">{{ 'WAITER.VIRTUAL_TAG' | translate }}</span>
                  }
                  <span class="chip-active" [class.free]="!totem.order">
                    {{ totem.order ? ('WAITER.STATUS_OCCUPIED' | translate) : ('WAITER.STATUS_FREE' | translate) }}
                  </span>
                </div>
                <div class="item-actions">
                  <button class="icon-btn-sm" (click)="openQR($event, totem.id)">
                    <lucide-icon name="qr-code" [size]="14"></lucide-icon>
                  </button>
                  @if (totem.isVirtual) {
                    <button class="icon-btn-sm error" (click)="deleteTotem($event, totem.id)">
                      <lucide-icon name="trash-2" [size]="14"></lucide-icon>
                    </button>
                  }
                </div>
              </div>

              <div class="item-body-md3">
                <div class="icon-surface" [class.occupied]="!!totem.order">
                  <lucide-icon [name]="totem.isVirtual ? 'clipboard-list' : 'armchair'" [size]="24"></lucide-icon>
                </div>
                <div class="item-info">
                  <div class="text-headline-small color-primary">#{{ totem.id }}</div>
                  <div class="text-title-medium">{{ totem.name }}</div>
                  
                  @if (totem.order) {
                    <div class="order-summary-md3">
                      <div class="summary-top">
                        <span class="text-label-medium">
                          <lucide-icon name="package" [size]="12"></lucide-icon>
                          {{ totem.order.items?.length || 0 }} ítems
                        </span>
                        <span class="text-label-large color-error">{{ getTimeElapsed(totem.order.createdAt) }}</span>
                      </div>
                      <div class="text-title-large color-secondary">{{ totem.order.totalAmount | currency:'EUR' }}</div>
                      
                      <div class="items-list-preview">
                        @for (item of totem.order.items?.slice(0, 4); track $index) {
                          <div class="mini-item-box" [title]="item.name">
                            <img *ngIf="item.image" [src]="item.image" class="mini-item-img">
                            <span *ngIf="!item.image" class="mini-item-fallback">{{ item.quantity }}x</span>
                          </div>
                        }
                        @if ((totem.order.items?.length || 0) > 4) {
                          <span class="mini-tag-more">+{{ totem.order.items.length - 4 }}</span>
                        }
                      </div>
                    </div>
                  } @else {
                    <div class="action-hint text-label-medium">{{ 'WAITER.READY_HINT' | translate }}</div>
                  }
                </div>
              </div>
            </div>
          } @empty {
            <div class="empty-state-md3">
              <lucide-icon name="layout-grid" [size]="48" class="opacity-10"></lucide-icon>
              <p class="text-body-large opacity-40">{{ 'WAITER.NO_TABLES' | translate }}</p>
            </div>
          }
        }
      </div>

      <!-- Add Virtual Table Modal (Bottom Sheet mobile / Dialog desktop) -->
      @if (showAddModal()) {
        <div class="md-modal-overlay" (click)="showAddModal.set(false)">
          <div class="md-modal-dialog md-form-panel" (click)="$event.stopPropagation()">
              <header class="md-form-panel-header">
                <div>
                  <h2 class="text-headline-small">{{ 'WAITER.ADD_VIRTUAL' | translate }}</h2>
                  <p class="text-body-small opacity-60">{{ 'WAITER.NEW_VIRTUAL_NAME' | translate }}</p>
                </div>
                <button class="icon-btn-md3" (click)="showAddModal.set(false)">
                  <lucide-icon name="x" [size]="20"></lucide-icon>
                </button>
              </header>

              <div class="md-form-panel-body">
                <div class="form-field-md3">
                    <label class="text-label-large">{{ 'WAITER.NEW_VIRTUAL_NAME' | translate }}</label>
                    <input type="text" #totemName class="md-input" (keyup.enter)="addVirtualTotem(totemName.value)" autofocus>
                </div>
              </div>

              <footer class="md-form-panel-footer">
                  <button class="btn-outline" (click)="showAddModal.set(false)">{{ 'COMMON.CANCEL' | translate }}</button>
                  <button class="btn-primary" (click)="addVirtualTotem(totemName.value)">{{ 'COMMON.SAVE' | translate }}</button>
              </footer>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .waiter-container {
      max-width: 1400px;
    }

    .tables-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
    }

    .md-card {
        padding: 20px;
        background: var(--md-sys-color-surface-1);
    }

    .table-item-md3 {
        padding: 20px;
        background: var(--md-sys-color-surface-2);
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .table-item-md3:hover {
        background: var(--md-sys-color-surface-3);
        transform: translateY(-4px);
    }

    .table-item-md3.is-occupied {
        background: var(--md-sys-color-primary-container);
        color: var(--md-sys-color-on-primary-container);
    }

    .table-item-md3.is-urgent {
        border-right: 4px solid var(--md-sys-color-error);
        animation: urgent-pulse 2s infinite;
    }

    @keyframes urgent-pulse {
        0%, 100% { box-shadow: 0 0 0 0 var(--md-sys-color-error); }
        50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--md-sys-color-error) 20%, transparent); }
    }

    .item-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .status-indicators { display: flex; gap: 8px; }
    
    .chip-active {
        font-size: 0.65rem; font-weight: 700; padding: 2px 10px; border-radius: 10px;
        background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary);
    }
    .chip-active.free {
        background: var(--md-sys-color-surface-variant); color: var(--md-sys-color-on-surface-variant);
    }
    
    .chip {
        font-size: 0.65rem; font-weight: 700; padding: 2px 10px; border-radius: 10px;
        display: inline-flex; align-items: center; justify-content: center;
    }
    .chip-outline { border: 1px solid var(--md-sys-color-outline); }
    .chip-outline.primary { border-color: var(--md-sys-color-primary); color: var(--md-sys-color-primary); }

    .icon-btn-sm {
        width: 32px; height: 32px; border-radius: 50%; border: none;
        background: var(--md-sys-color-surface-variant);
        color: var(--md-sys-color-on-surface-variant);
        display: flex; align-items: center; justify-content: center; cursor: pointer;
    }
    .icon-btn-sm.error:hover { background: var(--md-sys-color-error); color: white; }

    .item-body-md3 { display: flex; gap: 20px; align-items: flex-start; }
    
    .icon-surface {
        width: 64px; height: 64px; border-radius: 16px;
        background: var(--md-sys-color-surface-variant);
        display: flex; align-items: center; justify-content: center;
        color: var(--md-sys-color-on-surface-variant);
        flex-shrink: 0;
    }
    .icon-surface.occupied {
        background: var(--md-sys-color-on-primary-container);
        color: var(--md-sys-color-primary-container);
    }

    .item-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    
    .color-primary { color: var(--md-sys-color-primary); }
    .color-secondary { color: var(--md-sys-color-secondary); }
    .color-error { color: var(--md-sys-color-error); font-weight: 600; }

    .order-summary-md3 {
        margin-top: 12px; padding-top: 12px;
        border-top: 1px solid var(--md-sys-color-outline-variant);
        display: flex; flex-direction: column; gap: 8px;
    }

    .summary-top { display: flex; justify-content: space-between; align-items: center; }

    .items-list-preview { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
    .mini-item-box { 
      width: 28px; height: 28px; border-radius: 8px; overflow: hidden;
      background: var(--md-sys-color-surface-3); display: flex; align-items: center; justify-content: center;
      border: 1px solid var(--md-sys-color-outline-variant);
    }
    .mini-item-img { width: 100%; height: 100%; object-fit: cover; }
    .mini-item-fallback { font-size: 0.5rem; font-weight: 700; opacity: 0.6; }
    .mini-tag-more { font-size: 0.6rem; font-weight: 700; opacity: 0.6; padding-top: 8px; }

    .action-hint {
        margin-top: 12px; padding: 6px 12px;
        background: var(--md-sys-color-surface-variant);
        border-radius: 8px; width: fit-content; opacity: 0.7;
    }

    /* Skeleton */
    .table-card-skeleton { display: flex; gap: 16px; align-items: center; padding: 24px; opacity: 0.6; }
    .skeleton-icon-circle { width: 48px; height: 48px; border-radius: 50%; background: var(--md-sys-color-surface-variant); }
    .skeleton-content { flex: 1; display: flex; flex-direction: column; gap: 8px; }
    .skeleton-bar { height: 12px; background: var(--md-sys-color-surface-variant); border-radius: 4px; }
    .skeleton-bar.w40 { width: 40%; }
    .skeleton-bar.w70 { width: 70%; }

    .form-field-md3 { display: flex; flex-direction: column; gap: 8px; }

    @media (max-width: 600px) {
        .waiter-container { padding-inline: 16px; }
        .section-header-md3 { align-items: stretch; }
        .stat-chip-md3 { display: none; }
        .tables-grid { grid-template-columns: 1fr; }
    }

    .opacity-60 { opacity: 0.6; }
    .opacity-40 { opacity: 0.4; }
    .opacity-10 { opacity: 0.1; }
  `]
})
export class WaiterViewComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private auth = inject(AuthService);
  private comms = inject(CommunicationService);
  private http = inject(HttpClient);
  private translate = inject(TranslateService);
  private notify = inject(NotifyService);

  public totems = signal<any[]>([]);
  public orders = signal<any[]>([]);
  public loading = signal(false);
  public showAddModal = signal(false);

  private routerSub?: Subscription;
  private orderSub?: Subscription;
  private ordersCallback = (updatedOrder: any) => {
    this.orders.update(prev => {
      const idx = prev.findIndex(o => o._id === updatedOrder._id);
      if (idx !== -1) {
        const next = [...prev]; next[idx] = updatedOrder; return next;
      }
      return [updatedOrder, ...prev];
    });
  };
  private sessionEndCallback = (data: any) => {
    this.orders.update(prev =>
      prev.filter(o => o.sessionId !== data.sessionId && o._id !== data.orderId)
    );
  };

  // Combine totems + live orders into enriched table data
  public enrichedTotems = computed<TotemWithStatus[]>(() => {
    const activeOrders = this.orders().filter(o => o.status === 'active');
    const user = this.auth.currentUser();
    const currentUsername = user?.username;
    const isAdmin = user?.role === 'admin';

    return this.totems()
      .filter(t => {
        // Physical tables are shown to everyone
        if (!t.isVirtual) return true;
        // Admins see all virtual tables
        if (isAdmin) return true;
        // Waiters only see virtual tables they created
        return t.createdBy === currentUsername;
      })
      .map(t => ({
        ...t,
        order: activeOrders.find(o =>
          o.totemId === t.id || String(o.tableNumber) === String(t.id)
        ) || null
      }));
  });

  public occupiedCount = computed(() =>
    this.enrichedTotems().filter(t => !!t.order).length
  );

  ngOnInit() {
    // Load immediately
    this.loadData();

    // Re-load every time we navigate to this route (fixes the "double click" issue
    // where data was stale from last visit or wasn't loaded yet)
    this.routerSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      if (e.url?.includes('/waiter')) {
        this.loadData();
      }
    });

    // Subscribe to real-time order updates
    this.comms.subscribeToOrders(this.ordersCallback);

    // Subscribe to session-ended to remove closed orders from the list
    this.comms.subscribeToSessionEnd(this.sessionEndCallback);
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
    this.comms.unsubscribeFromOrders(this.ordersCallback);
    this.comms.unsubscribeFromSessionEnd(this.sessionEndCallback);
  }

  async loadData() {
    if (this.loading()) return;
    this.loading.set(true);
    try {
      // Load both in parallel
      const [totemsRes, ordersRes] = await Promise.all([
        firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/api/totems`)),
        firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/api/orders`))
      ]);

      this.totems.set(totemsRes || []);
      this.orders.set((ordersRes || []).filter((o: any) => o.status === 'active'));
    } catch (e) {
      console.error('Error loading waiter data', e);
      this.notify.errorKey('WAITER.LOAD_ERROR');
    } finally {
      this.loading.set(false);
    }
  }

  getTimeElapsed(createdAt: string): string {
    if (!createdAt) return '';
    const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (diff < 60) return `${diff}m`;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}h ${m}m`;
  }

  isUrgent(createdAt?: string): boolean {
    if (!createdAt) return false;
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000) > 45;
  }

  async addVirtualTotem(name: string) {
    const trimmed = name?.trim();
    if (!trimmed) {
      this.notify.warningKey('WAITER.VIRTUAL_NAME_REQUIRED');
      return;
    }
    try {
      await firstValueFrom(this.http.post(`${environment.apiUrl}/api/totems`, {
        name: trimmed,
        isVirtual: true
      }, { withCredentials: true }));

      this.showAddModal.set(false);
      await this.loadData();
      this.notify.successKey('WAITER.ADD_VIRTUAL_SUCCESS', { name: trimmed });
    } catch (e) {
      console.error('Error adding virtual totem', e);
      this.notify.errorKey('WAITER.ADD_VIRTUAL_ERROR');
    }
  }

  async deleteTotem(event: Event, id: number) {
    event.stopPropagation();
    if (!confirm(this.translate.instant('WAITER.DELETE_CONFIRM'))) return;
    try {
      await firstValueFrom(this.http.delete(`${environment.apiUrl}/api/totems/${id}`, {
        withCredentials: true
      }));
      await this.loadData();
      this.notify.successKey('WAITER.DELETE_VIRTUAL_SUCCESS', { id });
    } catch (e) {
      console.error('Error deleting totem', e);
      this.notify.errorKey('WAITER.DELETE_VIRTUAL_ERROR');
    }
  }

  goToTable(id: number) {
    this.router.navigate(['/admin/waiter/table', id]);
  }

  openQR(event: Event, totemId: number) {
    event.stopPropagation();
    const base = window.location.origin;
    window.open(`${base}/api/qr/${totemId}`, '_blank');
  }
}
