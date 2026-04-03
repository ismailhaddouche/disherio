import { Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import type { Restaurant } from '../../types';

@Injectable({
  providedIn: 'root'
})
export class RestaurantService {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);
  
  private restaurant = signal<Restaurant | null>(null);
  
  readonly restaurantName = computed(() => this.restaurant()?.restaurant_name ?? 'DisherIO');
  readonly logoUrl = computed(() => this.restaurant()?.logo_image_url);
  
  loadRestaurant() {
    this.http.get<Restaurant>(`${environment.apiUrl}/restaurant/me`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.restaurant.set(data),
        error: (err) => console.error('Error loading restaurant:', err)
      });
  }
  
  getRestaurant() {
    return this.restaurant.asReadonly();
  }
}
