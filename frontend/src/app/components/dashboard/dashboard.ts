import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardViewModel } from './dashboard.viewmodel';
import { AuthService } from '../../services/auth.service';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule],
  providers: [DashboardViewModel],
  template: `
    <div class="dashboard-container animate-fade-in">
      <!-- Error Display -->
      @if (vm.error()) {
        <div class="error-banner md-card">
          <div class="error-icon">
            <lucide-icon name="alert-triangle" [size]="28" color="var(--md-sys-color-error)"></lucide-icon>
          </div>
          <div class="error-content">
            <h4 class="text-title-medium">{{ 'DASHBOARD.UPS' | translate }}</h4>
            <p class="text-body-medium">{{ vm.error() }}</p>
          </div>
          <button class="btn-outline" (click)="loadAgain()">
            <lucide-icon name="refresh-cw" [size]="16"></lucide-icon>
            {{ 'DASHBOARD.RETRY' | translate }}
          </button>
        </div>
      }

      <!-- Stats Header -->
      <div class="stats-grid">
        <div class="md-card-elevated stat-card primary-tonal">
          <div class="stat-header">
            <lucide-icon name="clock" [size]="20"></lucide-icon>
            <span class="text-label-large">{{ 'DASHBOARD.ACTIVE_ORDERS' | translate }}</span>
          </div>
          <h2 class="text-headline-large">{{ vm.activeOrdersCount() }}</h2>
        </div>
        
        <div class="md-card-elevated stat-card secondary-tonal">
          <div class="stat-header">
            <lucide-icon name="wallet" [size]="20"></lucide-icon>
            <span class="text-label-large">{{ 'DASHBOARD.DAILY_REVENUE' | translate }}</span>
          </div>
          <h2 class="text-headline-large">{{ vm.dailyRevenue() | currency:'EUR' }}</h2>
        </div>

        <div class="md-card-elevated stat-card surface-tonal">
          <div class="stat-header">
            <lucide-icon name="activity" [size]="20"></lucide-icon>
            <span class="text-label-large">{{ 'DASHBOARD.SYS_STATUS' | translate }}</span>
          </div>
          <h2 class="text-title-large" [class.text-success]="!vm.error()">
            {{ vm.error() ? ('DASHBOARD.ERROR_CONN' | translate) : ('DASHBOARD.OPERATIONAL' | translate) }}
          </h2>
        </div>
      </div>

      <!-- Totem Management -->
      <div class="md-card qr-section">
        <div class="view-header-row">
            <div class="header-text">
                <h3 class="text-headline-small">{{ 'DASHBOARD.TOTEM_MGT' | translate }}</h3>
                <p class="text-body-medium opacity-60">{{ 'DASHBOARD.TOTEM_DESC' | translate }}</p>
            </div>
            <div class="totem-add-controls">
                <input type="text" #totemName [placeholder]="'DASHBOARD.TOTEM_NAME' | translate" class="md-input">
                <button class="btn-primary" (click)="vm.addTotem(totemName.value); totemName.value=''">
                    <lucide-icon name="plus" [size]="18"></lucide-icon>
                    {{ 'DASHBOARD.ADD_TOTEM' | translate }}
                </button>
            </div>
        </div>

        <div class="totem-grid">
            @for (totem of vm.totems(); track totem.id) {
                <div class="totem-card md-card-elevated">
                    <div class="totem-avatar">#{{ totem.id }}</div>
                    <div class="totem-info">
                        <span class="text-title-medium">{{ totem.name }}</span>
                        @if (totem.isVirtual) {
                            <span class="text-label-small color-primary"> ({{ 'WAITER.VIRTUAL_TAG' | translate }})</span>
                        }
                    </div>
                    
                    <div class="totem-actions">
                        <button class="icon-btn" (click)="openQR(totem.id)" [title]="'DASHBOARD.VIEW_QR' | translate">
                            <lucide-icon name="printer" [size]="18"></lucide-icon>
                        </button>
                        <button class="icon-btn" (click)="vm.editingTotem.set(totem)" [title]="'DASHBOARD.EDIT' | translate">
                            <lucide-icon name="pen" [size]="18"></lucide-icon>
                        </button>
                        <button class="icon-btn error" (click)="vm.deleteTotem(totem.id)" [title]="'DASHBOARD.DELETE' | translate">
                            <lucide-icon name="trash-2" [size]="18"></lucide-icon>
                        </button>
                    </div>
                </div>
            } @empty {
                <div class="empty-state text-body-large">{{ 'DASHBOARD.NO_TOTEMS' | translate }}</div>
            }
        </div>
      </div>

      <!-- Edit Totem Modal (Bottom Sheet-like for mobile, dialog for desktop) -->
      @if (vm.editingTotem(); as totem) {
        <div class="modal-overlay" (click)="vm.editingTotem.set(null)">
          <div class="modal-dialog md-card-elevated" (click)="$event.stopPropagation()">
            <h2 class="text-headline-small">{{ 'DASHBOARD.EDIT_TOTEM' | translate }} #{{ totem.id }}</h2>
            
            <div class="form-field">
                <label class="text-label-large">{{ 'DASHBOARD.TOTEM_NAME' | translate }}</label>
                <input type="text" #editName [value]="totem.name" class="md-input" (keyup.enter)="vm.updateTotem(totem.id, editName.value)">
            </div>

            <div class="modal-actions">
              <button class="btn-outline" (click)="vm.editingTotem.set(null)">{{ 'DASHBOARD.CANCEL' | translate }}</button>
              <button class="btn-primary" (click)="vm.updateTotem(totem.id, editName.value)">{{ 'DASHBOARD.SAVE' | translate }}</button>
            </div>
          </div>
        </div>
      }

      <!-- Main Content Grid -->
      <div class="dashboard-main-grid">
        <div class="md-card orders-section">
          <div class="section-header">
            <h3 class="text-title-large">{{ 'DASHBOARD.REALTIME' | translate }}</h3>
            <span class="status-chip active-pulse">{{ 'DASHBOARD.LIVE' | translate }}</span>
          </div>

          @if (vm.loading()) {
            <div class="loader-container">
                <div class="loader-ripple"><div></div><div></div></div>
                <p class="text-body-medium">{{ 'DASHBOARD.SYNCING' | translate }}</p>
            </div>
          } @else {
            <div class="orders-column">
              @for (order of vm.orders(); track order._id) {
                <div class="md-card order-item-md3" [class.active]="order.status === 'active'">
                  <div class="order-header-md3">
                    <div class="table-info">
                        <span class="text-label-large opacity-60">{{ 'DASHBOARD.TOTEM' | translate }}</span>
                        <span class="text-title-large">#{{ order.totemId }}</span>
                    </div>
                    <div class="time-info text-body-medium opacity-60">
                        <lucide-icon name="clock" [size]="14"></lucide-icon>
                        {{ order.createdAt | date:'HH:mm' }}
                    </div>
                  </div>
                  
                  <div class="order-items-list">
                    @for (item of order.items; track $index) {
                      <div class="item-row-md3">
                        <span class="qty text-label-large">{{ item.quantity }}x</span>
                        <span class="name text-body-large">{{ item.name }}</span>
                        <span class="status-tag" [class]="item.status">{{ item.status }}</span>
                      </div>
                    }
                  </div>

                  <div class="order-footer-md3">
                    <div class="price-container">
                        <span class="text-label-large opacity-60">{{ 'CUSTOMER.TOTAL' | translate }}</span>
                        <span class="text-title-large">{{ order.totalAmount | currency:'EUR' }}</span>
                    </div>
                    @if (order.status === 'active') {
                      <button class="btn-primary btn-sm" (click)="vm.completeOrder(order._id)">
                        <lucide-icon name="check" [size]="16"></lucide-icon>
                        {{ 'DASHBOARD.COMPLETE' | translate }}
                      </button>
                    }
                  </div>
                </div>
              } @empty {
                <div class="empty-state">
                  <lucide-icon name="clipboard-list" [size]="48" class="opacity-20"></lucide-icon>
                  <p class="text-body-large">{{ 'DASHBOARD.NO_ORDERS' | translate }}</p>
                </div>
              }
            </div>
          }
        </div>

        <div class="md-card activity-section">
          <div class="section-header">
            <h3 class="text-title-large">{{ 'DASHBOARD.ACTIVITY_LOG' | translate }}</h3>
            <lucide-icon name="history" [size]="20" class="opacity-40"></lucide-icon>
          </div>

          <div class="log-entries-column">
            @for (log of vm.logs(); track log._id) {
              <div class="log-item-md3">
                <div class="log-icon-wrapper">
                    <lucide-icon [name]="log.action.includes('LOGIN') ? 'user-check' : 'edit-2'" [size]="14"></lucide-icon>
                </div>
                <div class="log-content">
                  <div class="log-top">
                    <span class="text-label-large">{{ log.username }}</span>
                    <span class="text-label-small opacity-40">{{ log.timestamp | date:'HH:mm:ss' }}</span>
                  </div>
                  <span class="action-chip" [class]="log.action">{{ log.action }}</span>
                </div>
              </div>
            } @empty {
              <div class="empty-state">{{ 'DASHBOARD.NO_ACTIVITY' | translate }}</div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 20px;
      background: var(--md-sys-color-error-container);
      color: var(--md-sys-color-on-error-container);
      padding: 16px 24px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
    }

    .stat-card {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .stat-header { display: flex; align-items: center; gap: 12px; opacity: 0.8; }
    
    .primary-tonal { 
        background: var(--md-sys-color-primary-container); 
        color: var(--md-sys-color-on-primary-container); 
    }
    .secondary-tonal { 
        background: var(--md-sys-color-secondary-container); 
        color: var(--md-sys-color-on-secondary-container); 
    }
    .surface-tonal { 
        background: var(--md-sys-color-surface-2); 
    }

    .text-success { color: var(--highlight); }

    .qr-section { padding: 32px; }
    
    .view-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 32px;
        gap: 24px;
    }

    .totem-add-controls { display: flex; gap: 12px; align-items: center; }
    
    .md-input {
        background: var(--md-sys-color-surface-variant);
        border: none;
        border-radius: var(--radius-sm);
        padding: 12px 16px;
        color: var(--md-sys-color-on-surface);
        font-family: inherit;
        min-width: 200px;
    }

    .totem-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 20px;
    }

    .totem-card {
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 16px;
        background: var(--md-sys-color-surface-1);
    }

    .totem-avatar {
        width: 48px; height: 48px; 
        background: var(--md-sys-color-secondary-container);
        border-radius: 12px;
        display: flex; align-items: center; justify-content: center;
        font-weight: 700; color: var(--md-sys-color-on-secondary-container);
    }

    .totem-info { flex: 1; }
    
    .totem-actions { display: flex; gap: 4px; }
    .icon-btn {
        width: 36px; height: 36px; border-radius: 50%; border: none;
        background: transparent; color: var(--md-sys-color-on-surface-variant);
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: background 0.2s;
    }
    .icon-btn:hover { background: var(--md-sys-color-surface-variant); }
    .icon-btn.error:hover { color: var(--md-sys-color-error); }

    .dashboard-main-grid {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 24px;
    }

    @media (max-width: 1024px) {
        .dashboard-main-grid { grid-template-columns: 1fr; }
        .view-header-row { flex-direction: column; align-items: flex-start; }
        .totem-add-controls { width: 100%; }
        .totem-add-controls .md-input { flex: 1; }
    }

    .orders-section, .activity-section { padding: 24px; }
    .section-header { 
        display: flex; justify-content: space-between; align-items: center; 
        margin-bottom: 24px; 
    }

    .status-chip {
        padding: 4px 12px; border-radius: var(--radius-full);
        font-size: 0.75rem; font-weight: 600;
        background: var(--md-sys-color-secondary-container);
    }

    .active-pulse {
        background: color-mix(in srgb, var(--md-sys-color-primary) 15%, transparent);
        color: var(--md-sys-color-primary);
        position: relative;
    }

    .orders-column { display: grid; gap: 16px; }
    
    .order-item-md3 {
        padding: 20px;
        background: var(--md-sys-color-surface-2);
        display: flex;
        flex-direction: column;
        gap: 16px;
    }
    .order-item-md3.active {
        border-right: 4px solid var(--md-sys-color-primary);
    }

    .order-header-md3 { display: flex; justify-content: space-between; align-items: flex-start; }
    .table-info { display: flex; flex-direction: column; }
    .time-info { display: flex; align-items: center; gap: 6px; }

    .order-items-list { display: grid; gap: 8px; }
    .item-row-md3 { 
        display: flex; align-items: center; gap: 12px; 
        background: var(--md-sys-color-surface-1);
        padding: 8px 12px; border-radius: 12px;
    }
    .item-row-md3 .name { flex: 1; }
    .status-tag { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.6; }

    .order-footer-md3 {
        display: flex; justify-content: space-between; align-items: center;
        padding-top: 16px; border-top: 1px solid var(--md-sys-color-outline);
        opacity: 0.8;
    }
    .price-container { display: flex; flex-direction: column; }

    .log-entries-column { display: flex; flex-direction: column; gap: 12px; }
    .log-item-md3 {
        display: flex; gap: 16px; padding: 12px;
        border-radius: 16px; background: var(--md-sys-color-surface-1);
    }
    .log-icon-wrapper {
        width: 32px; height: 32px; border-radius: 10px;
        background: var(--md-sys-color-surface-variant);
        display: flex; align-items: center; justify-content: center;
        opacity: 0.6;
    }
    .log-content { flex: 1; display: flex; flex-direction: column; gap: 4px; }
    .log-top { display: flex; justify-content: space-between; }
    .action-chip {
        font-size: 0.65rem; padding: 2px 8px; border-radius: 4px;
        background: var(--md-sys-color-primary-container);
        color: var(--md-sys-color-on-primary-container);
        width: fit-content;
        text-transform: uppercase;
        font-weight: 700;
    }

    .modal-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .modal-dialog {
        width: 100%; max-width: 400px; padding: 24px;
        display: flex; flex-direction: column; gap: 24px;
    }
    .modal-actions { display: flex; justify-content: flex-end; gap: 12px; }

    .opacity-60 { opacity: 0.6; }
    .opacity-40 { opacity: 0.4; }
    .opacity-20 { opacity: 0.2; }
    .mt-16 { margin-top: 16px; }
  `]

})
export class DashboardComponent {
  public vm = inject(DashboardViewModel);
  private auth = inject(AuthService);

  public openQR(totemId: number) {
    const base = window.location.origin;
    window.open(`${base}/api/qr/${totemId}`, '_blank');
  }

  public loadAgain() {
    location.reload();
  }
}
