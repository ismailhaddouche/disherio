import { Component, inject, computed, OnInit, ChangeDetectionStrategy, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../../core/services/i18n.service';
import type { Language } from '../../core/services/i18n.service';
import { ThemeService } from '../../core/services/theme.service';
import { RestaurantService } from '../../core/services/restaurant.service';
import { authStore } from '../../store/auth.store';
import { TranslatePipe } from '../pipes/translate.pipe';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe, MatButtonModule, MatMenuModule, MatToolbarModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-toolbar class="disher-header" role="banner">
      <div class="disher-header-left">
        <a routerLink="/login" class="disher-logo-link" aria-label="DisherIO home">
          <div class="disher-logo-mark" aria-hidden="true">D</div>
          <span class="disher-wordmark">{{ 'DisherIO' }}</span>
        </a>
        @if (restaurantName()) {
          <span class="disher-header-divider" aria-hidden="true"></span>
          <span class="disher-restaurant-name" [title]="restaurantName()">{{ restaurantName() }}</span>
        }
      </div>

      <div class="disher-header-right">
        <button
          matIconButton
          type="button"
          (click)="toggleTheme()"
          [attr.aria-label]="'common.theme' | translate"
          [attr.aria-pressed]="themeService.isDark()"
        >
          <span class="material-symbols-outlined">{{ themeService.isDark() ? 'light_mode' : 'dark_mode' }}</span>
        </button>

        <button
          matButton
          class="disher-language-trigger"
          type="button"
          [matMenuTriggerFor]="langMenu"
          [attr.aria-haspopup]="true"
          [attr.aria-expanded]="langMenuOpen()"
          [attr.aria-label]="'common.language' | translate"
          (menuOpened)="langMenuOpen.set(true)"
          (menuClosed)="langMenuOpen.set(false)"
        >
          <span class="disher-language-code" aria-hidden="true">{{ currentLanguageCode() }}</span>
          <span class="material-symbols-outlined disher-chevron" aria-hidden="true">expand_more</span>
        </button>
        <mat-menu #langMenu="matMenu" xPosition="before" [attr.aria-label]="'common.language' | translate">
          @for (lang of availableLanguages(); track lang.code) {
            <button
              matMenuItem
              class="disher-language-option"
              (click)="setLanguage(lang.code)"
              [attr.aria-current]="i18n.currentLang() === lang.code ? 'true' : null"
            >
              <span class="disher-language-option-content">
                <span class="disher-language-name">{{ lang.name }}</span>
                @if (i18n.currentLang() === lang.code) {
                  <span class="material-symbols-outlined disher-check" aria-hidden="true">check</span>
                } @else {
                  <span class="disher-check-placeholder" aria-hidden="true"></span>
                }
              </span>
            </button>
          }
        </mat-menu>

        <button
          matIconButton
          type="button"
          (click)="logout()"
          [disabled]="isLoggingOut()"
          [attr.aria-label]="'common.logout' | translate"
        >
          <span class="material-symbols-outlined">logout</span>
        </button>
      </div>
    </mat-toolbar>
  `,
  styles: [`
    :host { display: block; }
    .disher-header {
      position: sticky;
      top: 0;
      z-index: 50;
      height: 56px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--mat-sys-surface-container);
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      backdrop-filter: blur(8px);
    }
    .disher-header-left { display: flex; align-items: center; gap: 12px; }
    .disher-header-right { display: flex; align-items: center; gap: 4px; }
    .disher-logo-link { display: flex; align-items: center; gap: 8px; text-decoration: none; }
    .disher-logo-mark {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--disher-shape-sm);
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      font-size: 14px;
      font-weight: 500;
      box-shadow: var(--disher-elevation-1);
    }
    .disher-wordmark {
      font-size: 16px;
      font-weight: 500;
      color: var(--mat-sys-on-surface);
    }
    @media (max-width: 640px) { .disher-wordmark { display: none; } }
    .disher-header-divider {
      width: 1px;
      height: 20px;
      background: var(--mat-sys-outline-variant);
    }
    @media (max-width: 768px) { .disher-header-divider { display: none; } }
    .disher-restaurant-name {
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
      color: var(--mat-sys-on-surface-variant);
    }
    @media (max-width: 768px) { .disher-restaurant-name { display: none; } }
    .disher-language-trigger { min-width: 64px; }
    .disher-language-code {
      min-width: 24px;
      text-align: center;
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.04em;
    }
    .disher-chevron { font-size: 20px; }
    .disher-language-option {
      min-width: 180px;
    }
    .disher-language-option-content {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .disher-language-name {
      flex: 1;
      min-width: 0;
      text-align: left;
    }
    .disher-check,
    .disher-check-placeholder {
      flex: 0 0 20px;
      width: 20px;
      height: 20px;
      margin-left: auto;
    }
    .disher-check { color: var(--mat-sys-primary); }
  `],
})
export class HeaderComponent implements OnInit {
  protected readonly i18n = inject(I18nService);
  protected readonly themeService = inject(ThemeService);
  private readonly restaurantService = inject(RestaurantService);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  readonly isLoggingOut = signal(false);

  readonly availableLanguages = computed(() => this.i18n.getAvailableLanguages());
  readonly langMenuOpen = signal(false);

  readonly currentLanguageCode = computed(() => {
    const lang = this.i18n.currentLang();
    const languageCodes: Record<Language, string> = { es: 'ES', en: 'EN', fr: 'FR' };
    return languageCodes[lang];
  });

  readonly restaurantName = computed(() => this.restaurantService.restaurantName());

  ngOnInit(): void {
    this.restaurantService.loadRestaurant();
  }

  setLanguage(lang: Language): void {
    this.i18n.setLanguage(lang);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  logout(): void {
    if (this.isLoggingOut()) return;
    this.isLoggingOut.set(true);
    this.authService.logout().pipe(
      finalize(() => {
        authStore.clearAuth();
        this.isLoggingOut.set(false);
        void this.router.navigate(['/login']);
      })
    ).subscribe({ error: () => undefined });
  }
}
