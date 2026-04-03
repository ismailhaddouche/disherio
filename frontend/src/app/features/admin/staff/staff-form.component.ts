import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { StaffService, Staff, Role } from '../../../services/staff.service';
import type { Role as RoleType } from '../../../services/staff.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-staff-form',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-container max-w-3xl">
      <header class="admin-header">
        <div>
          <a routerLink="/admin/staff" class="text-gray-500 dark:text-gray-400 hover:text-primary flex items-center gap-1 mb-1 text-sm font-medium transition-colors">
            <span class="material-symbols-outlined text-sm">arrow_back</span>
            {{ 'staff.back' | translate }}
          </a>
          <h1 class="admin-title">
            {{ isEditMode ? ('staff.save_changes' | translate) : ('staff.new' | translate) }}
          </h1>
        </div>
        <div class="flex gap-3">
          <a routerLink="/admin/staff" class="btn-admin btn-secondary">
            {{ 'common.cancel' | translate }}
          </a>
          <button
            type="button"
            (click)="onSubmit()"
            [disabled]="staffForm.invalid || submitting()"
            class="btn-admin btn-primary"
          >
            @if (submitting()) {
              <span class="material-symbols-outlined animate-spin text-sm">refresh</span>
              {{ 'common.saving' | translate }}
            } @else {
              <span class="material-symbols-outlined text-sm">save</span>
              {{ isEditMode ? ('staff.save_changes' | translate) : ('staff.create_staff' | translate) }}
            }
          </button>
        </div>
      </header>

      <form [formGroup]="staffForm" class="admin-card p-6">
        <!-- Name Field -->
        <div class="mb-5">
          <label for="staff_name" class="admin-label">
            {{ 'staff.full_name' | translate }} *
          </label>
          <input
            id="staff_name"
            type="text"
            formControlName="staff_name"
            [placeholder]="i18n.translate('staff.name_placeholder')"
            class="admin-input"
            [class.border-red-500]="staffForm.get('staff_name')?.invalid && staffForm.get('staff_name')?.touched"
          />
          @if (staffForm.get('staff_name')?.invalid && staffForm.get('staff_name')?.touched) {
            <div class="text-red-500 text-sm mt-1">
              {{ 'staff.name_required' | translate }}
            </div>
          }
        </div>

        <!-- Username Field -->
        <div class="mb-5">
          <label for="username" class="admin-label">
            {{ 'staff.username_label' | translate }} *
          </label>
          <input
            id="username"
            type="text"
            formControlName="username"
            [placeholder]="i18n.translate('staff.username_placeholder')"
            class="admin-input lowercase"
            [class.border-red-500]="staffForm.get('username')?.invalid && staffForm.get('username')?.touched"
          />
          @if (staffForm.get('username')?.invalid && staffForm.get('username')?.touched) {
            <div class="text-red-500 text-sm mt-1">
              {{ 'staff.username_required' | translate }}
            </div>
          }
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {{ 'staff.username_hint' | translate }}
          </p>
        </div>

        <!-- Role Field -->
        <div class="mb-5">
          <label for="role_id" class="admin-label">
            {{ 'staff.column_role' | translate }} *
          </label>
          <select
            id="role_id"
            formControlName="role_id"
            class="admin-select"
            [class.border-red-500]="staffForm.get('role_id')?.invalid && staffForm.get('role_id')?.touched"
            [disabled]="loadingRoles()"
          >
            <option value="">{{ loadingRoles() ? ('common.loading' | translate) : ('staff.select_role' | translate) }}</option>
            @for (role of roles(); track role._id) {
              <option [value]="role._id">{{ role.role_name }}</option>
            }
          </select>
          @if (staffForm.get('role_id')?.invalid && staffForm.get('role_id')?.touched && !loadingRoles()) {
            <div class="text-red-500 text-sm mt-1">
              {{ 'staff.select_role' | translate }}
            </div>
          }
          @if (roles().length === 0 && !loadingRoles()) {
            <div class="text-amber-600 text-sm mt-1">
              {{ 'staff.no_roles' | translate }}
            </div>
          }
          @if (roles().length > 0) {
            <div class="text-green-600 text-sm mt-1">
              {{ roles().length }} {{ 'staff.column_role' | translate }}(s): {{ roles().map(r => r.role_name).join(', ') }}
            </div>
          }
        </div>

        <!-- Password Field -->
        <div class="mb-5">
          <label for="password" class="admin-label">
            {{ 'auth.login.password' | translate }} {{ isEditMode ? ('staff.password_keep' | translate) : '*' }}
          </label>
          <input
            id="password"
            type="password"
            formControlName="password"
            [placeholder]="i18n.translate('staff.password_placeholder')"
            class="admin-input"
            [class.border-red-500]="staffForm.get('password')?.invalid && staffForm.get('password')?.touched"
          />
          @if (staffForm.get('password')?.invalid && staffForm.get('password')?.touched) {
            <div class="text-red-500 text-sm mt-1">
              {{ 'staff.password_min' | translate }}
            </div>
          }
        </div>

        <!-- PIN Field -->
        <div class="mb-5">
          <label for="pin_code" class="admin-label">
            {{ 'auth.login.pin' | translate }} {{ isEditMode ? ('staff.password_keep' | translate) : '*' }}
          </label>
          <input
            id="pin_code"
            type="password"
            formControlName="pin_code"
            [placeholder]="i18n.translate('staff.pin_placeholder')"
            maxlength="4"
            class="admin-input"
            [class.border-red-500]="staffForm.get('pin_code')?.invalid && staffForm.get('pin_code')?.touched"
          />
          @if (staffForm.get('pin_code')?.invalid && staffForm.get('pin_code')?.touched) {
            <div class="text-red-500 text-sm mt-1">
              {{ 'staff.pin_invalid' | translate }}
            </div>
          }
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {{ 'staff.pin_hint' | translate }}
          </p>
        </div>
      </form>
    </div>
  `
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

    // Load roles first, then staff to avoid race condition
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
            resolve(); // Resolve anyway to avoid blocking the flow
          }
        });
    });
  }

  loadStaff(id: string): void {
    this.staffService.getStaffMember(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (staff) => {
          // role_id can be a string or a populated object (Role)
          // Ensure it is always a string for the form
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
          // Clear password validators in edit mode
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
    
    // Remove empty password fields in edit mode
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
