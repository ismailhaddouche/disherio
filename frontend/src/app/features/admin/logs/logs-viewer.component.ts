import { Component, signal, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';

interface LogEntry {
  id: string;
  type: 'KDS' | 'POS' | 'TAS' | 'CUSTOMER';
  timestamp: string;
  userId?: string;
  userName?: string;
  action: string;
  details: { basePrice?: number; extras?: number; variant?: string };
  dishName?: string;
  status?: string;
}

interface LogUser {
  id: string;
  name: string;
  type: 'STAFF' | 'CUSTOMER';
}

@Component({
  selector: 'app-logs-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-container">
      <header class="admin-header">
        <div>
          <h1 class="admin-title">{{ 'logs.title' | translate }}</h1>
          <p class="admin-subtitle">{{ 'logs.subtitle' | translate }}</p>
        </div>
      </header>

      <!-- Filters -->
      <div class="admin-filters">
        <!-- Date From -->
        <div>
          <label class="admin-label">{{ 'common.from' | translate }}</label>
          <input 
            type="date" 
            [ngModel]="dateFrom()"
            (ngModelChange)="dateFrom.set($event); loadLogs()"
            class="admin-input"
          />
        </div>

        <!-- Date To -->
        <div>
          <label class="admin-label">{{ 'common.to' | translate }}</label>
          <input 
            type="date" 
            [ngModel]="dateTo()"
            (ngModelChange)="dateTo.set($event); loadLogs()"
            class="admin-input"
          />
        </div>

        <!-- Type Filter -->
        <div>
          <label class="admin-label">{{ 'logs.system_type' | translate }}</label>
          <select
            [ngModel]="filterType()"
            (ngModelChange)="filterType.set($event); loadLogs()"
            class="admin-select"
          >
            <option value="ALL">{{ 'logs.all_systems' | translate }}</option>
            <option value="KDS">{{ 'logs.kds_label' | translate }}</option>
            <option value="POS">{{ 'logs.pos_label' | translate }}</option>
            <option value="TAS">{{ 'logs.tas_label' | translate }}</option>
            <option value="CUSTOMER">{{ 'logs.customer_orders' | translate }}</option>
          </select>
        </div>

        <!-- User Filter -->
        <div>
          <label class="admin-label">{{ 'common.profile' | translate }}</label>
          <select
            [ngModel]="filterUser()"
            (ngModelChange)="filterUser.set($event); loadLogs()"
            class="admin-select"
          >
            <option value="">{{ 'logs.all_users' | translate }}</option>
            @for (user of users(); track user.id) {
              <option [value]="user.id">{{ user.name }} ({{ user.type === 'STAFF' ? ('logs.staff_type' | translate) : ('logs.customer_type' | translate) }})</option>
            }
          </select>
        </div>
      </div>

      <!-- Loading State -->
      @if (loading()) {
        <div class="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div class="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent"></div>
          <p class="mt-4 text-gray-600 dark:text-gray-400 font-medium">{{ 'common.loading' | translate }}</p>
        </div>
      }

      <!-- Error State -->
      @if (error()) {
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-4 rounded-xl mb-4">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined">error</span>
            {{ error() }}
          </div>
        </div>
      }

      <!-- Logs Table -->
      @if (!loading() && !error()) {
        <div class="admin-table-container">
          <div class="overflow-x-auto">
            <table class="admin-table">
              <thead>
                <tr>
                  <th class="admin-th">{{ 'logs.time' | translate }}</th>
                  <th class="admin-th">{{ 'logs.system_type' | translate }}</th>
                  <th class="admin-th">{{ 'logs.action' | translate }}</th>
                  <th class="admin-th">{{ 'logs.item' | translate }}</th>
                  <th class="admin-th">{{ 'logs.status' | translate }}</th>
                  <th class="admin-th">{{ 'logs.details' | translate }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                @for (log of logs(); track log.id) {
                  <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td class="admin-td text-gray-500 dark:text-gray-400">
                      {{ log.timestamp | date:'short' }}
                    </td>
                    <td class="admin-td">
                      <span class="px-2.5 py-1 inline-flex text-xs font-bold rounded-full border"
                        [class]="{
                          'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800': log.type === 'KDS',
                          'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800': log.type === 'POS',
                          'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800': log.type === 'TAS',
                          'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800': log.type === 'CUSTOMER'
                        }">
                        {{ log.type === 'CUSTOMER' ? ('logs.customer_label' | translate) : log.type }}
                      </span>
                      @if (log.userName) {
                        <span class="block text-xs text-gray-500 mt-1">{{ log.userName }}</span>
                      }
                    </td>
                    <td class="admin-td font-medium">
                      {{ log.action }}
                    </td>
                    <td class="admin-td">
                      {{ log.dishName || '-' }}
                    </td>
                    <td class="admin-td">
                      @if (log.status) {
                        <span class="px-2.5 py-1 inline-flex text-xs font-bold rounded-full border"
                          [class]="{
                            'bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800': log.status === 'ORDERED',
                            'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800': log.status === 'ON_PREPARE',
                            'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800': log.status === 'SERVED',
                            'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800': log.status === 'CANCELED'
                          }">
                          {{ getStatusLabel(log.status!) }}
                        </span>
                      } @else {
                        -
                      }
                    </td>
                    <td class="admin-td text-gray-500 dark:text-gray-400">
                      @if (log.details) {
                        <div class="text-sm">
                          @if (log.details.basePrice) {
                            <div>{{ 'logs.price' | translate }}: {{ log.details.basePrice | currency:'EUR' }}</div>
                          }
                          @if (log.details.extras) {
                            <div>{{ 'logs.extras' | translate }}: {{ log.details.extras }}</div>
                          }
                          @if (log.details.variant) {
                            <div>{{ 'logs.variant' | translate }}: {{ log.details.variant }}</div>
                          }
                        </div>
                      }
                    </td>
                  </tr>
                }
                @if (logs().length === 0) {
                  <tr>
                    <td colspan="6" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      <span class="material-symbols-outlined text-5xl mb-3 opacity-30">history</span>
                      <p>{{ 'logs.no_logs' | translate }}</p>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
            {{ 'logs.showing' | translate }} {{ logs().length }} {{ 'logs.entries' | translate }}
          </div>
        </div>
      }
    </div>
  `
})
export class LogsViewerComponent {
  private http = inject(HttpClient);
  private i18n = inject(I18nService);

  // State
  logs = signal<LogEntry[]>([]);
  users = signal<LogUser[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Filters
  dateFrom = signal<string>('');
  dateTo = signal<string>('');
  filterType = signal<string>('ALL');
  filterUser = signal<string>('');

  constructor() {
    this.loadLogs();
    this.loadUsers();
  }

  loadLogs(): void {
    this.loading.set(true);
    this.error.set(null);

    const params: Record<string, string> = {};
    if (this.dateFrom()) params['from'] = this.dateFrom();
    if (this.dateTo()) params['to'] = this.dateTo();
    if (this.filterType() && this.filterType() !== 'ALL') params['type'] = this.filterType();
    if (this.filterUser()) params['userId'] = this.filterUser();

    const queryString = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    this.http.get<{ logs: LogEntry[]; total: number }>(`/api/dashboard/logs${queryString ? '?' + queryString : ''}`)
      .subscribe({
        next: (response) => {
          this.logs.set(response.logs);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.error?.message || this.i18n.translate('errors.LOADING_ERROR'));
          this.loading.set(false);
        }
      });
  }

  loadUsers(): void {
    this.http.get<{ users: LogUser[] }>('/api/dashboard/logs/users')
      .subscribe({
        next: (response) => {
          this.users.set(response.users);
        }
      });
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'ORDERED': return this.i18n.translate('order_state.ordered');
      case 'ON_PREPARE': return this.i18n.translate('order_state.preparing');
      case 'SERVED': return this.i18n.translate('order_state.served');
      case 'CANCELED': return this.i18n.translate('order_state.canceled');
      default: return status;
    }
  }
}
