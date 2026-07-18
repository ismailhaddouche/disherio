import {
  Component,
  HostBinding,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, interval } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

export type ConnectionStatus = 'online' | 'offline' | 'reconnecting';

@Component({
  selector: 'app-offline-indicator',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (status() !== 'online') {
      <div
        class="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        [class]="bannerClass()"
        role="alert"
        aria-live="polite"
      >
        <div class="container mx-auto px-4 py-2 flex items-center justify-center gap-3">
          @switch (status()) {
            @case ('offline') {
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
                />
              </svg>
              <span class="font-medium">{{ 'offline.status' | translate }}</span>
              <span class="hidden sm:inline">- {{ 'offline.working' | translate }}</span>
              <button
                (click)="checkConnection()"
                class="ml-2 text-sm underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary rounded px-2"
              >
                {{ 'common.retry' | translate }}
              </button>
            }
            @case ('reconnecting') {
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span class="font-medium">{{ 'offline.reconnecting' | translate }}</span>
            }
          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
    }
    .disher-banner-offline {
      background: var(--mat-sys-error);
      color: var(--mat-sys-on-error);
      box-shadow: var(--disher-elevation-3);
    }
    .disher-banner-reconnecting {
      background: var(--mat-sys-tertiary);
      color: var(--mat-sys-on-tertiary);
      box-shadow: var(--disher-elevation-3);
    }
  `],
})
export class OfflineIndicatorComponent implements OnInit, OnDestroy {
  @HostBinding('class.offline') get isOffline() {
    return this.status() === 'offline';
  }
  @HostBinding('class.reconnecting') get isReconnecting() {
    return this.status() === 'reconnecting';
  }

  private destroy$ = new Subject<void>();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectInterval = 5000; // 5 seconds
  private onlineHandler = () => this.handleOnline();
  private offlineHandler = () => this.handleOffline();

  readonly status = signal<ConnectionStatus>('online');

  bannerClass(): string {
    switch (this.status()) {
      case 'offline':
        return 'disher-banner-offline';
      case 'reconnecting':
        return 'disher-banner-reconnecting';
      default:
        return '';
    }
  }

  ngOnInit(): void {
    // Check initial status
    this.updateStatus();

    // Listen for online/offline events
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);

    // Periodic connectivity check when offline
    interval(this.reconnectInterval)
      .pipe(
        takeUntil(this.destroy$),
        filter(() => this.status() === 'offline')
      )
      .subscribe(() => {
        this.attemptReconnect();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
  }

  private updateStatus(): void {
    this.status.set(navigator.onLine ? 'online' : 'offline');
  }

  private handleOnline(): void {
    this.status.set('online');
    this.reconnectAttempts = 0;
  }

  private handleOffline(): void {
    this.status.set('offline');
    this.reconnectAttempts = 0;
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.status.set('reconnecting');
    this.reconnectAttempts++;

    try {
      // Try to fetch a small resource to verify connectivity
      const response = await fetch('/health', {
        method: 'HEAD',
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        this.status.set('online');
        this.reconnectAttempts = 0;
      } else {
        this.status.set('offline');
      }
    } catch {
      this.status.set('offline');
    }
  }

  /**
   * Manual check for connection
   */
  async checkConnection(): Promise<void> {
    if (navigator.onLine) {
      this.status.set('reconnecting');
      await this.attemptReconnect();
    } else {
      this.status.set('offline');
    }
  }
}
