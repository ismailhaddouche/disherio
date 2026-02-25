import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-container">
      <div class="glass-card login-card">
        <header>
          <img src="logo.svg" alt="Disher.io Logo" class="login-logo">
          <h1 class="gradient-text">DISHER.IO</h1>
          <p>Acceso a Terminal de Gestión</p>
        </header>

        <form (submit)="onSubmit($event)">
          <div class="input-group">
            <label>Usuario</label>
            <input type="text" [(ngModel)]="username" name="username" class="glass-input" placeholder="ej: cocina" required>
          </div>

          <div class="input-group">
            <label>Contraseña</label>
            <input type="password" [(ngModel)]="password" name="password" class="glass-input" placeholder="••••" required>
          </div>

          @if (errorMessage()) {
            <p class="error-msg">{{ errorMessage() }}</p>
          }

          <button type="submit" class="btn-primary login-btn" [disabled]="loading()">
            {{ loading() ? 'AUTENTICANDO...' : 'ENTRAR AL SISTEMA' }}
          </button>
        </form>

      </div>
    </div>
  `,
  styles: [`
    .login-container {
      height: 90vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at center, rgba(56, 189, 248, 0.05) 0%, transparent 70%);
    }

    .login-card {
      width: 100%;
      max-width: 400px;
      padding: 48px;
      display: flex;
      flex-direction: column;
      gap: 32px;
      animation: zoomIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    header { text-align: center; }
    .login-logo { height: 64px; margin-bottom: 16px; border-radius: 12px; }
    header h1 { font-size: 2.5rem; font-weight: 900; margin-bottom: 8px; }
    header p { opacity: 0.6; font-size: 0.9rem; letter-spacing: 1px; }

    form { display: flex; flex-direction: column; gap: 24px; }
    .input-group { display: flex; flex-direction: column; gap: 8px; }
    label { font-size: 0.8rem; font-weight: bold; opacity: 0.8; margin-left: 4px; }

    /* glass-input styles now defined globally */
    .glass-input:focus {
      border-color: var(--accent-primary);
      background: rgba(56, 189, 248, 0.05);
    }

    .login-btn {
      padding: 18px;
      font-weight: 900;
      letter-spacing: 1px;
      margin-top: 8px;
    }

    .error-msg {
      color: #ef4444;
      font-size: 0.8rem;
      text-align: center;
      background: rgba(239, 68, 68, 0.1);
      padding: 8px;
      border-radius: 8px;
    }

    .hint {
      text-align: center;
      font-size: 0.75rem;
      opacity: 0.4;
    }

    /* zoomIn animation now in global styles.css */

    @media (max-width: 480px) {
      .login-card { padding: 32px 24px; }
      header h1 { font-size: 2rem; }
    }
  `]
})
export class LoginComponent {
  private auth = inject(AuthService);

  username = '';
  password = '';
  loading = signal(false);
  errorMessage = signal('');

  async onSubmit(event: Event) {
    event.preventDefault();
    if (this.loading()) return;

    this.loading.set(true);
    this.errorMessage.set('');

    try {
      const success = await this.auth.login(this.username, this.password);
      if (!success) {
        this.errorMessage.set('Credenciales incorrectas o red no disponible.');
        this.loading.set(false);
      }
      // If success, router navigation happens in auth service
    } catch (err) {
      this.errorMessage.set('Error en el sistema. Inténtalo más tarde.');
      this.loading.set(false);
    }
  }
}
