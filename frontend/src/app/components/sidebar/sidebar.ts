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
    <aside class="sidebar" [class.collapsed]="isCollapsed">
      <div class="sidebar-header">
        <div class="logo-container">
          <div class="logo-box">
            <lucide-icon name="chef-hat" [size]="20" color="white"></lucide-icon>
          </div>
          <span class="text-title-large" *ngIf="!isCollapsed">Disher<span class="dot">.</span>io</span>
        </div>
        <button class="md-icon-button" (click)="toggleSidebar()">
          <lucide-icon [name]="isCollapsed ? 'chevrons-right' : 'chevrons-left'" [size]="20"></lucide-icon>
        </button>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-group">
          <label class="text-label-medium" *ngIf="!isCollapsed">{{ 'SIDEBAR.MAIN' | translate }}</label>
          
          <a *ngIf="auth.hasRole('admin')" routerLink="/admin/dashboard" routerLinkActive="active" class="nav-item">
            <div class="active-indicator"></div>
            <lucide-icon name="layout-dashboard" class="icon"></lucide-icon>
            <span class="label text-body-medium" *ngIf="!isCollapsed">{{ 'NAV.DASHBOARD' | translate }}</span>
          </a>

          <a *ngIf="auth.hasRole('admin')" routerLink="/admin/menu" routerLinkActive="active" class="nav-item">
            <div class="active-indicator"></div>
            <lucide-icon name="book-open" class="icon"></lucide-icon>
            <span class="label text-body-medium" *ngIf="!isCollapsed">{{ 'NAV.MENU' | translate }}</span>
          </a>

          <a *ngIf="auth.hasRole('admin')" routerLink="/admin/users" routerLinkActive="active" class="nav-item">
            <div class="active-indicator"></div>
            <lucide-icon name="users" class="icon"></lucide-icon>
            <span class="label text-body-medium" *ngIf="!isCollapsed">{{ 'NAV.USERS' | translate }}</span>
          </a>

          <a *ngIf="auth.hasRole('admin')" routerLink="/admin/config" routerLinkActive="active" class="nav-item">
            <div class="active-indicator"></div>
            <lucide-icon name="settings" class="icon"></lucide-icon>
            <span class="label text-body-medium" *ngIf="!isCollapsed">{{ 'NAV.SETTINGS' | translate }}</span>
          </a>
        </div>

        <div class="nav-group">
          <label class="text-label-medium" *ngIf="!isCollapsed">{{ 'SIDEBAR.OPERATIONS' | translate }}</label>
          
          <a *ngIf="auth.hasRole('kitchen')" routerLink="/admin/kds" routerLinkActive="active" class="nav-item">
            <div class="active-indicator"></div>
            <lucide-icon name="flame" class="icon"></lucide-icon>
            <span class="label text-body-medium" *ngIf="!isCollapsed">{{ 'NAV.KDS' | translate }}</span>
          </a>

          <a *ngIf="auth.hasRole('pos')" routerLink="/admin/pos" routerLinkActive="active" class="nav-item">
            <div class="active-indicator"></div>
            <lucide-icon name="wallet" class="icon"></lucide-icon>
            <span class="label text-body-medium" *ngIf="!isCollapsed">{{ 'NAV.POS' | translate }}</span>
          </a>

          <a *ngIf="auth.hasRole('waiter')" routerLink="/admin/waiter" routerLinkActive="active" class="nav-item">
            <div class="active-indicator"></div>
            <lucide-icon name="hand-platter" class="icon"></lucide-icon>
            <span class="label text-body-medium" *ngIf="!isCollapsed">{{ 'SIDEBAR.WAITER' | translate }}</span>
          </a>
        </div>
      </nav>

      <div class="sidebar-footer">
        <button class="logout-btn" (click)="auth.logout()">
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
      background: var(--md-sys-color-surface-2);
      border-right: 1px solid var(--md-sys-color-outline-variant);
      display: flex;
      flex-direction: column;
      transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .sidebar.collapsed {
      width: var(--sidebar-collapsed-width);
    }

    .sidebar-header {
      padding: 24px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 80px;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 16px;
      overflow: hidden;
    }

    .logo-box {
      width: 40px;
      height: 40px;
      background: var(--md-sys-color-primary);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .logo-text {
      white-space: nowrap;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .logo-text .dot { color: var(--md-sys-color-primary); }

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
      padding: 8px 12px;
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
      opacity: 0.6;
      color: var(--md-sys-color-on-surface);
    }

    .nav-item {
      position: relative;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 16px;
      height: 56px;
      border-radius: 28px;
      color: var(--md-sys-color-on-surface-variant);
      text-decoration: none;
      transition: all 0.2s ease-in-out;
      overflow: hidden;
    }

    .active-indicator {
      position: absolute;
      left: 12px;
      right: 12px;
      height: 32px;
      background: var(--md-sys-color-secondary-container);
      border-radius: 16px;
      transform: scaleX(0);
      transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
      z-index: 0;
    }

    .nav-item.active .active-indicator {
      transform: scaleX(1);
    }

    .nav-item.active {
      color: var(--md-sys-color-on-secondary-container);
      font-weight: 600;
    }

    .icon {
      width: 24px;
      height: 24px;
      position: relative;
      z-index: 1;
    }

    .label {
      position: relative;
      z-index: 1;
      white-space: nowrap;
    }

    .nav-item:hover:not(.active) {
      background: rgba(0,0,0,0.04);
    }

    .sidebar-footer {
      padding: 16px 12px;
      border-top: 1px solid var(--md-sys-color-outline-variant);
    }

    .logout-btn {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-radius: 28px;
      background: transparent;
      border: none;
      color: var(--md-sys-color-error);
      cursor: pointer;
      transition: background 0.2s;
    }

    .logout-btn:hover {
      background: var(--md-sys-color-error-container);
      color: var(--md-sys-color-on-error-container);
    }

    @media (max-width: 768px) {
        .sidebar {
            position: fixed;
            left: -320px;
            box-shadow: var(--shadow-3);
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
