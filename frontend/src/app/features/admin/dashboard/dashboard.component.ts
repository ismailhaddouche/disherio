import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { authStore } from '../../../store/auth.store';
import { I18nService } from '../../../core/services/i18n.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { NotificationService } from '../../../core/services/notification.service';

interface SalesByDish {
  dishId: string;
  dishName: string;
  quantity: number;
  revenue: number;
}

interface SalesByCategory {
  categoryId: string;
  categoryName: string;
  revenue: number;
  quantity: number;
}

interface PaymentStats {
  totalRevenue: number;
  totalTransactions: number;
  averageTicket: number;
}

interface OrderStatus {
  ordered: number;
  onPrepare: number;
  served: number;
  canceled: number;
}

interface DashboardData {
  salesByDish: SalesByDish[];
  salesByCategory: SalesByCategory[];
  paymentStats: PaymentStats;
  orderStatus: OrderStatus;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-container">
      <header class="admin-header">
        <div>
          <h1 class="admin-title">{{ 'dashboard.title' | translate }}</h1>
          <p class="admin-subtitle">{{ 'dashboard.subtitle' | translate }}</p>
        </div>
        
        <div class="flex items-center gap-3">
          <label class="admin-label mb-0 text-sm">{{ 'common.from' | translate }}</label>
          <input 
            type="date" 
            [value]="dateFrom()"
            (change)="onDateFromChange($event)"
            class="admin-input w-auto py-1.5 text-sm"
          />
          <label class="admin-label mb-0 text-sm">{{ 'common.to' | translate }}</label>
          <input 
            type="date" 
            [value]="dateTo()"
            (change)="onDateToChange($event)"
            class="admin-input w-auto py-1.5 text-sm"
          />
          
          <button 
            (click)="loadData()"
            class="btn-admin btn-primary py-1.5 text-sm"
          >
            <span class="material-symbols-outlined text-sm">refresh</span>
            {{ 'common.refresh' | translate }}
          </button>
        </div>
      </header>

