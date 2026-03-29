import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TotemService, Totem } from '../../../services/totem.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-totem-form',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="p-6 max-w-2xl mx-auto">
      <header class="flex items-center justify-between mb-6">
        <div>
          <a routerLink="/admin/totems" class="text-gray-600 dark:text-gray-400 hover:text-primary flex items-center gap-1 mb-2">
            <span class="material-symbols-outlined text-sm">arrow_back</span>
            {{ 'totem.back' | translate }}
          </a>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ isEditMode ? ('totem.edit' | translate) : ('totem.new' | translate) }}
          </h1>
        </div>
        <div class="flex gap-2">
          <a routerLink="/admin/totems" class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium">
            {{ 'common.cancel' | translate }}
          </a>
          <button
            type="button"
            (click)="onSubmit()"
            [disabled]="totemForm.invalid || submitting()"
            class="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
          >
            <span *ngIf="!submitting()">{{ isEditMode ? ('totem.save_changes' | translate) : ('totem.create_totem' | translate) }}</span>
            <span *ngIf="submitting()">{{ 'common.saving' | translate }}</span>
          </button>
        </div>
      </header>

      <!-- Error Alert -->
      <div *ngIf="error()" class="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-6">
        {{ error() }}
      </div>

      <!-- Success Alert -->
      <div *ngIf="success()" class="bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-400 px-4 py-3 rounded mb-6">
        {{ success() }}
      </div>

      <form [formGroup]="totemForm" class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <!-- Name Field -->
        <div class="mb-6">
          <label for="totem_name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ 'totem.name_label' | translate }} *
          </label>
          <input
            id="totem_name"
            type="text"
            formControlName="totem_name"
            placeholder="Ej: Tótem Entrada, Mesa 1, Terraza..."
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            [class.border-red-500]="totemForm.get('totem_name')?.invalid && totemForm.get('totem_name')?.touched"
          />
          <div *ngIf="totemForm.get('totem_name')?.invalid && totemForm.get('totem_name')?.touched" class="text-red-500 text-sm mt-1">
            {{ 'totem.name_required' | translate }}
          </div>
        </div>

        <!-- Type Field -->
        <div class="mb-6">
          <label for="totem_type" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ 'totem.type_label' | translate }} *
          </label>
          <select
            id="totem_type"
            formControlName="totem_type"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="STANDARD">{{ 'totem.type_standard' | translate }}</option>
            <option value="TEMPORARY">{{ 'totem.type_temporary' | translate }}</option>
          </select>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {{ totemForm.get('totem_type')?.value === 'STANDARD'
              ? ('totem.standard_desc' | translate)
              : ('totem.temporary_desc' | translate) }}
          </p>
        </div>

        <!-- QR Code Display (Edit Mode Only) -->
        <div *ngIf="isEditMode && totem()?.totem_qr" class="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ 'totem.current_qr' | translate }}
          </label>
          <div class="flex items-center gap-4">
            <div class="bg-white p-4 rounded-lg">
              <img
                [src]="getQrImageUrl(totem()!.totem_qr!)"
                alt="QR Code"
                class="w-32 h-32"
              />
            </div>
            <div class="flex-1">
              <p class="font-mono text-sm text-gray-600 dark:text-gray-400 break-all">{{ totem()?.totem_qr }}</p>
              <button
                type="button"
                (click)="copyQrUrl()"
                class="mt-2 text-primary hover:underline text-sm"
              >
                {{ 'totem.copy_url' | translate }}
              </button>
            </div>
          </div>
        </div>

        <!-- Regenerate QR Button (Edit Mode Only) -->
        <div *ngIf="isEditMode && totem()?._id" class="pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            (click)="regenerateQr()"
            [disabled]="regenerating()"
            class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <span *ngIf="!regenerating()">{{ 'totem.regenerate_qr' | translate }}</span>
            <span *ngIf="regenerating()">{{ 'totem.regenerating' | translate }}</span>
          </button>
        </div>
      </form>
    </div>
  `
})
export class TotemFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private totemService = inject(TotemService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private i18n = inject(I18nService);

  totemForm!: FormGroup;
  isEditMode = false;
  totemId: string | null = null;

  totem = signal<Totem | null>(null);
  submitting = signal(false);
  regenerating = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  ngOnInit(): void {
    this.initForm();
    
    this.totemId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.totemId;

    if (this.isEditMode && this.totemId) {
      this.loadTotem(this.totemId);
    }
  }

  initForm(): void {
    this.totemForm = this.fb.group({
      totem_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      totem_type: ['STANDARD', Validators.required]
      // totem_start_date se asigna automáticamente en el servidor
    });
  }

  loadTotem(id: string): void {
    this.totemService.getTotem(id).subscribe({
      next: (totem) => {
        this.totem.set(totem);
        this.totemForm.patchValue({
          totem_name: totem.totem_name,
          totem_type: totem.totem_type
          // totem_start_date es asignado por el servidor
        });
      },
      error: (err) => {
        this.error.set(err.error?.message || this.i18n.translate('errors.LOADING_ERROR'));
      }
    });
  }

  onSubmit(): void {
    if (this.totemForm.invalid) {
      this.totemForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.success.set(null);

    const formData = this.totemForm.value;

    if (this.isEditMode && this.totemId) {
      this.totemService.updateTotem(this.totemId, formData).subscribe({
        next: () => {
          this.submitting.set(false);
          this.success.set(this.i18n.translate('totem.updated'));
          setTimeout(() => this.router.navigate(['/admin/totems']), 1500);
        },
        error: (err) => {
          this.error.set(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
          this.submitting.set(false);
        }
      });
    } else {
      this.totemService.createTotem(formData).subscribe({
        next: () => {
          this.submitting.set(false);
          this.success.set(this.i18n.translate('totem.created'));
          setTimeout(() => this.router.navigate(['/admin/totems']), 1500);
        },
        error: (err) => {
          this.error.set(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
          this.submitting.set(false);
        }
      });
    }
  }

  regenerateQr(): void {
    if (!this.totemId || !confirm(this.i18n.translate('totem.regenerate_qr') + '?')) return;

    this.regenerating.set(true);
    this.totemService.regenerateQr(this.totemId).subscribe({
      next: (response) => {
        this.regenerating.set(false);
        this.success.set(this.i18n.translate('totem.qr_regenerated'));
        if (this.totem()) {
          this.totem.set({ ...this.totem()!, totem_qr: response.qr });
        }
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Error al regenerar QR');
        this.regenerating.set(false);
      }
    });
  }

  copyQrUrl(): void {
    const qr = this.totem()?.totem_qr;
    if (qr) {
      navigator.clipboard.writeText(qr).then(() => {
        this.success.set(this.i18n.translate('totem.url_copied'));
        setTimeout(() => this.success.set(null), 2000);
      });
    }
  }

  getQrImageUrl(qrData: string): string {
    return 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(qrData);
  }
}
