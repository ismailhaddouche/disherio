import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div class="text-center">
        <span class="material-symbols-outlined text-6xl text-red-500">lock</span>
        <h1 class="text-2xl font-bold mt-4 text-gray-900 dark:text-white">{{ 'unauthorized.title' | translate }}</h1>
        <p class="text-gray-500 mt-2">{{ 'unauthorized.message' | translate }}</p>
        <button
          (click)="back()"
          class="mt-6 bg-primary text-white px-6 py-2 rounded-lg font-semibold active:scale-95 transition-transform"
        >
          {{ 'common.back' | translate }}
        </button>
      </div>
    </div>
  `,
})
export class UnauthorizedComponent {
  private router = inject(Router);
  back() { this.router.navigate(['/pos']); }
}
