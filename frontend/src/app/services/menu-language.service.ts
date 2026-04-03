import { Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../environments/environment';
import { I18nService } from '../core/services/i18n.service';
import type { MenuLanguage, LocalizedField } from '../types';

@Injectable({ providedIn: 'root' })
export class MenuLanguageService {
  private http = inject(HttpClient);
  private i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);

  private _languages = signal<MenuLanguage[]>([]);
  readonly languages = this._languages.asReadonly();
  readonly defaultLanguage = computed(() => this._languages().find(l => l.is_default) ?? null);

  load() {
    this.http.get<MenuLanguage[]>(`${environment.apiUrl}/menu-languages`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this._languages.set(data),
        error: (err) => console.error('[MenuLanguageService] Error loading:', err),
      });
  }

  localize(value: LocalizedField | null | undefined): string {
    if (!value || !Array.isArray(value) || value.length === 0) return '';

    const currentAppLang = this.i18n.currentLang();
    const languages = this._languages();
    
    // 1. Try to find a menu language linked to the current app language
    const targetLang = languages.find(l => l.linked_app_lang === currentAppLang);
    if (targetLang) {
      const entry = value.find(e => e.lang === targetLang._id);
      if (entry?.value) return entry.value;
    }

    // 2. Try the default menu language
    const defaultLang = this.defaultLanguage();
    if (defaultLang) {
      const entry = value.find(e => e.lang === defaultLang._id);
      if (entry?.value) return entry.value;
    }

    // 3. Fallback to the first available entry that has a value
    const firstWithValue = value.find(e => !!e.value);
    return firstWithValue?.value ?? '';
  }

  create(data: { name: string; code: string; is_default?: boolean; linked_app_lang?: string | null }) {
    return this.http.post<MenuLanguage>(`${environment.apiUrl}/menu-languages`, data);
  }

  update(id: string, data: Partial<Pick<MenuLanguage, 'name' | 'code' | 'linked_app_lang' | 'order'>>) {
    return this.http.patch<MenuLanguage>(`${environment.apiUrl}/menu-languages/${id}`, data);
  }

  setDefault(id: string) {
    return this.http.post<MenuLanguage>(`${environment.apiUrl}/menu-languages/${id}/set-default`, {});
  }

  remove(id: string) {
    return this.http.delete(`${environment.apiUrl}/menu-languages/${id}`);
  }

  /** Reload after mutation */
  refresh() {
    this.load();
  }

  /** Set languages from external source (e.g., totem public endpoint) */
  setLanguages(languages: MenuLanguage[]) {
    this._languages.set(languages);
  }
}
