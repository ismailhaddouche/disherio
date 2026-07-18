import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { CurrencyFormatPipe } from '../../../shared/pipes/currency-format.pipe';
import { NotificationService } from '../../../core/services/notification.service';
import { I18nService } from '../../../core/services/i18n.service';
import { DashboardService, LogEntry } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-logs-viewer',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslatePipe, CurrencyFormatPipe,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatSelectModule, MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-container">
      <header class="admin-header">
        <div>
          <h1 class="admin-title">{{ 'logs.title' | translate }}</h1>
          <p class="admin-subtitle">{{ 'logs.subtitle' | translate }}</p>
        </div>
      </header>

      <div class="admin-filters">
        <mat-form-field appearance="outline" class="disher-filter-field">
          <mat-label>{{ 'logs.system_type' | translate }}</mat-label>
          <mat-select
            [ngModel]="selectedType()"
            (ngModelChange)="selectedType.set($event); loadLogs()"
          >
            <mat-option value="ALL">{{ 'logs.all_systems' | translate }}</mat-option>
            <mat-option value="KDS">{{ 'logs.kds_label' | translate }}</mat-option>
            <mat-option value="POS">{{ 'logs.pos_label' | translate }}</mat-option>
            <mat-option value="TAS">{{ 'logs.tas_label' | translate }}</mat-option>
            <mat-option value="CUSTOMER">{{ 'logs.customer_label' | translate }}</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <div class="admin-table-container">
        @if (loading()) {
          <div class="disher-loading-state">
            <mat-progress-spinner mode="indeterminate" diameter="40" />
            <p class="disher-loading-text">{{ 'common.loading' | translate }}</p>
          </div>
        } @else if (logs().length === 0) {
          <div class="disher-empty-state">
            <span class="material-symbols-outlined disher-empty-icon" aria-hidden="true">receipt_long</span>
            <p class="disher-empty-title">{{ 'logs.no_logs' | translate }}</p>
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="admin-table">
              <thead>
                <tr>
                  <th class="admin-th" scope="col">{{ 'logs.time' | translate }}</th>
                  <th class="admin-th" scope="col">{{ 'logs.action' | translate }}</th>
                  <th class="admin-th" scope="col">{{ 'logs.item' | translate }}</th>
                  <th class="admin-th" scope="col">{{ 'logs.status' | translate }}</th>
                  <th class="admin-th" scope="col">{{ 'logs.details' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (log of logs(); track log.id) {
                  <tr class="disher-table-row">
                    <td class="admin-td text-on-surface-variant whitespace-nowrap">{{ log.timestamp | date: 'short' }}</td>
                    <td class="admin-td">
                      <span class="disher-log-type-badge" [class.disher-type-kds]="log.type === 'KDS'" [class.disher-type-pos]="log.type === 'POS'" [class.disher-type-tas]="log.type === 'TAS'" [class.disher-type-customer]="log.type === 'CUSTOMER'">
                        {{ log.type }}
                      </span>
                    </td>
                    <td class="admin-td font-medium text-on-surface">{{ log.dishName || '-' }}</td>
                    <td class="admin-td">
                      <span class="disher-log-status-badge" [class.disher-status-ordered]="log.status === 'ORDERED'" [class.disher-status-preparing]="log.status === 'ON_PREPARE'" [class.disher-status-served]="log.status === 'SERVED'" [class.disher-status-canceled]="log.status === 'CANCELED'">
                        {{ log.status }}
                      </span>
                    </td>
                    <td class="admin-td text-on-surface-variant text-xs">
                      @if (log.userName) { <span>{{ log.userName }}</span> }
                      @if (log.details['basePrice']) { <span class="ml-2">{{ $any(log.details['basePrice']) | currencyFormat }}</span> }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="disher-log-footer">
            {{ 'logs.showing' | translate }} {{ logs().length }} {{ 'logs.entries' | translate }}
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .disher-filter-field { width: 240px; }
    .disher-loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 0;
      gap: 16px;
    }
    .disher-loading-text { color: rgb(var(--mat-sys-on-surface-variant)); margin: 0; }
    .disher-empty-state {
      padding: 64px 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .disher-empty-icon { font-size: 48px; opacity: 0.2; color: rgb(var(--mat-sys-on-surface-variant)); }
    .disher-empty-title { color: rgb(var(--mat-sys-on-surface-variant)); font-weight: 500; }
    .disher-table-row { transition: background-color var(--disher-transition-fast); }
    .disher-table-row:hover { background: rgb(var(--mat-sys-surface-container-low)); }
    .disher-log-type-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: var(--disher-shape-full);
      font-size: 12px;
      font-weight: 500;
    }
    .disher-type-kds { background: rgb(var(--mat-sys-primary-container)); color: rgb(var(--mat-sys-on-primary-container)); }
    .disher-type-pos { background: rgb(var(--disher-success-container)); color: rgb(var(--disher-on-success-container)); }
    .disher-type-tas { background: rgb(var(--mat-sys-tertiary-container)); color: rgb(var(--mat-sys-on-tertiary-container)); }
    .disher-type-customer { background: rgb(var(--mat-sys-secondary-container)); color: rgb(var(--mat-sys-on-secondary-container)); }
    .disher-log-status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: var(--disher-shape-full);
      font-size: 12px;
    }
    .disher-status-ordered { background: rgb(var(--mat-sys-tertiary-container)); color: rgb(var(--mat-sys-on-tertiary-container)); }
    .disher-status-preparing { background: rgb(var(--mat-sys-primary-container)); color: rgb(var(--mat-sys-on-primary-container)); }
    .disher-status-served { background: rgb(var(--disher-success-container)); color: rgb(var(--disher-on-success-container)); }
    .disher-status-canceled { background: rgb(var(--mat-sys-error-container)); color: rgb(var(--mat-sys-on-error-container)); }
    .disher-log-footer {
      padding: 12px 16px;
      font-size: 12px;
      color: rgb(var(--mat-sys-on-surface-variant));
      border-top: 1px solid rgb(var(--mat-sys-outline-variant));
    }
  `],
})
export class LogsViewerComponent implements OnInit, OnDestroy {
  private dashboardService = inject(DashboardService);
  private notify = inject(NotificationService);
  protected i18n = inject(I18nService);
  private destroy$ = new Subject<void>();

  logs = signal<LogEntry[]>([]);
  loading = signal(false);
  selectedType = signal<'ALL' | 'KDS' | 'POS' | 'TAS' | 'CUSTOMER'>('ALL');

  ngOnInit() {
    this.loadLogs();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadLogs() {
    this.loading.set(true);
    const type = this.selectedType() !== 'ALL' ? this.selectedType() : undefined;

    this.dashboardService.getLogs({ type })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.logs.set(res.logs || []);
          this.loading.set(false);
        },
        error: () => {
          this.notify.error(this.i18n.translate('errors.LOADING_ERROR'));
          this.loading.set(false);
        },
      });
  }
}
