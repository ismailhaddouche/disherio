import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Role {
  _id: string;
  role_name: string;
  permissions: string[];
}

export interface Staff {
  _id: string;
  restaurant_id: string;
  role_id: string | Role;  // Puede ser string (ID) o Role poblado
  staff_name: string;
  username: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateStaffRequest {
  staff_name: string;
  username: string;
  password: string;
  pin_code: string;
  role_id: string;
}

export interface UpdateStaffRequest {
  staff_name?: string;
  username?: string;
  role_id?: string;
  password?: string;
  pin_code?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StaffService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/staff`;

  getStaff(): Observable<Staff[]> {
    return this.http.get<Staff[]>(this.apiUrl);
  }

  getStaffMember(id: string): Observable<Staff> {
    return this.http.get<Staff>(`${this.apiUrl}/${id}`);
  }

  createStaff(data: CreateStaffRequest): Observable<Staff> {
    return this.http.post<Staff>(this.apiUrl, data);
  }

  updateStaff(id: string, data: UpdateStaffRequest): Observable<Staff> {
    return this.http.patch<Staff>(`${this.apiUrl}/${id}`, data);
  }

  deleteStaff(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.apiUrl}/roles/all`);
  }

  createRole(role_name: string, permissions: string[]): Observable<Role> {
    return this.http.post<Role>(`${this.apiUrl}/roles`, { role_name, permissions });
  }
}
