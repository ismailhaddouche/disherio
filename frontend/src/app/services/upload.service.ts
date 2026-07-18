import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type UploadFolder = 'dishes' | 'restaurant' | 'categories';

@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly http = inject(HttpClient);

  uploadImage(folder: UploadFolder, resourceId: string | null, file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('image', file);

    const endpoint = folder === 'restaurant'
      ? '/uploads/restaurant'
      : `/uploads/${folder}/${resourceId}`;
    return this.http.post<{ url: string }>(`${environment.apiUrl}${endpoint}`, formData);
  }
}
