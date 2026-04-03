import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TotemService, Totem } from '../../../services/totem.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-totem-form',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-container max-w-3xl">
      <header class="admin-header">
        <div>
          <a routerLink="/admin/totems" class="text-gray-500 dark:text-gray-400 hover:text-primary flex items-center gap-1 mb-1 text-sm font-medium transition-colors">
            <span class="material-symbols-outlined text-sm">arrow_back</span>
            {{ 'totem.back' | translate }}
          </a>
          <h1 class="admin-title">
            {{ isEditMode ? ('totem.edit' | translate) : ('totem.new' | translate) }}
          </h1>
        </div>
        <div class="flex gap-3">
          <a routerLink="/admin/totems" class="btn-admin btn-secondary">
            {{ 'common.cancel' | translate }}
          </a>
          <button
            type="button"
            (click)="onSubmit()"
            [disabled]="totemForm.invalid || submitting()"
            class="btn-admin btn-primary"
          >
            @if (submitting()) {
              <span class="material-symbols-outlined animate-spin text-sm">refresh</span>
              {{ 'common.saving' | translate }}
            } @else {
              <span class="material-symbols-outlined text-sm">save</span>
              {{ isEditMode ? ('totem.save_changes' | translate) : ('totem.create_totem' | translate) }}
            }
          </button>
        </div>
      </header>

      <form [formGroup]="totemForm" class="admin-card p-6">
        <!-- Name Field -->
        <div class="mb-5">
          <label for="totem_name" class="admin-label">
            {{ 'totem.name_label' | translate }} *
          </label>
          <input
            id="totem_name"
            type="text"
            formControlName="totem_name"
            [placeholder]="i18n.translate('totem.name_placeholder')"
            class="admin-input"
            [class.border-red-500]="totemForm.get('totem_name')?.invalid && totemForm.get('totem_name')?.touched"
          />
          @if (totemForm.get('totem_name')?.invalid && totemForm.get('totem_name')?.touched) {
            <div class="text-red-500 text-sm mt-1">
              {{ 'totem.name_required' | translate }}
            </div>
          }
        </div>

        <!-- Type Field -->
        <div class="mb-5">
          <label for="totem_type" class="admin-label">
            {{ 'totem.type_label' | translate }} *
          </label>
          <select
            id="totem_type"
            formControlName="totem_type"
            class="admin-select"
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
        @if (isEditMode && totem()?.totem_qr) {
          <div class="mb-5 p-5 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <label class="admin-label mb-3">
              {{ 'totem.current_qr' | translate }}
            </label>
            <div class="flex items-center gap-6">
              <div class="bg-white p-3 rounded-xl shadow-sm">
                <img
                  [src]="getQrImageUrl(totem()!.totem_qr!)"
                  alt="QR Code"
                  class="w-28 h-28"
                />
              </div>
              <div class="flex-1">
                <p class="font-mono text-sm text-gray-600 dark:text-gray-400 break-all bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg">{{ getTotemUrl(totem()!.totem_qr!) }}</p>
                <button
                  type="button"
                  (click)="copyQrUrl()"
                  class="mt-3 text-primary hover:underline text-sm font-medium flex items-center gap-1"
                >
                  <span class="material-symbols-outlined text-sm">content_copy</span>
                  {{ 'totem.copy_url' | translate }}
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Regenerate QR Button (Edit Mode Only) -->
        @if (isEditMode && totem()?._id) {
          <div class="pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              (click)="regenerateQr()"
              [disabled]="regenerating()"
              class="btn-admin btn-secondary"
            >
              @if (regenerating()) {
                <span class="material-symbols-outlined animate-spin text-sm">refresh</span>
                {{ 'totem.regenerating' | translate }}
              } @else {
                <span class="material-symbols-outlined text-sm">replay</span>
                {{ 'totem.regenerate_qr' | translate }}
              }
            </button>
          </div>
        }
      </form>
    </div>
  `
})
export class TotemFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private totemService = inject(TotemService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected i18n = inject(I18nService);
  private notify = inject(NotificationService);

  totemForm!: FormGroup;
  isEditMode = false;
  totemId: string | null = null;

  totem = signal<Totem | null>(null);
  submitting = signal(false);
  regenerating = signal(false);

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
      // totem_start_date is automatically assigned on the server
    });
  }

  loadTotem(id: string): void {
    this.totemService.getTotem(id).subscribe({
      next: (totem) => {
        this.totem.set(totem);
        this.totemForm.patchValue({
          totem_name: totem.totem_name,
          totem_type: totem.totem_type
          // totem_start_date is assigned by the server
        });
      },
      error: (err) => {
        this.notify.error(err.error?.message || this.i18n.translate('errors.LOADING_ERROR'));
      }
    });
  }

  onSubmit(): void {
    if (this.totemForm.invalid) {
      this.totemForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);

    const formData = this.totemForm.value;

    if (this.isEditMode && this.totemId) {
      this.totemService.updateTotem(this.totemId, formData).subscribe({
        next: () => {
          this.submitting.set(false);
          this.notify.success(this.i18n.translate('totem.updated'));
          setTimeout(() => this.router.navigate(['/admin/totems']), 1500);
        },
        error: (err) => {
          this.notify.error(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
          this.submitting.set(false);
        }
      });
    } else {
      this.totemService.createTotem(formData).subscribe({
        next: () => {
          this.submitting.set(false);
          this.notify.success(this.i18n.translate('totem.created'));
          setTimeout(() => this.router.navigate(['/admin/totems']), 1500);
        },
        error: (err) => {
          this.notify.error(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
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
        this.notify.success(this.i18n.translate('totem.qr_regenerated'));
        if (this.totem()) {
          this.totem.set({ ...this.totem()!, totem_qr: response.qr });
        }
      },
      error: (err) => {
        this.notify.error(err.error?.message || this.i18n.translate('error.qr_regenerate'));
        this.regenerating.set(false);
      }
    });
  }

  copyQrUrl(): void {
    const qr = this.totem()?.totem_qr;
    if (qr) {
      navigator.clipboard.writeText(this.getTotemUrl(qr)).then(() => {
        this.notify.success(this.i18n.translate('totem.url_copied'));
      });
    }
  }

  getTotemUrl(qrData: string): string {
    return `${window.location.origin}/menu/${qrData}`;
  }

  getQrImageUrl(qrData: string): string {
    const totemUrl = this.getTotemUrl(qrData);
    return 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(totemUrl);
  }
}
