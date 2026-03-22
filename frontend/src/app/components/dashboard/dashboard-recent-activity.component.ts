import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';
import { DashboardViewModel } from './dashboard.viewmodel';

@Component({
  selector: 'app-dashboard-recent-activity',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule],
  template: `
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
  `,
  styles: [`
    .activity-section { padding: 24px; }
    .section-header { 
        display: flex; justify-content: space-between; align-items: center; 
        margin-bottom: 24px; 
    }

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

    .opacity-40 { opacity: 0.4; }
  `]
})
export class DashboardRecentActivityComponent {
  public vm = inject(DashboardViewModel);
}
