import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './header.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent],
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
      <app-header />
      <main class="flex-1">
        <router-outlet />
      </main>
    </div>
  `
})
export class LayoutComponent {}
