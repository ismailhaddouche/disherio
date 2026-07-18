import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { authStore } from '../../../store/auth.store';
import { I18nService } from '../../../core/services/i18n.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { CurrencyFormatPipe } from '../../../shared/pipes/currency-format.pipe';
import { NotificationService } from '../../../core/services/notification.service';
import { DashboardService, DashboardStats } from '../../../core/services/dashboard.service';

interface OrderStatusItem {
  label: string;
  count: number | null;
  dotClass: string;
  containerClass: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CurrencyFormatPipe, TranslatePipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-container">
      <header class="admin-header">
        <div>
          <h1 class="admin-title">{{ 'dashboard.title' | translate }}</h1>
          <p class="admin-subtitle">{{ 'dashboard.subtitle' | translate }}</p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <label class="admin-label mb-0 whitespace-nowrap" for="dateFrom">{{ 'common.from' | translate }}</label>
          <input
            id="dateFrom"
            type="date"
            [value]="dateFrom()"
            (change)="onDateFromChange($event)"
            class="admin-input w-auto py-1.5"
          />
          <label class="admin-label mb-0 whitespace-nowrap" for="dateTo">{{ 'common.to' | translate }}</label>
          <input
            id="dateTo"
            type="date"
            [value]="dateTo()"
            (change)="onDateToChange($event)"
            class="admin-input w-auto py-1.5"
          />

          <button matButton (click)="loadData()" class="disher-refresh-btn">
            <mat-icon aria-hidden="true">refresh</mat-icon>
            {{ 'common.refresh' | translate }}
          </button>
        </div>
      </header>

