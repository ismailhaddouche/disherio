import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PaymentStats {
  totalRevenue: number;
  totalTransactions: number;
  averageTicket: number;
}

export interface DashboardStats {
  salesByDish: Array<{ dishId: string; dishName: string; quantity: number; revenue: number }>;
  salesByCategory: Array<{ categoryId: string; categoryName: string; revenue: number; quantity: number }>;
  paymentStats: PaymentStats;
  orderStatus: { ordered: number; onPrepare: number; served: number; canceled: number };
  dateRange: { from?: string; to?: string };
}

export interface LogEntry {
  id: string;
  type: 'KDS' | 'POS' | 'TAS' | 'CUSTOMER';
  timestamp: string;
  userId?: string;
  userName?: string;
  action: string;
  details: Record<string, unknown>;
  dishName?: string;
  status?: string;
}

export interface LogUsersResponse {
  users: Array<{ id: string; name: string; type: 'STAFF' | 'CUSTOMER' }>;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/dashboard`;

  getStats(from?: string, to?: string): Observable<DashboardStats> {
    const params: Record<string, string> = {};
    if (from) params['from'] = from;
    if (to) params['to'] = to;
    return this.http.get<DashboardStats>(`${this.apiUrl}/stats`, { params });
  }

  getLogs(filters?: { from?: string; to?: string; userId?: string; type?: string }): Observable<{ logs: LogEntry[]; filters: { users: string[]; types: string[] }; total: number }> {
    const params: Record<string, string> = {};
    if (filters?.from) params['from'] = filters.from;
    if (filters?.to) params['to'] = filters.to;
    if (filters?.userId) params['userId'] = filters.userId;
    if (filters?.type) params['type'] = filters.type;
    return this.http.get<{ logs: LogEntry[]; filters: { users: string[]; types: string[] }; total: number }>(`${this.apiUrl}/logs`, { params });
  }

  getLogUsers(): Observable<LogUsersResponse> {
    return this.http.get<LogUsersResponse>(`${this.apiUrl}/logs/users`);
  }
}