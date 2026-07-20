import { Component, signal, inject, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { authStore } from '../../store/auth.store';
import { AuthService } from '../../core/services/auth.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="disher-login-page">
      <div class="disher-login-card">
        <div class="disher-login-header">
          <div class="disher-login-logo" aria-hidden="true">
            <span class="material-symbols-outlined">restaurant</span>
          </div>
          <h1 class="disher-login-title">DisherIO</h1>
          <p class="disher-login-subtitle">{{ 'auth.login.submit' | translate }}</p>
        </div>

        <form [formGroup]="loginForm" (ngSubmit)="login()" class="disher-login-form" novalidate>
          <mat-form-field appearance="outline" class="disher-login-field">
            <mat-label>{{ 'auth.login.username' | translate }}</mat-label>
            <input
              matInput
              formControlName="username"
              type="text"
              autocomplete="username"
              required
              [attr.aria-describedby]="usernameError() ? 'username-error' : null"
              [attr.aria-invalid]="usernameError() ? 'true' : null"
            />
            @if (usernameError()) {
              <mat-error id="username-error" role="alert">{{ usernameError() }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="disher-login-field">
            <mat-label>{{ 'auth.login.password' | translate }}</mat-label>
            <input
              matInput
              formControlName="password"
              [type]="showPassword() ? 'text' : 'password'"
              autocomplete="current-password"
              required
              [attr.aria-describedby]="passwordError() ? 'password-error' : null"
              [attr.aria-invalid]="passwordError() ? 'true' : null"
            />
            <button
              matIconButton
              type="button"
              matSuffix
              (click)="togglePassword()"
              [attr.aria-label]="showPassword() ? ('common.hide_password' | translate) : ('common.show_password' | translate)"
            >
              <span class="material-symbols-outlined">{{ showPassword() ? 'visibility_off' : 'visibility' }}</span>
            </button>
            @if (passwordError()) {
              <mat-error id="password-error" role="alert">{{ passwordError() }}</mat-error>
            }
          </mat-form-field>

          <button
            matButton="filled"
            type="submit"
            class="disher-login-submit"
            [disabled]="loading() || loginForm.invalid"
          >
            @if (loading()) {
              <span class="material-symbols-outlined disher-spin" aria-hidden="true">progress_activity</span>
              {{ 'common.logging_in' | translate }}
            } @else {
              {{ 'auth.login.submit' | translate }}
            }
          </button>

          @if (authError()) {
            <div class="disher-login-error" role="alert" aria-live="assertive">
              <span class="material-symbols-outlined" aria-hidden="true">error</span>
              <span>{{ authError() }}</span>
            </div>
          }
        </form>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .disher-login-page {
      display: flex;
      min-height: 100vh;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: var(--mat-sys-surface-container-low);
      min-height: 100dvh;
    }
    .disher-login-card {
      width: 100%;
      max-width: 400px;
      padding: 32px;
      border-radius: var(--disher-shape-md);
      background: var(--mat-sys-surface);
      box-shadow: var(--disher-elevation-2);
      border: 1px solid var(--mat-sys-outline-variant);
    }
    .disher-login-header { margin-bottom: 32px; text-align: center; }
    .disher-login-logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: var(--disher-shape-md);
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      margin-bottom: 16px;
      box-shadow: var(--disher-elevation-1);
    }
    .disher-login-logo .material-symbols-outlined { font-size: 28px; }
    .disher-login-title {
      font-size: 24px;
      font-weight: 500;
      color: var(--mat-sys-on-surface);
      margin: 0;
    }
    .disher-login-subtitle {
      font-size: 14px;
      color: var(--mat-sys-on-surface-variant);
      margin-top: 4px;
    }
    .disher-login-form { display: flex; flex-direction: column; gap: 16px; }
    .disher-login-field { width: 100%; }
    .disher-login-submit {
      width: 100%;
      margin-top: 8px;
      min-height: 44px;
    }
    @media (max-width: 479px) {
      .disher-login-page { align-items: stretch; padding: 0; }
      .disher-login-card {
        max-width: none;
        min-height: 100vh;
        min-height: 100dvh;
        padding: 32px 24px;
        border: 0;
        border-radius: 0;
        box-shadow: none;
      }
      .disher-login-header { margin-top: auto; }
      .disher-login-form { margin-bottom: auto; }
    }
    .disher-spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .disher-login-error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border-radius: var(--disher-shape-sm);
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
      font-size: 14px;
    }
    .disher-login-error .material-symbols-outlined { font-size: 20px; }
  `],
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected i18n = inject(I18nService);
  private notify = inject(NotificationService);
  private destroyRef = inject(DestroyRef);
  private fb = inject(FormBuilder);

  loading = signal(false);
  showPassword = signal(false);
  authError = signal<string | null>(null);

  loginForm = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  usernameError(): string | null {
    const ctrl = this.loginForm.get('username');
    if (ctrl && ctrl.touched && ctrl.invalid) {
      if (ctrl.hasError('required')) return this.i18n.translate('errors.REQUIRED_FIELD');
    }
    return null;
  }

  passwordError(): string | null {
    const ctrl = this.loginForm.get('password');
    if (ctrl && ctrl.touched && ctrl.invalid) {
      if (ctrl.hasError('required')) return this.i18n.translate('errors.REQUIRED_FIELD');
    }
    return null;
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  login(): void {
    this.authError.set(null);

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const { username, password } = this.loginForm.getRawValue();

    this.authService.login(username, password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const expiresAt = Date.now() + res.expires_in_ms;
          authStore.setAuth(res.user, expiresAt);
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
          const destination = this.resolveSafeReturnUrl(returnUrl, res.user.permissions);
          void this.router.navigateByUrl(destination);
          this.loading.set(false);
        },
        error: (err) => {
          const msg = err.status === 401
            ? this.i18n.translate('errors.INVALID_CREDENTIALS')
            : err.status === 429
              ? this.i18n.translate('errors.AUTH_RATE_LIMIT_EXCEEDED')
              : this.i18n.translate('errors.SERVER_ERROR');
          this.authError.set(msg);
          this.notify.error(msg);
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

  private resolveSafeReturnUrl(returnUrl: string | null, permissions: string[]): string {
    if (!returnUrl) return this.defaultRouteFor(permissions);
    const allowedPrefixes = ['/admin', '/pos', '/kds', '/tas'];
    const isAllowed = allowedPrefixes.some(
      (prefix) => returnUrl === prefix || returnUrl.startsWith(`${prefix}/`)
    );
    return isAllowed ? returnUrl : this.defaultRouteFor(permissions);
  }
}
