import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './header.component';
import { MenuLanguageService } from '../../services/menu-language.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
      <app-header />
      <main class="flex-1">
        <router-outlet />
      </main>
    </div>
  `
})
export class LayoutComponent implements OnInit {
  private menuLangService = inject(MenuLanguageService);

  ngOnInit() {
    this.menuLangService.load();
  }
}
