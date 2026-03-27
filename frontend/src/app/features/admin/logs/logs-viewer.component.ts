import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

interface LogEntry {
  id: string;
  type: 'KDS' | 'POS' | 'TAS';
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
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="p-6">
      <header class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">System Logs</h1>
        <p class="text-gray-600 dark:text-gray-400">View activity logs from KDS, POS, and TAS</p>
      </header>

      <!-- Filters -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <!-- Date From -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From Date</label>
            <input 
              type="date" 
              [ngModel]="dateFrom()"
              (ngModelChange)="dateFrom.set($event); loadLogs()"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <!-- Date To -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To Date</label>
            <input 
              type="date" 
              [ngModel]="dateTo()"
              (ngModelChange)="dateTo.set($event); loadLogs()"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <!-- Type Filter -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">System Type</label>
            <select 
              [ngModel]="filterType()"
              (ngModelChange)="filterType.set($event); loadLogs()"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="ALL">All Systems</option>
              <option value="KDS">Kitchen (KDS)</option>
              <option value="POS">Point of Sale (POS)</option>
              <option value="TAS">Table Service (TAS)</option>
            </select>
          </div>

          <!-- User Filter -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">User</label>
            <select 
              [ngModel]="filterUser()"
              (ngModelChange)="filterUser.set($event); loadLogs()"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Users</option>
              <option *ngFor="let user of users()" [value]="user.id">{{ user.name }} ({{ user.type }})</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="loading()" class="text-center py-8">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p class="mt-2 text-gray-600 dark:text-gray-400">Loading logs...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="error()" class="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
        {{ error() }}
      </div>

      <!-- Logs Table -->
      <div *ngIf="!loading() && !error()" class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Time</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Item</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              <tr *ngFor="let log of logs()" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {{ log.timestamp | date:'short' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                    [class]="{
                      'bg-blue-100 text-blue-800': log.type === 'KDS',
                      'bg-green-100 text-green-800': log.type === 'POS',
                      'bg-purple-100 text-purple-800': log.type === 'TAS'
                    }">
                    {{ log.type }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {{ log.action }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {{ log.dishName || '-' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                    [class]="{
                      'bg-yellow-100 text-yellow-800': log.status === 'ORDERED',
                      'bg-blue-100 text-blue-800': log.status === 'ON_PREPARE',
                      'bg-green-100 text-green-800': log.status === 'SERVED',
                      'bg-red-100 text-red-800': log.status === 'CANCELED'
                    }">
                    {{ log.status }}
                  </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  <div *ngIf="log.details">
                    <div *ngIf="log.details.basePrice">Price: {{ log.details.basePrice | currency:'EUR' }}</div>
                    <div *ngIf="log.details.extras">Extras: {{ log.details.extras }}</div>
                    <div *ngIf="log.details.variant">Variant: {{ log.details.variant }}</div>
                  </div>
                </td>
              </tr>
              <tr *ngIf="logs().length === 0">
                <td colspan="6" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  No logs found matching the selected filters.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="px-6 py-3 bg-gray-50 dark:bg-gray-700 text-sm text-gray-500 dark:text-gray-400">
          Showing {{ logs().length }} entries
        </div>
      </div>
    </div>
  `
})
export class LogsViewerComponent {
  private http = inject(HttpClient);

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
          this.error.set(err.error?.message || 'Failed to load logs');
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
}
