import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  template: `
    <aside class="sidebar" [class.collapsed]="isCollapsed">
      <div class="sidebar-header">
        <div class="logo-container">
          <div class="logo-box">D</div>
          <span class="logo-text" *ngIf="!isCollapsed">Disher<span class="dot">.</span>io</span>
        </div>
        <button class="toggle-btn" (click)="toggleSidebar()">
          <lucide-icon [name]="isCollapsed ? 'chevron-right' : 'chevron-left'" [size]="18"></lucide-icon>
        </button>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-group">
          <label *ngIf="!isCollapsed">Principal</label>
          <a *ngIf="auth.hasRole('admin')" routerLink="/admin/dashboard" routerLinkActive="active" class="nav-item">
            <lucide-icon name="layout-dashboard" class="icon"></lucide-icon>
            <span class="label" *ngIf="!isCollapsed">Dashboard</span>
          </a>
          <a *ngIf="auth.hasRole('admin')" routerLink="/admin/menu" routerLinkActive="active" class="nav-item">
            <lucide-icon name="utensils" class="icon"></lucide-icon>
            <span class="label" *ngIf="!isCollapsed">Menú</span>
          </a>
          <a *ngIf="auth.hasRole('admin')" routerLink="/admin/users" routerLinkActive="active" class="nav-item">
            <lucide-icon name="users" class="icon"></lucide-icon>
            <span class="label" *ngIf="!isCollapsed">Personal</span>
          </a>
        </div>

        <div class="nav-group">
          <label *ngIf="!isCollapsed">Operaciones</label>
          <a *ngIf="auth.hasRole('kitchen')" routerLink="/admin/kds" routerLinkActive="active" class="nav-item">
            <lucide-icon name="chef-hat" class="icon"></lucide-icon>
            <span class="label" *ngIf="!isCollapsed">Cocina (KDS)</span>
          </a>
          <a *ngIf="auth.hasRole('pos')" routerLink="/admin/pos" routerLinkActive="active" class="nav-item">
            <lucide-icon name="wallet" class="icon"></lucide-icon>
            <span class="label" *ngIf="!isCollapsed">Caja (POS)</span>
          </a>
          <a *ngIf="auth.hasRole('admin')" routerLink="/admin/config" routerLinkActive="active" class="nav-item">
            <lucide-icon name="settings" class="icon"></lucide-icon>
            <span class="label" *ngIf="!isCollapsed">Ajustes</span>
          </a>
        </div>
      </nav>

      <div class="sidebar-footer">
        <button class="logout-btn" (click)="auth.logout()">
          <lucide-icon name="log-out" class="icon"></lucide-icon>
          <span class="label" *ngIf="!isCollapsed">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: var(--sidebar-width);
      height: 100vh;
      background: var(--glass-bg);
      backdrop-filter: var(--glass-blur);
      border-right: 1px solid var(--glass-border);
      display: flex;
      flex-direction: column;
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .sidebar.collapsed {
      width: var(--sidebar-collapsed-width);
    }

    .sidebar-header {
      padding: 32px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
      overflow: hidden;
    }

    .logo-box {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      color: white; /* Keep logo letter white regardless of theme */
      flex-shrink: 0;
    }

    .logo-text {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 1.25rem;
      font-weight: 700;
      white-space: nowrap;
      color: var(--text-base);
    }

    .logo-text .dot { color: var(--accent-primary); }

    .toggle-btn {
      background: transparent;
      border: 1px solid var(--glass-border);
      color: var(--text-base);
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s;
    }

    .toggle-btn:hover { background: var(--glass-border); }

    .sidebar-nav {
      flex: 1;
      padding: 0 16px;
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .nav-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .nav-group label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted);
      padding-left: 12px;
      margin-bottom: 8px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: 12px;
      color: var(--text-muted);
      text-decoration: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      white-space: nowrap;
    }

    .nav-item:hover {
      background: var(--glass-border);
      color: var(--text-base);
    }

    .nav-item.active {
      background: rgba(56, 189, 248, 0.08); /* fallback */
      background: color-mix(in srgb, var(--accent-primary) 10%, transparent);
      color: var(--accent-primary);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-primary) 20%, transparent);
    }

    .icon {
      width: 20px;
      height: 20px;
      opacity: 0.8;
    }

    .sidebar-footer {
      padding: 24px 16px;
      border-top: 1px solid var(--glass-border);
    }

    .logout-btn {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: 12px;
      background: transparent;
      border: none;
      color: var(--danger);
      cursor: pointer;
      transition: all 0.3s;
      font-family: inherit;
      font-size: 0.9rem;
    }

    .logout-btn:hover {
      background: color-mix(in srgb, var(--danger) 10%, transparent);
    }

    @media (max-width: 768px) {
        .sidebar {
            position: fixed;
            left: -280px;
        }
        .sidebar.collapsed {
            left: 0;
            width: var(--sidebar-width);
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
