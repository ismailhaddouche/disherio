import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { StaffService, Staff, Role } from '../../../services/staff.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-staff-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  template: `
    <div class="p-6">
      <header class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ 'staff.title' | translate }}</h1>
          <p class="text-gray-600 dark:text-gray-400">{{ 'staff.subtitle' | translate }}</p>
        </div>
        <a
          routerLink="new"
          class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
        >
          <span class="material-symbols-outlined text-sm">add</span>
          {{ 'staff.new' | translate }}
        </a>
      </header>

      <!-- Loading State -->
      <div *ngIf="loading()" class="text-center py-8">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p class="mt-2 text-gray-600 dark:text-gray-400">{{ 'common.loading' | translate }}</p>
      </div>

      <!-- Error State -->
      <div *ngIf="error()" class="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
        {{ error() }}
      </div>

      <!-- Empty State -->
      <div *ngIf="!loading() && !error() && staff().length === 0" class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
        <span class="material-symbols-outlined text-6xl text-gray-300 mb-4">badge</span>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">{{ 'staff.no_staff' | translate }}</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-4">{{ 'staff.no_staff_desc' | translate }}</p>
        <a routerLink="new" class="text-primary hover:underline">{{ 'staff.create' | translate }} →</a>
      </div>

      <!-- Staff Table -->
      <div *ngIf="!loading() && !error() && staff().length > 0" class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{{ 'common.name' | translate }}</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{{ 'staff.column_username' | translate }}</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{{ 'staff.column_role' | translate }}</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{{ 'common.actions' | translate }}</th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              <tr *ngFor="let member of staff()" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                      {{ getInitials(member.staff_name) }}
                    </div>
                    <div class="ml-4">
                      <div class="text-sm font-medium text-gray-900 dark:text-white">{{ member.staff_name }}</div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                  {{ member.username }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                    {{ getRoleName(member) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div class="flex items-center gap-2">
                    <a
                      [routerLink]="[member._id]"
                      class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 p-1 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                      [title]="'common.edit' | translate"
                    >
                      <span class="material-symbols-outlined text-sm">edit</span>
                    </a>
                    <button
                      (click)="deleteStaff(member._id!, member.staff_name)"
                      [disabled]="deleting() === member._id"
                      class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                      [title]="'common.delete' | translate"
                    >
                      <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class StaffListComponent implements OnInit {
  private staffService = inject(StaffService);
  private router = inject(Router);
  private i18n = inject(I18nService);

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
        this.error.set(err.error?.message || 'Error al cargar el personal');
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
        this.loadStaff();
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Error al eliminar');
        this.deleting.set(null);
      }
    });
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getRoleName(member: Staff): string {
    // role_id puede ser string (solo ID) o objeto Role poblado
    if (typeof member.role_id === 'string') {
      return this.i18n.translate('common.loading');
    }
    return (member.role_id as Role)?.role_name || '-';
  }
}
