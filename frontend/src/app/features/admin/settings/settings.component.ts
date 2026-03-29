import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { I18nService, type Language } from '../../../core/services/i18n.service';
import { ThemeService, type Theme } from '../../../core/services/theme.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

interface RestaurantSettings {
  _id: string;
  restaurant_name: string;
  tax_rate: number;
  currency: string;
  default_language: Language;
  default_theme: Theme;
  tips_state: boolean;
  tips_type: 'MANDATORY' | 'VOLUNTARY';
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="p-4 lg:p-6 max-w-4xl mx-auto">
      <header class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ 'settings.title' | translate }}
        </h1>
        <div class="flex items-center gap-3">
          @if (saveSuccess()) {
            <span class="text-green-600 dark:text-green-400 flex items-center">
              <svg class="h-5 w-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
              {{ 'settings.preferences.saved' | translate }}
            </span>
          }
          <button
            (click)="saveSettings()"
            [disabled]="saving()"
            class="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {{ saving() ? ('common.loading' | translate) : ('common.save' | translate) }}
          </button>
        </div>
      </header>

      @if (loading()) {
        <div class="flex justify-center py-10">
          <div class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ 'common.loading' | translate }}</span>
          </div>
        </div>
      } @else if (error()) {
        <div class="bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-lg">
          {{ error() }}
        </div>
      } @else {
        <div class="space-y-6">
          <!-- Restaurant Info -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {{ 'settings.restaurant' | translate }}
            </h2>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ 'settings.restaurant' | translate }}
                </label>
                <input
                  type="text"
                  [(ngModel)]="settings().restaurant_name"
                  class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ 'settings.currency' | translate }}
                </label>
                <select
                  [(ngModel)]="settings().currency"
                  class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ 'settings.tax' | translate }} (%)
                </label>
                <input
                  type="number"
                  [(ngModel)]="settings().tax_rate"
                  min="0"
                  max="100"
                  class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <!-- Default Preferences -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {{ 'settings.general' | translate }} - {{ 'common.settings' | translate }} {{ 'settings.restaurant' | translate }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {{ 'settings.staff_defaults' | translate }}
            </p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Default Language -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ 'common.language' | translate }} ({{ 'common.default' | translate }})
                </label>
                <select
                  [(ngModel)]="settings().default_language"
                  class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  @for (lang of availableLanguages; track lang.code) {
                    <option [value]="lang.code">{{ lang.flag }} {{ lang.name }}</option>
                  }
                </select>
              </div>
              
              <!-- Default Theme -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ 'common.theme' | translate }} ({{ 'common.default' | translate }})
                </label>
                <select
                  [(ngModel)]="settings().default_theme"
                  class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="light">☀️ {{ 'common.light' | translate }}</option>
                  <option value="dark">🌙 {{ 'common.dark' | translate }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class SettingsComponent implements OnInit {
  private http = inject(HttpClient);
  private i18n = inject(I18nService);

  settings = signal<RestaurantSettings>({
    _id: '',
    restaurant_name: '',
    tax_rate: 10,
    currency: 'EUR',
    default_language: 'es',
    default_theme: 'light',
    tips_state: false,
    tips_type: 'VOLUNTARY'
  });

  loading = signal(true);
  saving = signal(false);
  error = signal('');
  saveSuccess = signal(false);

  readonly availableLanguages = this.i18n.getAvailableLanguages();

  ngOnInit() {
    this.loadSettings();
  }

  loadSettings() {
    this.loading.set(true);
    this.http.get<RestaurantSettings>(`${environment.apiUrl}/restaurant/settings`).subscribe({
      next: (data) => {
        this.settings.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading settings:', err);
        this.error.set(this.i18n.translate('error.loading'));
        this.loading.set(false);
      }
    });
  }

  saveSettings() {
    this.saving.set(true);
    this.saveSuccess.set(false);

    const s = this.settings();
    const payload = {
      restaurant_name: s.restaurant_name,
      tax_rate: s.tax_rate,
      currency: s.currency,
      default_language: s.default_language,
      default_theme: s.default_theme,
      tips_state: s.tips_state,
      tips_type: s.tips_type
    };

    this.http.patch(`${environment.apiUrl}/restaurant/settings`, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 3000);
      },
      error: (err) => {
        console.error('Error saving settings:', err);
        this.saving.set(false);
        this.error.set(this.i18n.translate('error.saving'));
      }
    });
  }
}
