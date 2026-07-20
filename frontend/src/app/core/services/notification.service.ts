import { Injectable, inject, signal } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig, MatSnackBarHorizontalPosition, MatSnackBarVerticalPosition } from '@angular/material/snack-bar';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { I18nService } from './i18n.service';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: number;
  message: string;
  type: NotificationType;
}

const DEFAULT_DURATION = 4000;

const ANNOUNCEMENT_KEYS: Record<NotificationType, string> = {
  success: 'common.success',
  error: 'common.error',
  info: 'common.info',
  warning: 'common.warning',
};

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private snackBar = inject(MatSnackBar);
  private liveAnnouncer = inject(LiveAnnouncer);
  private i18n = inject(I18nService);

  private _nextId = 0;
  private readonly dismissTimeouts = new Map<number, ReturnType<typeof setTimeout>>();
  readonly notifications = signal<Notification[]>([]);

  private getAnnouncementMessage(message: string, type: NotificationType): string {
    return `${this.i18n.translate(ANNOUNCEMENT_KEYS[type])}: ${message}`;
  }

  private getSnackBarConfig(type: NotificationType, duration: number): MatSnackBarConfig {
    const panelClassMap: Record<NotificationType, string[]> = {
      success: ['disher-snackbar-success'],
      error: ['disher-snackbar-error'],
      warning: ['disher-snackbar-warning'],
      info: ['disher-snackbar-info'],
    };

    const config: MatSnackBarConfig = {
      duration: duration > 0 ? duration : undefined,
      horizontalPosition: 'end' as MatSnackBarHorizontalPosition,
      verticalPosition: 'top' as MatSnackBarVerticalPosition,
      panelClass: panelClassMap[type],
      politeness: type === 'error' ? 'assertive' : 'polite',
    };

    return config;
  }

  show(message: string, type: NotificationType = 'info', duration = DEFAULT_DURATION): void {
    const id = this._nextId++;
    this.notifications.update((list) => [...list, { id, message, type }]);
    this.liveAnnouncer.announce(this.getAnnouncementMessage(message, type), 'polite');
    this.snackBar.open(message, this.i18n.translate('common.close'), this.getSnackBarConfig(type, duration));
    if (duration > 0) {
      const timeoutId = setTimeout(() => this.dismiss(id), duration);
      this.dismissTimeouts.set(id, timeoutId);
    }
  }

  success(message: string, duration = DEFAULT_DURATION): void {
    this.show(message, 'success', duration);
  }

  error(message: string, duration = DEFAULT_DURATION): void {
    this.show(message, 'error', duration);
  }

  warning(message: string, duration = DEFAULT_DURATION): void {
    this.show(message, 'warning', duration);
  }

  info(message: string, duration = DEFAULT_DURATION): void {
    this.show(message, 'info', duration);
  }

  dismiss(id: number): void {
    const timeoutId = this.dismissTimeouts.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.dismissTimeouts.delete(id);
    }
    this.notifications.update((list) => list.filter((n) => n.id !== id));
  }
}
