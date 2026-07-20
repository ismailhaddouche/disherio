import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LocalizePipe } from '../../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SafeUrlPipe } from '../../../shared/pipes/safe-url.pipe';
import { I18nService } from '../../../core/services/i18n.service';
import { NotificationService } from '../../../core/services/notification.service';
import { authStore } from '../../../store/auth.store';
import type { Category } from '../../../types';
import { CategoryService } from '../../../core/services/category.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [CommonModule, RouterModule, LocalizePipe, TranslatePipe, SafeUrlPipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-container">
      <header class="admin-header">
        <div>
          <h1 class="admin-title">{{ 'admin.menu.categories' | translate }}</h1>
          <p class="admin-subtitle">{{ 'category.subtitle' | translate }}</p>
        </div>
        <a matButton routerLink="new" class="disher-add-btn">
          <mat-icon aria-hidden="true">add</mat-icon>
          {{ 'category.new' | translate }}
        </a>
      </header>

      @if (loading()) {
        <div class="disher-loading-state" role="status">
          <mat-progress-spinner mode="indeterminate" diameter="48" />
          <p class="disher-loading-text">{{ 'common.loading' | translate }}</p>
        </div>
      }

      @if (!loading() && error(); as errorMessage) {
        <div class="disher-empty-state" role="alert">
          <span class="material-symbols-outlined disher-empty-icon" aria-hidden="true">error</span>
          <p class="disher-empty-title">{{ errorMessage }}</p>
          <button matButton (click)="loadCategories()" class="disher-add-btn">{{ 'common.retry' | translate }}</button>
        </div>
      }

      @if (!loading() && !error()) {
      <div class="admin-grid">
        @for (cat of categories(); track cat._id) {
          <div class="admin-card disher-cat-card">
            <div class="disher-cat-image">
              @if (cat.category_image_url) {
                <img [src]="cat.category_image_url | safeUrl" class="w-full h-full object-cover" alt="" />
              } @else {
                <div class="disher-cat-placeholder">
                  <span class="material-symbols-outlined" aria-hidden="true">category</span>
                </div>
              }
              <div class="disher-order-badge">
                {{ 'category.display_order' | translate }}: {{ cat.category_order }}
              </div>
            </div>

            <div class="disher-cat-body">
              <h3 class="disher-cat-name">{{ cat.category_name | localize }}</h3>
              <p class="disher-cat-desc">
                {{ (cat.category_description | localize) || ('dish.no_description' | translate) }}
              </p>

              <div class="disher-cat-actions">
                <a matButton [routerLink]="[cat._id]" class="disher-edit-btn">
                  {{ 'common.edit' | translate }}
                </a>
                <button
                  matIconButton
                  (click)="deleteCategory(cat._id!)"
                  [attr.aria-label]="'common.delete' | translate"
                  [title]="'common.delete' | translate"
                  class="disher-delete-btn"
                >
                  <mat-icon aria-hidden="true">delete</mat-icon>
                </button>
              </div>
            </div>
          </div>
        }
      </div>

      @if (categories().length === 0) {
        <div class="disher-empty-state">
          <span class="material-symbols-outlined disher-empty-icon" aria-hidden="true">category</span>
          <p class="disher-empty-title">{{ 'category.no_categories' | translate }}</p>
          <a matButton routerLink="new" class="disher-add-btn">{{ 'category.new' | translate }}</a>
        </div>
      }
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .disher-add-btn { min-height: 40px; }
    .disher-cat-image {
      position: relative;
      height: 160px;
      background: var(--mat-sys-surface-container-high);
      overflow: hidden;
    }
    .disher-cat-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--mat-sys-on-surface-variant);
    }
    .disher-cat-placeholder .material-symbols-outlined { font-size: 48px; opacity: 0.4; }
    .disher-order-badge {
      position: absolute;
      top: 12px;
      right: 12px;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: var(--disher-shape-full);
      background: color-mix(in srgb, var(--mat-sys-scrim) 60%, transparent);
      color: var(--mat-sys-on-surface);
      backdrop-filter: blur(8px);
      border: 1px solid color-mix(in srgb, var(--mat-sys-outline-variant) 20%, transparent);
    }
    .disher-cat-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }
    .disher-cat-name {
      font-size: 18px;
      font-weight: 700;
      color: var(--mat-sys-on-surface);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .disher-cat-desc {
      font-size: 14px;
      color: var(--mat-sys-on-surface-variant);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 2.5rem;
    }
    .disher-cat-actions {
      display: flex;
      gap: 8px;
      margin-top: auto;
      padding-top: 16px;
      align-items: center;
    }
    .disher-edit-btn { flex: 1; }
    .disher-delete-btn { color: var(--mat-sys-error); }
    .disher-loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 0;
      gap: 16px;
    }
    .disher-loading-text { color: var(--mat-sys-on-surface-variant); font-weight: 500; margin: 0; }
    .disher-empty-state {
      padding: 80px 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: var(--mat-sys-on-surface-variant);
    }
    .disher-empty-icon { font-size: 72px; opacity: 0.2; }
    .disher-empty-title { font-size: 18px; font-weight: 500; }
  `],
})
export class CategoryListComponent implements OnInit, OnDestroy {
  private categoryService = inject(CategoryService);
  private confirmation = inject(ConfirmationService);
  private i18n = inject(I18nService);
  private notify = inject(NotificationService);
  private destroy$ = new Subject<void>();
  categories = signal<Category[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  ngOnInit() {
    if (!authStore.isAuthenticated()) {
      return;
    }
    this.loadCategories();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCategories() {
    this.loading.set(true);
    this.error.set(null);
    this.categoryService.list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.categories.set(res);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(this.i18n.translate('errors.LOADING_ERROR'));
          this.notify.error(this.i18n.translate('errors.LOADING_ERROR'));
          this.loading.set(false);
        }
      });
  }

  deleteCategory(id: string) {
    this.confirmation.confirm(this.i18n.translate('category.delete_confirm'), { destructive: true })
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmed => {
        if (!confirmed) return;
        this.categoryService.delete(id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.notify.success(this.i18n.translate('common.deleted'));
            this.loadCategories();
          },
          error: (err) => {
            this.notify.error(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
          }
        });
      });
  }
}
