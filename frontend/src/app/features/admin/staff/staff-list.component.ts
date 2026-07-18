import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { StaffService, Staff, Role } from '../../../services/staff.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';

@Component({
  selector: 'app-staff-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-container">
      <header class="admin-header">
        <div>
          <h1 class="admin-title">{{ 'staff.title' | translate }}</h1>
          <p class="admin-subtitle">{{ 'staff.subtitle' | translate }}</p>
        </div>
        <a matButton routerLink="new" class="disher-add-btn">
          <mat-icon aria-hidden="true">add</mat-icon>
          {{ 'staff.new' | translate }}
        </a>
      </header>

      @if (loading()) {
        <div class="disher-loading-state">
          <mat-progress-spinner mode="indeterminate" diameter="48" />
          <p class="disher-loading-text">{{ 'common.loading' | translate }}</p>
        </div>
      }

      @if (!loading() && !error() && staff().length === 0) {
        <div class="disher-empty-state">
          <span class="material-symbols-outlined disher-empty-icon" aria-hidden="true">badge</span>
          <h3 class="disher-empty-title">{{ 'staff.no_staff' | translate }}</h3>
          <p class="disher-empty-desc">{{ 'staff.no_staff_desc' | translate }}</p>
          <a matButton routerLink="new" class="disher-add-btn">{{ 'staff.create' | translate }}</a>
        </div>
      }

      @if (!loading() && !error() && staff().length > 0) {
        <div class="admin-table-container">
          <div class="overflow-x-auto">
            <table class="admin-table">
              <thead>
                <tr>
                  <th class="admin-th" scope="col">{{ 'common.name' | translate }}</th>
                  <th class="admin-th" scope="col">{{ 'staff.column_username' | translate }}</th>
                  <th class="admin-th" scope="col">{{ 'staff.column_role' | translate }}</th>
                  <th class="admin-th text-right" scope="col">{{ 'common.actions' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (member of staff(); track member._id) {
                  <tr class="disher-table-row">
                    <td class="admin-td">
                      <div class="flex items-center gap-3">
                        <div class="disher-avatar" aria-hidden="true">{{ getInitials(member.staff_name) }}</div>
                        <span class="font-bold text-on-surface">{{ member.staff_name }}</span>
                      </div>
                    </td>
                    <td class="admin-td">
                      <span class="disher-mono-chip">{{ member.username }}</span>
                    </td>
                    <td class="admin-td">
                      <span class="disher-role-badge">{{ getRoleName(member) }}</span>
                    </td>
                    <td class="admin-td">
                      <div class="flex items-center justify-end gap-2">
                        <button
                          matIconButton
                          [routerLink]="[member._id]"
                          [attr.aria-label]="'common.edit' | translate"
                        >
                          <mat-icon aria-hidden="true">edit</mat-icon>
                        </button>
                        <button
                          matIconButton
                          (click)="deleteStaff(member._id!, member.staff_name)"
                          [disabled]="deleting() === member._id"
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
    .disher-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: var(--disher-shape-full);
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font-weight: 900;
      font-size: 14px;
    }
    .disher-mono-chip {
      display: inline-block;
      padding: 4px 8px;
      border-radius: var(--disher-shape-xs);
      background: var(--mat-sys-surface-container-high);
      font-family: monospace;
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant);
    }
    .disher-role-badge {
      display: inline-flex;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 700;
      border-radius: var(--disher-shape-full);
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .disher-delete-btn { color: var(--mat-sys-error); }
  `],
})
export class StaffListComponent implements OnInit, OnDestroy {
  private confirmation = inject(ConfirmationService);
  private staffService = inject(StaffService);
  private i18n = inject(I18nService);
  private notify = inject(NotificationService);
  private destroy$ = new Subject<void>();

  staff = signal<Staff[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  deleting = signal<string | null>(null);

  ngOnInit(): void {
    this.loadStaff();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadStaff(): void {
    this.loading.set(true);
    this.error.set(null);

    this.staffService.getStaff()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (staff) => {
          this.staff.set(staff);
          this.loading.set(false);
        },
        error: (err) => {
          const msg = err.error?.message || this.i18n.translate('error.staff_loading');
          this.error.set(msg);
          this.notify.error(msg);
          this.loading.set(false);
        }
      });
  }

  deleteStaff(id: string, name: string): void {
    this.confirmation.confirm(`${this.i18n.translate('common.delete')} "${name}"?`, { destructive: true })
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmed => {
        if (!confirmed) return;
        this.deleting.set(id);
        this.staffService.deleteStaff(id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.deleting.set(null);
              this.notify.success(this.i18n.translate('common.deleted'));
              this.loadStaff();
            },
            error: (err) => {
              this.notify.error(err.error?.message || this.i18n.translate('error.deleting'));
              this.deleting.set(null);
            }
          });
      });
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getRoleName(member: Staff): string {
    if (typeof member.role_id === 'string') {
      return this.i18n.translate('common.loading');
    }
    return (member.role_id as Role)?.role_name || '-';
  }
}
