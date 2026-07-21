import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ImageUploaderComponent } from '../../../shared/components/image-uploader/image-uploader.component';
import { LocalizedInputComponent } from '../../../shared/components/localized-input.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';
import { LocalizationService } from '../../../core/services/localization.service';
import { NotificationService } from '../../../core/services/notification.service';
import { CategoryService } from '../../../core/services/category.service';
import type { Category, LocalizedField } from '../../../types';

type CategoryFormData = Omit<Partial<Category>, 'category_name' | 'category_description' | 'category_image_url'> & {
  category_name: LocalizedField;
  category_description: LocalizedField;
  category_image_url: string | null;
  unlimited_orders: boolean;
};

@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ImageUploaderComponent, LocalizedInputComponent, TranslatePipe,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-container max-w-4xl">
      <header class="admin-header">
        <div>
          <a routerLink="/admin/categories" class="disher-back-link">
            <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
            {{ 'common.back' | translate }}
          </a>
          <h1 class="admin-title">{{ isEdit ? ('category.edit' | translate) : ('category.new' | translate) }}</h1>
          <p class="admin-subtitle">{{ isEdit ? ('category.edit_subtitle' | translate) : ('category.new_subtitle' | translate) }}</p>
        </div>
        <div class="flex gap-3">
          <button matButton (click)="cancel()">{{ 'common.cancel' | translate }}</button>
          <button matButton (click)="save()" [disabled]="saving()">
            <mat-icon aria-hidden="true">{{ saving() ? 'progress_activity' : 'save' }}</mat-icon>
            {{ 'common.save' | translate }}
          </button>
        </div>
      </header>

      <div class="admin-card p-6 flex flex-col gap-6">
        <section class="flex flex-col gap-2">
          <label class="admin-label text-base font-bold">{{ 'category.image' | translate }}</label>
          @if (isEdit) {
            <app-image-uploader
              folder="categories"
              [resourceId]="category()._id ?? null"
              [currentImage]="category().category_image_url"
              (imageUploaded)="onImageUploaded($event)"
            />
          } @else {
            <!-- New categories have no id yet: the upload endpoint is ownership-scoped
                 to an existing category, so uploading is enabled after the first save. -->
            <p class="text-sm" style="color: var(--mat-sys-on-surface-variant)">{{ 'image_uploader.save_first' | translate }}</p>
          }
        </section>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <app-localized-input
            [label]="('category.name' | translate) + ' *'"
            [(value)]="category().category_name"
            [required]="true"
          />
          <mat-form-field appearance="outline">
            <mat-label>{{ 'category.display_order' | translate }}</mat-label>
            <input matInput type="number" min="0"
              [ngModel]="category().category_order"
              (ngModelChange)="category.update(c => ({ ...c, category_order: +$event }))"
            />
          </mat-form-field>
        </div>

        <label class="disher-checkbox-row">
          <input
            type="checkbox"
            [ngModel]="category().unlimited_orders"
            (ngModelChange)="category.update(c => ({ ...c, unlimited_orders: $event }))"
          />
          <span>
            <strong>{{ 'category.unlimited_orders' | translate }}</strong>
            <small>{{ 'category.unlimited_orders_desc' | translate }}</small>
          </span>
        </label>

        <app-localized-input
          [label]="'category.description' | translate"
          [(value)]="category().category_description"
          [multiline]="true"
        />
      </div>
    </div>
  `,
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
    .disher-checkbox-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--disher-shape-sm);
      background: var(--mat-sys-surface-container-low);
      color: var(--mat-sys-on-surface);
      cursor: pointer;
    }
    .disher-checkbox-row input { margin-top: 3px; width: 18px; height: 18px; }
    .disher-checkbox-row span { display: flex; flex-direction: column; gap: 2px; }
    .disher-checkbox-row small { color: var(--mat-sys-on-surface-variant); }
  `],
})
export class CategoryFormComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private categoryService = inject(CategoryService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private i18n = inject(I18nService);
  private localizationService = inject(LocalizationService);
  private notify = inject(NotificationService);

  isEdit = false;
  saving = signal(false);
  category = signal<CategoryFormData>({
    category_name: [],
    category_order: 0,
    category_description: [],
    category_image_url: null,
    unlimited_orders: false,
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEdit = true;
      this.loadCategory(id);
    }
  }

  loadCategory(id: string) {
    this.categoryService.get(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (category) => this.category.set(category as CategoryFormData),
        error: (err) => {
          this.notify.error(err.error?.message || this.i18n.translate('errors.LOADING_ERROR'));
          this.router.navigate(['/admin/categories']);
        },
      });
  }

  onImageUploaded(url: string) {
    this.category.update(c => ({ ...c, category_image_url: url }));
  }

  save() {
    const defaultLang = this.localizationService.defaultLanguage();
    const nameInDefault = this.category().category_name?.find(e => e.lang === defaultLang)?.value;

    if (!nameInDefault?.trim()) {
      this.notify.error(this.i18n.translate('validation.default_lang_required'));
      return;
    }

    this.saving.set(true);
    // The backend schema rejects category_image_url: null; omit it when
    // no image has been uploaded yet.
    const { category_image_url, ...rest } = this.category();
    const payload = category_image_url ? { ...rest, category_image_url } : rest;
    const obs = this.isEdit
      ? this.categoryService.update(this.category()._id!, payload)
      : this.categoryService.create(payload);

    obs.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.success(this.i18n.translate(this.isEdit ? 'category.updated' : 'category.created'));
        this.router.navigate(['/admin/categories']);
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.error(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
      },
    });
  }

  cancel() {
    this.router.navigate(['/admin/categories']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
