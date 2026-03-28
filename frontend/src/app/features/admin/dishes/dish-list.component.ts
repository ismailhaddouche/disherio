import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { authStore } from '../../../store/auth.store';
import { LocalizePipe } from '../../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-dish-list',
  standalone: true,
  imports: [CommonModule, RouterModule, LocalizePipe, TranslatePipe],
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ 'admin.menu.dishes' | translate }}</h1>
        <a 
          routerLink="new" 
          class="bg-primary text-white rounded-lg px-4 py-2 font-bold flex items-center gap-1 active:scale-95 transition-transform"
        >
          <span class="material-symbols-outlined">add</span> {{ 'dish.new_dish' | translate }}
        </a>
      </header>

      @if (error()) {
        <div class="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-4 rounded-lg border border-red-400 dark:border-red-600">{{ error() }}</div>
      }

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        @for (dish of dishes(); track dish._id) {
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
            <div class="h-32 bg-gray-100 dark:bg-gray-700 relative">
              @if (dish.disher_url_image) {
                <img [src]="dish.disher_url_image" class="w-full h-full object-cover" />
              } @else {
                <div class="w-full h-full flex items-center justify-center text-gray-400">
                  <span class="material-symbols-outlined text-4xl">restaurant</span>
                </div>
              }
              <div class="absolute top-2 right-2 {{ dish.disher_status === 'ACTIVATED' ? 'bg-green-500' : 'bg-gray-500' }} text-white text-xs px-2 py-1 rounded-full">
                {{ dish.disher_status === 'ACTIVATED' ? ('common.active' | translate) : ('common.inactive' | translate) }}
              </div>
            </div>
            
            <div class="p-4 flex flex-col gap-1">
              <h3 class="font-bold text-lg text-gray-900 dark:text-white">{{ dish.disher_name | localize }}</h3>
              <p class="text-sm text-gray-500">{{ dish.disher_description || ('dish.no_description' | translate) }}</p>
              <p class="text-lg font-bold text-primary">{{ dish.disher_price | currency:'EUR' }}</p>
              
              <div class="flex gap-2 mt-4 pt-4 border-t border-gray-50 dark:border-gray-700">
                <a 
                  [routerLink]="[dish._id]" 
                  class="flex-1 bg-gray-100 dark:bg-gray-700 text-center py-2 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {{ 'common.edit' | translate }}
                </a>
                <button 
                  (click)="toggleStatus(dish._id!)"
                  class="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  [class.text-green-500]="dish.disher_status !== 'ACTIVATED'"
                  [class.text-gray-400]="dish.disher_status === 'ACTIVATED'"
                >
                  <span class="material-symbols-outlined">{{ dish.disher_status === 'ACTIVATED' ? 'visibility_off' : 'visibility' }}</span>
                </button>
              </div>
            </div>
          </div>
        }
        @if (dishes().length === 0) {
          <div class="col-span-full py-20 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
            <span class="material-symbols-outlined text-6xl mb-2">inventory_2</span>
            <p class="dark:text-gray-400">{{ 'dish.no_dishes' | translate }}</p>
          </div>
        }
      </div>
    </div>
  `
})
export class DishListComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private i18n = inject(I18nService);
  private destroy$ = new Subject<void>();
  dishes = signal<any[]>([]);
  error = signal<string>('');

  ngOnInit() {
    if (!authStore.isAuthenticated()) {
      console.warn('[DishList] Not authenticated, skipping load');
      return;
    }
    this.loadDishes();
  }

  loadDishes() {
    this.error.set('');
    this.http.get<any[]>(`${environment.apiUrl}/dishes`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.dishes.set(res);
        },
        error: (err) => {
          console.error('[DishList] Error loading dishes:', err);
          this.error.set(this.i18n.translate('errors.LOADING_ERROR'));
        }
      });
  }

  toggleStatus(id: string) {
    this.http.patch(`${environment.apiUrl}/dishes/${id}/toggle`, {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.loadDishes(),
        error: (err) => {
          console.error('[DishList] Error toggling status:', err);
          alert(this.i18n.translate('dish.toggle_status_error'));
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}