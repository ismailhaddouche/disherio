import { Injectable, signal, computed, effect, inject, DestroyRef } from '@angular/core';
import { Platform } from '@angular/cdk/platform';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { authStore, type Language } from '../../store/auth.store';

export type { Language };
import { environment } from '../../../environments/environment';

interface Translations {
  [key: string]: string | Translations;
}

const ALL_LANGUAGES: ReadonlyArray<{ code: Language; name: string; shortCode: string }> = [
  { code: 'es', name: 'Español', shortCode: 'ES' },
  { code: 'en', name: 'English', shortCode: 'EN' },
  { code: 'fr', name: 'Français', shortCode: 'FR' },
];

const CATALOG_BASE_URL = '/assets/i18n';

function isKnownLanguage(code: string): code is Language {
  return ALL_LANGUAGES.some((lang) => lang.code === code);
}

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  private readonly platform = inject(Platform);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  // Signals
  private readonly _currentLang = signal<Language>('en');
  readonly currentLang = this._currentLang.asReadonly();

  // Enabled interface languages for the current restaurant. Defaults to all
  // three until the login/refresh response provides the restaurant's set.
  private readonly _enabledLanguages = signal<Set<Language>>(new Set(['es', 'en', 'fr']));
  readonly enabledLanguages = computed(() => this._enabledLanguages());

  // JSON catalogs loaded over HTTP. translate() reads this signal, so
  // reactive consumers update automatically when a catalog arrives.
  private readonly catalogs = signal<Partial<Record<Language, Translations>>>({});
  private readonly pendingCatalogs = new Map<Language, Promise<void>>();

  readonly isSpanish = computed(() => this._currentLang() === 'es');
  readonly isEnglish = computed(() => this._currentLang() === 'en');
  readonly isFrench = computed(() => this._currentLang() === 'fr');

  constructor() {
    // Resolve the initial language synchronously (no network involved)
    this.loadLanguage();

    // Watch for changes in auth store preferences
    effect(() => {
      const prefs = authStore.preferences();
      if (prefs?.language) {
        this._currentLang.set(prefs.language);
        void this.loadCatalog(prefs.language);
      }
    });

    // Sync enabled languages from the auth store into the i18n service so
    // getAvailableLanguages() filters the header dropdown and form editors.
    effect(() => {
      const enabled = authStore.enabledLanguages();
      this.setEnabledLanguages(enabled);
    });

    // Save language when it changes
    effect(() => {
      const lang = this._currentLang();
      if (this.platform.isBrowser) {
        localStorage.setItem('disherio-language', lang);
        document.documentElement.lang = lang;
      }
    });
  }

  /**
   * Awaited by an APP_INITIALIZER so the first paint already has the initial
   * language catalog. Resolves without a catalog when the request fails;
   * translate() then falls back to returning keys until a retry succeeds.
   */
  async ensureInitialCatalog(): Promise<void> {
    await this.loadCatalog(this._currentLang());
  }

  private loadCatalog(lang: Language): Promise<void> {
    if (this.catalogs()[lang]) return Promise.resolve();
    const pending = this.pendingCatalogs.get(lang);
    if (pending) return pending;

    const request = firstValueFrom(this.http.get<Translations>(`${CATALOG_BASE_URL}/${lang}.json`))
      .then((catalog) => {
        this.catalogs.update((loaded) => ({ ...loaded, [lang]: catalog }));
      })
      .catch(() => undefined)
      .finally(() => {
        this.pendingCatalogs.delete(lang);
      });
    this.pendingCatalogs.set(lang, request);
    return request;
  }

  private loadLanguage(): void {
    // Priority: 1. Auth store preferences, 2. localStorage, 3. Browser language, 4. English
    const userPrefs = authStore.preferences();
    if (userPrefs?.language) {
      this._currentLang.set(userPrefs.language);
      void this.loadCatalog(userPrefs.language);
      return;
    }

    if (this.platform.isBrowser) {
      const saved = localStorage.getItem('disherio-language');
      if (saved && isKnownLanguage(saved)) {
        this._currentLang.set(saved);
        void this.loadCatalog(saved);
        return;
      }

      // Detect browser language
      const browserLang = navigator.language.split('-')[0];
      if (isKnownLanguage(browserLang)) {
        this._currentLang.set(browserLang);
        void this.loadCatalog(browserLang);
        return;
      }
    }

    this._currentLang.set('en');
    void this.loadCatalog('en');
  }

  setLanguage(lang: Language): void {
    if (!isKnownLanguage(lang)) return;

    this._currentLang.set(lang);
    void this.loadCatalog(lang);

    // Save to backend
    this.savePreference('language', lang);

    // Update local auth store
    authStore.updatePreferences({ language: lang });
  }

  private savePreference(key: 'language' | 'theme', value: string): void {
    if (!authStore.isAuthenticated()) return;

    this.http.patch(`${environment.apiUrl}/staff/me/preferences`, { [key]: value })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => undefined
      });
  }

  translate(key: string): string {
    const translations = this.catalogs()[this._currentLang()];
    if (!translations) return key;

    // Catalogs store flat keys like 'dashboard.title' as literal strings —
    // try direct lookup first before attempting dot-navigation.
    const direct = translations[key];
    if (typeof direct === 'string') {
      return direct;
    }

    // Fallback: navigate nested objects for any future nested structure
    const parts = key.split('.');
    let value: unknown = translations;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Translations)[part];
      } else {
        return key;
      }
    }
    return typeof value === 'string' ? value : key;
  }

  // Get all available languages, filtered by the restaurant's enabled set.
  getAvailableLanguages(): { code: Language; name: string; shortCode: string }[] {
    const enabled = this._enabledLanguages();
    return ALL_LANGUAGES.filter((lang) => enabled.has(lang.code)).map((lang) => ({ ...lang }));
  }

  // Update the enabled languages set (called after login/refresh).
  setEnabledLanguages(codes: Language[]): void {
    this._enabledLanguages.set(new Set(codes));
    // If the current language is no longer enabled, fall back to the first
    // enabled language (or the default 'es').
    if (!this._enabledLanguages().has(this._currentLang())) {
      const fallback = codes[0] ?? 'es';
      this.setLanguage(fallback);
    }
  }
}
