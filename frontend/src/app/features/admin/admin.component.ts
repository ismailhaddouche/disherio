import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  template: `
    <div class="h-screen flex bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      <!-- Sidebar -->
      <aside class="w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col p-4 gap-1">
        <div class="flex items-center gap-2 mb-4">
          <span class="material-symbols-outlined text-2xl text-primary">admin_panel_settings</span>
          <h1 class="font-bold text-lg">{{ 'admin.title' | translate }}</h1>
        </div>

        <nav class="flex flex-col gap-1">
          <a routerLink="dashboard" routerLinkActive="bg-primary text-white" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <span class="material-symbols-outlined text-base">dashboard</span> {{ 'admin.menu.dashboard' | translate }}
          </a>
          <a routerLink="dishes" routerLinkActive="bg-primary text-white" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <span class="material-symbols-outlined text-base">restaurant_menu</span> {{ 'admin.menu.dishes' | translate }}
          </a>
          <a routerLink="categories" routerLinkActive="bg-primary text-white" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <span class="material-symbols-outlined text-base">category</span> {{ 'admin.menu.categories' | translate }}
          </a>
          <a routerLink="totems" routerLinkActive="bg-primary text-white" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <span class="material-symbols-outlined text-base">qr_code_scanner</span> {{ 'admin.menu.totems' | translate }}
          </a>
          <a routerLink="staff" routerLinkActive="bg-primary text-white" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <span class="material-symbols-outlined text-base">badge</span> {{ 'admin.menu.staff' | translate }}
          </a>
          <a routerLink="logs" routerLinkActive="bg-primary text-white" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <span class="material-symbols-outlined text-base">receipt_long</span> {{ 'admin.menu.logs' | translate }}
          </a>
          <a routerLink="settings" routerLinkActive="bg-primary text-white" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <span class="material-symbols-outlined text-base">settings</span> {{ 'admin.menu.settings' | translate }}
          </a>
        </nav>
      </aside>

      <!-- Content -->
      <main class="flex-1 overflow-auto p-6">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AdminComponent {}
