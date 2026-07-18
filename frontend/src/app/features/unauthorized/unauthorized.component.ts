import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [TranslatePipe, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="disher-unauthorized-page">
      <div class="disher-unauthorized-content">
        <span class="material-symbols-outlined disher-unauthorized-icon" aria-hidden="true">lock</span>
        <h1 class="disher-unauthorized-title">{{ 'unauthorized.title' | translate }}</h1>
        <p class="disher-unauthorized-message">{{ 'unauthorized.message' | translate }}</p>
        <button matButton (click)="back()" class="disher-back-btn">
          <mat-icon aria-hidden="true">arrow_back</mat-icon>
          {{ 'common.back' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .disher-unauthorized-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--mat-sys-surface-container-low);
    }
    .disher-unauthorized-content {
      text-align: center;
    }
    .disher-unauthorized-icon {
      font-size: 64px;
      color: var(--mat-sys-error);
    }
    .disher-unauthorized-title {
      font-size: 24px;
      font-weight: 700;
      color: var(--mat-sys-on-surface);
      margin: 16px 0 8px;
    }
    .disher-unauthorized-message {
      color: var(--mat-sys-on-surface-variant);
      margin: 0 0 24px;
    }
    .disher-back-btn { min-height: 40px; }
  `],
})
export class UnauthorizedComponent {
  private router = inject(Router);
  back() { this.router.navigate(['/pos']); }
}