      @if (loading()) {
        <div class="disher-loading-state">
          <mat-progress-spinner mode="indeterminate" diameter="48" />
          <p class="disher-loading-text">{{ 'common.loading' | translate }}</p>
        </div>
      } @else {
        <!-- KPI Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <!-- Revenue -->
          <div class="admin-card p-5">
            <div class="flex items-center gap-3 mb-2">
              <div class="disher-kpi-icon kpi-revenue">
                <span class="material-symbols-outlined" aria-hidden="true">payments</span>
              </div>
              <span class="text-sm text-on-surface-variant">{{ 'dashboard.stats.revenue' | translate }}</span>
            </div>
            <div class="text-2xl font-medium text-on-surface">{{ data()?.paymentStats?.totalRevenue | currencyFormat }}</div>
          </div>

          <!-- Orders -->
          <div class="admin-card p-5">
            <div class="flex items-center gap-3 mb-2">
              <div class="disher-kpi-icon kpi-orders">
                <span class="material-symbols-outlined" aria-hidden="true">receipt</span>
              </div>
              <span class="text-sm text-on-surface-variant">{{ 'dashboard.stats.orders' | translate }}</span>
            </div>
            <div class="text-2xl font-medium text-on-surface">{{ data()?.paymentStats?.totalTransactions }}</div>
          </div>

          <!-- Avg Ticket -->
          <div class="admin-card p-5">
            <div class="flex items-center gap-3 mb-2">
              <div class="disher-kpi-icon kpi-avg">
                <span class="material-symbols-outlined" aria-hidden="true">trending_up</span>
              </div>
              <span class="text-sm text-on-surface-variant">{{ 'dashboard.stats.avgTicket' | translate }}</span>
            </div>
            <div class="text-2xl font-medium text-on-surface">{{ data()?.paymentStats?.averageTicket | currencyFormat }}</div>
          </div>

          <!-- Customers Served -->
          <div class="admin-card p-5">
            <div class="flex items-center gap-3 mb-2">
              <div class="disher-kpi-icon kpi-customers">
                <span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
              </div>
              <span class="text-sm text-on-surface-variant">{{ 'dashboard.stats.customers' | translate }}</span>
            </div>
            <div class="text-2xl font-medium text-on-surface">{{ data()?.orderStatus?.served }}</div>
          </div>
        </div>

        <!-- Order Status -->
        <div class="admin-card p-5">
          <h2 class="disher-section-title">
            <span class="material-symbols-outlined" aria-hidden="true">kitchen</span>
            {{ 'kds.title' | translate }}
          </h2>
          <div class="flex gap-4 flex-wrap">
            @for (status of orderStatusItems(); track status.label) {
              <div class="disher-status-chip" [class]="status.containerClass">
                <div class="disher-status-dot" [class]="status.dotClass"></div>
                <span class="text-sm font-medium text-on-surface-variant">
                  {{ status.label }}: {{ status.count }}
                </span>
              </div>
            }
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Top Dishes -->
          <div class="admin-card p-5">
            <h2 class="disher-section-title">
              <span class="material-symbols-outlined" aria-hidden="true">restaurant</span>
              {{ 'dashboard.popularDishes' | translate }}
            </h2>
            <div class="flex flex-col">
              @for (dish of data()?.salesByDish; track dish.dishId) {
                <div class="disher-list-row">
                  <div>
                    <div class="font-medium text-on-surface">{{ dish.dishName }}</div>
                    <div class="text-sm text-on-surface-variant">{{ dish.quantity }} {{ 'dashboard.chart.orders' | translate | lowercase }}</div>
                  </div>
                  <div class="font-medium text-primary">{{ dish.revenue | currencyFormat }}</div>
                </div>
              }
              @if (!data()?.salesByDish?.length) {
                <p class="disher-empty-text">{{ 'error.notFound' | translate }}</p>
              }
            </div>
          </div>

          <!-- Sales by Category -->
          <div class="admin-card p-5">
            <h2 class="disher-section-title">
              <span class="material-symbols-outlined" aria-hidden="true">category</span>
              {{ 'admin.menu.categories' | translate }}
            </h2>
            <div class="flex flex-col">
              @for (cat of data()?.salesByCategory; track cat.categoryId) {
                <div class="disher-list-row">
                  <div>
                    <div class="font-medium text-on-surface">{{ cat.categoryName }}</div>
                    <div class="text-sm text-on-surface-variant">{{ cat.quantity }} {{ 'dashboard.chart.orders' | translate | lowercase }}</div>
                  </div>
                  <div class="font-medium text-primary">{{ cat.revenue | currencyFormat }}</div>
                </div>
              }
              @if (!data()?.salesByCategory?.length) {
                <p class="disher-empty-text">{{ 'error.notFound' | translate }}</p>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .disher-loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 0;
      gap: 16px;
    }
    .disher-loading-text {
      color: var(--mat-sys-on-surface-variant);
      font-weight: 500;
      margin: 0;
    }
    .disher-refresh-btn { min-height: 36px; }
    .disher-kpi-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: var(--disher-shape-md);
    }
    .disher-kpi-icon .material-symbols-outlined { font-size: 22px; }
    .kpi-revenue { background: var(--mat-sys-primary-container); }
    .kpi-revenue .material-symbols-outlined { color: var(--mat-sys-on-primary-container); }
    .kpi-orders { background: var(--mat-sys-surface-container-high); }
    .kpi-orders .material-symbols-outlined { color: var(--mat-sys-on-surface-variant); }
    .kpi-avg { background: var(--mat-sys-tertiary-container); }
    .kpi-avg .material-symbols-outlined { color: var(--mat-sys-on-tertiary-container); }
    .kpi-customers { background: var(--disher-success-container); }
    .kpi-customers .material-symbols-outlined { color: var(--disher-on-success-container); }
    .disher-section-title {
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 16px;
      color: var(--mat-sys-on-surface);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .disher-status-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: var(--disher-shape-sm);
      border: 1px solid var(--mat-sys-outline-variant);
    }
    .disher-status-dot {
      width: 10px;
      height: 10px;
      border-radius: var(--disher-shape-full);
    }
    .dot-ordered { background: var(--mat-sys-tertiary); }
    .dot-preparing { background: var(--mat-sys-primary); }
    .dot-served { background: var(--disher-success); }
    .dot-canceled { background: var(--mat-sys-error); }
    .chip-ordered { background: var(--mat-sys-tertiary-container); border-color: transparent; }
    .chip-preparing { background: var(--mat-sys-primary-container); border-color: transparent; }
    .chip-served { background: var(--disher-success-container); border-color: transparent; }
    .chip-canceled { background: var(--mat-sys-error-container); border-color: transparent; }
    .disher-list-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .disher-list-row:last-child { border-bottom: none; }
    .disher-empty-text {
      color: var(--mat-sys-on-surface-variant);
      text-align: center;
      padding: 32px 0;
      margin: 0;
    }
  `],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private dashboardService = inject(DashboardService);
  private i18n = inject(I18nService);
  private notify = inject(NotificationService);
  private destroy$ = new Subject<void>();

  data = signal<DashboardStats | null>(null);
  loading = signal(false);
  dateFrom = signal('');
  dateTo = signal('');

  orderStatusItems = signal<OrderStatusItem[]>([]);

  ngOnInit() {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    this.dateTo.set(today.toISOString().split('T')[0]);
    this.dateFrom.set(thirtyDaysAgo.toISOString().split('T')[0]);

    if (authStore.isAuthenticated()) {
      this.loadData();
    }
  }

  loadData() {
    this.loading.set(true);

    this.dashboardService.getStats(this.dateFrom() || undefined, this.dateTo() || undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.data.set(res);
          this.updateOrderStatusItems();
          this.loading.set(false);
        },
        error: (err) => {
          this.notify.error(this.i18n.translate('dashboard.error'));
          this.loading.set(false);
        }
      });
  }

  private updateOrderStatusItems() {
    const d = this.data();
    this.orderStatusItems.set([
      { label: this.i18n.translate('kds.pending'), count: d?.orderStatus?.ordered ?? 0, dotClass: 'dot-ordered', containerClass: 'chip-ordered' },
      { label: this.i18n.translate('kds.preparing'), count: d?.orderStatus?.onPrepare ?? 0, dotClass: 'dot-preparing', containerClass: 'chip-preparing' },
      { label: this.i18n.translate('kds.ready'), count: d?.orderStatus?.served ?? 0, dotClass: 'dot-served', containerClass: 'chip-served' },
      { label: this.i18n.translate('common.cancel'), count: d?.orderStatus?.canceled ?? 0, dotClass: 'dot-canceled', containerClass: 'chip-canceled' },
    ]);
  }

  onDateFromChange(event: Event) {
    this.dateFrom.set((event.target as HTMLInputElement).value);
  }

  onDateToChange(event: Event) {
    this.dateTo.set((event.target as HTMLInputElement).value);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
