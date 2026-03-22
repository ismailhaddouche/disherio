import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuEditorViewModel } from './menu-editor.viewmodel';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';
import { MenuCategoryListComponent } from './menu-category-list.component';
import { MenuItemFormComponent } from './menu-item-form.component';

@Component({
  selector: 'app-menu-editor',
  standalone: true,
  imports: [
    CommonModule, 
    LucideAngularModule, 
    TranslateModule,
    MenuCategoryListComponent,
    MenuItemFormComponent
  ],
  providers: [MenuEditorViewModel],
  template: `
    <div class="md-page-shell editor-container animate-fade-in">
      <header class="section-header-md3">
        <div class="header-content">
          <div class="title-with-icon">
            <div class="icon-box-md3 primary">
              <lucide-icon name="book-open" [size]="24"></lucide-icon>
            </div>
            <div>
              <h1 class="text-headline-medium">{{ 'MENU_EDITOR.TITLE' | translate }}</h1>
              <p class="text-body-small opacity-60">{{ 'MENU_EDITOR.DESC' | translate }}</p>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn-primary" (click)="vm.selectItem(null)">
            <lucide-icon name="plus" [size]="18"></lucide-icon>
            {{ 'MENU_EDITOR.NEW_ITEM' | translate }}
          </button>
        </div>
      </header>

      @if (vm.loading()) {
        <div class="md-loading-state">
          <div class="spinner"></div>
          <p class="text-body-medium opacity-60">{{ 'MENU_EDITOR.LOADING' | translate }}</p>
        </div>
      } @else if (vm.error()) {
        <div class="md-alert-error m-32">
          <lucide-icon name="alert-circle" [size]="24"></lucide-icon>
          <div class="alert-content">
            <p class="text-title-medium">{{ vm.error() }}</p>
            <button class="btn-text btn-sm mt-8" (click)="vm.loadMenu()">{{ 'COMMON.RETRY' | translate }}</button>
          </div>
        </div>
      } @else {
        <div class="editor-main-layout">
          <app-menu-category-list></app-menu-category-list>

          <main class="editor-detail">
            @if (vm.isEditing()) {
              <app-menu-item-form></app-menu-item-form>
            } @else {
              <div class="empty-detail-state">
                <div class="empty-icon-box">
                  <lucide-icon name="book-open" [size]="64"></lucide-icon>
                </div>
                <h2 class="text-headline-small">{{ 'MENU_EDITOR.PRO_MANAGER' | translate }}</h2>
                <p class="text-body-large opacity-40">{{ 'MENU_EDITOR.SELECT_HINT' | translate }}</p>
              </div>
            }
          </main>
        </div>
      }
    </div>
  `,
  styles: [`
    .editor-container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .editor-main-layout {
        display: grid;
        grid-template-columns: 320px 1fr;
        gap: 32px;
        flex: 1;
        min-height: 0;
        padding-bottom: 32px;
    }

    @media (max-width: 1024px) {
        .editor-main-layout { grid-template-columns: 1fr; }
        app-menu-category-list { max-height: 300px; overflow-y: auto; }
    }

    .editor-detail { 
        height: 100%;
        min-height: 0;
    }

    .empty-detail-state {
        height: 100%; display: flex; flex-direction: column;
        align-items: center; justify-content: center; text-align: center;
        opacity: 0.2;
    }
    .empty-icon-box { margin-bottom: 24px; }

    .md-loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px;
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

    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    .m-32 { margin: 32px; }
    .mt-8 { margin-top: 8px; }
    .opacity-60 { opacity: 0.6; }
    .opacity-40 { opacity: 0.4; }
  `]
})
export class MenuEditorComponent implements OnInit {
  public vm = inject(MenuEditorViewModel);

  ngOnInit() {
    this.vm.loadMenu();
  }
}
