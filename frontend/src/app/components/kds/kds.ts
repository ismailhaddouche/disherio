import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KDSViewModel } from './kds.viewmodel';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-kds',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  providers: [KDSViewModel],
  template: `
    <div class="kds-container animate-fade-in">
      <header class="view-header" style="margin-bottom: 0;">
        <div>
          <h1 class="view-title"><lucide-icon name="chef-hat" [size]="28" class="text-muted"></lucide-icon> Pantalla Cocina (KDS)</h1>
          <p class="view-desc">Gestión de comandas y estado de preparación.</p>
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
            <span class="lab">Pedidos</span>
          </div>
        </div>
      </header>

      <main class="kds-layout">
        @if (vm.loading()) {
            <div class="kds-loader">
                <div class="loader-ripple"><div></div><div></div></div>
                <p>Sincronizando cocina...</p>
            </div>
        } @else {
            <section class="kds-grid">
            @for (order of vm.filteredOrders(); track order._id) {
                <div class="order-card glass-card" [class.urgent]="vm.getTimeDiff(order.createdAt).includes('15')">
                <div class="order-head">
                    <span class="table-num">Tótem #{{ order.totemId || order.tableNumber }}</span>
                    <span class="time-elapsed">{{ vm.getTimeDiff(order.createdAt) }}</span>
                </div>

                <div class="items-list">
                    @for (item of order.kitchenItems; track $index) {
                    <div class="kds-item" [class]="item.status">
                        <div class="item-info">
                        <div class="name-row">
                            <span class="qty">{{ item.quantity }}x</span>
                            <span class="name">{{ item.name }}</span>
                        </div>
                        <span class="ordered-by"><lucide-icon name="user" [size]="12" class="inline-icon"></lucide-icon> {{ item.orderedBy?.name }}</span>
                        </div>
                        
                        <div class="action-buttons">
                        @if (item.status === 'pending') {
                            <button class="btn-action prepare" (click)="vm.updateItemStatus(order._id, item._id || item.id, 'preparing')">
                            PREPARAR
                            </button>
                            <button class="btn-cancel" (click)="vm.cancelItem(order._id, item._id || item.id)">
                            ✕
                            </button>
                        }
                        @if (item.status === 'preparing') {
                            <div class="ready-actions">
                                <button class="btn-action ready" (click)="vm.updateItemStatus(order._id, item._id || item.id, 'ready', false)">
                                ¡LISTO!
                                </button>
                                <button class="btn-action ready-print" (click)="vm.updateItemStatus(order._id, item._id || item.id, 'ready', true)">
                                <lucide-icon name="printer" [size]="14" class="inline-icon"></lucide-icon> + LISTO
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
                            <span class="cancelled-tag">ANULADO</span>
                        }
                        </div>
                    </div>
                    }
                </div>
                </div>
            } @empty {
                <div class="empty-kds">
                <div class="empty-icon"><lucide-icon name="chef-hat" [size]="64" color="var(--text-muted)"></lucide-icon></div>
                <h2>Cocina en calma</h2>
                <p>No hay pedidos pendientes en este momento.</p>
                </div>
            }
            </section>
        }

        <!-- Stock / Product Availability Manager -->
        @if (vm.showStockManager()) {
          <aside class="stock-sidebar glass-card">
            <header>
              <h3>Disponibilidad de Productos</h3>
              <p>Desactiva platos que se hayan agotado.</p>
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
      height: 100vh;
      background: var(--bg-dark);
      display: flex;
      flex-direction: column;
      padding: 16px;
      gap: 16px;
      overflow: hidden;
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
      gap: 16px;
      overflow: hidden;
    }

    .kds-grid {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 16px;
      overflow-y: auto;
      padding-bottom: 40px;
    }

    @media (max-width: 768px) {
      .kds-grid { grid-template-columns: 1fr; }
      .kds-header { flex-direction: column; gap: 12px; align-items: flex-start; }
      .stock-sidebar { width: 100%; }
      .kds-layout { flex-direction: column; }
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
      padding: 16px;
      background: rgba(255,255,255,0.02);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .items-list { padding: 8px; }

    .kds-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      margin-bottom: 8px;
      border-radius: 12px;
      background: rgba(255,255,255,0.03);
    }

    .kds-item.preparing { background: rgba(192, 132, 252, 0.1); border-left: 4px solid var(--accent-secondary); }
    .kds-item.ready { opacity: 0.5; background: rgba(34, 197, 94, 0.05); }
    .kds-item.cancelled { opacity: 0.5; border: 1px dashed #ef4444; }

    .item-info { flex: 1; display: flex; flex-direction: column; gap: 4px; }
    .name-row { display: flex; align-items: center; gap: 8px; }
    .qty { font-weight: 900; color: var(--accent-primary); font-size: 1.1rem; }
    .name { font-weight: 700; font-size: 1.1rem; color: var(--text-base); }
    .ordered-by { font-size: 0.75rem; color: var(--text-muted); }

    .action-buttons { 
      display: flex; 
      align-items: center; 
      gap: 12px; 
      margin-left: 16px; 
    }

    .btn-action {
      border: none;
      padding: 12px 20px;
      border-radius: 10px;
      font-weight: 800;
      cursor: pointer;
      min-width: 120px;
    }
    .prepare { background: var(--accent-primary); color: var(--bg-dark); }
    .ready { background: var(--highlight); color: var(--bg-dark); }
    .ready-print { 
        background: rgba(34, 197, 94, 0.1); 
        color: var(--highlight); 
        border: 1px solid rgba(34, 197, 94, 0.3); 
        min-width: 60px;
        padding-left: 12px;
        padding-right: 12px;
    }

    .ready-actions { display: flex; gap: 8px; }


    .done-check-box { display: flex; align-items: center; gap: 12px; }
    .btn-reprint {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        color: var(--text-base);
        padding: 4px 8px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.8rem;
    }

    .btn-cancel {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.2);
      width: 44px;
      height: 44px;
      border-radius: 10px;
      font-size: 1.2rem;
      cursor: pointer;
    }

    .cancelled-tag { color: #ef4444; font-weight: bold; font-size: 0.8rem; }

    .stock-sidebar {
      width: 350px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 24px;
      animation: slideInRight 0.3s ease-out;
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
