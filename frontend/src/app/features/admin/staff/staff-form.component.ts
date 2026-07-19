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
import { StaffService, Staff, Role } from '../../../core/services/staff.service';
import type { Role as RoleType } from '../../../core/services/staff.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-staff-form',
  standalone: true,
  imports: [
    CommonModule, RouterModule, ReactiveFormsModule, TranslatePipe,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-container max-w-3xl">
      <header class="admin-header">
        <div>
          <a routerLink="/admin/staff" class="disher-back-link">
            <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
            {{ 'staff.back' | translate }}
          </a>
          <h1 class="admin-title">
            {{ isEditMode ? ('staff.save_changes' | translate) : ('staff.new' | translate) }}
          </h1>
        </div>
        <div class="flex gap-3">
          <a matButton routerLink="/admin/staff">{{ 'common.cancel' | translate }}</a>
          <button
            matButton
            type="button"
            (click)="onSubmit()"
            [disabled]="staffForm.invalid || submitting()"
          >
            <mat-icon aria-hidden="true">{{ submitting() ? 'progress_activity' : 'save' }}</mat-icon>
            {{ submitting() ? ('common.saving' | translate) : (isEditMode ? ('staff.save_changes' | translate) : ('staff.create_staff' | translate)) }}
          </button>
        </div>
      </header>

      <form [formGroup]="staffForm" class="admin-card p-6 disher-form">
        <mat-form-field appearance="outline" class="disher-form-field">
          <mat-label>{{ 'staff.full_name' | translate }}</mat-label>
          <input matInput formControlName="staff_name" [placeholder]="i18n.translate('staff.name_placeholder')" required />
          @if (staffForm.get('staff_name')?.invalid && staffForm.get('staff_name')?.touched) {
            <mat-error>{{ 'staff.name_required' | translate }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="disher-form-field">
          <mat-label>{{ 'staff.username_label' | translate }}</mat-label>
          <input matInput formControlName="username" [placeholder]="i18n.translate('staff.username_placeholder')" required />
          @if (staffForm.get('username')?.invalid && staffForm.get('username')?.touched) {
            <mat-error>{{ 'staff.username_required' | translate }}</mat-error>
          }
          <mat-hint>{{ 'staff.username_hint' | translate }}</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="disher-form-field">
          <mat-label>{{ 'staff.column_role' | translate }}</mat-label>
          <mat-select formControlName="role_id" required [disabled]="loadingRoles()">
            <mat-option value="">{{ loadingRoles() ? ('common.loading' | translate) : ('staff.select_role' | translate) }}</mat-option>
            @for (role of roles(); track role._id) {
              <mat-option [value]="role._id">{{ role.role_name }}</mat-option>
            }
          </mat-select>
          @if (staffForm.get('role_id')?.invalid && staffForm.get('role_id')?.touched && !loadingRoles()) {
            <mat-error>{{ 'staff.select_role' | translate }}</mat-error>
          }
          @if (roles().length === 0 && !loadingRoles()) {
            <mat-hint class="disher-warn-hint">{{ 'staff.no_roles' | translate }}</mat-hint>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="disher-form-field">
          <mat-label>{{ 'auth.login.password' | translate }} {{ isEditMode ? ('staff.password_keep' | translate) : '' }}</mat-label>
          <input matInput type="password" formControlName="password" [placeholder]="i18n.translate('staff.password_placeholder')" [required]="!isEditMode" />
          @if (staffForm.get('password')?.invalid && staffForm.get('password')?.touched) {
            <mat-error>{{ 'staff.password_min' | translate }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="disher-form-field">
          <mat-label>{{ 'auth.login.pin' | translate }} {{ isEditMode ? ('staff.password_keep' | translate) : '' }}</mat-label>
          <input matInput type="password" formControlName="pin_code" [placeholder]="i18n.translate('staff.pin_placeholder')" maxlength="4" [required]="!isEditMode" />
          @if (staffForm.get('pin_code')?.invalid && staffForm.get('pin_code')?.touched) {
            <mat-error>{{ 'staff.pin_invalid' | translate }}</mat-error>
          }
          <mat-hint>{{ 'staff.pin_hint' | translate }}</mat-hint>
        </mat-form-field>
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
    .disher-warn-hint { color: var(--mat-sys-tertiary); }
  `],
})
export class StaffFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private staffService = inject(StaffService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected i18n = inject(I18nService);
  private notify = inject(NotificationService);
  private destroy$ = new Subject<void>();
  private navigationTimeout: ReturnType<typeof setTimeout> | null = null;

  staffForm!: FormGroup;
  isEditMode = false;
  staffId: string | null = null;

  roles = signal<Role[]>([]);
  loadingRoles = signal(false);
  submitting = signal(false);

  ngOnInit(): void {
    this.initForm();
    this.staffId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.staffId;
    this.loadRoles().then(() => {
      if (this.isEditMode && this.staffId) {
        this.loadStaff(this.staffId);
      }
    });
  }

  initForm(): void {
    const passwordValidators = this.isEditMode ? [] : [Validators.required, Validators.minLength(6)];
    const pinValidators = this.isEditMode ? [] : [Validators.required, Validators.pattern('^\\d{4}$')];

    this.staffForm = this.fb.group({
      staff_name: ['', [Validators.required, Validators.minLength(2)]],
      username: ['', [Validators.required, Validators.minLength(3), Validators.pattern('^[a-z0-9.]+$')]],
      role_id: ['', Validators.required],
      password: ['', passwordValidators],
      pin_code: ['', pinValidators]
    });
  }

  loadRoles(): Promise<void> {
    return new Promise((resolve) => {
      this.loadingRoles.set(true);
      this.staffService.getRoles()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (roles) => {
            this.roles.set(roles);
            this.loadingRoles.set(false);
            resolve();
          },
          error: () => {
            this.notify.error(this.i18n.translate('errors.LOADING_ERROR'));
            this.loadingRoles.set(false);
            resolve();
          }
        });
    });
  }

  loadStaff(id: string): void {
    this.staffService.getStaffMember(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (staff) => {
          let roleId = '';
          if (typeof staff.role_id === 'string') {
            roleId = staff.role_id;
          } else if (staff.role_id && typeof staff.role_id === 'object') {
            roleId = (staff.role_id as RoleType)._id?.toString() || '';
          }

          this.staffForm.patchValue({
            staff_name: staff.staff_name,
            username: staff.username,
            role_id: roleId
          });
          this.staffForm.get('password')?.setValidators([]);
          this.staffForm.get('password')?.updateValueAndValidity();
          this.staffForm.get('pin_code')?.setValidators([]);
          this.staffForm.get('pin_code')?.updateValueAndValidity();
        },
        error: (err) => {
          this.notify.error(err.error?.message || this.i18n.translate('error.staff_loading'));
        }
      });
  }

  onSubmit(): void {
    if (this.staffForm.invalid) {
      this.staffForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const formData = this.staffForm.value;

    if (this.isEditMode) {
      if (!formData.password) delete formData.password;
      if (!formData.pin_code) delete formData.pin_code;
    }

    if (this.isEditMode && this.staffId) {
      this.staffService.updateStaff(this.staffId, formData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.submitting.set(false);
            this.notify.success(this.i18n.translate('staff.updated'));
            this.navigationTimeout = setTimeout(() => this.router.navigate(['/admin/staff']), 1500);
          },
          error: (err) => {
            this.notify.error(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
            this.submitting.set(false);
          }
        });
    } else {
      this.staffService.createStaff(formData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.submitting.set(false);
            this.notify.success(this.i18n.translate('staff.created'));
            this.navigationTimeout = setTimeout(() => this.router.navigate(['/admin/staff']), 1500);
          },
          error: (err) => {
            this.notify.error(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
            this.submitting.set(false);
          }
        });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.navigationTimeout) {
      clearTimeout(this.navigationTimeout);
    }
  }
}