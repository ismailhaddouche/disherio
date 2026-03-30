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
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-dish-list',
  standalone: true,
  imports: [CommonModule, RouterModule, LocalizePipe, TranslatePipe],
  template: `
    <div class="admin-container">
      <header class="admin-header">
        <div>
          <h1 class="admin-title">{{ 'admin.menu.dishes' | translate }}</h1>
          <p class="admin-subtitle">{{ 'dish.subtitle' | translate }}</p>
        </div>
        <a routerLink="new" class="btn-admin btn-primary">
          <span class="material-symbols-outlined">add</span> {{ 'dish.new_dish' | translate }}
        </a>
      </header>

      <div class="admin-grid">
        @for (dish of dishes(); track dish._id) {
          <div class="admin-card">
            <div class="h-40 bg-gray-100 dark:bg-gray-700 relative">
              @if (dish.disher_url_image) {
                <img [src]="dish.disher_url_image" class="w-full h-full object-cover" />
              } @else {
                <div class="w-full h-full flex items-center justify-center text-gray-400">
                  <span class="material-symbols-outlined text-5xl">restaurant</span>
                </div>
              }
              <div class="absolute top-3 right-3 shadow-md {{ dish.disher_status === 'ACTIVATED' ? 'bg-green-500' : 'bg-gray-500' }} text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {{ dish.disher_status === 'ACTIVATED' ? ('common.active' | translate) : ('common.inactive' | translate) }}
              </div>
            </div>
            
            <div class="p-5 flex flex-col gap-1 flex-1">
              <h3 class="font-bold text-lg text-gray-900 dark:text-white line-clamp-1">{{ dish.disher_name | localize }}</h3>
              <p class="text-sm text-gray-500 line-clamp-2 min-h-[2.5rem]">{{ dish.disher_description || ('dish.no_description' | translate) }}</p>
              <p class="text-xl font-black text-primary mt-1">{{ dish.disher_price | currency:'EUR' }}</p>
              
              <div class="flex gap-2 mt-auto pt-4">
                <a [routerLink]="[dish._id]" class="flex-1 btn-admin btn-secondary justify-center">
                  {{ 'common.edit' | translate }}
                </a>
                <button 
                  (click)="toggleStatus(dish._id!)"
                  class="btn-icon btn-secondary"
                  [class.text-green-500]="dish.disher_status !== 'ACTIVATED'"
                  [title]="(dish.disher_status === 'ACTIVATED' ? 'common.deactivate' : 'common.activate') | translate"
                >
                  <span class="material-symbols-outlined">{{ dish.disher_status === 'ACTIVATED' ? 'visibility_off' : 'visibility' }}</span>
                </button>
              </div>
            </div>
          </div>
        }
      </div>

      @if (dishes().length === 0) {
        <div class="py-20 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
          <span class="material-symbols-outlined text-7xl mb-4 opacity-20">restaurant_menu</span>
          <p class="text-lg font-medium">{{ 'dish.no_dishes' | translate }}</p>
          <a routerLink="new" class="mt-4 text-primary font-bold hover:underline">{{ 'dish.new_dish' | translate }}</a>
        </div>
      }
    </div>
  `
})
export class DishListComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private i18n = inject(I18nService);
  private notify = inject(NotificationService);
  private destroy$ = new Subject<void>();
  dishes = signal<any[]>([]);

  ngOnInit() {
    if (!authStore.isAuthenticated()) {
      console.warn('[DishList] Not authenticated, skipping load');
      return;
    }
    this.loadDishes();
  }

  loadDishes() {
    this.http.get<{ data: any[] }>(`${environment.apiUrl}/dishes`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.dishes.set(res.data);
        },
        error: (err) => {
          console.error('[DishList] Error loading dishes:', err);
          this.notify.error(this.i18n.translate('errors.LOADING_ERROR'));
        }
      });
  }

  toggleStatus(id: string) {
    this.http.patch(`${environment.apiUrl}/dishes/${id}/toggle`, {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notify.success(this.i18n.translate('dish.status_updated'));
          this.loadDishes();
        },
        error: (err) => {
          console.error('[DishList] Error toggling status:', err);
          this.notify.error(this.i18n.translate('dish.toggle_status_error'));
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}