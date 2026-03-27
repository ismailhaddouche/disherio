import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { 
  TotemSession, 
  ItemOrder, 
  Customer, 
  Dish 
} from '../store/tas.store';

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

@Injectable({
  providedIn: 'root',
})
export class TasService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // Totems
  getTotems(): Observable<Array<{ _id: string; totem_name: string; totem_type: string; totem_qr: string }>> {
    return this.http.get<any[]>(`${this.apiUrl}/totems`);
  }

  createTotem(data: CreateTotemData): Observable<{ _id: string; totem_name: string; totem_qr: string }> {
    return this.http.post<any>(`${this.apiUrl}/totems`, data);
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

  // Orders & Items
  getSessionItems(sessionId: string): Observable<ItemOrder[]> {
    return this.http.get<ItemOrder[]>(`${this.apiUrl}/orders/session/${sessionId}`);
  }

  getServiceItems(): Observable<ItemOrder[]> {
    return this.http.get<ItemOrder[]>(`${this.apiUrl}/orders/service-items`);
  }

  createOrder(data: CreateOrderData): Observable<{ _id: string; session_id: string }> {
    return this.http.post<any>(`${this.apiUrl}/orders`, data);
  }

  addItem(data: AddItemData): Observable<ItemOrder> {
    return this.http.post<ItemOrder>(`${this.apiUrl}/orders/items`, data);
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
  getDishes(): Observable<{ dishes: Dish[]; categories: Array<{ _id: string; category_name: { es: string; en: string; fr: string; ar: string } }> }> {
    return this.http.get<any>(`${this.apiUrl}/dishes`);
  }
}
