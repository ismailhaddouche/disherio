import { Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, Subject } from 'rxjs';
import { NotificationService } from './notification.service';

export interface UpdateInfo {
  type: 'VERSION_DETECTED' | 'VERSION_READY' | 'VERSION_INSTALLATION_FAILED';
  currentVersion?: { hash: string; appData?: object };
  latestVersion?: { hash: string; appData?: object };
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class UpdateService {
  private swUpdate = inject(SwUpdate);
  private notificationService = inject(NotificationService);

  private updateAvailable$ = new Subject<UpdateInfo>();
  public updateAvailable = this.updateAvailable$.asObservable();

  constructor() {
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(
          filter(
            (event): event is VersionReadyEvent =>
              event.type === 'VERSION_READY'
          )
        )
        .subscribe((event) => {
          this.updateAvailable$.next({
            type: 'VERSION_READY',
            currentVersion: event.currentVersion,
            latestVersion: event.latestVersion,
          });

          this.notificationService.info(
            'Nueva versión disponible. Recarga para actualizar.'
          );
        });

      // Check for updates every 30 minutes
      setInterval(() => {
        this.checkForUpdate();
      }, 30 * 60 * 1000);
    }
  }

  /**
   * Check if Service Worker updates are enabled
   */
  get isEnabled(): boolean {
    return this.swUpdate.isEnabled;
  }

  /**
   * Manually check for updates
   * @returns Promise<boolean> true if update check was successful
   */
  async checkForUpdate(): Promise<boolean> {
    if (!this.swUpdate.isEnabled) {
      console.log('Service Worker updates are not enabled');
      return false;
    }

    try {
      const updateFound = await this.swUpdate.checkForUpdate();
      console.log(updateFound ? 'Update available' : 'No update available');
      return true;
    } catch (error) {
      console.error('Failed to check for updates:', error);
      return false;
    }
  }

  /**
   * Apply the update by reloading the page
   */
  async applyUpdate(): Promise<void> {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    try {
      await this.swUpdate.activateUpdate();
      window.location.reload();
    } catch (error) {
      console.error('Failed to apply update:', error);
      this.notificationService.error('Error al aplicar la actualización');
    }
  }

  /**
   * Unrecoverable state handler - reload the page
   */
  handleUnrecoverableState(): void {
    this.notificationService.error(
      'Error crítico. La aplicación se recargará.'
    );
    window.location.reload();
  }
}
