import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { authStore, AuthUser } from '../../store/auth.store';
import { environment } from '../../../environments/environment';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div class="text-center mb-6">
          <span class="material-symbols-outlined text-5xl text-primary">restaurant</span>
          <h1 class="text-2xl font-bold mt-2 text-gray-900 dark:text-white">DisherIo</h1>
        </div>

        <form (ngSubmit)="login()" class="flex flex-col gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ 'auth.login.username' | translate }}</label>
            <input
              [(ngModel)]="username" name="username" type="text" required autocomplete="username"
              class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ 'auth.login.password' | translate }}</label>
            <input
              [(ngModel)]="password" name="password" type="password" required autocomplete="current-password"
              class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            type="submit"
            [disabled]="loading()"
            class="bg-primary text-white rounded-lg py-2 font-bold disabled:opacity-50 active:scale-95 transition-transform"
          >
            {{ loading() ? ('common.logging_in' | translate) : ('auth.login.submit' | translate) }}
          </button>
        </form>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  protected i18n = inject(I18nService);
  private notify = inject(NotificationService);

  username = '';
  password = '';
  loading = signal(false);

  login() {
    this.loading.set(true);
    this.http
      .post<{ user: AuthUser }>(
        `${environment.apiUrl}/auth/login`,
        { username: this.username.toLowerCase().trim(), password: this.password }
      )
      .subscribe({
        next: (res) => {
          // Cookie set by server; store user info with expiry in localStorage
          // Use 8h default or extract from JWT if available
          const expiresAt = this.calculateExpiryFromToken(res.user);
          authStore.setAuth(res.user, expiresAt);
          this.router.navigate([this.defaultRouteFor(res.user.permissions)]);
          this.loading.set(false);
        },
        error: (err) => {
          this.notify.error(err.status === 401 ? this.i18n.translate('errors.INVALID_CREDENTIALS') : this.i18n.translate('errors.SERVER_ERROR'));
          this.loading.set(false);
        },
      });
  }

  private defaultRouteFor(permissions: string[]): string {
    if (permissions.includes('ADMIN')) return '/admin';
    if (permissions.includes('KTS')) return '/kds';
    if (permissions.includes('TAS')) return '/tas';
    if (permissions.includes('POS')) return '/pos';
    return '/pos';
  }

  /**
   * Calculate token expiry from JWT or use default (8 hours)
   */
  private calculateExpiryFromToken(user: AuthUser): number {
    // Default: 8 hours from now
    const defaultExpiry = Date.now() + 8 * 60 * 60 * 1000;
    
    try {
      // Try to extract exp from JWT in cookie (if accessible)
      // Note: HttpOnly cookies can't be read from JS, so we rely on default
      // The server will reject expired tokens anyway
      return defaultExpiry;
    } catch {
      return defaultExpiry;
    }
  }
}
