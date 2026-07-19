import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TotemService, Totem } from '../../../core/services/totem.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';

@Component({
  selector: 'app-totem-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-container">
      <header class="admin-header">
        <div>
          <h1 class="admin-title">{{ 'totem.title' | translate }}</h1>
          <p class="admin-subtitle">{{ 'totem.subtitle' | translate }}</p>
        </div>
        <a matButton routerLink="new" class="disher-add-btn">
          <mat-icon aria-hidden="true">add</mat-icon>
          {{ 'totem.new' | translate }}
        </a>
      </header>

      @if (loading()) {
        <div class="disher-loading-state">
          <mat-progress-spinner mode="indeterminate" diameter="48" />
          <p class="disher-loading-text">{{ 'common.loading' | translate }}</p>
        </div>
      }

      @if (!loading() && !error() && totems().length === 0) {
        <div class="disher-empty-state">
          <span class="material-symbols-outlined disher-empty-icon" aria-hidden="true">qr_code_scanner</span>
          <h3 class="disher-empty-title">{{ 'totem.no_totems' | translate }}</h3>
          <p class="disher-empty-desc">{{ 'totem.no_totems_desc' | translate }}</p>
          <a matButton routerLink="new" class="disher-add-btn">{{ 'totem.create' | translate }}</a>
        </div>
      }

      @if (!loading() && !error() && totems().length > 0) {
        <div class="admin-table-container">
          <div class="overflow-x-auto">
            <table class="admin-table">
              <thead>
                <tr>
                  <th class="admin-th" scope="col">{{ 'common.name' | translate }}</th>
                  <th class="admin-th" scope="col">{{ 'totem.type_column' | translate }}</th>
                  <th class="admin-th" scope="col">QR</th>
                  <th class="admin-th" scope="col">{{ 'totem.start_date' | translate }}</th>
                  <th class="admin-th text-right" scope="col">{{ 'common.actions' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (totem of totems(); track totem._id) {
                  <tr class="disher-table-row">
                    <td class="admin-td font-bold text-on-surface">{{ totem.totem_name }}</td>
                    <td class="admin-td">
                      <span class="disher-type-badge" [class.disher-type-standard]="totem.totem_type === 'STANDARD'" [class.disher-type-temporary]="totem.totem_type !== 'STANDARD'">
                        {{ totem.totem_type === 'STANDARD' ? ('totem.type_standard' | translate) : ('totem.type_temporary' | translate) }}
                      </span>
                    </td>
                    <td class="admin-td">
                      <span class="disher-mono-chip">{{ totem.totem_qr || ('totem.no_qr' | translate) }}</span>
                    </td>
                    <td class="admin-td text-on-surface-variant">
                      {{ totem.totem_start_date | date:'shortDate' }}
                    </td>
                    <td class="admin-td">
                      <div class="flex items-center justify-end gap-2">
                        <button
                          matIconButton
                          (click)="regenerateQr(totem._id!)"
                          [disabled]="regenerating() === totem._id"
                          [attr.aria-label]="'totem.regenerate_qr' | translate"
                        >
                          <mat-icon aria-hidden="true">replay</mat-icon>
                        </button>
                        <button
                          matIconButton
                          [routerLink]="[totem._id]"
                          [attr.aria-label]="'common.edit' | translate"
                        >
                          <mat-icon aria-hidden="true">edit</mat-icon>
                        </button>
                        <button
                          matIconButton
                          (click)="deleteTotem(totem._id!, totem.totem_name)"
                          [disabled]="deleting() === totem._id"
                          [attr.aria-label]="'common.delete' | translate"
                          class="disher-delete-btn"
                        >
                          <mat-icon aria-hidden="true">delete</mat-icon>
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .disher-add-btn { min-height: 40px; }
    .disher-loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 0;
      gap: 16px;
    }
    .disher-loading-text { color: var(--mat-sys-on-surface-variant); font-weight: 500; margin: 0; }
    .disher-empty-state {
      padding: 80px 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      text-align: center;
    }
    .disher-empty-icon { font-size: 72px; opacity: 0.2; color: var(--mat-sys-on-surface-variant); }
    .disher-empty-title { font-size: 20px; font-weight: 700; color: var(--mat-sys-on-surface); margin: 0; }
    .disher-empty-desc { color: var(--mat-sys-on-surface-variant); margin: 0 0 8px 0; }
    .disher-table-row { transition: background-color var(--disher-transition-fast); }
    .disher-table-row:hover { background: var(--mat-sys-surface-container-low); }
    .disher-type-badge {
      display: inline-flex;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 700;
      border-radius: var(--disher-shape-full);
    }
    .disher-type-standard { background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container); }
    .disher-type-temporary { background: var(--mat-sys-tertiary-container); color: var(--mat-sys-on-tertiary-container); }
    .disher-mono-chip {
      display: inline-block;
      padding: 4px 8px;
      border-radius: var(--disher-shape-xs);
      background: var(--mat-sys-surface-container-high);
      font-family: monospace;
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant);
    }
    .disher-delete-btn { color: var(--mat-sys-error); }
  `],
})
export class TotemListComponent implements OnInit, OnDestroy {
  private confirmation = inject(ConfirmationService);
  private totemService = inject(TotemService);
  private i18n = inject(I18nService);
  private notify = inject(NotificationService);
  private destroy$ = new Subject<void>();

  totems = signal<Totem[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  regenerating = signal<string | null>(null);
  deleting = signal<string | null>(null);

  ngOnInit(): void {
    this.loadTotems();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTotems(): void {
    this.loading.set(true);
    this.error.set(null);

    this.totemService.getTotems()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (totems) => {
          this.totems.set(totems);
          this.loading.set(false);
        },
        error: (err) => {
          const msg = err.error?.message || this.i18n.translate('errors.LOADING_ERROR');
          this.error.set(msg);
          this.notify.error(msg);
          this.loading.set(false);
        }
      });
  }

  regenerateQr(id: string): void {
    this.confirmation.confirm(this.i18n.translate('totem.regenerate_qr') + '?')
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmed => {
        if (!confirmed) return;
        this.regenerating.set(id);
        this.totemService.regenerateQr(id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.regenerating.set(null);
              this.notify.success(this.i18n.translate('totem.qr_regenerated'));
              this.loadTotems();
            },
            error: (err) => {
              this.notify.error(err.error?.message || this.i18n.translate('error.qr_regenerate'));
              this.regenerating.set(null);
            }
          });
      });
  }

  deleteTotem(id: string, name: string): void {
    this.confirmation.confirm(`${this.i18n.translate('common.delete')} "${name}"?`, { destructive: true })
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmed => {
        if (!confirmed) return;
        this.deleting.set(id);
        this.totemService.deleteTotem(id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.deleting.set(null);
              this.notify.success(this.i18n.translate('common.deleted'));
              this.loadTotems();
            },
            error: (err) => {
              this.notify.error(err.error?.message || this.i18n.translate('error.totem_delete'));
              this.deleting.set(null);
            }
          });
      });
  }
}
