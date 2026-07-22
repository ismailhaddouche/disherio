import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ImageUploaderComponent } from '../../../shared/components/image-uploader/image-uploader.component';
import { LocalizedInputComponent } from '../../../shared/components/localized-input.component';
import { DishOptionListComponent, OptionItem } from './dish-option-list.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';
import { NotificationService } from '../../../core/services/notification.service';
import { DishService } from '../../../core/services/dish.service';
import { CategoryService } from '../../../core/services/category.service';
import { Dish, Variant, Extra, Category, LocalizedField } from '../../../types';
import { LocalizationService } from '../../../core/services/localization.service';

const ALLERGEN_CODES = ['GLUTEN','CRUSTACEANS','EGGS','FISH','PEANUTS','SOY','MILK','NUTS','CELERY','MUSTARD','SESAME','SULPHITES','LUPINE','MOLLUSCS'] as const;

type DishFormData = Omit<Partial<Dish>, 'disher_name' | 'disher_description' | 'disher_price' | 'disher_alergens' | 'variants' | 'extras' | 'disher_type' | 'category_id'> & {
  category_id: string;
  disher_name: LocalizedField;
  disher_description: LocalizedField;
  disher_price: number;
  disher_type: 'KITCHEN' | 'SERVICE';
  disher_alergens: string[];
  variants: Variant[];
  extras: Extra[];
};

@Component({
  selector: 'app-dish-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ImageUploaderComponent, LocalizedInputComponent, DishOptionListComponent, TranslatePipe,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dish-form.component.html',
  styles: [`
    :host { display: block; }
    .disher-back-link {
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 4px;
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      transition: color var(--disher-transition-fast);
    }
    .disher-back-link:hover { color: var(--mat-sys-primary); }
    .disher-back-link .material-symbols-outlined { font-size: 18px; }
    .disher-allergens-section {
      border-top: 1px solid var(--mat-sys-outline-variant);
      padding-top: 24px;
    }
    .disher-section-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--mat-sys-on-surface);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .disher-allergen-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: var(--disher-shape-sm);
      border: 1px solid var(--mat-sys-outline-variant);
      cursor: pointer;
      font-size: 14px;
      transition: all var(--disher-transition-fast);
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface-variant);
    }
    .disher-allergen-chip:hover { border-color: var(--mat-sys-outline); }
    .disher-allergen-active {
      background: var(--mat-sys-tertiary-container);
      border-color: var(--mat-sys-tertiary);
      color: var(--mat-sys-on-tertiary-container);
    }
  `],
})
export class DishFormComponent implements OnInit, OnDestroy {
  private dishService = inject(DishService);
  private categoryService = inject(CategoryService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private i18n = inject(I18nService);
  private localizationService = inject(LocalizationService);
  private notify = inject(NotificationService);
  private destroy$ = new Subject<void>();

  readonly allergenCodes = ALLERGEN_CODES;

  isEdit = false;
  saving = signal(false);
  dish = signal<DishFormData>({
    category_id: '',
    disher_name: [],
    disher_description: [],
    disher_price: 0.01,
    disher_type: 'KITCHEN',
    disher_alergens: [],
    variants: [],
    extras: []
  });
  categories = signal<Category[]>([]);

  ngOnInit(): void {
    this.loadCategories();
    this.loadDishIfEditing();
  }

  getCategoryName(cat: Category): string {
    if (!cat.category_name || cat.category_name.length === 0) return '';
    return cat.category_name[0]?.value ?? '';
  }

  private loadDishIfEditing(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEdit = true;
      this.loadDish(id);
    }
  }

