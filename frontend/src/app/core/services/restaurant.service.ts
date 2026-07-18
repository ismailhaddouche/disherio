import { Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import type { Restaurant } from '../../types';
import type { Language, Theme } from '../../store/auth.store';

@Injectable({
  providedIn: 'root'
})
export class RestaurantService {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

  private restaurant = signal<Restaurant | null>(null);

  readonly restaurantName = computed(() => this.restaurant()?.restaurant_name ?? 'DisherIO');
  readonly logoUrl = computed(() => this.restaurant()?.logo_image_url);
  readonly currency = computed(() => this.restaurant()?.currency ?? 'EUR');

  loadRestaurant() {
    this.http.get<Restaurant>(`${environment.apiUrl}/restaurant/me`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.restaurant.set(data),
        error: () => undefined
      });
  }

  getRestaurant() {
    return this.restaurant.asReadonly();
  }

  getSettings(): Observable<RestaurantSettings> {
    return this.http.get<RestaurantSettings>(`${environment.apiUrl}/restaurant/settings`);
  }

  updateSettings(payload: Partial<RestaurantSettings>): Observable<{ message: string; settings: RestaurantSettings }> {
    return this.http.patch<{ message: string; settings: RestaurantSettings }>(`${environment.apiUrl}/restaurant/settings`, payload);
  }
}

export interface RestaurantSettings {
  _id: string;
  restaurant_name: string;
  tax_rate: number;
  currency: string;
  default_language: Language;
  default_theme: Theme;
  enabled_languages: Language[];
  tips_state: boolean;
  tips_type: 'MANDATORY' | 'VOLUNTARY';
  order_interval_minutes: number;
  max_orders_per_session: number;
}
