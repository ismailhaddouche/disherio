import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { LocalizePipe } from '../../../shared/pipes/localize.pipe';
import { authStore } from '../../../store/auth.store';

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [CommonModule, RouterModule, LocalizePipe],
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex items-center justify-between">
        <h1 class="text-2xl font-bold">Categorías</h1>
        <a 
          routerLink="new" 
          class="bg-primary text-white rounded-lg px-4 py-2 font-bold flex items-center gap-1 active:scale-95 transition-transform"
        >
          <span class="material-symbols-outlined">add</span> Nueva Categoría
        </a>
      </header>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        @for (cat of categories(); track cat._id) {
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
            <div class="h-32 bg-gray-100 dark:bg-gray-700 relative">
              @if (cat.category_image_url) {
                <img [src]="cat.category_image_url" class="w-full h-full object-cover" />
              } @else {
                <div class="w-full h-full flex items-center justify-center text-gray-400">
                  <span class="material-symbols-outlined text-4xl">category</span>
                </div>
              }
              <div class="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                Orden: {{ cat.category_order }}
              </div>
            </div>
            
            <div class="p-4 flex flex-col gap-1">
              <h3 class="font-bold text-lg">{{ cat.category_name | localize }}</h3>
              <p class="text-sm text-gray-500 line-clamp-2 min-h-[2.5rem]">
                {{ (cat.category_description | localize) || 'Sin descripción' }}
              </p>
              
              <div class="flex gap-2 mt-4 pt-4 border-t border-gray-50 dark:border-gray-700">
                <a 
                  [routerLink]="[cat._id]" 
                  class="flex-1 bg-gray-100 dark:bg-gray-700 text-center py-2 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Editar
                </a>
                <button 
                  (click)="deleteCategory(cat._id)"
                  class="w-10 h-10 flex items-center justify-center text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <span class="material-symbols-outlined">delete</span>
                </button>
              </div>
            </div>
          </div>
        }
        @if (categories().length === 0) {
          <div class="col-span-full py-20 flex flex-col items-center justify-center text-gray-400">
            <span class="material-symbols-outlined text-6xl mb-2">inventory_2</span>
            <p>No hay categorías creadas aún</p>
          </div>
        }
      </div>
    </div>
  `
})
export class CategoryListComponent implements OnInit {
  private http = inject(HttpClient);
  categories = signal<any[]>([]);
  error = signal<string>('');

  ngOnInit() {
    // Only load if authenticated
    if (!authStore.isAuthenticated()) {
      console.warn('[CategoryList] Not authenticated, skipping load');
      return;
    }
    this.loadCategories();
  }

  loadCategories() {
    this.error.set('');
    this.http.get<any[]>(`${environment.apiUrl}/dishes/categories`).subscribe({
      next: (res) => {
        this.categories.set(res);
      },
      error: (err) => {
        console.error('[CategoryList] Error loading categories:', err);
        this.error.set('Error loading categories. Please try again.');
      }
    });
  }

  deleteCategory(id: string) {
    if (confirm('¿Estás seguro de eliminar esta categoría? Los platos asociados podrían quedar sin categoría.')) {
      this.http.delete(`${environment.apiUrl}/dishes/categories/${id}`).subscribe(() => {
        this.loadCategories();
      });
    }
  }
}
