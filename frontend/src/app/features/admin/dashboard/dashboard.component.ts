import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { authStore } from '../../../store/auth.store';
import { I18nService } from '../../../core/services/i18n.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

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
  template: `
    <div class="flex flex-col gap-6 p-4 lg:p-6">
      <header class="flex items-center justify-between flex-wrap gap-4">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ 'dashboard.title' | translate }}
        </h1>
        
        <div class="flex gap-2 items-center">
          <label class="text-sm text-gray-600 dark:text-gray-400">
            {{ 'common.from' | translate }}:
          </label>
          <input 
            type="date" 
            [value]="dateFrom()"
            (change)="onDateFromChange($event)"
            class="border rounded px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          />
          <label class="text-sm text-gray-600 dark:text-gray-400">
            {{ 'common.to' | translate }}:
          </label>
          <input 
            type="date" 
            [value]="dateTo()"
            (change)="onDateToChange($event)"
            class="border rounded px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          />
          
          <button 
            (click)="loadData()"
            class="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
          >
            {{ 'common.refresh' | translate }}
          </button>
        </div>
      </header>

      @if (error()) {
        <div class="bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-lg">
          {{ error() }}
        </div>
      }

      @if (loading()) {
        <div class="flex justify-center py-10">
          <div class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ 'common.loading' | translate }}</span>
          </div>
        </div>
      } @else {
        <!-- KPI Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
            <div class="text-sm text-gray-500 dark:text-gray-400">
              {{ 'dashboard.stats.revenue' | translate }}
            </div>
            <div class="text-2xl font-bold text-blue-600">{{ data()?.paymentStats?.totalRevenue | currency:'EUR' }}</div>
          </div>
          
          <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
            <div class="text-sm text-gray-500 dark:text-gray-400">
              {{ 'dashboard.stats.orders' | translate }}
            </div>
            <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ data()?.paymentStats?.totalTransactions }}</div>
          </div>
          
          <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
            <div class="text-sm text-gray-500 dark:text-gray-400">
              {{ 'dashboard.stats.avgTicket' | translate }}
            </div>
            <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ data()?.paymentStats?.averageTicket | currency:'EUR' }}</div>
          </div>
          
          <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
            <div class="text-sm text-gray-500 dark:text-gray-400">
              {{ 'dashboard.stats.customers' | translate }}
            </div>
            <div class="text-2xl font-bold text-green-600">{{ data()?.orderStatus?.served }}</div>
          </div>
        </div>

        <!-- Order Status Chart -->
        <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
          <h2 class="font-bold mb-4 text-gray-900 dark:text-white">
            {{ 'kds.title' | translate }}
          </h2>
          <div class="flex gap-4 flex-wrap">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span class="text-sm text-gray-700 dark:text-gray-300">
                {{ 'kds.pending' | translate }}: {{ data()?.orderStatus?.ordered }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-blue-500"></div>
              <span class="text-sm text-gray-700 dark:text-gray-300">
                {{ 'kds.preparing' | translate }}: {{ data()?.orderStatus?.onPrepare }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-green-500"></div>
              <span class="text-sm text-gray-700 dark:text-gray-300">
                {{ 'kds.ready' | translate }}: {{ data()?.orderStatus?.served }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-red-500"></div>
              <span class="text-sm text-gray-700 dark:text-gray-300">
                {{ 'kds.served' | translate }}: {{ data()?.orderStatus?.canceled }}
              </span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Top Dishes -->
          <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
            <h2 class="font-bold mb-4 text-gray-900 dark:text-white">
              {{ 'dashboard.popularDishes' | translate }}
            </h2>
            <div class="flex flex-col gap-3">
              @for (dish of data()?.salesByDish; track dish.dishId) {
                <div class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <div>
                    <div class="font-medium text-gray-900 dark:text-white">{{ dish.dishName }}</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">{{ dish.quantity }} {{ 'dashboard.chart.orders' | translate | lowercase }}</div>
                  </div>
                  <div class="font-bold text-blue-600">{{ dish.revenue | currency:'EUR' }}</div>
                </div>
              }
              @if (!data()?.salesByDish?.length) {
                <p class="text-gray-500 dark:text-gray-400 text-center py-4">
                  {{ 'error.notFound' | translate }}
                </p>
              }
            </div>
          </div>

          <!-- Sales by Category -->
          <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
            <h2 class="font-bold mb-4 text-gray-900 dark:text-white">
              {{ 'admin.menu.categories' | translate }}
            </h2>
            <div class="flex flex-col gap-3">
              @for (cat of data()?.salesByCategory; track cat.categoryId) {
                <div class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <div>
                    <div class="font-medium text-gray-900 dark:text-white">{{ cat.categoryName }}</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">{{ cat.quantity }} {{ 'dashboard.chart.orders' | translate | lowercase }}</div>
                  </div>
                  <div class="font-bold text-blue-600">{{ cat.revenue | currency:'EUR' }}</div>
                </div>
              }
              @if (!data()?.salesByCategory?.length) {
                <p class="text-gray-500 dark:text-gray-400 text-center py-4">
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
export class DashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private i18n = inject(I18nService);
  
  data = signal<DashboardData | null>(null);
  loading = signal(false);
  error = signal('');
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
    this.error.set('');
    
    const params: Record<string, string> = {};
    if (this.dateFrom()) params['from'] = this.dateFrom();
    if (this.dateTo()) params['to'] = this.dateTo();
    
    const queryString = new URLSearchParams(params).toString();
    const url = `${environment.apiUrl}/dashboard/stats${queryString ? '?' + queryString : ''}`;
    
    this.http.get<DashboardData>(url).subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        console.error(this.i18n.translate('dashboard.error'), err);
        this.error.set(this.i18n.translate('dashboard.error'));
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
}