      @if (loading()) {
        <div class="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div class="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent"></div>
          <p class="mt-4 text-gray-600 dark:text-gray-400 font-medium">{{ 'common.loading' | translate }}</p>
        </div>
      } @else {
        <!-- KPI Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="admin-card p-5">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <span class="material-symbols-outlined text-blue-600 dark:text-blue-400">payments</span>
              </div>
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ 'dashboard.stats.revenue' | translate }}</span>
            </div>
            <div class="text-2xl font-black text-blue-600">{{ data()?.paymentStats?.totalRevenue | currency:'EUR' }}</div>
          </div>
          
          <div class="admin-card p-5">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <span class="material-symbols-outlined text-gray-600 dark:text-gray-400">receipt</span>
              </div>
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ 'dashboard.stats.orders' | translate }}</span>
            </div>
            <div class="text-2xl font-black text-gray-900 dark:text-white">{{ data()?.paymentStats?.totalTransactions }}</div>
          </div>
          
          <div class="admin-card p-5">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <span class="material-symbols-outlined text-purple-600 dark:text-purple-400">trending_up</span>
              </div>
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ 'dashboard.stats.avgTicket' | translate }}</span>
            </div>
            <div class="text-2xl font-black text-purple-600">{{ data()?.paymentStats?.averageTicket | currency:'EUR' }}</div>
          </div>
          
          <div class="admin-card p-5">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <span class="material-symbols-outlined text-green-600 dark:text-green-400">check_circle</span>
              </div>
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ 'dashboard.stats.customers' | translate }}</span>
            </div>
            <div class="text-2xl font-black text-green-600">{{ data()?.orderStatus?.served }}</div>
          </div>
        </div>

        <!-- Order Status -->
        <div class="admin-card p-5">
          <h2 class="font-bold text-lg mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span class="material-symbols-outlined">kitchen</span>
            {{ 'kds.title' | translate }}
          </h2>
          <div class="flex gap-6 flex-wrap">
            <div class="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-2 rounded-lg border border-yellow-100 dark:border-yellow-800">
              <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ 'kds.pending' | translate }}: {{ data()?.orderStatus?.ordered }}
              </span>
            </div>
            <div class="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-100 dark:border-blue-800">
              <div class="w-3 h-3 rounded-full bg-blue-500"></div>
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ 'kds.preparing' | translate }}: {{ data()?.orderStatus?.onPrepare }}
              </span>
            </div>
            <div class="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-lg border border-green-100 dark:border-green-800">
              <div class="w-3 h-3 rounded-full bg-green-500"></div>
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ 'kds.ready' | translate }}: {{ data()?.orderStatus?.served }}
              </span>
            </div>
            <div class="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg border border-red-100 dark:border-red-800">
              <div class="w-3 h-3 rounded-full bg-red-500"></div>
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ 'common.cancel' | translate }}: {{ data()?.orderStatus?.canceled }}
              </span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Top Dishes -->
          <div class="admin-card p-5">
            <h2 class="font-bold text-lg mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <span class="material-symbols-outlined">restaurant</span>
              {{ 'dashboard.popularDishes' | translate }}
            </h2>
            <div class="flex flex-col gap-3">
              @for (dish of data()?.salesByDish; track dish.dishId) {
                <div class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <div>
                    <div class="font-bold text-gray-900 dark:text-white">{{ dish.dishName }}</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">{{ dish.quantity }} {{ 'dashboard.chart.orders' | translate | lowercase }}</div>
                  </div>
                  <div class="font-black text-primary">{{ dish.revenue | currency:'EUR' }}</div>
                </div>
              }
              @if (!data()?.salesByDish?.length) {
                <p class="text-gray-500 dark:text-gray-400 text-center py-8">
                  {{ 'error.notFound' | translate }}
                </p>
              }
            </div>
          </div>

          <!-- Sales by Category -->
          <div class="admin-card p-5">
            <h2 class="font-bold text-lg mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <span class="material-symbols-outlined">category</span>
              {{ 'admin.menu.categories' | translate }}
            </h2>
            <div class="flex flex-col gap-3">
              @for (cat of data()?.salesByCategory; track cat.categoryId) {
                <div class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <div>
                    <div class="font-bold text-gray-900 dark:text-white">{{ cat.categoryName }}</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">{{ cat.quantity }} {{ 'dashboard.chart.orders' | translate | lowercase }}</div>
                  </div>
                  <div class="font-black text-primary">{{ cat.revenue | currency:'EUR' }}</div>
                </div>
              }
              @if (!data()?.salesByCategory?.length) {
                <p class="text-gray-500 dark:text-gray-400 text-center py-8">
                  {{ 'error.notFound' | translate }}
                </p>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class DashboardComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private i18n = inject(I18nService);
  private notify = inject(NotificationService);
  private destroy$ = new Subject<void>();
  
  data = signal<DashboardData | null>(null);
  loading = signal(false);
  dateFrom = signal('');
  dateTo = signal('');

  ngOnInit() {
    // Set default date range to last 30 days
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
    
    const params: Record<string, string> = {};
    if (this.dateFrom()) params['from'] = this.dateFrom();
    if (this.dateTo()) params['to'] = this.dateTo();
    
    const queryString = new URLSearchParams(params).toString();
    const url = `${environment.apiUrl}/dashboard/stats${queryString ? '?' + queryString : ''}`;
    
    this.http.get<DashboardData>(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.data.set(res);
          this.loading.set(false);
        },
        error: (err) => {
          console.error(this.i18n.translate('dashboard.error'), err);
          this.notify.error(this.i18n.translate('dashboard.error'));
          this.loading.set(false);
        }
      });
  }

  onDateFromChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.dateFrom.set(value);
  }

  onDateToChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.dateTo.set(value);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
