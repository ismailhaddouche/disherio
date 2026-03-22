import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';
import { DashboardViewModel } from './dashboard.viewmodel';

@Component({
  selector: 'app-dashboard-charts',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule],
  template: `
    <div class="md-card charts-section">
      <div class="section-header">
        <h3 class="text-title-large">{{ 'DASHBOARD.VISUAL_DATA' | translate }}</h3>
        <lucide-icon name="bar-chart-3" [size]="20" class="opacity-40"></lucide-icon>
      </div>
      
      <div class="chart-placeholder">
        <lucide-icon name="pie-chart" [size]="48" class="opacity-10"></lucide-icon>
        <p class="text-body-medium opacity-40">{{ 'DASHBOARD.CHARTS_COMING_SOON' | translate }}</p>
      </div>
    </div>
  `,
  styles: [`
    .charts-section { padding: 24px; margin-top: 24px; }
    .section-header { 
        display: flex; justify-content: space-between; align-items: center; 
        margin-bottom: 24px; 
    }
    .chart-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 200px;
        gap: 16px;
        background: var(--md-sys-color-surface-1);
        border-radius: 16px;
        border: 2px dashed var(--md-sys-color-outline-variant);
    }
    .opacity-40 { opacity: 0.4; }
    .opacity-10 { opacity: 0.1; }
  `]
})
export class DashboardChartsComponent {
  public vm = inject(DashboardViewModel);
}
