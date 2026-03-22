import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';
import { DashboardViewModel } from './dashboard.viewmodel';

@Component({
  selector: 'app-dashboard-stats',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule],
  template: `
    <div class="stats-grid">
      <div class="md-card md-card-elevated stat-card">
        <div class="icon-box-md3 primary">
          <lucide-icon name="shopping-bag" [size]="20"></lucide-icon>
        </div>
        <div class="stat-info">
          <span class="text-label-large opacity-70">{{ 'DASHBOARD.ACTIVE_ORDERS' | translate }}</span>
          <h2 class="text-display-small">{{ vm.activeOrdersCount() }}</h2>
        </div>
      </div>
      
      <div class="md-card md-card-elevated stat-card">
        <div class="icon-box-md3 secondary">
          <lucide-icon name="currency-euro" [size]="20"></lucide-icon>
        </div>
        <div class="stat-info">
          <span class="text-label-large opacity-70">{{ 'DASHBOARD.DAILY_REVENUE' | translate }}</span>
          <h2 class="text-display-small">{{ vm.dailyRevenue() | currency:'EUR' }}</h2>
        </div>
      </div>

      <div class="md-card md-card-elevated stat-card">
        <div class="icon-box-md3" [class.success]="!vm.error()" [class.error]="vm.error()">
          <lucide-icon [name]="vm.error() ? 'alert-circle' : 'check-circle-2'" [size]="20"></lucide-icon>
        </div>
        <div class="stat-info">
          <span class="text-label-large opacity-70">{{ 'DASHBOARD.SYS_STATUS' | translate }}</span>
          <h2 class="text-title-large">
            {{ vm.error() ? ('DASHBOARD.ERROR_CONN' | translate) : ('DASHBOARD.OPERATIONAL' | translate) }}
          </h2>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: var(--space-lg);
    }

    .stat-card {
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 32px;
      background: var(--md-sys-color-surface-2);
    }

    .icon-box-md3 {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: var(--md-sys-color-surface-container-highest);
    }

    .icon-box-md3.primary { background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); }
    .icon-box-md3.secondary { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
    .icon-box-md3.success { background: rgba(176, 255, 198, 0.1); color: #b0ffc6; }
    .icon-box-md3.error { background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); }

    .stat-info { display: flex; flex-direction: column; }
    .stat-info h2 { margin-top: 4px; }
  `]
})
export class DashboardStatsComponent {
  public vm = inject(DashboardViewModel);
}
