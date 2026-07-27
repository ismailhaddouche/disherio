import { Component, inject, computed, OnInit, ChangeDetectionStrategy, signal, HostListener } from '@angular/core';
import { finalize } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
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
  imports: [CommonModule, RouterLink, TranslatePipe, MatButtonModule, MatToolbarModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-toolbar class="disher-header" role="banner">
      <div class="disher-header-inner">
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
          <div class="disher-language-selector relative">
            <button
              type="button"
              (click)="langMenuOpen.set(!langMenuOpen())"
              class="flex items-center gap-1 px-2 py-2 rounded-full bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest transition-colors"
              [title]="'common.language' | translate"
              [attr.aria-label]="'common.language' | translate"
              [attr.aria-expanded]="langMenuOpen()"
              aria-haspopup="true"
            >
              <span class="material-symbols-outlined text-base">language</span>
              <span class="text-xs font-medium uppercase">{{ i18n.currentLang() }}</span>
            </button>
            @if (langMenuOpen()) {
              <button
                type="button"
                class="fixed inset-0 z-10 cursor-default bg-transparent"
                (click)="langMenuOpen.set(false)"
                [attr.aria-label]="'common.close' | translate"
                tabindex="-1"
              ></button>
              <div class="absolute right-0 top-full mt-1 z-20 min-w-32 rounded-xl bg-surface-container-high shadow-lg border border-outline-variant py-1">
                @for (lang of availableLanguages(); track lang.code) {
                  <button
                    type="button"
                    (click)="selectLanguage(lang.code)"
                    class="w-full flex items-center justify-between gap-2 px-4 py-2 text-sm text-on-surface hover:bg-surface-container-highest transition-colors"
                    [class.font-semibold]="i18n.currentLang() === lang.code"
                  >
                    <span>{{ lang.name }}</span>
                    @if (i18n.currentLang() === lang.code) {
                      <span class="material-symbols-outlined text-base text-primary">check</span>
                    }
                  </button>
                }
              </div>
            }
          </div>

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
            matIconButton
            type="button"
            (click)="logout()"
            [disabled]="isLoggingOut()"
            [attr.aria-label]="'common.logout' | translate"
          >
            <span class="material-symbols-outlined">logout</span>
          </button>
        </div>
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
      padding: 0;
      display: flex;
      align-items: center;
      background: var(--mat-sys-surface-container);
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      backdrop-filter: blur(8px);
    }
    .disher-header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      width: 100%;
      height: 100%;
      padding: 0 16px;
    }
    .disher-header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
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

  readonly restaurantName = computed(() => this.restaurantService.restaurantName());

  ngOnInit(): void {
    this.restaurantService.loadRestaurant();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.langMenuOpen()) return;
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.disher-language-selector')) {
      this.langMenuOpen.set(false);
    }
  }

  selectLanguage(lang: Language): void {
    this.i18n.setLanguage(lang);
    this.langMenuOpen.set(false);
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
