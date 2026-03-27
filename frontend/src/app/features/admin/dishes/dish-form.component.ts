import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { ImageUploaderComponent } from '../../../shared/components/image-uploader/image-uploader.component';

@Component({
  selector: 'app-dish-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ImageUploaderComponent],
  template: `
    <div class="max-w-3xl mx-auto flex flex-col gap-6">
      <header class="flex items-center justify-between">
        <h1 class="text-2xl font-bold">{{ isEdit ? 'Editar Plato' : 'Nuevo Plato' }}</h1>
        <div class="flex gap-2">
          <button (click)="cancel()" class="px-4 py-2 text-gray-500 font-medium">Cancelar</button>
          <button (click)="save()" class="bg-primary text-white rounded-lg px-6 py-2 font-bold active:scale-95 transition-transform">
            Guardar
          </button>
        </div>
      </header>

      <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
        <!-- Image Section -->
        <section class="flex flex-col gap-2">
          <label class="font-bold">Imagen del Plato</label>
          <app-image-uploader 
            folder="dishes" 
            [currentImage]="dish().disher_url_image"
            (imageUploaded)="onImageUploaded($event)"
          />
        </section>

        <!-- Basic Info -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm text-gray-500">Nombre (ES)</label>
            <input [(ngModel)]="dish().disher_name.es" class="input-style" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm text-gray-500">Precio (IVA Inc.)</label>
            <input type="number" [(ngModel)]="dish().disher_price" class="input-style" />
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm text-gray-500">Categoría</label>
          <select [(ngModel)]="dish().category_id" class="input-style">
            @for (cat of categories(); track cat._id) {
              <option [value]="cat._id">{{ cat.category_name.es }}</option>
            }
          </select>
        </div>

        <!-- Variants Section -->
        <section class="border-t border-gray-100 dark:border-gray-700 pt-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-bold text-lg">Variantes</h2>
            <button (click)="addVariant()" class="text-primary text-sm font-bold">+ Añadir Variante</button>
          </div>
          <div class="flex flex-col gap-3">
            @for (v of dish().variants; track $index; let i = $index) {
              <div class="flex items-end gap-2 bg-gray-50 dark:bg-gray-700 p-3 rounded-xl">
                <div class="flex-1 flex flex-col gap-1">
                  <label class="text-xs text-gray-400">Nombre</label>
                  <input [(ngModel)]="v.variant_name.es" class="input-style-sm" />
                </div>
                <div class="w-24 flex flex-col gap-1">
                  <label class="text-xs text-gray-400">Precio</label>
                  <input type="number" [(ngModel)]="v.variant_price" class="input-style-sm" />
                </div>
                <button (click)="removeVariant(i)" class="text-red-500 mb-2"><span class="material-symbols-outlined">delete</span></button>
              </div>
            }
          </div>
        </section>

        <!-- Extras Section (Toppings) -->
        <section class="border-t border-gray-100 dark:border-gray-700 pt-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-bold text-lg">Extras (Toppings)</h2>
            <button (click)="addExtra()" class="text-primary text-sm font-bold">+ Añadir Extra</button>
          </div>
          <p class="text-xs text-gray-500 mb-3">Extras que se pueden añadir al plato, como toppings o complementos.</p>
          <div class="flex flex-col gap-3">
            @for (e of dish().extras; track $index; let i = $index) {
              <div class="flex items-end gap-2 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-100 dark:border-amber-800">
                <div class="flex-1 flex flex-col gap-1">
                  <label class="text-xs text-gray-400">Nombre</label>
                  <input [(ngModel)]="e.extra_name.es" class="input-style-sm" placeholder="Ej: Queso extra" />
                </div>
                <div class="w-24 flex flex-col gap-1">
                  <label class="text-xs text-gray-400">Precio</label>
                  <input type="number" [(ngModel)]="e.extra_price" class="input-style-sm" placeholder="0.00" />
                </div>
                <button (click)="removeExtra(i)" class="text-red-500 mb-2"><span class="material-symbols-outlined">delete</span></button>
              </div>
            }
          </div>
          @if (dish().extras.length === 0) {
            <p class="text-sm text-gray-400 italic">Sin extras configurados</p>
          }
        </section>
      </div>
    </div>
  `,
  styles: [`
    .input-style { @apply bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 outline-none focus:border-primary; }
    .input-style-sm { @apply bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1 text-sm outline-none; }
  `]
})
export class DishFormComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEdit = false;
  dish = signal<any>({
    disher_name: { es: '' },
    disher_price: 0,
    disher_type: 'KITCHEN',
    variants: [],
    extras: []
  });
  categories = signal<any[]>([]);

  ngOnInit() {
    this.loadCategories();
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEdit = true;
      this.loadDish(id);
    }
  }

  loadCategories() {
    this.http.get<any[]>(`${environment.apiUrl}/dishes/categories`).subscribe(res => this.categories.set(res));
  }

  loadDish(id: string) {
    this.http.get(`${environment.apiUrl}/dishes/${id}`).subscribe(res => this.dish.set(res));
  }

  onImageUploaded(url: string) {
    this.dish.update(d => ({ ...d, disher_url_image: url }));
  }

  addVariant() {
    this.dish.update(d => ({
      ...d,
      variants: [...d.variants, { variant_name: { es: '' }, variant_price: 0 }]
    }));
  }

  removeVariant(index: number) {
    this.dish.update(d => ({
      ...d,
      variants: d.variants.filter((_: any, i: number) => i !== index)
    }));
  }

  addExtra() {
    this.dish.update(d => ({
      ...d,
      extras: [...d.extras, { extra_name: { es: '' }, extra_price: 0 }]
    }));
  }

  removeExtra(index: number) {
    this.dish.update(d => ({
      ...d,
      extras: d.extras.filter((_: any, i: number) => i !== index)
    }));
  }

  save() {
    const obs = this.isEdit 
      ? this.http.patch(`${environment.apiUrl}/dishes/${this.dish()._id}`, this.dish())
      : this.http.post(`${environment.apiUrl}/dishes`, this.dish());
    
    obs.subscribe(() => this.router.navigate(['/admin/dishes']));
  }

  cancel() {
    this.router.navigate(['/admin/dishes']);
  }
}
