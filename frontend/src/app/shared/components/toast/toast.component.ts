import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NotificationService, NotificationType } from '../../../core/services/notification.service';

const ICON_MAP: Record<NotificationType, string> = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

const COLOR_MAP: Record<NotificationType, string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  warning: 'bg-yellow-500',
  info: 'bg-blue-600',
};

@Component({
  selector: 'app-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      @for (n of notificationService.notifications(); track n.id) {
        <div
          class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white text-sm animate-slide-in"
          [class]="getColorClass(n.type)"
        >
          <span class="material-symbols-outlined text-lg">{{ getIcon(n.type) }}</span>
          <span class="flex-1">{{ n.message }}</span>
          <button (click)="notificationService.dismiss(n.id)" class="opacity-70 hover:opacity-100 transition-opacity">
            <span class="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .animate-slide-in {
      animation: slideIn 0.25s ease-out;
    }
  `],
})
export class ToastComponent {
  notificationService = inject(NotificationService);

  getIcon(type: NotificationType): string {
    return ICON_MAP[type];
  }

  getColorClass(type: NotificationType): string {
    return COLOR_MAP[type];
  }
}
