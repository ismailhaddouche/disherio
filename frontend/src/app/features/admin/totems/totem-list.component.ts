import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TotemService, Totem } from '../../../services/totem.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-totem-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  template: `
    <div class="p-6">
      <header class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ 'totem.title' | translate }}</h1>
        <a
          routerLink="new"
          class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
        >
          <span class="material-symbols-outlined text-sm">add</span>
          {{ 'totem.new' | translate }}
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
      <div *ngIf="!loading() && !error() && totems().length === 0" class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
        <span class="material-symbols-outlined text-6xl text-gray-300 mb-4">qr_code_scanner</span>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">{{ 'totem.no_totems' | translate }}</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-4">{{ 'totem.no_totems_desc' | translate }}</p>
        <a routerLink="new" class="text-primary hover:underline">{{ 'totem.create' | translate }} →</a>
      </div>

      <!-- Totems Table -->
      <div *ngIf="!loading() && !error() && totems().length > 0" class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{{ 'common.name' | translate }}</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{{ 'totem.type_column' | translate }}</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">QR</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{{ 'totem.start_date' | translate }}</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{{ 'common.actions' | translate }}</th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              <tr *ngFor="let totem of totems()" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                  {{ totem.totem_name }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                    [class]="{
                      'bg-blue-100 text-blue-800': totem.totem_type === 'STANDARD',
                      'bg-yellow-100 text-yellow-800': totem.totem_type === 'TEMPORARY'
                    }"
                  >
                    {{ totem.totem_type === 'STANDARD' ? ('totem.type_standard' | translate) : ('totem.type_temporary' | translate) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                  {{ totem.totem_qr || ('totem.no_qr' | translate) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ totem.totem_start_date | date:'shortDate' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div class="flex items-center gap-2">
                    <button
                      (click)="regenerateQr(totem._id!)"
                      [disabled]="regenerating() === totem._id"
                      class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30"
                      [title]="'totem.regenerate_qr' | translate"
                    >
                      <span class="material-symbols-outlined text-sm">replay</span>
                    </button>
                    <a
                      [routerLink]="[totem._id]"
                      class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 p-1 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                      [title]="'common.edit' | translate"
                    >
                      <span class="material-symbols-outlined text-sm">edit</span>
                    </a>
                    <button
                      (click)="deleteTotem(totem._id!, totem.totem_name)"
                      [disabled]="deleting() === totem._id"
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
export class TotemListComponent implements OnInit {
  private totemService = inject(TotemService);
  private router = inject(Router);
  private i18n = inject(I18nService);

  totems = signal<Totem[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  regenerating = signal<string | null>(null);
  deleting = signal<string | null>(null);

  ngOnInit(): void {
    this.loadTotems();
  }

  loadTotems(): void {
    this.loading.set(true);
    this.error.set(null);

    this.totemService.getTotems().subscribe({
      next: (totems) => {
        this.totems.set(totems);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || this.i18n.translate('errors.LOADING_ERROR'));
        this.loading.set(false);
      }
    });
  }

  regenerateQr(id: string): void {
    if (!confirm(this.i18n.translate('totem.regenerate_qr') + '?')) return;

    this.regenerating.set(id);
    this.totemService.regenerateQr(id).subscribe({
      next: () => {
        this.regenerating.set(null);
        this.loadTotems();
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Error al regenerar QR');
        this.regenerating.set(null);
      }
    });
  }

  deleteTotem(id: string, name: string): void {
    if (!confirm(`${this.i18n.translate('common.delete')} "${name}"?`)) return;

    this.deleting.set(id);
    this.totemService.deleteTotem(id).subscribe({
      next: () => {
        this.deleting.set(null);
        this.loadTotems();
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Error al eliminar tótem');
        this.deleting.set(null);
      }
    });
  }
}
