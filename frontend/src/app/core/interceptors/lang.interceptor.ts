import { HttpInterceptorFn } from '@angular/common/http';
import { authStore, type Language } from '../../store/auth.store';

const KNOWN_LANGUAGES: readonly string[] = ['es', 'en', 'fr'];

export function resolveActiveLanguage(): Language {
  const pref = authStore.preferences()?.language;
  if (pref) return pref;

  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('disherio-language');
    if (saved && KNOWN_LANGUAGES.includes(saved)) return saved as Language;
  }

  if (typeof navigator !== 'undefined') {
    const browserLang = navigator.language?.split('-')[0];
    if (browserLang && KNOWN_LANGUAGES.includes(browserLang)) return browserLang as Language;
  }

  return 'en';
}

export const langInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ setHeaders: { 'Accept-Language': resolveActiveLanguage() } }));
