import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Totem {
  _id?: string;
  restaurant_id: string;
  totem_name: string;
  totem_qr?: string;
  totem_type: 'STANDARD' | 'TEMPORARY';
  totem_start_date: string;
  createdAt?: string;
  updatedAt?: string;
}

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
}
