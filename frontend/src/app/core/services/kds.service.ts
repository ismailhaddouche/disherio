import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { KdsItem } from '../../store/kds.store';

@Injectable({ providedIn: 'root' })
export class KdsService {
  private readonly http = inject(HttpClient);

  getKitchenItems(): Observable<KdsItem[]> {
    return this.http.get<KdsItem[]>(`${environment.apiUrl}/orders/kitchen`);
  }
}
