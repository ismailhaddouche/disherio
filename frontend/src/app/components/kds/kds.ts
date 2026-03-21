import { Component, inject, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KDSViewModel } from './kds.viewmodel';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-kds',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule],
  providers: [KDSViewModel],
  template: `
    <div class="md-page-shell kds-container animate-fade-in">
      <header class="section-header-md3">
        <div class="header-content">
          <div class="title-with-icon">
            <div class="icon-box-md3 primary">
                <lucide-icon name="chef-hat" [size]="24"></lucide-icon>
            </div>
            <div>
              <h1 class="text-headline-medium">{{ 'KDS.TITLE' | translate }}</h1>
              <p class="text-body-small opacity-60">{{ 'KDS.SUBTITLE' | translate }}</p>
            </div>
          </div>
        </div>
        
        <div class="header-actions">
          @if (vm.error()) {
            <div class="md-badge-error">
              <lucide-icon name="alert-triangle" [size]="14"></lucide-icon>
              <span>{{ vm.error() }}</span>
            </div>
          }
          
          <button class="btn-tonal" (click)="vm.showStockManager.set(!vm.showStockManager())">
            <lucide-icon name="package" [size]="18"></lucide-icon>
            <span>{{ 'KDS.AVAILABILITY' | translate }}</span>
          </button>

          <div class="stat-chip-md3">
            <span class="text-title-medium">{{ vm.filteredOrders().length }}</span>
            <span class="text-label-small">{{ 'KDS.ORDERS' | translate }}</span>
          </div>
        </div>
      </header>

      <main class="kds-layout">
        @if (vm.loading()) {
            <div class="kds-loader">
                <lucide-icon name="loader-2" [size]="48" class="animate-spin opacity-20"></lucide-icon>
                <p class="text-body-medium opacity-60">{{ 'KDS.SYNCING' | translate }}</p>
            </div>
        } @else {
            <section class="kds-grid">
            @for (order of vm.filteredOrders(); track order._id) {
                <div class="order-card-md3" [class.urgent]="order.urgent">
                  <header class="order-header-md3">
                    <div class="order-meta">
                        <span class="text-title-large color-primary">{{ 'ROLES.Table' | translate }} #{{ order.totemId || order.tableNumber }}</span>
                        <div class="time-badge">
                           <lucide-icon name="clock" [size]="14"></lucide-icon>
                           <span class="text-label-medium">{{ vm.getTimeDiff(order.createdAt) }}</span>
                        </div>
                    </div>
                    <div class="bulk-actions-md3">
                        <button class="icon-btn-md3 success-tonal" (click)="vm.bulkUpdateItemsStatus(order._id, 'ready')" [attr.aria-label]="'KDS.ALL_READY' | translate" [title]="'KDS.ALL_READY' | translate">
                            <lucide-icon name="check-check" [size]="18"></lucide-icon>
                        </button>
                        <button class="icon-btn-md3 info-tonal" (click)="vm.bulkUpdateItemsStatus(order._id, 'served')" [attr.aria-label]="'KDS.ALL_SERVED' | translate" [title]="'KDS.ALL_SERVED' | translate">
                            <lucide-icon name="bell-ring" [size]="18"></lucide-icon>
                        </button>
                    </div>
                  </header>

                  <div class="items-list-md3">
                    @for (item of order.kitchenItems; track $index) {
                      <div class="kds-item-md3" [class]="item.status">
                        <div class="item-thumb-md3" *ngIf="item.image" [style.backgroundImage]="'url(' + item.image + ')'"></div>
                        <div class="item-main-md3">
                          <div class="item-name-row">
                              <span class="text-title-medium item-qty">{{ item.quantity }}x</span>
                              <span class="text-title-medium item-name">{{ item.name }}</span>

                              @if (item.createdAt && item.status !== 'ready') {
                                  <span class="item-timer-md3" [class.urgent]="vm.getTimeDiffMinutes(item.createdAt) >= 15">
                                    {{ vm.getTimeDiff(item.createdAt) }}
                                  </span>
                              }
                          </div>
                          
                          <div class="item-sub-info">
                              <span class="text-label-medium opacity-60">
                                <lucide-icon name="user" [size]="12"></lucide-icon>
                                {{ item.orderedBy?.name }}
                              </span>
                              @if (item.notes) {
                                  <span class="item-note-md3">
                                    <lucide-icon name="message-square" [size]="12"></lucide-icon>
                                    "{{ item.notes }}"
                                  </span>
                              }
                          </div>
                        </div>
                        
                        <div class="item-actions-md3">
                          @if (item.status === 'pending') {
                              <button class="btn-primary-sm" (click)="vm.updateItemStatus(order._id, item._id || item.id, 'preparing')">
                                {{ 'KDS.MARK_PREPARING' | translate }}
                              </button>
                              <button class="icon-btn-md3 error-tonal-sm" (click)="vm.cancelItem(order._id, item._id || item.id)">
                                <lucide-icon name="x" [size]="16"></lucide-icon>
                              </button>
                          }
                          @if (item.status === 'preparing') {
                              <div class="ready-action-group">
                                  <button class="btn-success-sm" (click)="vm.updateItemStatus(order._id, item._id || item.id, 'ready', false)">
                                    <lucide-icon name="check" [size]="16"></lucide-icon>
                                    {{ 'KDS.MARK_READY' | translate }}
                                  </button>
                                  <button class="icon-btn-md3 success-tonal-sm" (click)="vm.updateItemStatus(order._id, item._id || item.id, 'ready', true)">
                                    <lucide-icon name="printer" [size]="16"></lucide-icon>
                                  </button>
                              </div>
                          }
                          @if (item.status === 'ready') {
                              <div class="ready-status-md3">
                                  <div class="status-icon success">
                                    <lucide-icon name="check-circle" [size]="20"></lucide-icon>
                                  </div>
                                  <button class="icon-btn-md3 tonal-sm" (click)="vm.printItemTicket(order, item)" [attr.aria-label]="'KDS.REPRINT' | translate" [title]="'KDS.REPRINT' | translate">
                                    <lucide-icon name="printer" [size]="16"></lucide-icon>
                                  </button>
                              </div>
                          }
                          @if (item.status === 'cancelled') {
                              <span class="text-label-small status-tag error">{{ 'KDS.CANCELLED' | translate }}</span>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>
            } @empty {
                <div class="empty-state-md3">
                  <div class="empty-icon-box">
                    <lucide-icon name="chef-hat" [size]="64"></lucide-icon>
                  </div>
                  <h2 class="text-headline-small">{{ 'KDS.EMPTY_TITLE' | translate }}</h2>
                  <p class="text-body-medium opacity-60">{{ 'KDS.EMPTY_DESC' | translate }}</p>
                </div>
            }
            </section>
        }

        <!-- Stock / Product Availability Manager -->
        @if (vm.showStockManager()) {
          <div class="stock-drawer-backdrop" (click)="vm.showStockManager.set(false)">
            <aside class="stock-drawer-md3" (click)="$event.stopPropagation()">
              <header class="drawer-header-md3">
                <div>
                  <h3 class="text-title-large">{{ 'KDS.AVAILABILITY' | translate }}</h3>
                  <p class="text-label-medium opacity-60">{{ 'KDS.AVAILABILITY_DESC' | translate }}</p>
                </div>
                <button class="icon-btn-md3" (click)="vm.showStockManager.set(false)">
                  <lucide-icon name="x" [size]="20"></lucide-icon>
                </button>
              </header>
              <div class="stock-list-md3">
                @for (item of vm.productList(); track item._id) {
                  <div class="stock-item-row-md3">
                    <div class="stock-info">
                      <span class="text-title-small">{{ item.name }}</span>
                      <span class="text-label-small opacity-60">{{ item.category }}</span>
                    </div>
                    <button class="md-toggle-btn" 
                            [class.off]="!item.available"
                            [attr.aria-pressed]="item.available"
                            (click)="vm.toggleProduct(item._id)">
                      {{ (item.available ? 'KDS.STOCK_ACTIVE' : 'KDS.STOCK_OUT') | translate }}
                    </button>
                  </div>
                }
              </div>
            </aside>
          </div>
        }
      </main>
    </div>
  `,
  styles: [`
    .kds-container {
      width: 100%;
    }

    .kds-layout {
      position: relative;
      min-height: 400px;
    }

    .kds-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 24px;
      align-items: start;
    }

    /* Solid Order Card — high contrast for kitchen environment */
    .order-card-md3 {
      background: var(--md-sys-color-surface-container);
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid var(--md-sys-color-outline-variant);
      box-shadow: var(--md-sys-elevation-1);
      transition: border-color 0.2s;
      animation: slideUp 0.4s ease-out;
    }
    
    .order-card-md3:hover { 
      border-color: rgba(var(--md-sys-color-primary-rgb), 0.4);
    }
    
    .order-card-md3.urgent {
      border: 2px solid var(--md-sys-color-error);
      background: rgba(var(--md-sys-color-error-container-rgb), 0.25);
      animation: urgentPulse 2s infinite;
    }

    @keyframes urgentPulse {
      0% { box-shadow: 0 0 0 0 rgba(186, 26, 26, 0.4); }
      70% { box-shadow: 0 0 20px 10px rgba(186, 26, 26, 0); }
      100% { box-shadow: 0 0 0 0 rgba(186, 26, 26, 0); }
    }

    .order-header-md3 {
      padding: 16px 20px;
      background: var(--md-sys-color-surface-container-high);
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
    }

    .order-meta { display: flex; flex-direction: column; gap: 4px; }
    
    .time-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: rgba(0,0,0,0.05);
      border-radius: 20px;
      color: var(--md-sys-color-on-surface-variant);
    }

    .bulk-actions-md3 { display: flex; gap: 8px; }

    .items-list-md3 { padding: 16px; display: flex; flex-direction: column; gap: 12px; }

    .kds-item-md3 {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-radius: 12px;
      background: var(--md-sys-color-surface-container-high);
      border: 1px solid var(--md-sys-color-outline-variant);
      transition: background 0.2s;
    }

    .kds-item-md3:hover {
      background: var(--md-sys-color-surface-container-highest);
    }

    .kds-item-md3.preparing {
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
      border-color: var(--md-sys-color-primary);
    }
    .kds-item-md3.preparing .opacity-60 { color: var(--md-sys-color-on-primary-container); opacity: 0.7; }

    .kds-item-md3.ready {
      opacity: 0.65;
      background: var(--md-sys-color-surface-container-highest);
    }

    .kds-item-md3.cancelled {
      opacity: 0.4;
      text-decoration: line-through;
      border: 1px dashed var(--md-sys-color-error);
      background: transparent;
    }

    .item-thumb-md3 {
      width: 48px; height: 48px; border-radius: 12px;
      background-size: cover; background-position: center;
      background-color: var(--md-sys-color-surface-variant);
      flex-shrink: 0;
    }

    .item-main-md3 { flex: 1; display: flex; flex-direction: column; gap: 6px; }
    .item-name-row { display: flex; align-items: baseline; gap: 12px; }
    .item-qty { font-weight: 900; color: var(--md-sys-color-primary); font-size: 1.1rem; }
    .item-name { font-weight: 600; }
    
    .kds-item-md3.preparing .item-qty { color: inherit; }

    .item-timer-md3 {
      padding: 4px 12px;
      border-radius: 12px;
      background: rgba(0,0,0,0.08);
      font-size: 0.75rem;
      font-weight: 800;
      color: var(--md-sys-color-on-surface-variant);
    }
    .item-timer-md3.urgent { 
      background: var(--md-sys-color-error); 
      color: var(--md-sys-color-on-error);
      animation: blink 1s infinite;
    }

    @keyframes blink { 50% { opacity: 0.7; } }

    .item-sub-info { display: flex; align-items: center; gap: 12px; }
    
    .item-note-md3 {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      background: rgba(var(--md-sys-color-secondary-container-rgb), 0.3);
      border-radius: 8px;
      font-size: 0.75rem;
      color: var(--md-sys-color-secondary);
      font-weight: 600;
    }

    .item-actions-md3 { display: flex; align-items: center; gap: 10px; }

    .ready-action-group { display: flex; gap: 8px; }

    .ready-status-md3 { display: flex; align-items: center; gap: 16px; }
    .status-icon.success { color: #10b981; }

    .status-tag {
      padding: 6px 14px;
      border-radius: 100px;
      text-transform: uppercase;
      font-weight: 900;
      font-size: 0.7rem;
      letter-spacing: 0.05em;
    }
    .status-tag.error { background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); }

    /* Stock Drawer */
    .stock-drawer-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.3);
      z-index: 1000;
      display: flex;
      justify-content: flex-end;
      animation: fadeIn 0.3s ease-out;
      backdrop-filter: blur(12px);
    }

    .stock-drawer-md3 {
      width: 100%;
      max-width: 440px;
      height: 100%;
      background: var(--md-sys-color-surface-container-low);
      box-shadow: -4px 0 32px rgba(0,0,0,0.4);
      padding: 32px;
      display: flex;
      flex-direction: column;
      gap: 28px;
      animation: slideInRight 0.35s cubic-bezier(0.05, 0.7, 0.1, 1);
    }

    .drawer-header-md3 { display: flex; justify-content: space-between; align-items: flex-start; }

    .stock-list-md3 {
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;
      padding-right: 12px;
    }

    .stock-item-row-md3 {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: var(--md-sys-color-surface-container);
      border-radius: 14px;
      border: 1px solid var(--md-sys-color-outline-variant);
      transition: background 0.15s;
    }
    .stock-item-row-md3:hover { background: var(--md-sys-color-surface-container-high); }

    .md-toggle-btn {
      padding: 10px 20px;
      border-radius: 100px;
      border: none;
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
      font-size: 0.75rem;
      font-weight: 900;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .md-toggle-btn:active { transform: scale(0.9); }
    .md-toggle-btn.off {
      background: var(--md-sys-color-surface-variant);
      color: var(--md-sys-color-on-surface-variant);
      box-shadow: none;
    }

    /* Helper Classes */
    .md-badge-error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: var(--md-sys-color-error-container);
      color: var(--md-sys-color-on-error-container);
      border-radius: 100px;
      font-size: 0.85rem;
      font-weight: 800;
    }

    .empty-state-md3 {
      grid-column: 1 / -1;
      text-align: center;
      padding: 120px 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
    }
    .empty-icon-box {
      width: 120px; height: 120px;
      border-radius: 50%;
      background: var(--md-sys-color-surface-container-high);
      display: flex; align-items: center; justify-content: center;
      color: var(--md-sys-color-on-surface-variant);
      margin-bottom: 12px;
    }

    .kds-loader {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 24px;
      padding: 150px;
    }

    .animate-spin { animation: spin 1s linear infinite; }
    .animate-fade-in { animation: fadeIn 0.6s ease-out; }
    
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }

    @media (max-width: 768px) {
      .kds-grid { grid-template-columns: 1fr; }
      .stock-drawer-md3 { width: 100%; max-width: none; }
    }

    .btn-primary-sm, .btn-success-sm, .btn-tonal-sm {
       padding: 10px 20px; border-radius: 100px; border: none; font-weight: 800; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 8px;
       transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .btn-primary-sm:hover, .btn-success-sm:hover { transform: scale(1.05); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .btn-primary-sm:active, .btn-success-sm:active { transform: scale(0.95); }
    
    .btn-primary-sm { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
    .btn-success-sm { background: #10b981; color: white; }

    .color-primary { color: var(--md-sys-color-primary); }
    .opacity-60 { opacity: 0.6; }

  `]
})
export class KDSComponent implements OnInit {
  public vm = inject(KDSViewModel);
  public auth = inject(AuthService);
  public theme = inject(ThemeService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.vm.initKDS();

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((e: any) => {
      if (e.url?.includes('/kds')) {
        this.vm.initKDS();
      }
    });
  }
}
