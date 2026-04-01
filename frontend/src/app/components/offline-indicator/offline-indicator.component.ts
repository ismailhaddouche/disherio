import {
  Component,
  HostBinding,
  OnInit,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, interval } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';

export type ConnectionStatus = 'online' | 'offline' | 'reconnecting';

@Component({
  selector: 'app-offline-indicator',
  standalone: true,
  imports: [CommonModule],
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
              <span class="font-medium">Sin conexión</span>
              <span class="hidden sm:inline">- Trabajando en modo offline</span>
              <button
                (click)="checkConnection()"
                class="ml-2 text-sm underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-white rounded px-2"
              >
                Reintentar
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
              <span class="font-medium">Reconectando...</span>
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
  `],
})
export class OfflineIndicatorComponent implements OnInit, OnDestroy {
  @HostBinding('class.offline') get isOffline() {
    return this._status === 'offline';
  }
  @HostBinding('class.reconnecting') get isReconnecting() {
    return this._status === 'reconnecting';
  }

  private destroy$ = new Subject<void>();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectInterval = 5000; // 5 seconds

  protected _status: ConnectionStatus = 'online';

  status(): ConnectionStatus {
    return this._status;
  }

  bannerClass(): string {
    switch (this._status) {
      case 'offline':
        return 'bg-red-600 text-white shadow-lg';
      case 'reconnecting':
        return 'bg-yellow-500 text-white shadow-lg';
      default:
        return '';
    }
  }

  ngOnInit(): void {
    // Check initial status
    this.updateStatus();

    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Periodic connectivity check when offline
    interval(this.reconnectInterval)
      .pipe(
        takeUntil(this.destroy$),
        filter(() => this._status === 'offline')
      )
      .subscribe(() => {
        this.attemptReconnect();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    window.removeEventListener('online', () => this.handleOnline());
    window.removeEventListener('offline', () => this.handleOffline());
  }

  private updateStatus(): void {
    this._status = navigator.onLine ? 'online' : 'offline';
  }

  private handleOnline(): void {
    this._status = 'online';
    this.reconnectAttempts = 0;
  }

  private handleOffline(): void {
    this._status = 'offline';
    this.reconnectAttempts = 0;
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this._status = 'reconnecting';
    this.reconnectAttempts++;

    try {
      // Try to fetch a small resource to verify connectivity
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        this._status = 'online';
        this.reconnectAttempts = 0;
      } else {
        this._status = 'offline';
      }
    } catch {
      this._status = 'offline';
    }
  }

  /**
   * Manual check for connection
   */
  async checkConnection(): Promise<void> {
    if (navigator.onLine) {
      this._status = 'reconnecting';
      await this.attemptReconnect();
    } else {
      this._status = 'offline';
    }
  }
}
