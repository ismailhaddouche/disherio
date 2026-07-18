import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { I18nService } from '../../core/services/i18n.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe, MatSidenavModule, MatListModule, MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-sidenav-container class="disher-admin-container" [hasBackdrop]="isCompact()">
      <mat-sidenav
        class="disher-admin-sidenav"
        [mode]="isCompact() ? 'over' : 'side'"
        [opened]="!isCompact() || navOpen()"
        [fixedInViewport]="isCompact()"
        [fixedTopGap]="56"
        (closedStart)="navOpen.set(false)"
      >
        <div class="disher-admin-nav-header">
          <span class="material-symbols-outlined" aria-hidden="true">admin_panel_settings</span>
          <span class="disher-admin-nav-title">{{ 'admin.title' | translate }}</span>
        </div>

        <mat-nav-list class="disher-admin-nav-list" role="navigation" [attr.aria-label]="'admin.title' | translate">
          @for (item of navItems; track item.link) {
            <a
              mat-list-item
              [routerLink]="item.link"
              routerLinkActive
              #rla="routerLinkActive"
              [class.disher-nav-active]="rla.isActive"
              [attr.aria-current]="rla.isActive ? 'page' : null"
              (click)="closeCompactNavigation()"
            >
              <mat-icon matListItemIcon aria-hidden="true">{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label() }}</span>
            </a>
          }
        </mat-nav-list>

        <footer class="disher-admin-footer">
          <p>&copy; {{ year }} DisherIO</p>
        </footer>
      </mat-sidenav>

      <mat-sidenav-content class="disher-admin-content">
        @if (isCompact()) {
          <div class="disher-admin-mobile-bar">
            <button
              matIconButton
              type="button"
              (click)="navOpen.set(true)"
              [attr.aria-label]="'admin.title' | translate"
            >
              <mat-icon aria-hidden="true">menu</mat-icon>
            </button>
            <span>{{ 'admin.title' | translate }}</span>
          </div>
        }
        <router-outlet />
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .disher-admin-container {
      height: calc(100vh - 56px);
      min-height: calc(100vh - 56px);
      height: calc(100dvh - 56px);
      min-height: calc(100dvh - 56px);
      background: var(--mat-sys-surface-container-low);
      color: var(--mat-sys-on-surface);
    }
    .disher-admin-sidenav {
      width: 240px;
      border-right: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container);
      display: flex;
      flex-direction: column;
      border-radius: 0;
    }
    .disher-admin-nav-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px 16px 8px 16px;
    }
    .disher-admin-nav-header .material-symbols-outlined {
      font-size: 20px;
      color: var(--mat-sys-primary);
    }
    .disher-admin-nav-title {
      font-size: 16px;
      font-weight: 500;
      color: var(--mat-sys-on-surface);
    }
    .disher-admin-nav-list { flex: 1; padding-top: 8px; }
    .disher-admin-nav-list a[mat-list-item] {
      color: var(--mat-sys-on-surface);
    }
    .disher-admin-nav-list a[mat-list-item]:hover {
      background: var(--mat-sys-surface-container-high);
    }
    .disher-admin-nav-list a[mat-list-item] mat-icon {
      color: var(--mat-sys-on-surface-variant);
    }
    .disher-admin-nav-list a[mat-list-item].disher-nav-active {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .disher-admin-nav-list a[mat-list-item].disher-nav-active mat-icon {
      color: var(--mat-sys-on-primary-container);
    }
    .disher-admin-nav-list a[mat-list-item].disher-nav-active:hover {
      background: var(--mat-sys-primary-container);
    }
    .disher-admin-footer {
      padding: 16px;
      border-top: 1px solid var(--mat-sys-outline-variant);
      text-align: center;
    }
    .disher-admin-footer p {
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant);
      margin: 0;
    }
    .disher-admin-content {
      overflow: auto;
      background: var(--mat-sys-surface-container-low);
    }
    .disher-admin-mobile-bar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      min-height: 52px;
      align-items: center;
      gap: 8px;
      padding: 0 8px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container);
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-title-medium);
    }
    @media (max-width: 767px) {
      .disher-admin-sidenav {
        width: min(320px, calc(100vw - 56px));
      }
    }
  `],
})
export class AdminComponent {
  readonly year = new Date().getFullYear();
  private i18n = inject(I18nService);
  private breakpointObserver = inject(BreakpointObserver);

  private readonly compactResult = toSignal(
    this.breakpointObserver.observe('(max-width: 767px)'),
    { initialValue: { matches: false, breakpoints: {} } }
  );
  readonly isCompact = computed(() => this.compactResult().matches);
  readonly navOpen = signal(false);

  readonly navItems = [
    { link: 'dashboard', icon: 'dashboard', label: () => this.i18n.translate('admin.menu.dashboard') },
    { link: 'dishes', icon: 'restaurant_menu', label: () => this.i18n.translate('admin.menu.dishes') },
    { link: 'categories', icon: 'category', label: () => this.i18n.translate('admin.menu.categories') },
    { link: 'totems', icon: 'qr_code_scanner', label: () => this.i18n.translate('admin.menu.totems') },
    { link: 'staff', icon: 'badge', label: () => this.i18n.translate('admin.menu.staff') },
    { link: 'logs', icon: 'receipt_long', label: () => this.i18n.translate('admin.menu.logs') },
    { link: 'settings', icon: 'settings', label: () => this.i18n.translate('admin.menu.settings') },
  ];

  closeCompactNavigation(): void {
    if (this.isCompact()) {
      this.navOpen.set(false);
    }
  }
}
