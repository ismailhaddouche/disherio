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
      <header class="view-header">
        <div>
          <h1 class="view-title">
            <lucide-icon name="hand-platter" [size]="28" class="text-muted"></lucide-icon>
            {{ 'WAITER.PANEL' | translate }}
          </h1>
          <p class="view-desc">{{ 'WAITER.DESC' | translate }}</p>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="stat-badge">
            <span class="stat-value">{{ occupiedCount() }}</span>
            <span class="stat-label">activas</span>
          </div>
          <button class="btn-primary" (click)="showAddModal.set(true)">
            <lucide-icon name="plus-circle" [size]="18" class="mr-2"></lucide-icon>
            {{ 'WAITER.ADD_VIRTUAL' | translate }}
          </button>
        </div>
      </header>

      <div class="tables-grid">
        @if (loading()) {
          <!-- Skeleton loading — no blocking state, renders placeholders immediately -->
          @for (i of [1,2,3,4,5,6]; track i) {
            <div class="table-card glass-card skeleton-card">
              <div class="skeleton-icon"></div>
              <div class="skeleton-body">
                <div class="skeleton-line w60"></div>
                <div class="skeleton-line w40"></div>
              </div>
            </div>
          }
        } @else {
          @for (totem of enrichedTotems(); track totem.id) {
            <div class="table-card glass-card clickable"
                 [class.occupied]="!!totem.order"
                 [class.urgent]="isUrgent(totem.order?.createdAt)"
                 (click)="goToTable(totem.id)">

              <!-- Top actions bar -->
              <div class="card-header">
                <div style="display: flex; gap: 6px; align-items: center;">
                  @if (totem.isVirtual) {
                    <span class="type-tag">{{ 'WAITER.VIRTUAL_TAG' | translate }}</span>
                  }
                  @if (totem.order) {
                    <span class="status-tag occupied-tag">ACTIVA</span>
                  } @else {
                    <span class="status-tag free-tag">LIBRE</span>
                  }
                </div>
                <div style="display: flex; gap: 6px;">
                  <button class="btn-qr-action-mini" (click)="openQR($event, totem.id)" [title]="'DASHBOARD.VIEW_QR' | translate">
                    <lucide-icon name="qr-code" [size]="12"></lucide-icon>
                  </button>
                  @if (totem.isVirtual) {
                    <button class="btn-delete" (click)="deleteTotem($event, totem.id)">
                      <lucide-icon name="x" [size]="14"></lucide-icon>
                    </button>
                  }
                </div>
              </div>

              <!-- Main body -->
              <div class="table-body">
                <div class="table-icon" [class.has-order]="!!totem.order">
                  {{ totem.isVirtual ? '📋' : '🪑' }}
                </div>
                <div class="table-info-box">
                  <div class="table-id">#{{ totem.id }}</div>
                  <div class="table-name">{{ totem.name }}</div>

                  @if (totem.order) {
                    <!-- Order details when occupied -->
                    <div class="order-details">
                      <div class="order-meta">
                        <span class="item-count">
                          <lucide-icon name="shopping-bag" [size]="12" class="inline-icon"></lucide-icon>
                          {{ totem.order.items?.length || 0 }} platos
                        </span>
                        <span class="time-ago">{{ getTimeElapsed(totem.order.createdAt) }}</span>
                      </div>
                      <div class="order-amount">{{ totem.order.totalAmount | currency:'EUR' }}</div>
                      <div class="items-preview">
                        @for (item of totem.order.items?.slice(0, 3); track $index) {
                          <span class="item-chip" [class.ready]="item.status === 'ready'" [class.preparing]="item.status === 'preparing'">
                            {{ item.quantity }}x {{ item.name | slice:0:12 }}{{ item.name?.length > 12 ? '…' : '' }}
                          </span>
                        }
                        @if ((totem.order.items?.length || 0) > 3) {
                          <span class="item-chip more">+{{ totem.order.items.length - 3 }}</span>
                        }
                      </div>
                    </div>
                  } @else {
                    <div class="tap-hint">{{ 'WAITER.TOUCH_ORDER' | translate }}</div>
                  }
                </div>
              </div>
            </div>
          } @empty {
            <div class="empty-state">
              <lucide-icon name="alert-triangle" [size]="48" class="opacity-20 mb-4"></lucide-icon>
              <p>{{ 'WAITER.NO_TABLES' | translate }}</p>
            </div>
          }
        }
      </div>

      <!-- Add Virtual Table Modal -->
      @if (showAddModal()) {
        <div class="modal-overlay" (click)="showAddModal.set(false)">
          <div class="modal-content glass-card" (click)="$event.stopPropagation()">
              <h2 class="card-title">{{ 'WAITER.ADD_VIRTUAL' | translate }}</h2>
              <div class="form-group">
                  <label>{{ 'WAITER.NEW_VIRTUAL_NAME' | translate }}</label>
                  <input type="text" #totemName class="glass-input" (keyup.enter)="addVirtualTotem(totemName.value)" autofocus>
              </div>
              <div class="modal-actions">
                  <button class="btn-secondary" (click)="showAddModal.set(false)">{{ 'COMMON.CANCEL' | translate }}</button>
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
      gap: 24px;
      padding-bottom: 40px;
    }

    .tables-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }

    @media (max-width: 768px) {
      .tables-grid {
        grid-template-columns: 1fr;
        gap: 16px;
      }
    }

    /* --- Status Badges --- */
    .stat-badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      padding: 8px 16px;
      border-radius: 12px;
    }
    .stat-value { font-size: 1.4rem; font-weight: 900; color: var(--highlight); line-height: 1; }
    .stat-label { font-size: 0.65rem; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.05em; }

    /* --- Table Cards --- */
    .table-card {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      cursor: pointer;
      border: 1px solid var(--glass-border);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    }

    .table-card:hover {
      background: rgba(255, 255, 255, 0.05);
      transform: translateY(-3px);
      border-color: var(--accent-primary);
      box-shadow: 0 12px 24px -8px rgba(99, 102, 241, 0.3);
    }

    .table-card.occupied {
      border-color: rgba(34, 197, 94, 0.3);
      background: rgba(34, 197, 94, 0.03);
      border-top: 3px solid var(--highlight);
    }

    .table-card.urgent {
      border-color: rgba(239, 68, 68, 0.5);
      border-top-color: #ef4444;
      animation: gentle-pulse 3s infinite;
    }

    @keyframes gentle-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
      50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1); }
    }

    /* --- Card Header (tags/actions) --- */
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .status-tag {
      font-size: 0.6rem;
      font-weight: 900;
      letter-spacing: 0.08em;
      padding: 2px 8px;
      border-radius: 100px;
    }
    .occupied-tag { background: rgba(34,197,94,0.15); color: #34d399; border: 1px solid rgba(34,197,94,0.3); }
    .free-tag { background: rgba(255,255,255,0.05); color: var(--text-muted); border: 1px solid rgba(255,255,255,0.08); }

    .type-tag {
      font-size: 0.6rem;
      background: var(--accent-secondary);
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 800;
    }

    /* --- Card Body --- */
    .table-body {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }

    .table-icon {
      font-size: 2.2rem;
      line-height: 1;
      filter: grayscale(0.5);
      transition: filter 0.3s;
      flex-shrink: 0;
    }
    .table-icon.has-order { filter: none; }

    .table-info-box {
      display: flex;
      flex-direction: column;
      flex: 1;
      gap: 4px;
    }

    .table-id {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--accent-primary);
      line-height: 1;
    }

    .table-name {
      font-weight: 600;
      font-size: 0.9rem;
      opacity: 0.8;
    }

    .tap-hint {
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      padding: 4px 10px;
      background: rgba(99, 102, 241, 0.1);
      color: var(--accent-primary);
      border-radius: 100px;
      margin-top: 6px;
      align-self: flex-start;
    }

    /* --- Order Details in Card --- */
    .order-details {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 6px;
      padding-top: 8px;
      border-top: 1px solid rgba(255,255,255,0.06);
    }

    .order-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
    }
    .item-count { color: var(--text-muted); display: flex; align-items: center; gap: 4px; }
    .time-ago { font-weight: bold; font-family: monospace; color: var(--highlight); }
    .order-amount { font-size: 1.3rem; font-weight: 900; color: var(--highlight); }

    .items-preview {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .item-chip {
      font-size: 0.6rem;
      padding: 2px 6px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 4px;
      white-space: nowrap;
    }
    .item-chip.ready { border-color: rgba(34,197,94,0.4); color: #34d399; }
    .item-chip.preparing { border-color: rgba(192,132,252,0.4); color: #c084fc; }
    .item-chip.more { color: var(--text-muted); opacity: 0.7; }

    /* --- Action Buttons --- */
    .btn-delete {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
      border: none;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-delete:hover { background: #ef4444; color: white; }

    .btn-qr-action-mini {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--glass-border);
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-qr-action-mini:hover { background: var(--accent-primary); color: var(--bg-dark); border-color: var(--accent-primary); }

    /* --- Skeleton Loader --- */
    .skeleton-card {
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      cursor: default;
      pointer-events: none;
    }
    .skeleton-icon { width: 52px; height: 52px; border-radius: 12px; background: rgba(255,255,255,0.05); animation: shimmer 1.5s infinite; }
    .skeleton-body { flex: 1; display: flex; flex-direction: column; gap: 8px; }
    .skeleton-line { height: 14px; background: rgba(255,255,255,0.05); border-radius: 4px; animation: shimmer 1.5s infinite; }
    .skeleton-line.w60 { width: 60%; }
    .skeleton-line.w40 { width: 40%; }
    @keyframes shimmer {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 0.9; }
    }

    /* --- Header / States --- */
    .loader, .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 60px;
      opacity: 0.5;
    }

    .view-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      flex-wrap: wrap;
      gap: 12px;
    }

    @media (max-width: 600px) {
      .view-header { flex-direction: column; align-items: stretch; }
      .view-header .btn-primary { width: 100%; justify-content: center; display: flex; }
      .stat-badge { display: none; }
    }

    /* --- Modal --- */
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(8px);
    }
    .modal-content {
      width: 100%;
      max-width: 500px;
      padding: 32px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      border-radius: 24px 24px 0 0;
      animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @media (min-width: 768px) {
      .modal-overlay { align-items: center; }
      .modal-content { border-radius: 24px; margin: 20px; }
    }
    .modal-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 10px;
    }
    @media (min-width: 480px) {
      .modal-actions { flex-direction: row; justify-content: flex-end; }
      .modal-actions button { width: auto; }
    }
    .modal-actions button { width: 100%; }

    @keyframes slideUp {
      from { transform: translateY(100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .mr-2 { margin-right: 8px; }
    .inline-icon { display: inline-block; vertical-align: text-bottom; }

    .form-group { display: flex; flex-direction: column; gap: 8px; }
    .form-group label { font-size: 0.9rem; font-weight: bold; opacity: 0.8; }

    @media (max-width: 768px) { .modal-content { padding: 20px; } }
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
