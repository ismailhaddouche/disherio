import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TotemService, Totem } from '../../../core/services/totem.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';
import { NotificationService } from '../../../core/services/notification.service';
import { QrCodeComponent } from '../../../shared/components/qr-code.component';
import { ConfirmationService } from '../../../core/services/confirmation.service';

@Component({
  selector: 'app-totem-form',
  standalone: true,
  imports: [
    CommonModule, RouterModule, ReactiveFormsModule, TranslatePipe,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule, QrCodeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-container max-w-3xl">
      <header class="admin-header">
        <div>
          <a routerLink="/admin/totems" class="disher-back-link">
            <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
            {{ 'totem.back' | translate }}
          </a>
          <h1 class="admin-title">
            {{ isEditMode ? ('totem.edit' | translate) : ('totem.new' | translate) }}
          </h1>
        </div>
        <div class="flex gap-3">
          <a matButton routerLink="/admin/totems">{{ 'common.cancel' | translate }}</a>
          <button
            matButton
            type="button"
            (click)="onSubmit()"
            [disabled]="totemForm.invalid || submitting()"
          >
            <mat-icon aria-hidden="true">{{ submitting() ? 'progress_activity' : 'save' }}</mat-icon>
            {{ submitting() ? ('common.saving' | translate) : (isEditMode ? ('totem.save_changes' | translate) : ('totem.create_totem' | translate)) }}
          </button>
        </div>
      </header>

      <form [formGroup]="totemForm" class="admin-card p-6 disher-form">
        <mat-form-field appearance="outline" class="disher-form-field">
          <mat-label>{{ 'totem.name_label' | translate }}</mat-label>
          <input matInput formControlName="totem_name" [placeholder]="i18n.translate('totem.name_placeholder')" required />
          @if (totemForm.get('totem_name')?.invalid && totemForm.get('totem_name')?.touched) {
            <mat-error>{{ 'totem.name_required' | translate }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="disher-form-field">
          <mat-label>{{ 'totem.type_label' | translate }}</mat-label>
          <mat-select formControlName="totem_type" required [disabled]="isEditMode">
            <mat-option value="STANDARD">{{ 'totem.type_standard' | translate }}</mat-option>
            <mat-option value="TEMPORARY">{{ 'totem.type_temporary' | translate }}</mat-option>
          </mat-select>
          <mat-hint>{{ isEditMode
            ? ('totem.type_immutable' | translate)
            : (totemForm.get('totem_type')?.value === 'STANDARD'
              ? ('totem.standard_desc' | translate)
              : ('totem.temporary_desc' | translate)) }}</mat-hint>
        </mat-form-field>

        @if (isEditMode && totem()?.totem_qr) {
          <div class="disher-qr-section">
            <label class="admin-label">{{ 'totem.current_qr' | translate }}</label>
            <div class="flex items-center gap-6">
              <div class="disher-qr-image">
                <app-qr-code
                  [value]="getTotemUrl(totem()!.totem_qr!)"
                  [ariaLabel]="'totem.current_qr' | translate"
                  [size]="150"
                  class="w-28"
                />
              </div>
              <div class="flex-1">
                <p class="disher-qr-url">{{ getTotemUrl(totem()!.totem_qr!) }}</p>
                <button matButton type="button" (click)="copyQrUrl()" class="disher-copy-btn">
                  <mat-icon aria-hidden="true">content_copy</mat-icon>
                  {{ 'totem.copy_url' | translate }}
                </button>
              </div>
            </div>
          </div>
        }

        @if (isEditMode && totem()?._id) {
          <div class="disher-qr-regen">
            <button matButton type="button" (click)="regenerateQr()" [disabled]="regenerating()">
              <mat-icon aria-hidden="true">{{ regenerating() ? 'progress_activity' : 'replay' }}</mat-icon>
              {{ regenerating() ? ('totem.regenerating' | translate) : ('totem.regenerate_qr' | translate) }}
            </button>
          </div>
        }
      </form>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .disher-back-link {
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 4px;
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      transition: color var(--disher-transition-fast);
    }
    .disher-back-link:hover { color: var(--mat-sys-primary); }
    .disher-back-link .material-symbols-outlined { font-size: 18px; }
    .disher-form { display: flex; flex-direction: column; gap: 20px; }
    .disher-form-field { width: 100%; }
    .disher-qr-section {
      padding: 20px;
      border-radius: var(--disher-shape-md);
      background: var(--mat-sys-surface-container-low);
      border: 1px solid var(--mat-sys-outline-variant);
    }
    .disher-qr-image {
      background: var(--mat-sys-surface);
      padding: 12px;
      border-radius: var(--disher-shape-md);
      box-shadow: var(--disher-elevation-1);
    }
    .disher-qr-url {
      font-family: monospace;
      font-size: 14px;
      color: var(--mat-sys-on-surface-variant);
      word-break: break-all;
      padding: 8px 12px;
      border-radius: var(--disher-shape-sm);
      background: var(--mat-sys-surface-container-high);
      margin: 0 0 12px 0;
    }
    .disher-copy-btn { min-height: 36px; }
    .disher-qr-regen {
      padding-top: 16px;
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
  `],
})
export class TotemFormComponent implements OnInit, OnDestroy {
  private confirmation = inject(ConfirmationService);
  private fb = inject(FormBuilder);
  private totemService = inject(TotemService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected i18n = inject(I18nService);
  private notify = inject(NotificationService);
  private destroy$ = new Subject<void>();
  private navigateTimeoutId: ReturnType<typeof setTimeout> | null = null;

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

  ngOnDestroy(): void {
    if (this.navigateTimeoutId !== null) {
      clearTimeout(this.navigateTimeoutId);
      this.navigateTimeoutId = null;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  private scheduleNavigateBack(): void {
    if (this.navigateTimeoutId !== null) {
      clearTimeout(this.navigateTimeoutId);
    }
    this.navigateTimeoutId = setTimeout(() => {
      this.navigateTimeoutId = null;
      void this.router.navigate(['/admin/totems']);
    }, 1500);
  }

  initForm(): void {
    this.totemForm = this.fb.group({
      totem_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      totem_type: ['STANDARD', Validators.required]
    });
  }

  loadTotem(id: string): void {
    this.totemService.getTotem(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (totem) => {
          this.totem.set(totem);
          this.totemForm.patchValue({
            totem_name: totem.totem_name,
            totem_type: totem.totem_type
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
      // totem_type is immutable after creation (enforced server-side); send
      // only the mutable fields so strict validation does not reject the PATCH.
      const updatePayload = { totem_name: formData.totem_name };
      this.totemService.updateTotem(this.totemId, updatePayload)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.submitting.set(false);
            this.notify.success(this.i18n.translate('totem.updated'));
            this.scheduleNavigateBack();
          },
          error: (err) => {
            this.notify.error(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
            this.submitting.set(false);
          }
        });
    } else {
      this.totemService.createTotem(formData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.submitting.set(false);
            this.notify.success(this.i18n.translate('totem.created'));
            this.scheduleNavigateBack();
          },
          error: (err) => {
            this.notify.error(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
            this.submitting.set(false);
          }
        });
    }
  }

  regenerateQr(): void {
    if (!this.totemId) return;
    const totemId = this.totemId;
    this.confirmation.confirm(this.i18n.translate('totem.regenerate_qr') + '?')
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmed => {
        if (!confirmed) return;
        this.regenerating.set(true);
        this.totemService.regenerateQr(totemId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
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

}
