import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserManagementViewModel } from './user-management.viewmodel';
import { AuthService } from '../../services/auth.service';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, TranslateModule],
  providers: [UserManagementViewModel],
  template: `
    <div class="user-management-container">
      @if (vm.editingUser(); as editUser) {
        <!-- Edit View -->
        <header class="section-header-md3">
          <div class="header-content">
            <div class="title-with-icon">
              <div class="icon-box-md3 primary">
                <lucide-icon name="pen-line" [size]="24"></lucide-icon>
              </div>
              <div>
                <h2 class="text-headline-medium">{{ 'USER_MGMT.EDITING' | translate }} {{ editUser.username }}</h2>
                <div class="subtitle-badge-row">
                  <span class="text-body-small opacity-60">{{ 'USER_MGMT.SYSTEM_ROLE' | translate }}</span>
                  <div class="md-badge-tonal-sm" [class]="editUser.role">{{ 'ROLES.' + editUser.role | translate }}</div>
                </div>
              </div>
            </div>
            <button class="btn-tonal" (click)="vm.closeEditModal()">
              <lucide-icon name="chevron-left" [size]="18"></lucide-icon>
              <span>{{ 'USER_MGMT.GO_BACK' | translate }}</span>
            </button>
          </div>
        </header>

        <main class="edit-main-md3">
          <div class="edit-card-md3 animate-fade-in">
            <h3 class="text-title-large mb-24">{{ 'USER_MGMT.ACCESS_DATA' | translate }}</h3>
            
            <div class="md-form-grid">
              <div class="md-field">
                <label class="text-label-medium">{{ 'USER_MGMT.USERNAME' | translate }}</label>
                <input type="text" [(ngModel)]="editUser.username" class="md-input" [placeholder]="'USER_MGMT.USERNAME' | translate">
              </div>

              <div class="md-field">
                <label class="text-label-medium">{{ 'USER_MGMT.NEW_PASS' | translate }} <small class="opacity-60">({{ 'USER_MGMT.OPTIONAL' | translate }})</small></label>
                <input type="password" [(ngModel)]="editUser.password" class="md-input" placeholder="********">
              </div>
            </div>

            <div class="divider-md3 mt-32 mb-32"></div>

            <h3 class="text-title-large mb-24">{{ 'USER_MGMT.PRINT_CONFIG' | translate }}</h3>

            <div class="md-field mb-24">
              <label class="text-label-medium">{{ 'USER_MGMT.DEF_PRINTER' | translate }}</label>
              <select [(ngModel)]="editUser.printerId" class="md-select">
                <option [ngValue]="null">{{ 'USER_MGMT.NO_PRINTER_T' | translate }}</option>
                @for (printer of vm.printers(); track printer.id) {
                  <option [value]="printer.id">{{ printer.name }} ({{ printer.type }})</option>
                }
              </select>
            </div>

            <div class="md-form-grid">
              <div class="md-field">
                <label class="text-label-medium">{{ 'USER_MGMT.HEADER_MSG' | translate }}</label>
                <input type="text" [(ngModel)]="editUser.printTemplate.header" class="md-input" [placeholder]="'USER_MGMT.HEADER_PH' | translate">
              </div>

              <div class="md-field">
                <label class="text-label-medium">{{ 'USER_MGMT.FOOTER_MSG' | translate }}</label>
                <input type="text" [(ngModel)]="editUser.printTemplate.footer" class="md-input" [placeholder]="'USER_MGMT.FOOTER_PH' | translate">
              </div>
            </div>

            <div class="edit-actions-md3">
              <button class="btn-primary" (click)="vm.saveUser()">
                <lucide-icon name="save" [size]="20"></lucide-icon>
                <span>{{ 'USER_MGMT.SAVE' | translate }}</span>
              </button>
            </div>
          </div>
        </main>
      } @else {
        <!-- List View -->
        <header class="section-header-md3">
          <div class="header-content">
            <div class="title-with-icon">
              <div class="icon-box-md3 primary">
                <lucide-icon name="users" [size]="24"></lucide-icon>
              </div>
              <div>
                <h1 class="text-headline-medium">{{ 'ROLES.Admin' | translate }} - Usuarios</h1>
                <p class="text-body-small opacity-60">{{ 'USER_MGMT.SUBTITLE' | translate }}</p>
              </div>
            </div>
            
            <div class="user-add-controls-md3">
              <input type="text" #usernameInput [placeholder]="'USER_MGMT.NEW_USER_PH' | translate" class="md-input-sm">
              <select #roleInput class="md-select-sm">
                <option value="waiter">{{ 'ROLES.waiter' | translate }}</option>
                <option value="kitchen">{{ 'ROLES.kitchen' | translate }}</option>
                <option value="pos">{{ 'ROLES.pos' | translate }}</option>
                <option value="admin">{{ 'ROLES.admin' | translate }}</option>
              </select>
              <button class="btn-primary btn-sm" (click)="vm.addUser(usernameInput.value, roleInput.value); usernameInput.value=''">
                <lucide-icon name="plus" [size]="18"></lucide-icon>
                <span>{{ 'USER_MGMT.CREATE_USER' | translate }}</span>
              </button>
            </div>
          </div>
        </header>
          
        <main class="users-main-md3">
          @if (vm.loading()) {
            <div class="md-loading-state">
              <div class="spinner"></div>
              <p class="text-body-medium opacity-60">{{ 'USER_MGMT.LOADING' | translate }}</p>
            </div>
          }

          @if (vm.error()) {
            <div class="md-alert-error mb-24">
              <lucide-icon name="alert-circle" [size]="20"></lucide-icon>
              <span>{{ vm.error() }}</span>
            </div>
          }
          
          <div class="users-grid-md3">
            @for (user of vm.users(); track user._id) {
              <div class="user-card-md3 animate-fade-in">
                <div class="card-top-md3">
                  <div class="user-avatar-md3" [class]="user.role">
                    <lucide-icon name="user" [size]="24"></lucide-icon>
                  </div>
                  <div class="user-meta-md3">
                    <span class="text-title-large">{{ user.username }}</span>
                    <div class="md-badge-tonal-sm" [class]="user.role">{{ 'ROLES.' + user.role | translate }}</div>
                  </div>
                </div>

                <div class="card-details-md3">
                  <div class="detail-item-md3">
                    <lucide-icon name="printer" [size]="16" class="opacity-60"></lucide-icon>
                    <span class="text-body-small">
                      {{ user.printerId ? ('USER_MGMT.PRINTER_ASSIGNED' | translate) : ('USER_MGMT.NO_PRINTER' | translate) }}
                    </span>
                  </div>
                </div>
                
                <div class="card-actions-md3">
                  <button class="btn-tonal btn-sm flex-1" (click)="vm.openEditModal(user)">
                    <lucide-icon name="pen-line" [size]="16"></lucide-icon>
                    <span>{{ 'USER_MGMT.EDIT' | translate }}</span>
                  </button>
                  
                  @if (user.username !== 'admin') {
                    <button class="icon-btn-md3 error-tonal" (click)="vm.deleteUser(user._id)" [title]="'COMMON.DELETE' | translate">
                      <lucide-icon name="trash-2" [size]="18"></lucide-icon>
                    </button>
                  } @else {
                    <div class="system-lock-md3" [title]="'USER_MGMT.SYSTEM' | translate">
                      <lucide-icon name="lock" [size]="16"></lucide-icon>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </main>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .user-management-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--md-sys-color-surface-container-low);
    }

    .subtitle-badge-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 4px;
    }

    /* List View Layout */
    .users-main-md3 {
      flex: 1;
      padding: 24px 32px;
      overflow-y: auto;
    }

    .user-add-controls-md3 {
      display: flex;
      gap: 16px;
      align-items: center;
    }

    .users-grid-md3 {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
    }

    /* User Card MD3 */
    .user-card-md3 {
      background: var(--md-sys-color-surface-container-high);
      border-radius: 24px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      transition: all 0.2s;
      border: 1px solid var(--md-sys-color-outline-variant);
    }
    .user-card-md3:hover {
      background: var(--md-sys-color-surface-container-highest);
      transform: translateY(-2px);
      box-shadow: var(--md-sys-elevation-1);
    }

    .card-top-md3 {
      display: flex;
      gap: 16px;
      align-items: center;
    }

    .user-avatar-md3 {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--md-sys-color-secondary-container);
      color: var(--md-sys-color-on-secondary-container);
    }
    .user-avatar-md3.admin { background: var(--md-sys-color-tertiary-container); color: var(--md-sys-color-on-tertiary-container); }
    .user-avatar-md3.kitchen { background: #fef3c7; color: #92400e; }
    .user-avatar-md3.waiter { background: #d1fae5; color: #065f46; }

    .user-meta-md3 {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .card-details-md3 {
      padding: 12px 16px;
      background: var(--md-sys-color-surface-container-low);
      border-radius: 12px;
    }

    .detail-item-md3 {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .card-actions-md3 {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: auto;
    }

    .system-lock-md3 {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--md-sys-color-on-surface-variant);
      opacity: 0.5;
    }

    /* Edit View Layout */
    .edit-main-md3 {
      flex: 1;
      padding: 32px;
      overflow-y: auto;
      display: flex;
      justify-content: center;
    }

    .edit-card-md3 {
      width: 100%;
      max-width: 800px;
      background: var(--md-sys-color-surface-container-low);
      border-radius: 28px;
      padding: 32px;
      border: 1px solid var(--md-sys-color-outline-variant);
    }

    .md-form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .edit-actions-md3 {
      margin-top: 40px;
      display: flex;
      justify-content: flex-end;
    }

    .mb-24 { margin-bottom: 24px; }
    .mb-32 { margin-bottom: 32px; }
    .mt-32 { margin-top: 32px; }
    .opacity-60 { opacity: 0.6; }
    .flex-1 { flex: 1; }

    .md-loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      gap: 16px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid var(--md-sys-color-secondary-container);
      border-top-color: var(--md-sys-color-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .user-add-controls-md3 {
        flex-direction: column;
        width: 100%;
        gap: 12px;
      }
      .user-add-controls-md3 .md-input-sm,
      .user-add-controls-md3 .md-select-sm,
      .user-add-controls-md3 .btn-sm {
        width: 100%;
      }
      .users-grid-md3 { grid-template-columns: 1fr; }
      .md-form-grid { grid-template-columns: 1fr; }
      .edit-main-md3 { padding: 16px; }
      .edit-card-md3 { padding: 20px; }
    }
  `]
})
export class UserManagementComponent {
  public vm = inject(UserManagementViewModel);
}
