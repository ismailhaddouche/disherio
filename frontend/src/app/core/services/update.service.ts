import { Injectable, inject, OnDestroy } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, Subject } from 'rxjs';
import { NotificationService } from './notification.service';
import { I18nService } from './i18n.service';

export interface UpdateInfo {
  type: 'VERSION_DETECTED' | 'VERSION_READY' | 'VERSION_INSTALLATION_FAILED';
  currentVersion?: { hash: string; appData?: object };
  latestVersion?: { hash: string; appData?: object };
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class UpdateService implements OnDestroy {
  private swUpdate = inject(SwUpdate);
  private notificationService = inject(NotificationService);
  private i18n = inject(I18nService);

  private updateAvailable$ = new Subject<UpdateInfo>();
  public updateAvailable = this.updateAvailable$.asObservable();
  private intervalId?: ReturnType<typeof setInterval>;

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
            this.i18n.translate('update.available')
          );
        });

      // Check for updates every 30 minutes
      this.intervalId = setInterval(() => {
        this.checkForUpdate();
      }, 30 * 60 * 1000);
    }
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.updateAvailable$.complete();
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
      return false;
    }

    try {
      const updateFound = await this.swUpdate.checkForUpdate();
      return true;
    } catch {
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
      this.reloadPage();
    } catch {
      this.notificationService.error(this.i18n.translate('update.apply_failed'));
    }
  }

  /**
   * Unrecoverable state handler - reload the page
   */
  handleUnrecoverableState(): void {
    this.notificationService.error(
      this.i18n.translate('update.unrecoverable')
    );
    this.reloadPage();
  }

  private reloadPage(): void {
    window.location.reload();
  }
}
