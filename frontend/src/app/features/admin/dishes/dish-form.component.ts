import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ImageUploaderComponent } from '../../../shared/components/image-uploader/image-uploader.component';
import { DishOptionListComponent, OptionItem } from './dish-option-list.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';
import { Dish, Variant, Extra, Category } from '../../../types';

// Form-specific types matching backend requirements (es, en, fr, ar supported)
type LocalizedFormString = { es: string; en: string; fr: string; ar: string };

interface VariantForm {
  variant_name: LocalizedFormString;
  variant_price: number;
}

interface ExtraForm {
  extra_name: LocalizedFormString;
  extra_price: number;
}

interface DishForm extends Omit<Dish, 'restaurant_id' | 'disher_status' | 'disher_alergens' | 'disher_variant' | 'disher_name' | 'variants' | 'extras'> {
  disher_name: LocalizedFormString;
  variants: VariantForm[];
  extras: ExtraForm[];
}

const INITIAL_DISH: DishForm = {
  category_id: '',
  disher_name: { es: '', en: '', fr: '', ar: '' },
  disher_price: 0,
  disher_type: 'KITCHEN',
  variants: [],
  extras: []
};

const INITIAL_VARIANT: VariantForm = { variant_name: { es: '', en: '', fr: '', ar: '' }, variant_price: 0 };
const INITIAL_EXTRA: ExtraForm = { extra_name: { es: '', en: '', fr: '', ar: '' }, extra_price: 0 };

@Component({
  selector: 'app-dish-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ImageUploaderComponent, DishOptionListComponent, TranslatePipe],
  template: `
    <div class="max-w-3xl mx-auto flex flex-col gap-6">
      <header class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ isEdit ? ('dish.edit_dish' | translate) : ('dish.new_dish' | translate) }}</h1>
        <div class="flex gap-2">
          <button (click)="cancel()" class="px-4 py-2 text-gray-500 dark:text-gray-400 font-medium hover:text-gray-700 dark:hover:text-gray-200">{{ 'common.cancel' | translate }}</button>
          <button (click)="save()" class="bg-primary text-white rounded-lg px-6 py-2 font-bold active:scale-95 transition-transform">
            {{ 'common.save' | translate }}
          </button>
        </div>
      </header>

      <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
        <!-- Image Section -->
        <section class="flex flex-col gap-2">
          <label class="font-bold text-gray-900 dark:text-white">{{ 'dish.image' | translate }}</label>
          <app-image-uploader
            folder="dishes"
            [currentImage]="dish().disher_url_image ?? null"
            (imageUploaded)="onImageUploaded($event)"
          />
        </section>

        <!-- Basic Info -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm text-gray-500 dark:text-gray-400">{{ 'category.name_es' | translate }}</label>
            <input [(ngModel)]="dish().disher_name.es" class="input-style" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm text-gray-500 dark:text-gray-400">{{ 'dish.base_price' | translate }} *</label>
            <input
              type="number"
              [(ngModel)]="dish().disher_price"
              min="0"
              step="0.01"
              class="input-style"
              [class.border-red-500]="dish().disher_price < 0"
            />
            @if (dish().disher_price <= 0) {
              <span class="text-xs text-red-500">{{ 'dish.price_negative' | translate }}</span>
            }
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm text-gray-500 dark:text-gray-400">{{ 'dish.category' | translate }}</label>
          <select [(ngModel)]="dish().category_id" class="input-style">
            @for (cat of categories(); track cat._id) {
              <option [value]="cat._id">{{ cat.category_name.es }}</option>
            }
          </select>
        </div>

        <!-- Variants Section -->
        <app-dish-option-list
          [title]="'dish.variants' | translate"
          [emptyMessage]="'dish.no_variants' | translate"
          [items]="getVariantsAsOptions()"
          (add)="addVariant()"
          (remove)="removeVariant($event)"
        />

        <!-- Extras Section -->
        <app-dish-option-list
          [title]="'dish.extras' | translate"
          [subtitle]="'dish.extras_desc' | translate"
          [emptyMessage]="'dish.no_extras' | translate"
          variant="amber"
          [items]="getExtrasAsOptions()"
          (add)="addExtra()"
          (remove)="removeExtra($event)"
        />
      </div>
    </div>
  `,
  styles: [`
    .input-style { @apply bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 outline-none focus:border-primary; }
  `]
})
export class DishFormComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private i18n = inject(I18nService);
  private destroy$ = new Subject<void>();

  isEdit = false;
  dish = signal<DishForm>({
    ...INITIAL_DISH,
    disher_name: { es: '', en: '', fr: '', ar: '' },
  });
  categories = signal<Category[]>([]);

  ngOnInit(): void {
    this.loadCategories();
    this.loadDishIfEditing();
  }

  private loadDishIfEditing(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEdit = true;
      this.loadDish(id);
    }
  }

  loadCategories(): void {
    this.http.get<Category[]>(`${environment.apiUrl}/dishes/categories`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => this.categories.set(categories),
        error: (err) => console.error('[DishForm] Error loading categories:', err)
      });
  }

  loadDish(id: string): void {
    this.http.get<DishForm>(`${environment.apiUrl}/dishes/${id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (dish) => this.dish.set(dish),
        error: (err) => {
          console.error('[DishForm] Error loading dish:', err);
          alert(this.i18n.translate('errors.LOADING_ERROR'));
          this.router.navigate(['/admin/dishes']);
        }
      });
  }

  onImageUploaded(url: string): void {
    this.dish.update((d) => ({ ...d, disher_url_image: url }));
  }

  addVariant(): void {
    this.addListItem('variants', INITIAL_VARIANT);
  }

  removeVariant(index: number): void {
    this.removeListItem('variants', index);
  }

  addExtra(): void {
    this.addListItem('extras', INITIAL_EXTRA);
  }

  removeExtra(index: number): void {
    this.removeListItem('extras', index);
  }

  // Helper methods for template type conversion
  getVariantsAsOptions(): OptionItem[] {
    return this.dish().variants as unknown as OptionItem[];
  }

  getExtrasAsOptions(): OptionItem[] {
    return this.dish().extras as unknown as OptionItem[];
  }

  private addListItem(key: 'variants' | 'extras', item: VariantForm | ExtraForm): void {
    this.dish.update((d) => ({
      ...d,
      [key]: [...d[key], item as VariantForm & ExtraForm]
    }));
  }

  private removeListItem(key: 'variants' | 'extras', index: number): void {
    this.dish.update((d) => ({
      ...d,
      [key]: d[key].filter((_, i) => i !== index)
    }));
  }

  save(): void {
    const request$ = this.isEdit 
      ? this.http.patch(`${environment.apiUrl}/dishes/${this.dish()._id}`, this.dish())
      : this.http.post(`${environment.apiUrl}/dishes`, this.dish());
    
    request$.pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.router.navigate(['/admin/dishes']),
        error: (err) => {
          console.error('[DishForm] Error saving dish:', err);
          alert(this.i18n.translate('errors.SERVER_ERROR') + ': ' + (err.error?.message || ''));
        }
      });
  }

  cancel(): void {
    this.router.navigate(['/admin/dishes']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
