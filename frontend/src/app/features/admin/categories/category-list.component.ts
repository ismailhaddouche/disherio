import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { LocalizePipe } from '../../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';
import { NotificationService } from '../../../core/services/notification.service';
import { authStore } from '../../../store/auth.store';

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [CommonModule, RouterModule, LocalizePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-container">
      <header class="admin-header">
        <div>
          <h1 class="admin-title">{{ 'admin.menu.categories' | translate }}</h1>
          <p class="admin-subtitle">{{ 'category.subtitle' | translate }}</p>
        </div>
        <a routerLink="new" class="btn-admin btn-primary">
          <span class="material-symbols-outlined">add</span> {{ 'category.new' | translate }}
        </a>
      </header>

      <div class="admin-grid">
        @for (cat of categories(); track cat._id) {
          <div class="admin-card">
            <div class="h-40 bg-gray-100 dark:bg-gray-700 relative">
              @if (cat.category_image_url) {
                <img [src]="cat.category_image_url" class="w-full h-full object-cover" />
              } @else {
                <div class="w-full h-full flex items-center justify-center text-gray-400">
                  <span class="material-symbols-outlined text-5xl">category</span>
                </div>
              }
              <div class="absolute top-3 right-3 bg-black/60 text-white text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-md border border-white/10">
                {{ 'category.display_order' | translate }}: {{ cat.category_order }}
              </div>
            </div>

            <div class="p-5 flex flex-col gap-1 flex-1">
              <h3 class="font-bold text-lg text-gray-900 dark:text-white line-clamp-1">{{ cat.category_name | localize }}</h3>
              <p class="text-sm text-gray-500 line-clamp-2 min-h-[2.5rem]">
                {{ (cat.category_description | localize) || ('dish.no_description' | translate) }}
              </p>

              <div class="flex gap-2 mt-auto pt-4">
                <a [routerLink]="[cat._id]" class="flex-1 btn-admin btn-secondary justify-center">
                  {{ 'common.edit' | translate }}
                </a>
                <button
                  (click)="deleteCategory(cat._id!)"
                  class="btn-icon btn-secondary text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  [title]="'common.delete' | translate"
                >
                  <span class="material-symbols-outlined">delete</span>
                </button>
              </div>
            </div>
          </div>
        }
      </div>

      @if (categories().length === 0) {
        <div class="py-20 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
          <span class="material-symbols-outlined text-7xl mb-4 opacity-20">category</span>
          <p class="text-lg font-medium">{{ 'category.no_categories' | translate }}</p>
          <a routerLink="new" class="mt-4 text-primary font-bold hover:underline">{{ 'category.new' | translate }}</a>
        </div>
      }
    </div>
  `
})
export class CategoryListComponent implements OnInit {
  private http = inject(HttpClient);
  private i18n = inject(I18nService);
  private notify = inject(NotificationService);
  categories = signal<any[]>([]);

  ngOnInit() {
    if (!authStore.isAuthenticated()) {
      console.warn('[CategoryList] Not authenticated, skipping load');
      return;
    }
    this.loadCategories();
  }

  loadCategories() {
    this.http.get<any[]>(`${environment.apiUrl}/dishes/categories`).subscribe({
      next: (res) => {
        this.categories.set(res);
      },
      error: (err) => {
        console.error('[CategoryList] Error loading categories:', err);
        this.notify.error(this.i18n.translate('errors.LOADING_ERROR'));
      }
    });
  }

  deleteCategory(id: string) {
    if (confirm(this.i18n.translate('category.delete_confirm'))) {
      this.http.delete(`${environment.apiUrl}/dishes/categories/${id}`).subscribe({
        next: () => {
          this.notify.success(this.i18n.translate('common.deleted'));
          this.loadCategories();
        },
        error: (err) => {
          this.notify.error(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
        }
      });
    }
  }
}
