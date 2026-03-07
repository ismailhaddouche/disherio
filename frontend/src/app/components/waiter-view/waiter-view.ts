import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { CommunicationService } from '../../services/communication.service';
import { TranslateModule } from '@ngx-translate/core';
import { filter, Subscription } from 'rxjs';

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
    <div class="waiter-container animate-fade-in">
      <header class="section-header-md3">
        <div class="header-content">
          <h1 class="text-headline-medium">
            <lucide-icon name="hand-platter" [size]="28"></lucide-icon>
            {{ 'WAITER.PANEL' | translate }}
          </h1>
          <p class="text-body-large opacity-60">{{ 'WAITER.DESC' | translate }}</p>
        </div>
        <div class="header-actions">
          <div class="badge-tonal">
            <span class="text-title-large">{{ occupiedCount() }}</span>
            <span class="text-label-small opacity-60">ACTIVAS</span>
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
                    <span class="chip chip-outline primary">VIRTUAL</span>
                  }
                  <span class="chip-active" [class.free]="!totem.order">
                    {{ totem.order ? 'ACTIVA' : 'LIBRE' }}
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
                        @for (item of totem.order.items?.slice(0, 3); track $index) {
                          <span class="mini-tag" [class]="item.status">
                            {{ item.quantity }}x {{ item.name | slice:0:10 }}
                          </span>
                        }
                        @if ((totem.order.items?.length || 0) > 3) {
                          <span class="mini-tag more">+{{ totem.order.items.length - 3 }}</span>
                        }
                      </div>
                    </div>
                  } @else {
                    <div class="action-hint text-label-medium">LISTA PARA PEDIR</div>
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
        <div class="modal-overlay" (click)="showAddModal.set(false)">
          <div class="modal-dialog md-card-elevated" (click)="$event.stopPropagation()">
              <h2 class="text-headline-small">{{ 'WAITER.ADD_VIRTUAL' | translate }}</h2>
              <div class="form-field-md3">
                  <label class="text-label-large">{{ 'WAITER.NEW_VIRTUAL_NAME' | translate }}</label>
                  <input type="text" #totemName class="md-input" (keyup.enter)="addVirtualTotem(totemName.value)" autofocus>
              </div>
              <div class="modal-actions-md3">
                  <button class="btn-outline" (click)="showAddModal.set(false)">{{ 'COMMON.CANCEL' | translate }}</button>
                  <button class="btn-primary" (click)="addVirtualTotem(totemName.value)">{{ 'COMMON.SAVE' | translate }}</button>
              </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .waiter-container {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .section-header-md3 {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 24px;
        flex-wrap: wrap;
    }

    .header-content h1 { display: flex; align-items: center; gap: 16px; margin: 0; }
    
    .header-actions { display: flex; align-items: center; gap: 16px; }

    .badge-tonal {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: var(--md-sys-color-secondary-container);
        color: var(--md-sys-color-on-secondary-container);
        width: 80px; height: 64px; border-radius: 16px;
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

    .items-list-preview { display: flex; flex-wrap: wrap; gap: 4px; }
    .mini-tag {
        font-size: 0.6rem; padding: 2px 8px; border-radius: 6px;
        background: var(--md-sys-color-surface-3); opacity: 0.8;
    }
    .mini-tag.ready { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); font-weight: 600; }
    .mini-tag.preparing { background: var(--md-sys-color-tertiary-container); }

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

    /* Modal */
    .modal-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center; z-index: 1000;
        backdrop-filter: blur(4px);
    }
    .modal-dialog { width: 100%; max-width: 440px; padding: 32px; display: flex; flex-direction: column; gap: 24px; }
    .form-field-md3 { display: flex; flex-direction: column; gap: 8px; }
    .md-input {
        background: var(--md-sys-color-surface-variant);
        border: none; border-radius: 8px; padding: 12px 16px;
        color: var(--md-sys-color-on-surface); font-family: inherit;
    }
    .modal-actions-md3 { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }

    @media (max-width: 600px) {
        .waiter-container { gap: 24px; }
        .section-header-md3 { flex-direction: column; align-items: stretch; }
        .badge-tonal { display: none; }
        .tables-grid { grid-template-columns: 1fr; }
    }

    .opacity-60 { opacity: 0.6; }
    .opacity-40 { opacity: 0.4; }
    .opacity-10 { opacity: 0.1; }
  `]

})
export class WaiterViewComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private comms = inject(CommunicationService);

  public totems = signal<any[]>([]);
  public orders = signal<any[]>([]);
  public loading = signal(true);
  public showAddModal = signal(false);

  private routerSub?: Subscription;
  private orderSub?: Subscription;

  // Combine totems + live orders into enriched table data
  public enrichedTotems = computed<TotemWithStatus[]>(() => {
    const activeOrders = this.orders().filter(o => o.status === 'active');
    return this.totems().map(t => ({
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
    this.orderSub = new Subscription();
    this.comms.subscribeToOrders((updatedOrder: any) => {
      this.orders.update(prev => {
        const idx = prev.findIndex(o => o._id === updatedOrder._id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = updatedOrder;
          return next;
        }
        return [updatedOrder, ...prev];
      });
    });

    // Subscribe to session-ended to remove closed orders from the list
    this.comms.subscribeToSessionEnd((data: any) => {
      this.orders.update(prev =>
        prev.filter(o => o.sessionId !== data.sessionId && o._id !== data.orderId)
      );
    });
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
    this.orderSub?.unsubscribe();
  }

  async loadData() {
    // Show skeleton but don't block
    this.loading.set(true);
    try {
      // Load both in parallel
      const [totemsRes, ordersRes] = await Promise.all([
        fetch(`${environment.apiUrl}/api/totems`).then(r => r.json()),
        fetch(`${environment.apiUrl}/api/orders`).then(r => r.json())
      ]);

      this.totems.set(totemsRes || []);
      this.orders.set((ordersRes || []).filter((o: any) => o.status === 'active'));
    } catch (e) {
      console.error('Error loading waiter data', e);
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
    if (!name?.trim()) return;
    try {
      const res = await fetch(`${environment.apiUrl}/api/totems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), isVirtual: true })
      });
      if (res.ok) {
        this.showAddModal.set(false);
        await this.loadData();
      }
    } catch (e) {
      console.error('Error adding virtual totem', e);
    }
  }

  async deleteTotem(event: Event, id: number) {
    event.stopPropagation();
    if (!confirm('¿Eliminar esta mesa temporal?')) return;
    try {
      const res = await fetch(`${environment.apiUrl}/api/totems/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) this.loadData();
    } catch (e) {
      console.error('Error deleting totem', e);
    }
  }

  goToTable(id: number) {
    this.router.navigate(['/', id]);
  }

  openQR(event: Event, totemId: number) {
    event.stopPropagation();
    const base = window.location.origin;
    window.open(`${base}/api/qr/${totemId}`, '_blank');
  }
}
