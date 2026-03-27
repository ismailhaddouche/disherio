import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Restaurant {
  _id: string;
  restaurant_name: string;
  restaurant_url?: string;
  logo_image_url?: string;
  tax_rate: number;
  currency: string;
  default_language: 'es' | 'en';
  default_theme: 'light' | 'dark' | 'system';
}

@Injectable({
  providedIn: 'root'
})
export class RestaurantService {
  private http = inject(HttpClient);
  
  private restaurant = signal<Restaurant | null>(null);
  
  readonly restaurantName = computed(() => this.restaurant()?.restaurant_name ?? 'DisherIO');
  readonly logoUrl = computed(() => this.restaurant()?.logo_image_url);
  
  loadRestaurant() {
    this.http.get<Restaurant>(`${environment.apiUrl}/restaurant/me`).subscribe({
      next: (data) => this.restaurant.set(data),
      error: (err) => console.error('Error loading restaurant:', err)
    });
  }
  
  getRestaurant() {
    return this.restaurant.asReadonly();
  }
}
