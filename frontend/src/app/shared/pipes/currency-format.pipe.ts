import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService, type Language } from '../../core/services/i18n.service';
import { RestaurantService } from '../../core/services/restaurant.service';

export const LANG_LOCALES: Record<Language, string> = {
  es: 'es-ES',
  en: 'en-US',
  fr: 'fr-FR',
};

@Pipe({
  name: 'currencyFormat',
  standalone: true,
  pure: false, // Re-evaluate when the active language or restaurant currency changes
})
export class CurrencyFormatPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  private readonly restaurantService = inject(RestaurantService);

  // Intl.NumberFormat construction is expensive; reuse one instance per
  // (locale, currency) pair since impure pipes run every change detection.
  private readonly formatters = new Map<string, Intl.NumberFormat>();

  transform(value: number | null | undefined, currency?: string, locale?: string): string {
    if (value === null || value === undefined) return '';

    const resolvedCurrency = currency ?? this.restaurantService.currency();
    const resolvedLocale = locale ?? LANG_LOCALES[this.i18n.currentLang()];
    const cacheKey = `${resolvedLocale}|${resolvedCurrency}`;

    let formatter = this.formatters.get(cacheKey);
    if (!formatter) {
      formatter = new Intl.NumberFormat(resolvedLocale, {
        style: 'currency',
        currency: resolvedCurrency,
        minimumFractionDigits: 2,
      });
      this.formatters.set(cacheKey, formatter);
    }

    return formatter.format(value);
  }
}
