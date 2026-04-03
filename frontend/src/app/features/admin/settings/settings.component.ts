import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { I18nService, type Language } from '../../../core/services/i18n.service';
import { ThemeService, type Theme } from '../../../core/services/theme.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { NotificationService } from '../../../core/services/notification.service';
import { MenuLanguageService } from '../../../services/menu-language.service';
import type { MenuLanguage } from '../../../types';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-container max-w-5xl">
      <header class="admin-header">
        <div>
          <h1 class="admin-title">{{ 'settings.title' | translate }}</h1>
          <p class="admin-subtitle">{{ 'settings.subtitle' | translate }}</p>
        </div>
        <button
          (click)="saveSettings()"
          [disabled]="saving()"
          class="btn-admin btn-primary"
        >
          @if (saving()) {
            <span class="material-symbols-outlined animate-spin text-sm">refresh</span>
          } @else {
            <span class="material-symbols-outlined text-sm">save</span>
          }
          {{ saving() ? ('common.saving' | translate) : ('common.save' | translate) }}
        </button>
      </header>

      @if (loading()) {
        <div class="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div class="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent"></div>
          <p class="mt-4 text-gray-600 dark:text-gray-400 font-medium">{{ 'common.loading' | translate }}</p>
        </div>
      } @else {
        <div class="space-y-6">
          <!-- Restaurant Info -->
          <div class="admin-card p-6">
            <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">store</span>
              {{ 'settings.restaurant' | translate }}
            </h2>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label class="admin-label">
                  {{ 'settings.restaurant_name' | translate }}
                </label>
                <input
                  type="text"
                  [(ngModel)]="settings().restaurant_name"
                  class="admin-input"
                  [placeholder]="'settings.restaurant_name' | translate"
                />
              </div>
              
              <div>
                <label class="admin-label">
                  {{ 'settings.currency' | translate }}
                </label>
                <select
                  [(ngModel)]="settings().currency"
                  class="admin-select"
                >
                  <option value="EUR">{{ 'settings.currency_eur' | translate }}</option>
                  <option value="USD">{{ 'settings.currency_usd' | translate }}</option>
                  <option value="GBP">{{ 'settings.currency_gbp' | translate }}</option>
                </select>
              </div>
              
              <div>
                <label class="admin-label">
                  {{ 'settings.tax' | translate }} (%)
                </label>
                <input
                  type="number"
                  [(ngModel)]="settings().tax_rate"
                  min="0"
                  max="100"
                  class="admin-input"
                />
              </div>
            </div>
          </div>

          <!-- Default Preferences -->
          <div class="admin-card p-6">
            <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">tune</span>
              {{ 'settings.general' | translate }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-5">
              {{ 'settings.staff_defaults' | translate }}
            </p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <!-- Default Language -->
              <div>
                <label class="admin-label">
                  {{ 'common.language' | translate }} ({{ 'common.default' | translate }})
                </label>
                <select
                  [(ngModel)]="settings().default_language"
                  class="admin-select"
                >
                  @for (lang of availableLanguages; track lang.code) {
                    <option [value]="lang.code">{{ lang.flag }} {{ lang.name }}</option>
                  }
                </select>
              </div>
              
              <!-- Default Theme -->
              <div>
                <label class="admin-label">
                  {{ 'common.theme' | translate }} ({{ 'common.default' | translate }})
                </label>
                <select
                  [(ngModel)]="settings().default_theme"
                  class="admin-select"
                >
                  <option value="light">☀️ {{ 'common.light' | translate }}</option>
                  <option value="dark">🌙 {{ 'common.dark' | translate }}</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Menu Languages -->
          <div class="admin-card p-6">
            <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">translate</span>
              {{ 'settings.menu_languages' | translate }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-5">
              {{ 'settings.menu_languages_desc' | translate }}
            </p>

            <!-- Existing languages list -->
            @if (menuLangService.languages().length) {
              <div class="space-y-3 mb-5">
                @for (lang of menuLangService.languages(); track lang._id) {
                  <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    @if (editingLangId() === lang._id) {
                      <!-- Edit mode -->
                      <div class="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input
                          type="text"
                          [(ngModel)]="editLangName"
                          class="admin-input text-sm"
                          [placeholder]="'settings.language_name' | translate"
                        />
                        <select
                          [(ngModel)]="editLangLinked"
                          class="admin-select text-sm"
                        >
                          <option [ngValue]="null">{{ 'settings.none_linked' | translate }}</option>
                          @for (al of availableLanguages; track al.code) {
                            <option [value]="al.code">{{ al.flag }} {{ al.name }}</option>
                          }
                        </select>
                        <div class="flex gap-2">
                          <button (click)="saveEditLang(lang)" class="btn-admin btn-primary text-sm px-3 py-1">
                            <span class="material-symbols-outlined text-sm">check</span>
                          </button>
                          <button (click)="cancelEditLang()" class="btn-admin btn-secondary text-sm px-3 py-1">
                            <span class="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>
                      </div>
                    } @else {
                      <!-- Display mode -->
                      <div class="flex-1 flex items-center gap-3">
                        <span class="font-semibold text-gray-900 dark:text-white">{{ lang.name }}</span>
                        <span class="text-xs font-mono bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">{{ lang.code }}</span>
                        @if (lang.is_default) {
                          <span class="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                            {{ 'settings.default_language_badge' | translate }}
                          </span>
                        }
                        @if (lang.linked_app_lang) {
                          <span class="text-xs text-gray-500 dark:text-gray-400">
                            → {{ getAppLangName(lang.linked_app_lang) }}
                          </span>
                        }
                      </div>
                      <div class="flex items-center gap-1">
                        @if (!lang.is_default) {
                          <button
                            (click)="setDefaultLang(lang._id!)"
                            class="p-1.5 text-gray-400 hover:text-primary transition-colors"
                            [title]="'settings.set_as_default' | translate"
                          >
                            <span class="material-symbols-outlined text-lg">star</span>
                          </button>
                        }
                        <button
                          (click)="startEditLang(lang)"
                          class="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                        >
                          <span class="material-symbols-outlined text-lg">edit</span>
                        </button>
                        @if (!lang.is_default) {
                          <button
                            (click)="deleteLang(lang)"
                            class="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <span class="material-symbols-outlined text-lg">delete</span>
                          </button>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }

            <!-- Add new language form -->
            @if (showAddLangForm()) {
              <div class="p-4 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/20 mb-4">
                <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    [(ngModel)]="newLangName"
                    class="admin-input text-sm"
                    [placeholder]="'settings.language_name' | translate"
                  />
                  <input
                    type="text"
                    [(ngModel)]="newLangCode"
                    class="admin-input text-sm"
                    [placeholder]="'settings.language_code' | translate"
                    maxlength="5"
                  />
                  <select
                    [(ngModel)]="newLangLinked"
                    class="admin-select text-sm"
                  >
                    <option [ngValue]="null">{{ 'settings.none_linked' | translate }}</option>
                    @for (al of availableLanguages; track al.code) {
                      <option [value]="al.code">{{ al.flag }} {{ al.name }}</option>
                    }
                  </select>
                  <div class="flex gap-2">
                    <button (click)="addLang()" class="btn-admin btn-primary text-sm flex-1" [disabled]="!newLangName || !newLangCode">
                      <span class="material-symbols-outlined text-sm">check</span>
                      {{ 'common.save' | translate }}
                    </button>
                    <button (click)="showAddLangForm.set(false)" class="btn-admin btn-secondary text-sm">
                      <span class="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                </div>
              </div>
            } @else {
              <button (click)="showAddLangForm.set(true)" class="btn-admin btn-secondary text-sm">
                <span class="material-symbols-outlined text-sm">add</span>
                {{ 'settings.add_language' | translate }}
              </button>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class SettingsComponent implements OnInit {
  private http = inject(HttpClient);
  private i18n = inject(I18nService);
  private notify = inject(NotificationService);
  readonly menuLangService = inject(MenuLanguageService);

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

  readonly availableLanguages = this.i18n.getAvailableLanguages();

  // Menu language form state
  showAddLangForm = signal(false);
  editingLangId = signal<string | null>(null);
  newLangName = '';
  newLangCode = '';
  newLangLinked: string | null = null;
  editLangName = '';
  editLangLinked: string | null = null;

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
      tips_state: s.tips_state,
      tips_type: s.tips_type
    };

    this.http.patch(`${environment.apiUrl}/restaurant/settings`, payload).subscribe({
      next: () => {
        // Sync menu language default with app language
        this.syncMenuLanguageWithAppLanguage(s.default_language);
        
        this.saving.set(false);
        this.notify.success(this.i18n.translate('settings.preferences.saved'));
      },
      error: (err) => {
        console.error('Error saving settings:', err);
        this.saving.set(false);
        this.notify.error(this.i18n.translate('error.saving'));
      }
    });
  }

  /**
   * Syncs the default menu language with the app default language.
   * Finds the menu language linked to the app language and sets it as default.
   */
  private syncMenuLanguageWithAppLanguage(appLangCode: string) {
    // Find menu language linked to this app language
    const linkedMenuLang = this.menuLangService.languages().find(
      l => l.linked_app_lang === appLangCode
    );

    if (linkedMenuLang && !linkedMenuLang.is_default) {
      // Set it as default
      this.menuLangService.setDefault(linkedMenuLang._id!).subscribe({
        next: () => {
          this.menuLangService.refresh();
          console.log(`[Settings] Menu language synced: ${linkedMenuLang.name} is now default`);
        },
        error: (err) => {
          console.error('[Settings] Failed to sync menu language default:', err);
          // Don't show error to user as the main settings were saved successfully
        }
      });
    } else if (!linkedMenuLang) {
      // No menu language linked to this app language - could create one automatically
      // or notify the user. For now, we just log it.
      console.warn(`[Settings] No menu language linked to app language: ${appLangCode}`);
      
      // Optional: Auto-create a menu language for this app language
      this.autoCreateMenuLanguageForAppLang(appLangCode);
    }
  }

  /**
   * Auto-creates a menu language linked to the app language if none exists.
   */
  private autoCreateMenuLanguageForAppLang(appLangCode: string) {
    const appLang = this.availableLanguages.find(l => l.code === appLangCode);
    if (!appLang) return;

    // Check if a menu language with this code already exists
    const existingByCode = this.menuLangService.languages().find(l => l.code === appLangCode);
    if (existingByCode) {
      // Just link it and set as default
      this.menuLangService.update(existingByCode._id!, {
        linked_app_lang: appLangCode
      } as any).subscribe({
        next: () => {
          this.menuLangService.setDefault(existingByCode._id!).subscribe(() => {
            this.menuLangService.refresh();
          });
        }
      });
      return;
    }

    // Create new menu language
    this.menuLangService.create({
      name: appLang.name,
      code: appLangCode,
      linked_app_lang: appLangCode,
      is_default: true
    }).subscribe({
      next: () => {
        this.menuLangService.refresh();
        this.notify.success(this.i18n.translate('settings.menu_lang_auto_created'));
      },
      error: (err) => {
        console.error('[Settings] Failed to auto-create menu language:', err);
      }
    });
  }

  // --- Menu Languages ---

  getAppLangName(code: string): string {
    const lang = this.availableLanguages.find(l => l.code === code);
    return lang ? `${lang.flag} ${lang.name}` : code;
  }

  addLang() {
    if (!this.newLangName || !this.newLangCode) return;
    this.menuLangService.create({
      name: this.newLangName,
      code: this.newLangCode.toLowerCase(),
      linked_app_lang: this.newLangLinked,
    }).subscribe({
      next: () => {
        this.notify.success(this.i18n.translate('settings.menu_lang_created'));
        this.menuLangService.refresh();
        this.newLangName = '';
        this.newLangCode = '';
        this.newLangLinked = null;
        this.showAddLangForm.set(false);
      },
      error: () => this.notify.error(this.i18n.translate('error.saving')),
    });
  }

  startEditLang(lang: MenuLanguage) {
    this.editingLangId.set(lang._id ?? null);
    this.editLangName = lang.name;
    this.editLangLinked = lang.linked_app_lang ?? null;
  }

  cancelEditLang() {
    this.editingLangId.set(null);
  }

  saveEditLang(lang: MenuLanguage) {
    this.menuLangService.update(lang._id!, {
      name: this.editLangName,
      linked_app_lang: this.editLangLinked,
    } as any).subscribe({
      next: () => {
        this.notify.success(this.i18n.translate('settings.menu_lang_updated'));
        this.menuLangService.refresh();
        this.editingLangId.set(null);
      },
      error: () => this.notify.error(this.i18n.translate('error.saving')),
    });
  }

  setDefaultLang(id: string) {
    this.menuLangService.setDefault(id).subscribe({
      next: () => {
        this.notify.success(this.i18n.translate('settings.menu_lang_default_set'));
        this.menuLangService.refresh();
      },
      error: () => this.notify.error(this.i18n.translate('error.saving')),
    });
  }

  deleteLang(lang: MenuLanguage) {
    if (lang.is_default) {
      this.notify.error(this.i18n.translate('settings.cannot_delete_default'));
      return;
    }
    if (!confirm(this.i18n.translate('settings.confirm_delete_lang'))) return;
    this.menuLangService.remove(lang._id!).subscribe({
      next: () => {
        this.notify.success(this.i18n.translate('settings.menu_lang_deleted'));
        this.menuLangService.refresh();
      },
      error: () => this.notify.error(this.i18n.translate('error.saving')),
    });
  }
}
