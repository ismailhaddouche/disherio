import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Dish } from '../types';

export interface DishListResponse {
  data: Dish[];
}

export interface PaginatedDishResponse {
  data: Dish[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

@Injectable({ providedIn: 'root' })
export class DishService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/dishes`;

  list(): Observable<DishListResponse> {
    return this.http.get<DishListResponse>(this.apiUrl);
  }

  get(id: string): Observable<Partial<Dish>> {
    return this.http.get<Partial<Dish>>(`${this.apiUrl}/${id}`);
  }

  create(data: Partial<Dish>): Observable<Dish> {
    return this.http.post<Dish>(this.apiUrl, data);
  }

  update(id: string, data: Partial<Dish>): Observable<Dish> {
    return this.http.patch<Dish>(`${this.apiUrl}/${id}`, data);
  }

  toggleStatus(id: string): Observable<unknown> {
    return this.http.patch(`${this.apiUrl}/${id}/toggle`, {});
  }

  delete(id: string): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
