import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, TranslateModule],
  template: `
    <div class="sidebar-overlay" [class.visible]="isCollapsed" (click)="toggleSidebar()" aria-hidden="true"></div>
    <aside class="sidebar" [class.collapsed]="isCollapsed" [attr.aria-expanded]="isCollapsed">
      <div class="sidebar-header">
        <div class="logo-container">
          <div class="logo-box">
            <lucide-icon name="chef-hat" [size]="20" color="white"></lucide-icon>
          </div>
          <span class="text-title-large" *ngIf="!isCollapsed">Disher<span class="logo-dot">.</span>io</span>
        </div>
        <button class="md-icon-button"
                (click)="toggleSidebar()"
                [attr.aria-label]="(isCollapsed ? 'SIDEBAR.COLLAPSE' : 'SIDEBAR.EXPAND') | translate"
                [attr.aria-expanded]="isCollapsed">
          <lucide-icon [name]="isCollapsed ? 'chevrons-right' : 'chevrons-left'" [size]="20"></lucide-icon>
        </button>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-group">
          <label class="text-label-medium" *ngIf="!isCollapsed">{{ 'SIDEBAR.MAIN' | translate }}</label>
          
          <a *ngIf="auth.hasRole('admin')" routerLink="/admin/dashboard" routerLinkActive="active" #rla1="routerLinkActive" [attr.aria-current]="rla1.isActive ? 'page' : null" class="nav-item" [attr.title]="isCollapsed ? ('NAV.DASHBOARD' | translate) : null">
            <div class="active-indicator"></div>
            <lucide-icon name="layout-dashboard" class="icon"></lucide-icon>
            <span class="label text-body-medium" *ngIf="!isCollapsed">{{ 'NAV.DASHBOARD' | translate }}</span>
          </a>

          <a *ngIf="auth.hasRole('admin')" routerLink="/admin/menu" routerLinkActive="active" #rla2="routerLinkActive" [attr.aria-current]="rla2.isActive ? 'page' : null" class="nav-item" [attr.title]="isCollapsed ? ('NAV.MENU' | translate) : null">
            <div class="active-indicator"></div>
            <lucide-icon name="book-open" class="icon"></lucide-icon>
            <span class="label text-body-medium" *ngIf="!isCollapsed">{{ 'NAV.MENU' | translate }}</span>
          </a>

          <a *ngIf="auth.hasRole('admin')" routerLink="/admin/users" routerLinkActive="active" #rla3="routerLinkActive" [attr.aria-current]="rla3.isActive ? 'page' : null" class="nav-item" [attr.title]="isCollapsed ? ('NAV.USERS' | translate) : null">
            <div class="active-indicator"></div>
            <lucide-icon name="users" class="icon"></lucide-icon>
            <span class="label text-body-medium" *ngIf="!isCollapsed">{{ 'NAV.USERS' | translate }}</span>
          </a>

          <a *ngIf="auth.hasRole('admin')" routerLink="/admin/config" routerLinkActive="active" #rla4="routerLinkActive" [attr.aria-current]="rla4.isActive ? 'page' : null" class="nav-item" [attr.title]="isCollapsed ? ('NAV.SETTINGS' | translate) : null">
            <div class="active-indicator"></div>
            <lucide-icon name="settings" class="icon"></lucide-icon>
            <span class="label text-body-medium" *ngIf="!isCollapsed">{{ 'NAV.SETTINGS' | translate }}</span>
          </a>
        </div>

        <div class="nav-group">
          <label class="text-label-medium" *ngIf="!isCollapsed">{{ 'SIDEBAR.OPERATIONS' | translate }}</label>
          
          <a *ngIf="auth.hasRole('kitchen')" routerLink="/admin/kds" routerLinkActive="active" #rla5="routerLinkActive" [attr.aria-current]="rla5.isActive ? 'page' : null" class="nav-item" [attr.title]="isCollapsed ? ('NAV.KDS' | translate) : null">
            <div class="active-indicator"></div>
            <lucide-icon name="flame" class="icon"></lucide-icon>
            <span class="label text-body-medium" *ngIf="!isCollapsed">{{ 'NAV.KDS' | translate }}</span>
          </a>

          <a *ngIf="auth.hasRole('pos')" routerLink="/admin/pos" routerLinkActive="active" #rla6="routerLinkActive" [attr.aria-current]="rla6.isActive ? 'page' : null" class="nav-item" [attr.title]="isCollapsed ? ('NAV.POS' | translate) : null">
            <div class="active-indicator"></div>
            <lucide-icon name="wallet" class="icon"></lucide-icon>
            <span class="label text-body-medium" *ngIf="!isCollapsed">{{ 'NAV.POS' | translate }}</span>
          </a>

          <a *ngIf="auth.hasRole('waiter')" routerLink="/admin/waiter" routerLinkActive="active" #rla7="routerLinkActive" [attr.aria-current]="rla7.isActive ? 'page' : null" class="nav-item" [attr.title]="isCollapsed ? ('SIDEBAR.WAITER' | translate) : null">
            <div class="active-indicator"></div>
            <lucide-icon name="hand-platter" class="icon"></lucide-icon>
            <span class="label text-body-medium" *ngIf="!isCollapsed">{{ 'SIDEBAR.WAITER' | translate }}</span>
          </a>
        </div>
      </nav>

      <div class="sidebar-footer">
        <button class="logout-btn" (click)="auth.logout()" [attr.aria-label]="'NAV.LOGOUT' | translate" [attr.title]="isCollapsed ? ('NAV.LOGOUT' | translate) : null">
          <lucide-icon name="log-out" class="icon"></lucide-icon>
          <span class="label text-label-large" *ngIf="!isCollapsed">{{ 'NAV.LOGOUT' | translate }}</span>
        </button>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: var(--sidebar-width);
      height: 100vh;
      background: var(--md-sys-color-surface-container-low);
      display: flex;
      flex-direction: column;
      transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
      position: sticky;
      top: 0;
      z-index: 100;
      padding: 12px;
      gap: 12px;
    }

    .sidebar.collapsed {
      width: var(--sidebar-collapsed-width);
    }

    .sidebar-header {
      padding: 12px 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 64px;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
      overflow: hidden;
    }

    .logo-box {
      width: 40px;
      height: 40px;
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .logo-dot { color: var(--md-sys-color-primary); }

    .md-icon-button {
      background: transparent;
      border: none;
      color: var(--md-sys-color-on-surface-variant);
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.2s;
    }

    .md-icon-button:hover { background: var(--md-sys-color-surface-variant); }

    .sidebar-nav {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .nav-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .nav-group label {
      padding: 0 16px;
      margin-bottom: 8px;
      color: var(--md-sys-color-on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .nav-item {
      position: relative;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 16px;
      height: 56px;
      border-radius: var(--radius-full);
      color: var(--md-sys-color-on-surface-variant);
      text-decoration: none;
      transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
    }

    .nav-item.active {
      background: var(--md-sys-color-secondary-container);
      color: var(--md-sys-color-on-secondary-container);
    }

    .nav-item:hover:not(.active) {
      background: var(--md-sys-color-surface-container-high);
    }

    .icon {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
    }

    .sidebar-footer {
      padding-top: 12px;
      border-top: 1px solid var(--md-sys-color-outline-variant);
    }

    .logout-btn {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 24px;
      height: 56px;
      border-radius: var(--radius-full);
      background: transparent;
      border: none;
      color: var(--md-sys-color-error);
      cursor: pointer;
      transition: all 0.2s;
    }

    .logout-btn:hover {
      background: var(--md-sys-color-error-container);
      color: var(--md-sys-color-on-error-container);
    }

    .sidebar-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 99;
        opacity: 0;
        transition: opacity 0.3s;
        pointer-events: none;
    }

    @media (max-width: 768px) {
        .sidebar-overlay {
            display: block;
        }
        .sidebar-overlay.visible {
            opacity: 1;
            pointer-events: auto;
        }
        .sidebar {
            position: fixed;
            left: -320px;
            z-index: 200;
            box-shadow: var(--md-sys-elevation-3);
        }
        .sidebar.collapsed {
            left: 0;
            width: var(--sidebar-width) !important;
        }
    }
  `]

})
export class SidebarComponent {
  @Input() isCollapsed = false;
  @Output() collapsedChange = new EventEmitter<boolean>();

  public auth = inject(AuthService);

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
    this.collapsedChange.emit(this.isCollapsed);
  }
}
