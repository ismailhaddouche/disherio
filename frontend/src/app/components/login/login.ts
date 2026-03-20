import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="login-container">
      <div class="md-card-elevated login-card">
        <header class="login-header">
          <div class="logo-box">
            <img src="logo.svg" alt="Disher.io Logo" class="login-logo">
          </div>
          <h1 class="text-headline-large color-primary">DISHER.IO</h1>
          <p class="text-label-large opacity-60">{{ 'LOGIN.SUBTITLE' | translate }}</p>
        </header>

        <form (submit)="onSubmit($event)" class="login-form" aria-label="{{ 'LOGIN.FORM_LABEL' | translate }}">
          <div class="md-field">
            <label for="username" class="text-label-large">{{ 'LOGIN.USER' | translate }}</label>
            <input id="username" type="text" [(ngModel)]="username" name="username" class="md-input"
                   [placeholder]="'LOGIN.USER_PLACEHOLDER' | translate"
                   autocomplete="username"
                   [attr.aria-describedby]="errorMessage() ? 'login-error' : null"
                   required>
          </div>

          <div class="md-field">
            <label for="password" class="text-label-large">{{ 'LOGIN.PASSWORD' | translate }}</label>
            <input id="password" type="password" [(ngModel)]="password" name="password" class="md-input"
                   placeholder="••••"
                   autocomplete="current-password"
                   [attr.aria-describedby]="errorMessage() ? 'login-error' : null"
                   required>
          </div>

          @if (errorMessage()) {
            <div id="login-error" class="error-banner" role="alert" aria-live="assertive">
              <span class="text-body-small">{{ errorMessage() }}</span>
            </div>
          }

          <button type="submit" class="btn-primary login-btn" [disabled]="loading()" [attr.aria-busy]="loading()">
            {{ loading() ? ('LOGIN.AUTHENTICATING' | translate) : ('LOGIN.SIGN_IN' | translate) }}
          </button>
        </form>

        <footer class="login-footer">
          <p class="text-label-small opacity-40">Disher.io &copy; {{ currentYear }}</p>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--md-sys-color-surface-container-low);
    }

    .login-card {
      width: 100%;
      max-width: 440px;
      padding: 48px;
      display: flex;
      flex-direction: column;
      gap: 40px;
      background: var(--md-sys-color-surface-1);
      border-radius: 28px;
    }

    .login-header { text-align: center; }
    
    .logo-box {
        width: 80px; height: 80px; margin: 0 auto 24px;
        background: var(--md-sys-color-surface-2);
        border-radius: 20px;
        display: flex; align-items: center; justify-content: center;
    }
    .login-logo { height: 48px; }
    
    .color-primary { color: var(--md-sys-color-primary); }

    .login-form { display: flex; flex-direction: column; gap: 24px; }
    
    .md-field { display: flex; flex-direction: column; gap: 8px; }
    
    .md-input {
        background: var(--md-sys-color-surface-variant);
        border: none; border-radius: 12px; padding: 16px;
        color: var(--md-sys-color-on-surface); font-family: inherit;
        transition: box-shadow 0.2s;
    }
    .md-input:focus { box-shadow: 0 0 0 2px var(--md-sys-color-primary); outline: none; }

    .login-btn {
      padding: 16px;
      border-radius: 12px;
      margin-top: 8px;
      font-size: 1rem;
    }

    .error-banner {
      background: var(--md-sys-color-error-container);
      color: var(--md-sys-color-on-error-container);
      padding: 12px 16px;
      border-radius: 12px;
      text-align: center;
    }

    .login-footer {
        text-align: center;
        margin-top: 8px;
    }

    @media (max-width: 480px) {
      .login-card { padding: 32px 24px; border-radius: 0; height: 100%; justify-content: center; }
    }

    .opacity-60 { opacity: 0.6; }
    .opacity-40 { opacity: 0.4; }
  `]

})
export class LoginComponent {
  private auth = inject(AuthService);
  private translate = inject(TranslateService);

  username = '';
  password = '';
  loading = signal(false);
  errorMessage = signal('');
  readonly currentYear = new Date().getFullYear();

  async onSubmit(event: Event) {
    event.preventDefault();
    if (this.loading()) return;

    this.loading.set(true);
    this.errorMessage.set('');

    try {
      const success = await this.auth.login(this.username, this.password);
      if (!success) {
        this.errorMessage.set(this.translate.instant('LOGIN.ERROR_CREDS'));
        this.loading.set(false);
      }
      // If success, router navigation happens in auth service
    } catch (err) {
      this.errorMessage.set(this.translate.instant('LOGIN.ERROR_SYSTEM'));
      this.loading.set(false);
    }
  }
}
