import { Component, inject, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { I18nService, Language } from '../../core/services/i18n.service';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  template: `
    <header class="sticky top-0 z-50 w-full border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 shadow-sm">
      <div class="flex h-14 items-center justify-between px-4 lg:px-6">
        <!-- Logo y Nombre -->
        <div class="flex items-center gap-3">
          <a routerLink="/admin/dashboard" class="flex items-center gap-2">
            <div class="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
              D
            </div>
            <span class="hidden font-bold text-lg text-gray-900 dark:text-white sm:inline-block">
              DisherIO
            </span>
          </a>
          @if (restaurantName()) {
            <span class="hidden md:inline-block text-gray-400">|</span>
            <span class="hidden md:inline-block text-sm text-gray-600 dark:text-gray-300 truncate max-w-[200px]">
              {{ restaurantName() }}
            </span>
          }
        </div>

        <!-- Controles -->
        <div class="flex items-center gap-2">
          <!-- Selector de Tema -->
          <button
            type="button"
            (click)="toggleTheme()"
            class="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white transition-colors"
            [title]="'common.theme' | translate"
          >
            @if (themeService.isDark()) {
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            } @else {
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
          </button>

          <!-- Selector de Idioma -->
          <div class="relative">
            <button
              type="button"
              (click)="showLanguageMenu = !showLanguageMenu"
              class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
            >
              <span class="text-lg">{{ currentLanguageFlag() }}</span>
              <span class="hidden sm:inline">{{ currentLanguageName() }}</span>
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <!-- Dropdown de Idiomas -->
            @if (showLanguageMenu) {
              <div
                class="absolute right-0 mt-2 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800 z-50"
              >
                @for (lang of availableLanguages; track lang.code) {
                  <button
                    type="button"
                    (click)="setLanguage(lang.code); $event.stopPropagation()"
                    class="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    [class.bg-blue-50]="i18n.currentLang() === lang.code"
                    [class.dark:bg-blue-900]="i18n.currentLang() === lang.code"
                    [class.dark:bg-opacity-20]="i18n.currentLang() === lang.code"
                  >
                    <span class="text-lg">{{ lang.flag }}</span>
                    <span>{{ lang.name }}</span>
                    @if (i18n.currentLang() === lang.code) {
                      <svg class="ml-auto h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                    }
                  </button>
                }
              </div>
            }
          </div>

          <!-- Usuario / Logout -->
          <button
            type="button"
            (click)="logout()"
            class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
            [title]="'common.logout' | translate"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span class="hidden sm:inline">{{ 'common.logout' | translate }}</span>
          </button>
        </div>
      </div>
    </header>
  `
})
export class HeaderComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly themeService = inject(ThemeService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  showLanguageMenu = false;

  readonly availableLanguages = this.i18n.getAvailableLanguages();
  
  readonly currentLanguageFlag = computed(() => {
    const lang = this.i18n.currentLang();
    return lang === 'es' ? '🇪🇸' : '🇬🇧';
  });

  readonly currentLanguageName = computed(() => {
    const lang = this.i18n.currentLang();
    return lang === 'es' ? 'ES' : 'EN';
  });

  readonly restaurantName = computed(() => {
    // TODO: Get from a restaurant store/service
    return 'DisherIO Restaurant';
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Close language menu when clicking outside
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      this.showLanguageMenu = false;
    }
  }

  setLanguage(lang: Language): void {
    this.i18n.setLanguage(lang);
    this.showLanguageMenu = false;
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
