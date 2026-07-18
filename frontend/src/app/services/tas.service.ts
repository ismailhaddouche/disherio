import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import type {
  TotemSession,
  ItemOrder,
  Customer,
  Dish,
  LocalizedField,
  PaymentTicket,
  PaymentType,
} from '../types';
import type { Totem } from '@disherio/shared';
import { createRequestId } from '../core/utils/request-id';

export interface CreateTotemData {
  totem_name: string;
  totem_type: 'STANDARD' | 'TEMPORARY';
}

export interface AddItemData {
  order_id: string;
  session_id: string;
  dish_id: string;
  customer_id?: string;
  variant_id?: string;
  extras?: string[];
}

export interface CreateOrderData {
  session_id: string;
}

export interface PaymentHistoryEntry {
  _id: string;
  session_id: string;
  payment_type: PaymentType;
  payment_total: number;
  payment_date: string;
  tickets: PaymentTicket[];
  session: {
    _id: string;
    totem_state: TotemSession['totem_state'];
    session_date_start: string;
  };
  totem: {
    _id: string;
    totem_name: string;
    totem_type: Totem['totem_type'];
  };
}

@Injectable({
  providedIn: 'root',
})
export class TasService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // Totems
  getTotems(): Observable<Totem[]> {
    return this.http.get<Totem[]>(`${this.apiUrl}/totems`);
  }

  createTotem(data: CreateTotemData): Observable<{ _id: string; totem_name: string; totem_qr: string }> {
    return this.http.post<{ _id: string; totem_name: string; totem_qr: string }>(`${this.apiUrl}/totems`, data);
  }

  deleteTotem(totemId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/totems/${totemId}`);
  }

  // Sessions
  getActiveSessions(): Observable<TotemSession[]> {
    return this.http.get<TotemSession[]>(`${this.apiUrl}/totems/sessions/active`);
  }

  startSession(totemId: string): Observable<TotemSession> {
    return this.http.post<TotemSession>(`${this.apiUrl}/totems/${totemId}/session`, {});
  }

  closeSession(sessionId: string): Observable<TotemSession> {
    return this.http.post<TotemSession>(`${this.apiUrl}/totems/sessions/${sessionId}/close`, {});
  }

  reopenSession(sessionId: string): Observable<TotemSession> {
    return this.http.post<TotemSession>(`${this.apiUrl}/totems/sessions/${sessionId}/reopen`, {});
  }

  // Orders & Items
  getSessionItems(sessionId: string): Observable<ItemOrder[]> {
    return this.http.get<ItemOrder[]>(`${this.apiUrl}/orders/session/${sessionId}`);
  }

  getServiceItems(): Observable<ItemOrder[]> {
    return this.http.get<ItemOrder[]>(`${this.apiUrl}/orders/service-items`);
  }

  createOrder(data: CreateOrderData): Observable<{ _id: string; session_id: string }> {
    return this.http.post<{ _id: string; session_id: string }>(`${this.apiUrl}/orders`, data);
  }

  addItem(data: AddItemData): Observable<ItemOrder> {
    return this.http.post<ItemOrder>(`${this.apiUrl}/orders/items`, data);
  }

  addBatchItems(sessionId: string, items: Array<{ dishId: string; quantity: number; customerId?: string; variantId?: string; extras?: string[] }>, asServed: boolean = false): Observable<{ orderId: string; items: ItemOrder[] }> {
    const requestId = createRequestId();
    return this.http.post<{ orderId: string; items: ItemOrder[] }>(`${this.apiUrl}/orders/items/batch`, {
      request_id: requestId,
      session_id: sessionId,
      items,
      as_served: asServed,
    });
  }

  archiveSession(sessionId: string): Observable<TotemSession> {
    return this.http.post<TotemSession>(`${this.apiUrl}/totems/sessions/${sessionId}/archive`, {});
  }

  cancelSession(sessionId: string): Observable<TotemSession> {
    return this.http.post<TotemSession>(`${this.apiUrl}/totems/sessions/${sessionId}/cancel`, {});
  }

  getTotemSessions(totemId: string): Observable<TotemSession[]> {
    return this.http.get<TotemSession[]>(`${this.apiUrl}/totems/${totemId}/sessions`);
  }

  createPayment(data: { session_id: string; payment_type: 'ALL' | 'BY_USER' | 'SHARED'; parts?: number; tips?: number }): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/orders/payments`, data);
  }

  getPaymentHistory(filters: { from?: string; to?: string; search?: string; limit?: number } = {}): Observable<PaymentHistoryEntry[]> {
    const params: Record<string, string> = {};
    if (filters.from) params['from'] = filters.from;
    if (filters.to) params['to'] = filters.to;
    if (filters.search) params['search'] = filters.search;
    if (filters.limit) params['limit'] = String(filters.limit);

    return this.http.get<PaymentHistoryEntry[]>(`${this.apiUrl}/orders/payments/history`, { params });
  }

  deleteItem(itemId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/orders/items/${itemId}`);
  }

  updateItemState(itemId: string, state: ItemOrder['item_state']): Observable<ItemOrder> {
    return this.http.patch<ItemOrder>(`${this.apiUrl}/orders/items/${itemId}/state`, { state });
  }

  assignItemToCustomer(itemId: string, customerId: string | null): Observable<ItemOrder> {
    return this.http.patch<ItemOrder>(`${this.apiUrl}/orders/items/${itemId}/assign`, { customer_id: customerId });
  }

  // Customers
  getCustomers(sessionId: string): Observable<Customer[]> {
    // Note: This endpoint might need to be added to backend
    return this.http.get<Customer[]>(`${this.apiUrl}/customers/session/${sessionId}`);
  }

  createCustomer(sessionId: string, name: string): Observable<Customer> {
    return this.http.post<Customer>(`${this.apiUrl}/customers`, {
      session_id: sessionId,
      customer_name: name,
    });
  }

  // Dishes & Menu
  getDishes(): Observable<{ dishes: Dish[]; categories: Array<{ _id: string; category_name: LocalizedField }> }> {
    return forkJoin({
      dishesResp: this.http.get<{ data: Dish[] }>(`${this.apiUrl}/dishes?limit=100`),
      categories: this.http.get<Array<{ _id: string; category_name: LocalizedField }>>(`${this.apiUrl}/dishes/categories`),
    }).pipe(
      map(({ dishesResp, categories }) => ({
        dishes: dishesResp.data,
        categories,
      }))
    );
  }
}