  loadCategories(): void {
    this.categoryService.list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => this.categories.set(categories),
        error: () => undefined
      });
  }

  loadDish(id: string): void {
    this.dishService.get(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (dish) => this.dish.set(dish as DishFormData),
        error: (err) => {
          this.notify.error(this.i18n.translate('errors.LOADING_ERROR'));
          this.router.navigate(['/admin/dishes']);
        }
      });
  }

  onImageUploaded(url: string): void {
    this.dish.update((d) => ({ ...d, disher_url_image: url }));
  }

  hasAllergen(code: string): boolean {
    return (this.dish().disher_alergens ?? []).includes(code);
  }

  toggleAllergen(code: string): void {
    const current = this.dish().disher_alergens ?? [];
    const updated = current.includes(code)
      ? current.filter(a => a !== code)
      : [...current, code];
    this.dish.update(d => ({ ...d, disher_alergens: updated }));
  }

  addVariant(): void {
    const newVariant: Partial<Variant> = {
      variant_name: [],
      variant_description: [],
      variant_price: 0
    };
    this.dish.update(d => ({
      ...d,
      variants: [...(d.variants || []), newVariant as Variant]
    }));
  }

  removeVariant(index: number): void {
    this.dish.update(d => ({
      ...d,
      variants: (d.variants || []).filter((_, i) => i !== index)
    }));
  }

  addExtra(): void {
    const newExtra: Partial<Extra> = {
      extra_name: [],
      extra_description: [],
      extra_price: 0
    };
    this.dish.update(d => ({
      ...d,
      extras: [...(d.extras || []), newExtra as Extra]
    }));
  }

  removeExtra(index: number): void {
    this.dish.update(d => ({
      ...d,
      extras: (d.extras || []).filter((_, i) => i !== index)
    }));
  }

  getVariantsAsOptions(): OptionItem[] {
    return this.dish().variants;
  }

  getExtrasAsOptions(): OptionItem[] {
    return this.dish().extras;
  }

  save(): void {
    const defaultLang = this.localizationService.defaultLanguage();
    const nameInDefault = this.dish().disher_name?.find(e => e.lang === defaultLang)?.value;

    if (!nameInDefault?.trim()) {
      this.notify.error(this.i18n.translate('validation.default_lang_required'));
      return;
    }

    if (!Number.isFinite(this.dish().disher_price) || this.dish().disher_price < 0) {
      this.notify.error(this.i18n.translate('validation.price_required'));
      return;
    }

    if (!this.dish().category_id) {
      this.notify.error(this.i18n.translate('validation.category_required'));
      return;
    }

    const validVariants = (this.dish().variants || []).filter(v => {
      const hasName = v.variant_name?.some(n => n.value?.trim());
      const hasValidPrice = Number.isFinite(v.variant_price) && v.variant_price >= 0;
      return hasName && hasValidPrice;
    });

    const validExtras = (this.dish().extras || []).filter(e => {
      const hasName = e.extra_name?.some(n => n.value?.trim());
      const hasValidPrice = Number.isFinite(e.extra_price) && e.extra_price >= 0;
      return hasName && hasValidPrice;
    });

    // Build the PATCH payload with only schema fields: the backend's
    // UpdateDishSchema is .strict() and rejects document metadata (_id,
    // restaurant_id, createdAt, updatedAt, __v) that spreading this.dish()
    // would otherwise send back. category_id is normalized to a string in
    // case the backend returned a populated Category object.
    const {
      _id: _omitId,
      restaurant_id: _omitRestaurant,
      createdAt: _omitCreatedAt,
      updatedAt: _omitUpdatedAt,
      __v: _omitV,
      ...editableFields
    } = this.dish() as Record<string, unknown>;

    const rawCategoryId = this.dish().category_id as unknown;
    const categoryId = typeof rawCategoryId === 'string'
      ? rawCategoryId
      : (rawCategoryId as { _id?: string })?._id ?? '';

    const dishData = {
      ...editableFields,
      category_id: categoryId,
      variants: validVariants,
      extras: validExtras,
    };

    this.saving.set(true);
    const dishId = this.dish()._id;
    const request$ = this.isEdit && dishId
      ? this.dishService.update(dishId, dishData)
      : this.dishService.create(dishData);

    request$.pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.notify.success(this.i18n.translate(this.isEdit ? 'dish.updated' : 'dish.created'));
          this.router.navigate(['/admin/dishes']);
        },
        error: (err) => {
          this.saving.set(false);
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR') + ': ' + (err.error?.message || ''));
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
