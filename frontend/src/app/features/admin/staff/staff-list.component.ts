import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { StaffService, Staff, Role } from '../../../services/staff.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-staff-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-container">
      <header class="admin-header">
        <div>
          <h1 class="admin-title">{{ 'staff.title' | translate }}</h1>
          <p class="admin-subtitle">{{ 'staff.subtitle' | translate }}</p>
        </div>
        <a routerLink="new" class="btn-admin btn-primary">
          <span class="material-symbols-outlined text-sm">add</span>
          {{ 'staff.new' | translate }}
        </a>
      </header>

      <!-- Loading State -->
      @if (loading()) {
        <div class="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div class="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent"></div>
          <p class="mt-4 text-gray-600 dark:text-gray-400 font-medium">{{ 'common.loading' | translate }}</p>
        </div>
      }

      <!-- Empty State -->
      @if (!loading() && !error() && staff().length === 0) {
        <div class="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <span class="material-symbols-outlined text-7xl text-gray-200 dark:text-gray-700 mb-4 opacity-50">badge</span>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">{{ 'staff.no_staff' | translate }}</h3>
          <p class="text-gray-500 dark:text-gray-400 mb-6">{{ 'staff.no_staff_desc' | translate }}</p>
          <a routerLink="new" class="btn-admin btn-primary mx-auto inline-flex">{{ 'staff.create' | translate }}</a>
        </div>
      }

      <!-- Staff Table -->
      @if (!loading() && !error() && staff().length > 0) {
        <div class="admin-table-container">
          <div class="overflow-x-auto">
            <table class="admin-table">
              <thead>
                <tr>
                  <th class="admin-th">{{ 'common.name' | translate }}</th>
                  <th class="admin-th">{{ 'staff.column_username' | translate }}</th>
                  <th class="admin-th">{{ 'staff.column_role' | translate }}</th>
                  <th class="admin-th text-right">{{ 'common.actions' | translate }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                @for (member of staff(); track member._id) {
                  <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                    <td class="admin-td">
                      <div class="flex items-center gap-3">
                        <div class="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm border border-primary/5">
                          {{ getInitials(member.staff_name) }}
                        </div>
                        <span class="font-bold text-gray-900 dark:text-white">{{ member.staff_name }}</span>
                      </div>
                    </td>
                    <td class="admin-td">
                      <span class="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono text-xs text-gray-600 dark:text-gray-400">
                        {{ member.username }}
                      </span>
                    </td>
                    <td class="admin-td">
                      <span class="px-2.5 py-1 inline-flex text-xs font-bold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                        {{ getRoleName(member) }}
                      </span>
                    </td>
                    <td class="admin-td">
                      <div class="flex items-center justify-end gap-2">
                        <a [routerLink]="[member._id]" class="btn-icon btn-secondary hover:text-primary" [title]="'common.edit' | translate">
                          <span class="material-symbols-outlined text-lg">edit</span>
                        </a>
                        <button
                          (click)="deleteStaff(member._id!, member.staff_name)"
                          [disabled]="deleting() === member._id"
                          class="btn-icon btn-secondary hover:text-red-500"
                          [title]="'common.delete' | translate"
                        >
                          <span class="material-symbols-outlined text-lg">delete</span>
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
  `
})
export class StaffListComponent implements OnInit {
  private staffService = inject(StaffService);
  private router = inject(Router);
  private i18n = inject(I18nService);
  private notify = inject(NotificationService);

  staff = signal<Staff[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  deleting = signal<string | null>(null);

  ngOnInit(): void {
    this.loadStaff();
  }

  loadStaff(): void {
    this.loading.set(true);
    this.error.set(null);

    this.staffService.getStaff().subscribe({
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
    if (!confirm(`${this.i18n.translate('common.delete')} "${name}"?`)) return;

    this.deleting.set(id);
    this.staffService.deleteStaff(id).subscribe({
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
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getRoleName(member: Staff): string {
    // role_id can be a string (ID only) or a populated Role object
    if (typeof member.role_id === 'string') {
      return this.i18n.translate('common.loading');
    }
    return (member.role_id as Role)?.role_name || '-';
  }
}
