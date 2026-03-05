import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KDSViewModel } from './kds.viewmodel';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-kds',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule],
  providers: [KDSViewModel],
  template: `
    <div class="kds-container animate-fade-in">
      <header class="view-header" style="margin-bottom: 0;">
        <div>
          <h1 class="view-title"><lucide-icon name="chef-hat" [size]="28" class="text-muted"></lucide-icon> {{ 'KDS.TITLE' | translate }}</h1>
          <p class="view-desc">{{ 'KDS.SUBTITLE' | translate }}</p>
        </div>
        <div class="kds-controls">
          @if (vm.error()) {
            <div class="err-msg">⚠️ {{ vm.error() }}</div>
          }
          <button class="btn-stock" (click)="vm.showStockManager.set(!vm.showStockManager())">
            <lucide-icon name="package" [size]="16" class="inline-icon"></lucide-icon> GESTIÓN STOCK
          </button>
          <div class="stat">
            <span class="val">{{ vm.filteredOrders().length }}</span>
            <span class="lab">{{ 'KDS.ORDERS' | translate }}</span>
          </div>
        </div>
      </header>

      <main class="kds-layout">
        @if (vm.loading()) {
            <div class="kds-loader">
                <div class="loader-ripple"><div></div><div></div></div>
                <p>{{ 'KDS.SYNCING' | translate }}</p>
            </div>
        } @else {
            <section class="kds-grid">
            @for (order of vm.filteredOrders(); track order._id) {
                <div class="order-card glass-card" [class.urgent]="vm.getTimeDiff(order.createdAt).includes('15')">
                <div class="order-head">
                    <div style="display: flex; flex-direction: column;">
                        <span class="table-num">{{ 'ROLES.Table' | translate }} #{{ order.totemId || order.tableNumber }}</span>
                        <span class="time-elapsed">{{ vm.getTimeDiff(order.createdAt) }}</span>
                    </div>
                    <div class="bulk-actions">
                        <button class="btn-bulk ready" (click)="vm.bulkUpdateItemsStatus(order._id, 'ready')" title="Todo listo">
                            <lucide-icon name="check-check" [size]="16"></lucide-icon>
                        </button>
                        <button class="btn-bulk served" (click)="vm.bulkUpdateItemsStatus(order._id, 'served')" title="Todo servido">
                            <lucide-icon name="bell-ring" [size]="16"></lucide-icon>
                        </button>
                    </div>
                </div>

                <div class="items-list">
                    @for (item of order.kitchenItems; track $index) {
                    <div class="kds-item" [class]="item.status">
                        <div class="item-info">
                        <div class="name-row">
                            <span class="qty">{{ item.quantity }}x</span>
                            <span class="name">{{ item.name }}</span>
                            <!-- Per-item timer: added as requested -->
                            @if (item.createdAt && item.status !== 'ready') {
                                <span class="item-timer" [class.urgent]="vm.getTimeDiffMinutes(item.createdAt) >= 15">{{ vm.getTimeDiff(item.createdAt) }}</span>
                            }
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <span class="ordered-by"><lucide-icon name="user" [size]="12" class="inline-icon"></lucide-icon> {{ item.orderedBy?.name }}</span>
                            @if (item.notes) {
                                <span class="item-note">"{{ item.notes }}"</span>
                            }
                        </div>
                        </div>
                        
                        <div class="action-buttons">
                        @if (item.status === 'pending') {
                            <button class="btn-action prepare" (click)="vm.updateItemStatus(order._id, item._id || item.id, 'preparing')">
                            {{ 'KDS.MARK_PREPARING' | translate }}
                            </button>
                            <button class="btn-cancel" (click)="vm.cancelItem(order._id, item._id || item.id)">
                            ✕
                            </button>
                        }
                        @if (item.status === 'preparing') {
                            <div class="ready-actions">
                                <button class="btn-action ready" (click)="vm.updateItemStatus(order._id, item._id || item.id, 'ready', false)">
                                {{ 'KDS.MARK_READY' | translate }}
                                </button>
                                <button class="btn-action ready-print" (click)="vm.updateItemStatus(order._id, item._id || item.id, 'ready', true)">
                                <lucide-icon name="printer" [size]="14" class="inline-icon"></lucide-icon> + {{ 'KDS.MARK_READY' | translate }}
                                </button>
                            </div>
                        }
                        @if (item.status === 'ready') {
                            <div class="done-check-box">
                                <div class="done-check"><lucide-icon name="check-circle-2" [size]="20" color="var(--highlight)"></lucide-icon></div>
                                <button class="btn-reprint" (click)="vm.printItemTicket(order, item)" title="Reimprimir vale"><lucide-icon name="printer" [size]="16"></lucide-icon></button>
                            </div>
                        }
                        @if (item.status === 'cancelled') {
                            <span class="cancelled-tag">{{ 'KDS.CANCELLED' | translate }}</span>
                        }
                        </div>
                    </div>
                    }
                </div>
                </div>
            } @empty {
                <div class="empty-kds">
                <div class="empty-icon"><lucide-icon name="chef-hat" [size]="64" color="var(--text-muted)"></lucide-icon></div>
                <h2>{{ 'KDS.EMPTY_TITLE' | translate }}</h2>
                <p>{{ 'KDS.EMPTY_DESC' | translate }}</p>
                </div>
            }
            </section>
        }

        <!-- Stock / Product Availability Manager -->
        @if (vm.showStockManager()) {
          <aside class="stock-sidebar glass-card">
            <header>
              <h3>{{ 'KDS.AVAILABILITY' | translate }}</h3>
              <p>{{ 'KDS.AVAILABILITY_DESC' | translate }}</p>
            </header>
            <div class="stock-list">
              @for (item of vm.productList(); track item._id) {
                <div class="product-toggle-row">
                  <div class="prod-info">
                    <span class="prod-name">{{ item.name }}</span>
                    <span class="prod-cat">{{ item.category }}</span>
                  </div>
                  <button class="toggle-switch" 
                          [class.off]="!item.available"
                          (click)="vm.toggleProduct(item._id)">
                    {{ item.available ? 'ACTIVO' : 'AGOTADO' }}
                  </button>
                </div>
              }
            </div>
          </aside>
        }
      </main>
    </div>
  `,
  styles: [`
    .kds-container {
      min-height: 100vh;
      background: var(--bg-dark);
      display: flex;
      flex-direction: column;
      padding: 16px;
      gap: 24px;
      width: 100%;
      max-width: 900px;
      margin: 0 auto;
    }

    .err-msg {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 0.8rem;
        font-weight: bold;
        border: 1px solid #ef4444;
    }

    .kds-loader {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 20px;
        opacity: 0.7;
    }
    
    .kds-controls { display: flex; align-items: center; gap: 24px; }
    .btn-stock {
      background: rgba(192, 132, 252, 0.1);
      border: 1px solid var(--accent-secondary);
      color: var(--accent-secondary);
      padding: 10px 16px;
      border-radius: 12px;
      font-weight: bold;
      cursor: pointer;
      font-size: 0.8rem;
    }

    .stat { text-align: center; }
    .stat .val { font-size: 1.5rem; font-weight: bold; display: block; color: var(--accent-primary); }
    .stat .lab { font-size: 0.7rem; opacity: 0.6; }

    .kds-layout {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 24px;
      width: 100%;
    }

    .kds-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      align-items: start;
      gap: 20px;
      width: 100%;
      padding-bottom: 40px;
    }

    @media (max-width: 768px) {
      .kds-grid { grid-template-columns: 1fr; }
      .kds-container { padding: 12px; gap: 16px; }
      .kds-controls {
        flex-direction: column;
        align-items: stretch;
        gap: 16px;
        width: 100%;
      }
      .btn-stock { width: 100%; justify-content: center; }
      .stat { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--glass-border); padding-bottom: 12px; }
      .stat .val { font-size: 1.2rem; }
      .stock-sidebar { position: static; width: 100%; max-height: none; }
      .kds-item { flex-direction: column; align-items: stretch; gap: 12px; }
      .action-buttons { justify-content: flex-start; }
      .ready-actions { width: 100%; }
      .ready-actions .btn-action { flex: 1; }
    }

    @media (max-width: 480px) {
      .btn-action { min-width: unset; padding: 12px 14px; font-size: 0.8rem; }
      .ready-actions { flex-direction: column; width: 100%; }
      .ready-actions .btn-action { max-width: 100%; }
    }

    .order-card {
      padding: 0;
      display: flex;
      flex-direction: column;
      border-top: 4px solid var(--accent-primary);
      height: fit-content;
    }

    .order-card.urgent { border-top-color: #ef4444; animation: flash 2s infinite; }

    .order-head {
      padding: 16px 20px;
      background: rgba(255,255,255,0.02);
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .table-num { font-size: 1.4rem; font-weight: 900; color: var(--accent-primary); text-transform: uppercase; }
    .time-elapsed { font-size: 1.1rem; font-weight: bold; opacity: 0.8; font-family: monospace; }
    
    .bulk-actions { display: flex; gap: 8px; }
    .btn-bulk { 
        width: 44px; height: 44px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);
        display: flex; align-items: center; justify-content: center; cursor: pointer; color: white;
        transition: all 0.2s;
    }
    .btn-bulk.ready { background: rgba(34, 197, 94, 0.1); color: var(--highlight); border-color: rgba(34, 197, 94, 0.3); }
    .btn-bulk.ready:hover { background: var(--highlight); color: var(--bg-dark); }
    .btn-bulk.served { background: rgba(59, 130, 246, 0.1); color: #60a5fa; border-color: rgba(59, 130, 246, 0.3); }
    .btn-bulk.served:hover { background: #3b82f6; color: white; }

    .items-list { padding: 8px; }

    .kds-item {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      margin-bottom: 12px;
      border-radius: 12px;
      background: rgba(255,255,255,0.03);
      gap: 16px;
    }

    .kds-item.preparing { background: rgba(192, 132, 252, 0.1); border-left: 4px solid var(--accent-secondary); }
    .kds-item.ready { opacity: 0.5; background: rgba(34, 197, 94, 0.05); }
    .kds-item.cancelled { opacity: 0.5; border: 1px dashed #ef4444; }

    .item-info { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 200px; }
    .name-row { display: flex; align-items: center; gap: 8px; }
    .qty { font-weight: 900; color: var(--accent-primary); font-size: 1.1rem; }
    .name { font-weight: 700; font-size: 1.1rem; color: var(--text-base); }
    .ordered-by { font-size: 0.8rem; color: var(--text-muted); opacity: 0.8; }
    
    .item-timer { 
        background: rgba(255,255,255,0.05); 
        padding: 2px 8px; 
        border-radius: 6px; 
        font-size: 0.8rem; 
        font-family: monospace; 
        font-weight: bold; 
        color: var(--text-muted); 
    }
    .item-timer.urgent { background: #ef4444; color: white; box-shadow: 0 0 10px rgba(239, 68, 68, 0.3); }

    .item-note { font-style: italic; font-size: 0.75rem; color: var(--highlight); opacity: 0.9; margin-left: 12px; }

    .action-buttons { 
      display: flex; 
      flex-wrap: wrap;
      align-items: center; 
      gap: 12px; 
      flex: 1;
      justify-content: flex-end;
    }

    .btn-action {
      flex: 1;
      border: none;
      padding: 16px 20px; /* Larger touch target */
      border-radius: 10px;
      font-weight: 800;
      font-size: 0.9rem;
      cursor: pointer;
      min-width: 120px;
      max-width: 200px;
      text-align: center;
    }
    .prepare { background: var(--accent-primary); color: var(--bg-dark); }
    .ready { background: var(--highlight); color: var(--bg-dark); }
    .ready-print { 
        background: rgba(34, 197, 94, 0.1); 
        color: var(--highlight); 
        border: 1px solid rgba(34, 197, 94, 0.3); 
    }

    .ready-actions { display: flex; gap: 8px; flex: 1; justify-content: flex-end; flex-wrap: wrap; }

    .done-check-box { display: flex; align-items: center; gap: 16px; }
    .btn-reprint {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        color: var(--text-base);
        padding: 10px 14px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.9rem;
    }

    .btn-cancel {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.2);
      width: 50px;
      height: 50px;
      border-radius: 10px;
      font-size: 1.2rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cancelled-tag { color: #ef4444; font-weight: bold; font-size: 0.8rem; }

    .stock-sidebar {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 24px;
      margin-top: 16px;
    }

    .stock-sidebar header h3 { font-size: 1.1rem; margin-bottom: 4px; }
    .stock-sidebar header p { font-size: 0.8rem; opacity: 0.6; }

    .stock-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow-y: auto;
    }

    .product-toggle-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255,255,255,0.02);
      padding: 12px;
      border-radius: 10px;
    }

    .prod-info { display: flex; flex-direction: column; gap: 2px; color: var(--text-base); }
    .prod-name { font-weight: 600; font-size: 0.9rem; }
    .prod-cat { font-size: 0.7rem; color: var(--text-muted); }

    .toggle-switch {
      border: none;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.7rem;
      font-weight: 900;
      cursor: pointer;
      background: var(--highlight);
      color: var(--bg-dark);
      min-width: 80px;
    }

    .toggle-switch.off {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
      border: 1px solid #ef4444;
    }
    .inline-icon { display: inline-block; vertical-align: text-bottom; margin-right: 4px; }

    /* Loader, slideInRight, flash: now in global styles.css */
  `]
})
export class KDSComponent {
  public vm = inject(KDSViewModel);
  public auth = inject(AuthService);
  public theme = inject(ThemeService);
}
