import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import type { Category, Dish, ItemOrder, OrderLimitStatus, Totem } from '../types';
import { createRequestId } from '../core/utils/request-id';
export type { Totem };

export interface CreateTotemRequest {
  totem_name: string;
  totem_type: 'STANDARD' | 'TEMPORARY';
  totem_start_date?: string;
}

export interface UpdateTotemRequest {
  totem_name?: string;
  totem_type?: 'STANDARD' | 'TEMPORARY';
  totem_start_date?: string;
}

export interface PublicTotemSession {
  session_id: string;
  totem_id: string;
  totem_name: string;
  restaurant_id: string;
  totem_state: string;
  session_token?: string;
  order_limit_status?: OrderLimitStatus;
}

export interface PublicTotemCustomer {
  customer_id: string;
  customer_name: string;
}

@Injectable({
  providedIn: 'root'
})
export class TotemService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/totems`;

  getTotems(): Observable<Totem[]> {
    return this.http.get<Totem[]>(this.apiUrl);
  }

  getTotem(id: string): Observable<Totem> {
    return this.http.get<Totem>(`${this.apiUrl}/${id}`);
  }

  createTotem(data: CreateTotemRequest): Observable<Totem> {
    return this.http.post<Totem>(this.apiUrl, data);
  }

  updateTotem(id: string, data: UpdateTotemRequest): Observable<Totem> {
    return this.http.patch<Totem>(`${this.apiUrl}/${id}`, data);
  }

  deleteTotem(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  regenerateQr(id: string): Observable<{ qr: string }> {
    return this.http.post<{ qr: string }>(`${this.apiUrl}/${id}/regenerate-qr`, {});
  }

  // ==================== PUBLIC TOTEM FLOW (customer-facing) ====================

  getMenuByQR(qr: string): Observable<{ categories: Category[]; dishes: Dish[] }> {
    return this.http.get<{ categories: Category[]; dishes: Dish[] }>(`${this.apiUrl}/menu/${qr}/dishes`);
  }

  getTotemByQR(qr: string): Observable<Totem> {
    return this.http.get<Totem>(`${this.apiUrl}/menu/${qr}`);
  }

  startSessionByQR(qr: string): Observable<PublicTotemSession> {
    return this.http.post<PublicTotemSession>(`${this.apiUrl}/menu/${qr}/session`, {});
  }

  getCustomerOrders(qr: string, sessionId: string, customerId: string, sessionToken?: string): Observable<ItemOrder[]> {
    const headers: Record<string, string> = sessionToken ? { 'x-session-token': sessionToken } : {};
    return this.http.get<ItemOrder[]>(`${this.apiUrl}/menu/${qr}/session/${sessionId}/customers/${customerId}/orders`, { headers });
  }

  getSessionOrders(qr: string, sessionId: string, sessionToken?: string): Observable<ItemOrder[]> {
    const headers: Record<string, string> = sessionToken ? { 'x-session-token': sessionToken } : {};
    return this.http.get<ItemOrder[]>(`${this.apiUrl}/menu/${qr}/session/${sessionId}/orders`, { headers });
  }

  createCustomer(qr: string, sessionId: string, customerName: string, sessionToken?: string): Observable<PublicTotemCustomer> {
    return this.http.post<PublicTotemCustomer>(
      `${this.apiUrl}/menu/${qr}/session/${sessionId}/customers`,
      { customer_name: customerName, session_token: sessionToken }
    );
  }

  placeOrder(
    qr: string,
    sessionId: string,
    items: Array<{ dishId: string; quantity: number; variantId?: string; extras?: string[] }>,
    customerId?: string,
    sessionToken?: string
  ): Observable<{ order_id: string; items: unknown[] }> {
    const requestId = createRequestId();
    return this.http.post<{ order_id: string; items: unknown[] }>(
      `${this.apiUrl}/menu/${qr}/order`,
      { request_id: requestId, session_id: sessionId, items, customer_id: customerId, session_token: sessionToken }
    );
  }
}
