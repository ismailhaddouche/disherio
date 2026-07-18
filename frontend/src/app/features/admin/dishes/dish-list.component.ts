import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { authStore } from '../../../store/auth.store';
import { LocalizePipe } from '../../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { CurrencyFormatPipe } from '../../../shared/pipes/currency-format.pipe';
import { I18nService } from '../../../core/services/i18n.service';
import { NotificationService } from '../../../core/services/notification.service';
import { DishService } from '../../../services/dish.service';
import type { Dish } from '../../../types';

@Component({
  selector: 'app-dish-list',
  standalone: true,
  imports: [CommonModule, RouterModule, LocalizePipe, TranslatePipe, CurrencyFormatPipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-container">
      <header class="admin-header">
        <div>
          <h1 class="admin-title">{{ 'admin.menu.dishes' | translate }}</h1>
          <p class="admin-subtitle">{{ 'dish.subtitle' | translate }}</p>
        </div>
        <a matButton routerLink="new" class="disher-add-btn">
          <mat-icon aria-hidden="true">add</mat-icon>
          {{ 'dish.new_dish' | translate }}
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
          <button matButton (click)="loadDishes()" class="disher-add-btn">{{ 'common.retry' | translate }}</button>
        </div>
      }

      @if (!loading() && !error()) {
      <div class="admin-grid">
        @for (dish of dishes(); track dish._id) {
          <div class="admin-card disher-dish-card">
            <div class="disher-dish-image">
              @if (dish.disher_url_image) {
                <img [src]="dish.disher_url_image" class="w-full h-full object-cover" alt="" />
              } @else {
                <div class="disher-dish-placeholder">
                  <span class="material-symbols-outlined" aria-hidden="true">restaurant</span>
                </div>
              }
              <div class="disher-status-badge" [class.disher-status-active]="dish.disher_status === 'ACTIVATED'" [class.disher-status-inactive]="dish.disher_status !== 'ACTIVATED'">
                {{ dish.disher_status === 'ACTIVATED' ? ('common.active' | translate) : ('common.inactive' | translate) }}
              </div>
            </div>

            <div class="disher-dish-body">
              <h3 class="disher-dish-name">{{ dish.disher_name | localize }}</h3>
              <p class="disher-dish-desc">{{ (dish.disher_description | localize) || ('dish.no_description' | translate) }}</p>
              <p class="disher-dish-price">{{ dish.disher_price | currencyFormat }}</p>

              <div class="disher-dish-actions">
                <a matButton [routerLink]="[dish._id]" class="disher-edit-btn">
                  {{ 'common.edit' | translate }}
                </a>
                <button
                  matIconButton
                  (click)="toggleStatus(dish._id!)"
                  [attr.aria-label]="(dish.disher_status === 'ACTIVATED' ? 'common.deactivate' : 'common.activate') | translate"
                  [title]="(dish.disher_status === 'ACTIVATED' ? 'common.deactivate' : 'common.activate') | translate"
                >
                  <mat-icon aria-hidden="true">{{ dish.disher_status === 'ACTIVATED' ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </div>
            </div>
          </div>
        }
      </div>

      @if (dishes().length === 0) {
        <div class="disher-empty-state">
          <span class="material-symbols-outlined disher-empty-icon" aria-hidden="true">restaurant_menu</span>
          <p class="disher-empty-title">{{ 'dish.no_dishes' | translate }}</p>
          <a matButton routerLink="new" class="disher-add-btn">{{ 'dish.new_dish' | translate }}</a>
        </div>
      }
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .disher-add-btn { min-height: 40px; }
    .disher-dish-card { cursor: default; }
    .disher-dish-image {
      position: relative;
      height: 160px;
      background: var(--mat-sys-surface-container-high);
      overflow: hidden;
    }
    .disher-dish-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--mat-sys-on-surface-variant);
    }
    .disher-dish-placeholder .material-symbols-outlined { font-size: 48px; opacity: 0.4; }
    .disher-status-badge {
      position: absolute;
      top: 12px;
      right: 12px;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: var(--disher-shape-full);
      color: var(--mat-sys-on-primary);
    }
    .disher-status-active { background: var(--disher-success); }
    .disher-status-inactive { background: var(--mat-sys-surface-container-highest); color: var(--mat-sys-on-surface-variant); }
    .disher-dish-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }
    .disher-dish-name {
      font-size: 18px;
      font-weight: 700;
      color: var(--mat-sys-on-surface);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .disher-dish-desc {
      font-size: 14px;
      color: var(--mat-sys-on-surface-variant);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 2.5rem;
    }
    .disher-dish-price {
      font-size: 20px;
      font-weight: 900;
      color: var(--mat-sys-primary);
      margin-top: 4px;
    }
    .disher-dish-actions {
      display: flex;
      gap: 8px;
      margin-top: auto;
      padding-top: 16px;
      align-items: center;
    }
    .disher-edit-btn { flex: 1; }
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
export class DishListComponent implements OnInit, OnDestroy {
  private dishService = inject(DishService);
  private i18n = inject(I18nService);
  private notify = inject(NotificationService);
  private destroy$ = new Subject<void>();
  dishes = signal<Dish[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  ngOnInit() {
    if (!authStore.isAuthenticated()) {
      return;
    }
    this.loadDishes();
  }

  loadDishes() {
    this.loading.set(true);
    this.error.set(null);
    this.dishService.list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.dishes.set(res.data);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(this.i18n.translate('errors.LOADING_ERROR'));
          this.notify.error(this.i18n.translate('errors.LOADING_ERROR'));
          this.loading.set(false);
        }
      });
  }

  toggleStatus(id: string) {
    this.dishService.toggleStatus(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notify.success(this.i18n.translate('dish.status_updated'));
          this.loadDishes();
        },
        error: (err) => {
          this.notify.error(this.i18n.translate('dish.toggle_status_error'));
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
