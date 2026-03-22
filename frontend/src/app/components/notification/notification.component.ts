import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotifyService } from '../../services/notify.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
    selector: 'app-notification',
    standalone: true,
    imports: [CommonModule, LucideAngularModule],
    template: `
    <div class="notification-container" aria-label="Notifications" role="region">
      @for (n of notify.notifications(); track n.id) {
        <div class="notification-snackbar animate-slide-up" [class]="n.type"
             [attr.role]="n.type === 'error' ? 'alert' : 'status'"
             [attr.aria-live]="n.type === 'error' ? 'assertive' : 'polite'"
             aria-atomic="true">
          <div class="snackbar-icon" aria-hidden="true">
             @if (n.type === 'success') { <lucide-icon name="check-circle-2" [size]="20"></lucide-icon> }
             @if (n.type === 'error') { <lucide-icon name="alert-circle" [size]="20"></lucide-icon> }
             @if (n.type === 'info') { <lucide-icon name="info" [size]="20"></lucide-icon> }
             @if (n.type === 'warning') { <lucide-icon name="alert-triangle" [size]="20"></lucide-icon> }
          </div>
          <div class="snackbar-content text-label-large">
            {{ n.message }}
          </div>
          <button class="snackbar-close" (click)="notify.notifications.set([])" aria-label="Close">
            <lucide-icon name="x" [size]="16"></lucide-icon>
          </button>
        </div>
      }
    </div>
  `,
    styles: [`
    .notification-container {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      flex-direction: column-reverse;
      gap: 12px;
      pointer-events: none;
      width: 100%;
      max-width: 560px;
      padding: 0 24px;
      height: 0;
      overflow: visible;
      justify-content: flex-start;
    }

    .notification-snackbar {
      padding: 14px 16px 14px 20px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      box-shadow: var(--md-sys-elevation-3);
      pointer-events: auto;
      border: 1px solid var(--md-sys-color-outline-variant);
      margin-bottom: 12px;
    }

    /* MD3 Tonal Variations */
    .notification-snackbar.info { 
      background: var(--md-sys-color-surface-container-highest);
      color: var(--md-sys-color-on-surface);
    }
    
    .notification-snackbar.success { 
      background: #b0ffc6; /* Success highlight */
      color: #00391c;
      border-color: rgba(0,0,0,0.1);
    }
    
    .notification-snackbar.error { 
      background: var(--md-sys-color-error-container); 
      color: var(--md-sys-color-on-error-container);
      border-color: var(--md-sys-color-error);
    }
    
    .notification-snackbar.warning { 
      background: var(--md-sys-color-secondary-container); 
      color: var(--md-sys-color-on-secondary-container);
    }

    .snackbar-icon {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }

    .snackbar-content {
      flex: 1;
      min-width: 0;
    }

    .snackbar-close {
      background: transparent;
      border: none;
      color: inherit;
      opacity: 0.6;
      cursor: pointer;
      padding: 4px;
      border-radius: 50%;
      display: flex;
      transition: background 0.2s;
    }

    .snackbar-close:hover {
      background: rgba(0,0,0,0.05);
      opacity: 1;
    }

    .animate-slide-up {
      animation: slideUp 0.3s cubic-bezier(0.2, 0, 0, 1);
    }

    @keyframes slideUp {
      from { transform: translateY(40px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    @media (max-width: 600px) {
      .notification-container {
        bottom: 16px;
        padding: 0 16px;
      }
    }
  `]
})
export class NotificationComponent {
    public notify = inject(NotifyService);
}
