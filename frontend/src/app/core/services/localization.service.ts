import { Injectable, computed, inject } from '@angular/core';
import { I18nService } from './i18n.service';
import type { Language } from '../../store/auth.store';
import type { LocalizedField } from '../../types';

/**
 * Native display names for each supported app language. Used as tab labels
 * in the localized input component and anywhere a language needs a human
 * readable label.
 */
const LANGUAGE_NAMES: Record<Language, string> = {
  es: 'Español',
  en: 'English',
  fr: 'Français',
};

/**
 * A lightweight language descriptor used by the localized input component
 * to render tabs. Replaces the former MenuLanguage entity.
 */
export interface LanguageDescriptor {
  code: Language;
  name: string;
  is_default: boolean;
}

/**
 * LocalizationService resolves localized field values (dish names, category
 * names, variant/extra names) against the restaurant's enabled app languages.
 *
 * It replaces the former MenuLanguageService. There is no HTTP CRUD: the list
 * of available languages is derived from the restaurant's `enabled_languages`
 * (exposed via I18nService.enabledLanguages), and localized entries are keyed
 * directly by app language code ('es' | 'en' | 'fr').
 */
@Injectable({ providedIn: 'root' })
export class LocalizationService {
  private readonly i18n = inject(I18nService);

  /**
   * The restaurant's default interface language. Used as the fallback when
   * a localized entry for the current language is not available.
   */
  readonly defaultLanguage = computed<Language>(() => {
    const enabled = this.i18n.enabledLanguages();
    // The first enabled language is the restaurant default (restaurant.service
    // auto-adjusts default_language to enabled[0] when the previous default is
    // disabled). Fall back to the current language if the set is somehow empty.
    const arr = Array.from(enabled);
    return arr[0] ?? this.i18n.currentLang();
  });

  /**
   * Language descriptors for every enabled interface language, in the order
   * returned by enabledLanguages. The default language is flagged so the
   * localized input component can mark the required tab.
   */
  readonly languages = computed<LanguageDescriptor[]>(() => {
    const enabled = Array.from(this.i18n.enabledLanguages()) as Language[];
    const def = this.defaultLanguage();
    return enabled.map((code) => ({
      code,
      name: LANGUAGE_NAMES[code] ?? code,
      is_default: code === def,
    }));
  });

  /**
   * Resolve the best available value for a localized field:
   *   1. The entry whose `lang` matches the current interface language.
   *   2. The entry whose `lang` matches the restaurant default language.
   *   3. The first entry with a non-empty value.
   *   4. Empty string.
   *
   * Entries created before this refactor may carry a MenuLanguage ObjectId as
   * `lang`; those miss the app-code match and fall through to step 3 until the
   * dish/category is re-edited.
   */
  localize(value: LocalizedField | null | undefined): string {
    if (!value || !Array.isArray(value) || value.length === 0) return '';

    const currentAppLang = this.i18n.currentLang();

    // 1. Match the current interface language directly.
    const currentEntry = value.find((e) => e.lang === currentAppLang);
    if (currentEntry?.value) return currentEntry.value;

    // 2. Match the restaurant default language.
    const def = this.defaultLanguage();
    const defaultEntry = value.find((e) => e.lang === def);
    if (defaultEntry?.value) return defaultEntry.value;

    // 3. Fallback to the first available entry that has a value.
    const firstWithValue = value.find((e) => !!e.value);
    return firstWithValue?.value ?? '';
  }
}
