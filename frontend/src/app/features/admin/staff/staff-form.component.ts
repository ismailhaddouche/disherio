import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { StaffService, Staff, Role } from '../../../services/staff.service';
import type { Role as RoleType } from '../../../services/staff.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-staff-form',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="p-6 max-w-2xl mx-auto">
      <header class="flex items-center justify-between mb-6">
        <div>
          <a routerLink="/admin/staff" class="text-gray-600 dark:text-gray-400 hover:text-primary flex items-center gap-1 mb-2">
            <span class="material-symbols-outlined text-sm">arrow_back</span>
            {{ 'staff.back' | translate }}
          </a>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ isEditMode ? ('staff.save_changes' | translate) : ('staff.new' | translate) }}
          </h1>
        </div>
        <div class="flex gap-2">
          <a routerLink="/admin/staff" class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium">
            {{ 'common.cancel' | translate }}
          </a>
          <button
            type="button"
            (click)="onSubmit()"
            [disabled]="staffForm.invalid || submitting()"
            class="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
          >
            <span *ngIf="!submitting()">{{ isEditMode ? ('staff.save_changes' | translate) : ('staff.create_staff' | translate) }}</span>
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

      <form [formGroup]="staffForm" class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">

        <!-- Name Field -->
        <div class="mb-6">
          <label for="staff_name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ 'staff.full_name' | translate }} *
          </label>
          <input
            id="staff_name"
            type="text"
            formControlName="staff_name"
            placeholder="Ej: Juan Pérez"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            [class.border-red-500]="staffForm.get('staff_name')?.invalid && staffForm.get('staff_name')?.touched"
          />
          <div *ngIf="staffForm.get('staff_name')?.invalid && staffForm.get('staff_name')?.touched" class="text-red-500 text-sm mt-1">
            {{ 'staff.name_required' | translate }}
          </div>
        </div>

        <!-- Username Field -->
        <div class="mb-6">
          <label for="username" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ 'staff.username_label' | translate }} *
          </label>
          <input
            id="username"
            type="text"
            formControlName="username"
            placeholder="juan.perez"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent lowercase"
            [class.border-red-500]="staffForm.get('username')?.invalid && staffForm.get('username')?.touched"
          />
          <div *ngIf="staffForm.get('username')?.invalid && staffForm.get('username')?.touched" class="text-red-500 text-sm mt-1">
            {{ 'staff.username_required' | translate }}
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {{ 'staff.username_hint' | translate }}
          </p>
        </div>

        <!-- Role Field -->
        <div class="mb-6">
          <label for="role_id" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ 'staff.column_role' | translate }} *
          </label>
          <select
            id="role_id"
            formControlName="role_id"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            [class.border-red-500]="staffForm.get('role_id')?.invalid && staffForm.get('role_id')?.touched"
            [disabled]="loadingRoles()"
          >
            <option value="">{{ loadingRoles() ? ('common.loading' | translate) : ('staff.select_role' | translate) }}</option>
            <option *ngFor="let role of roles()" [value]="role._id">{{ role.role_name }}</option>
          </select>
          <div *ngIf="staffForm.get('role_id')?.invalid && staffForm.get('role_id')?.touched && !loadingRoles()" class="text-red-500 text-sm mt-1">
            {{ 'staff.select_role' | translate }}
          </div>
          <div *ngIf="roles().length === 0 && !loadingRoles()" class="text-amber-600 text-sm mt-1">
            {{ 'staff.no_roles' | translate }}
          </div>
          <div *ngIf="roles().length > 0" class="text-green-600 text-sm mt-1">
            {{ roles().length }} {{ 'staff.column_role' | translate }}(s): {{ roles().map(r => r.role_name).join(', ') }}
          </div>
        </div>

        <!-- Password Field -->
        <div class="mb-6">
          <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ 'auth.login.password' | translate }} {{ isEditMode ? ('staff.password_keep' | translate) : '*' }}
          </label>
          <input
            id="password"
            type="password"
            formControlName="password"
            placeholder="Mínimo 6 caracteres"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            [class.border-red-500]="staffForm.get('password')?.invalid && staffForm.get('password')?.touched"
          />
          <div *ngIf="staffForm.get('password')?.invalid && staffForm.get('password')?.touched" class="text-red-500 text-sm mt-1">
            {{ 'staff.password_min' | translate }}
          </div>
        </div>

        <!-- PIN Field -->
        <div class="mb-6">
          <label for="pin_code" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ 'auth.login.pin' | translate }} {{ isEditMode ? ('staff.password_keep' | translate) : '*' }}
          </label>
          <input
            id="pin_code"
            type="password"
            formControlName="pin_code"
            placeholder="4 dígitos numéricos"
            maxlength="4"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            [class.border-red-500]="staffForm.get('pin_code')?.invalid && staffForm.get('pin_code')?.touched"
          />
          <div *ngIf="staffForm.get('pin_code')?.invalid && staffForm.get('pin_code')?.touched" class="text-red-500 text-sm mt-1">
            {{ 'staff.pin_invalid' | translate }}
          </div>
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
  private i18n = inject(I18nService);
  private destroy$ = new Subject<void>();
  private navigationTimeout: ReturnType<typeof setTimeout> | null = null;

  staffForm!: FormGroup;
  isEditMode = false;
  staffId: string | null = null;

  roles = signal<Role[]>([]);
  loadingRoles = signal(false);
  submitting = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  ngOnInit(): void {
    this.initForm();
    
    this.staffId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.staffId;

    // Cargar roles primero, luego el staff para evitar condición de carrera
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
            this.error.set(this.i18n.translate('errors.LOADING_ERROR'));
            this.loadingRoles.set(false);
            resolve(); // Resolvemos igual para no bloquear el flujo
          }
        });
    });
  }

  loadStaff(id: string): void {
    this.staffService.getStaffMember(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (staff) => {
          // role_id puede ser string o objeto poblado (Role)
          // Asegurar que siempre sea string para el formulario
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
          this.error.set(err.error?.message || 'Error al cargar el personal');
        }
      });
  }

  onSubmit(): void {
    if (this.staffForm.invalid) {
      this.staffForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.success.set(null);

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
            this.success.set(this.i18n.translate('staff.updated'));
            this.navigationTimeout = setTimeout(() => this.router.navigate(['/admin/staff']), 1500);
          },
          error: (err) => {
            this.error.set(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
            this.submitting.set(false);
          }
        });
    } else {
      this.staffService.createStaff(formData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.submitting.set(false);
            this.success.set(this.i18n.translate('staff.created'));
            this.navigationTimeout = setTimeout(() => this.router.navigate(['/admin/staff']), 1500);
          },
          error: (err) => {
            this.error.set(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
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
