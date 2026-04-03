import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TotemService, Totem } from '../../../services/totem.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-totem-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-container">
      <header class="admin-header">
        <div>
          <h1 class="admin-title">{{ 'totem.title' | translate }}</h1>
          <p class="admin-subtitle">{{ 'totem.subtitle' | translate }}</p>
        </div>
        <a routerLink="new" class="btn-admin btn-primary">
          <span class="material-symbols-outlined text-sm">add</span>
          {{ 'totem.new' | translate }}
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
      @if (!loading() && !error() && totems().length === 0) {
        <div class="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <span class="material-symbols-outlined text-7xl text-gray-200 dark:text-gray-700 mb-4 opacity-50">qr_code_scanner</span>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">{{ 'totem.no_totems' | translate }}</h3>
          <p class="text-gray-500 dark:text-gray-400 mb-6">{{ 'totem.no_totems_desc' | translate }}</p>
          <a routerLink="new" class="btn-admin btn-primary mx-auto inline-flex">{{ 'totem.create' | translate }}</a>
        </div>
      }

      <!-- Totems Table -->
      @if (!loading() && !error() && totems().length > 0) {
        <div class="admin-table-container">
          <div class="overflow-x-auto">
            <table class="admin-table">
              <thead>
                <tr>
                  <th class="admin-th">{{ 'common.name' | translate }}</th>
                  <th class="admin-th">{{ 'totem.type_column' | translate }}</th>
                  <th class="admin-th">QR</th>
                  <th class="admin-th">{{ 'totem.start_date' | translate }}</th>
                  <th class="admin-th text-right">{{ 'common.actions' | translate }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                @for (totem of totems(); track totem._id) {
                  <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td class="admin-td font-bold">
                      {{ totem.totem_name }}
                    </td>
                    <td class="admin-td">
                      <span
                        class="px-2.5 py-1 inline-flex text-xs font-bold rounded-full border"
                        [class]="totem.totem_type === 'STANDARD' 
                          ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' 
                          : 'bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'"
                      >
                        {{ totem.totem_type === 'STANDARD' ? ('totem.type_standard' | translate) : ('totem.type_temporary' | translate) }}
                      </span>
                    </td>
                    <td class="admin-td">
                      <span class="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono text-xs text-gray-600 dark:text-gray-400">
                        {{ totem.totem_qr || ('totem.no_qr' | translate) }}
                      </span>
                    </td>
                    <td class="admin-td text-gray-500 dark:text-gray-400">
                      {{ totem.totem_start_date | date:'shortDate' }}
                    </td>
                    <td class="admin-td">
                      <div class="flex items-center justify-end gap-2">
                        <button
                          (click)="regenerateQr(totem._id!)"
                          [disabled]="regenerating() === totem._id"
                          class="btn-icon btn-secondary hover:text-blue-500"
                          [title]="'totem.regenerate_qr' | translate"
                        >
                          <span class="material-symbols-outlined text-lg">replay</span>
                        </button>
                        <a [routerLink]="[totem._id]" class="btn-icon btn-secondary hover:text-primary" [title]="'common.edit' | translate">
                          <span class="material-symbols-outlined text-lg">edit</span>
                        </a>
                        <button
                          (click)="deleteTotem(totem._id!, totem.totem_name)"
                          [disabled]="deleting() === totem._id"
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
export class TotemListComponent implements OnInit {
  private totemService = inject(TotemService);
  private router = inject(Router);
  private i18n = inject(I18nService);
  private notify = inject(NotificationService);

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
        const msg = err.error?.message || this.i18n.translate('errors.LOADING_ERROR');
        this.error.set(msg);
        this.notify.error(msg);
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
        this.notify.success(this.i18n.translate('totem.qr_regenerated'));
        this.loadTotems();
      },
      error: (err) => {
        this.notify.error(err.error?.message || this.i18n.translate('error.qr_regenerate'));
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
        this.notify.success(this.i18n.translate('common.deleted'));
        this.loadTotems();
      },
      error: (err) => {
        this.notify.error(err.error?.message || this.i18n.translate('error.totem_delete'));
        this.deleting.set(null);
      }
    });
  }
}
