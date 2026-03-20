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
        <div class="notification-toast animate-slide-in" [class]="n.type"
             [attr.role]="n.type === 'error' ? 'alert' : 'status'"
             [attr.aria-live]="n.type === 'error' ? 'assertive' : 'polite'"
             aria-atomic="true">
          <div class="toast-icon" aria-hidden="true">
             @if (n.type === 'success') { <lucide-icon name="check-circle" [size]="20"></lucide-icon> }
             @if (n.type === 'error') { <lucide-icon name="alert-circle" [size]="20"></lucide-icon> }
             @if (n.type === 'info') { <lucide-icon name="info" [size]="20"></lucide-icon> }
             @if (n.type === 'warning') { <lucide-icon name="alert-triangle" [size]="20"></lucide-icon> }
          </div>
          <div class="toast-content text-body-medium">
            {{ n.message }}
          </div>
        </div>
      }
    </div>
  `,
    styles: [`
    .notification-container {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
    }

    .notification-toast {
      padding: 16px 20px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      min-width: 300px;
      max-width: 450px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.3);
      backdrop-filter: blur(12px);
      pointer-events: auto;
      border: 1px solid rgba(255,255,255,0.1);
    }

    .notification-toast.info { 
      background: rgba(30, 30, 35, 0.9); 
      color: white;
      border-left: 4px solid var(--md-sys-color-primary);
    }
    
    .notification-toast.success { 
      background: rgba(13, 137, 74, 0.9); 
      color: white;
    }
    
    .notification-toast.error { 
      background: rgba(186, 26, 26, 0.9); 
      color: white;
    }
    
    .notification-toast.warning { 
      background: rgba(235, 163, 0, 0.9); 
      color: black;
      border-left: 4px solid black;
    }

    .animate-slide-in {
      animation: slideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `]
})
export class NotificationComponent {
    public notify = inject(NotifyService);
}
