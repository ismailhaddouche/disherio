import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { I18nService, type Language } from '../../../core/services/i18n.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { NotificationService } from '../../../core/services/notification.service';
import { RestaurantService, type RestaurantSettings } from '../../../core/services/restaurant.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslatePipe,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatProgressSpinnerModule,
    MatSlideToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-container max-w-5xl">
      <header class="admin-header">
        <div>
          <h1 class="admin-title">{{ 'settings.title' | translate }}</h1>
          <p class="admin-subtitle">{{ 'settings.subtitle' | translate }}</p>
        </div>
        <button matButton (click)="saveSettings()" [disabled]="saving()">
          <mat-icon aria-hidden="true">{{ saving() ? 'progress_activity' : 'save' }}</mat-icon>
          {{ saving() ? ('common.saving' | translate) : ('common.save' | translate) }}
        </button>
      </header>

      @if (loading()) {
        <div class="disher-loading-state">
          <mat-progress-spinner mode="indeterminate" diameter="48" />
          <p class="disher-loading-text">{{ 'common.loading' | translate }}</p>
        </div>
      } @else {
        <div class="space-y-6">
          <!-- Restaurant Info -->
          <div class="admin-card p-6">
            <h2 class="disher-section-title">
              <span class="material-symbols-outlined text-primary" aria-hidden="true">store</span>
              {{ 'settings.restaurant' | translate }}
            </h2>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <mat-form-field appearance="outline" class="disher-form-field">
                <mat-label>{{ 'settings.restaurant_name' | translate }}</mat-label>
                <input matInput type="text"
                  [ngModel]="settings().restaurant_name"
                  (ngModelChange)="settings.update(s => ({ ...s, restaurant_name: $event }))"
                  [placeholder]="'settings.restaurant_name' | translate"
                />
              </mat-form-field>

              <mat-form-field appearance="outline" class="disher-form-field">
                <mat-label>{{ 'settings.currency' | translate }}</mat-label>
                <mat-select
                  [ngModel]="settings().currency"
                  (ngModelChange)="settings.update(s => ({ ...s, currency: $event }))"
                >
                  <mat-option value="EUR">{{ 'settings.currency_eur' | translate }}</mat-option>
                  <mat-option value="USD">{{ 'settings.currency_usd' | translate }}</mat-option>
                  <mat-option value="GBP">{{ 'settings.currency_gbp' | translate }}</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="disher-form-field">
                <mat-label>{{ 'settings.tax' | translate }} (%)</mat-label>
                <input matInput type="number" min="0" max="100"
                  [ngModel]="settings().tax_rate"
                  (ngModelChange)="settings.update(s => ({ ...s, tax_rate: +$event }))"
                />
              </mat-form-field>
            </div>
          </div>

          <!-- Default Preferences -->
          <div class="admin-card p-6">
            <h2 class="disher-section-title">
              <span class="material-symbols-outlined text-primary" aria-hidden="true">tune</span>
              {{ 'settings.general' | translate }}
            </h2>
            <p class="disher-section-desc">{{ 'settings.staff_defaults' | translate }}</p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <mat-form-field appearance="outline" class="disher-form-field">
                <mat-label>{{ 'common.language' | translate }} ({{ 'common.default' | translate }})</mat-label>
                <mat-select
                  [ngModel]="settings().default_language"
                  (ngModelChange)="settings.update(s => ({ ...s, default_language: $event }))"
                >
                  @for (lang of availableLanguages; track lang.code) {
                    <mat-option [value]="lang.code">{{ lang.shortCode }} {{ lang.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="disher-form-field">
                <mat-label>{{ 'common.theme' | translate }} ({{ 'common.default' | translate }})</mat-label>
                <mat-select
                  [ngModel]="settings().default_theme"
                  (ngModelChange)="settings.update(s => ({ ...s, default_theme: $event }))"
                >
                  <mat-option value="light">{{ 'common.light' | translate }}</mat-option>
                  <mat-option value="dark">{{ 'common.dark' | translate }}</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
          </div>

          <!-- Interface Languages -->
          <div class="admin-card p-6">
            <h2 class="disher-section-title">
              <span class="material-symbols-outlined text-primary" aria-hidden="true">language</span>
              {{ 'settings.interface_languages' | translate }}
            </h2>
            <p class="disher-section-desc">{{ 'settings.interface_languages_desc' | translate }}</p>

            <div class="flex flex-col gap-3 mt-4">
              @for (lang of allInterfaceLanguages; track lang.code) {
                <label class="flex items-center justify-between gap-3 cursor-pointer">
                  <span class="text-sm font-medium">{{ lang.name }} ({{ lang.shortCode }})</span>
                  <mat-slide-toggle
                    [checked]="settings().enabled_languages.includes(lang.code)"
                    (change)="toggleInterfaceLanguage(lang.code, $event.checked)"
                  />
                </label>
              }
            </div>
          </div>

          <!-- Customer Order Limits -->
          <div class="admin-card p-6">
            <h2 class="disher-section-title">
              <span class="material-symbols-outlined text-primary" aria-hidden="true">timer</span>
              {{ 'settings.order_limits' | translate }}
            </h2>
            <p class="disher-section-desc">{{ 'settings.order_limits_desc' | translate }}</p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <mat-form-field appearance="outline" class="disher-form-field">
                <mat-label>{{ 'settings.order_interval_minutes' | translate }}</mat-label>
                <input matInput type="number" min="0"
                  [ngModel]="settings().order_interval_minutes"
                  (ngModelChange)="settings.update(s => ({ ...s, order_interval_minutes: normalizeLimit($event) }))"
                />
              </mat-form-field>

              <mat-form-field appearance="outline" class="disher-form-field">
                <mat-label>{{ 'settings.max_orders_per_session' | translate }}</mat-label>
                <input matInput type="number" min="0"
                  [ngModel]="settings().max_orders_per_session"
                  (ngModelChange)="settings.update(s => ({ ...s, max_orders_per_session: normalizeLimit($event) }))"
                />
              </mat-form-field>
            </div>
          </div>

        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .disher-loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 0;
      gap: 16px;
    }
    .disher-loading-text { color: var(--mat-sys-on-surface-variant); font-weight: 500; margin: 0; }
    .disher-section-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--mat-sys-on-surface);
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .disher-section-desc {
      font-size: 14px;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 20px;
    }
    .disher-form-field { width: 100%; }
    .disher-lang-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: var(--disher-shape-md);
      background: var(--mat-sys-surface-container-low);
    }
    .disher-mono-chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: var(--disher-shape-xs);
      background: var(--mat-sys-surface-container-high);
      font-family: monospace;
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant);
    }
    .disher-default-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: var(--disher-shape-full);
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font-size: 12px;
      font-weight: 500;
    }
    .disher-action-btn { color: var(--mat-sys-on-surface-variant); }
    .disher-action-btn:hover { color: var(--mat-sys-primary); }
    .disher-save-btn { color: var(--mat-sys-primary); }
    .disher-delete-btn { color: var(--mat-sys-error); }
    .disher-add-lang-form {
      padding: 16px;
      border-radius: var(--disher-shape-md);
      background: var(--mat-sys-primary-container);
      border: 1px solid var(--mat-sys-outline-variant);
      margin-bottom: 16px;
    }
    .disher-add-lang-btn { min-height: 36px; }
  `],
})
export class SettingsComponent implements OnInit, OnDestroy {
  private restaurantService = inject(RestaurantService);
  private i18n = inject(I18nService);
  private notify = inject(NotificationService);
  private destroy$ = new Subject<void>();

  settings = signal<RestaurantSettings>({
    _id: '',
    restaurant_name: '',
    tax_rate: 10,
    currency: 'EUR',
    default_language: 'es',
    default_theme: 'light',
    enabled_languages: ['es', 'en', 'fr'],
    tips_state: false,
    tips_type: 'VOLUNTARY',
    tips_rate: 0,
    order_interval_minutes: 0,
    max_orders_per_session: 0,
  });

  loading = signal(true);
  saving = signal(false);

  readonly availableLanguages = this.i18n.getAvailableLanguages();

  // Always show all three interface languages in the toggle card, regardless
  // of which are currently enabled, so the admin can re-enable a disabled one.
  readonly allInterfaceLanguages: { code: Language; name: string; shortCode: string }[] = [
    { code: 'es', name: 'Español', shortCode: 'ES' },
    { code: 'en', name: 'English', shortCode: 'EN' },
    { code: 'fr', name: 'Français', shortCode: 'FR' },
  ];

  ngOnInit() {
    this.loadSettings();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSettings() {
    this.loading.set(true);
    this.restaurantService.getSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.settings.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          this.notify.error(this.i18n.translate('error.loading'));
          this.loading.set(false);
        }
      });
  }

  saveSettings() {
    this.saving.set(true);

    const s = this.settings();
    const payload = {
      restaurant_name: s.restaurant_name,
      tax_rate: s.tax_rate,
      currency: s.currency,
      default_language: s.default_language,
      default_theme: s.default_theme,
      enabled_languages: s.enabled_languages,
      tips_state: s.tips_state,
      tips_type: s.tips_type,
      tips_rate: s.tips_rate,
      order_interval_minutes: s.order_interval_minutes,
      max_orders_per_session: s.max_orders_per_session,
    };

    this.restaurantService.updateSettings(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.notify.success(this.i18n.translate('settings.preferences.saved'));
        },
        error: (err) => {
          this.saving.set(false);
          this.notify.error(this.i18n.translate('error.saving'));
        }
      });
  }

  normalizeLimit(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.floor(parsed);
  }

  /** Toggle an interface language on/off for this restaurant. */
  toggleInterfaceLanguage(lang: Language, checked: boolean): void {
    const current = this.settings().enabled_languages;
    const enabled = checked
      ? [...new Set([...current, lang])]
      : current.filter((l) => l !== lang);

    if (enabled.length === 0) {
      this.notify.error(this.i18n.translate('settings.cannot_disable_all_languages'));
      this.loadSettings();
      return;
    }

    // Prevent disabling the current default language.
    if (!checked && lang === this.settings().default_language) {
      this.notify.error(this.i18n.translate('settings.cannot_disable_default_language'));
      this.loadSettings();
      return;
    }

    this.restaurantService.updateSettings({ enabled_languages: enabled })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.settings.update((s) => ({ ...s, enabled_languages: res.settings.enabled_languages }));
          this.notify.success(this.i18n.translate('settings.languages_updated'));
        },
        error: () => this.notify.error(this.i18n.translate('error.saving')),
      });
  }
}
