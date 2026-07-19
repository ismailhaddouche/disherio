import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Category } from '../../types';

export type CategoryPayload = Omit<Partial<Category>, 'category_image_url'> & {
  category_image_url?: string | null;
};

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/dishes/categories`;

  list(): Observable<Category[]> {
    return this.http.get<Category[]>(this.apiUrl);
  }

  get(id: string): Observable<Category> {
    return this.http.get<Category>(`${this.apiUrl}/${id}`);
  }

  create(data: CategoryPayload): Observable<Category> {
    return this.http.post<Category>(this.apiUrl, data);
  }

  update(id: string, data: CategoryPayload): Observable<Category> {
    return this.http.patch<Category>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: string): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
