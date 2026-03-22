import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';
import { MenuEditorViewModel } from './menu-editor.viewmodel';

@Component({
  selector: 'app-menu-category-list',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule],
  template: `
    <aside class="menu-structure">
      <div class="categories-column">
        @for (cat of vm.categories(); track cat.name) {
          <div class="category-group">
            <h3 class="text-label-large color-secondary">{{ cat.name }}</h3>
            <div class="items-stack">
              @for (item of cat.items; track item._id) {
                <div class="md-card menu-item-row" 
                     [class.is-selected]="vm.selectedItem()?._id === item._id"
                     (click)="vm.selectItem(item)">
                  <div class="item-visual">
                    <lucide-icon [name]="item.isMenu ? 'layers' : 'utensils-crossed'" [size]="18"></lucide-icon>
                  </div>
                  <div class="item-content">
                    <span class="text-title-small">{{ item.name }}</span>
                    <span class="text-label-medium color-primary">{{ item.basePrice }}€</span>
                  </div>
                  <div class="item-badges">
                    @if (item.allergens.length > 0) {
                        <div class="dot-badge error" [title]="item.allergens.join(', ')"></div>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </div>
    </aside>
  `,
  styles: [`
    .menu-structure {
        min-height: 0;
    }

    .categories-column {
        display: flex;
        flex-direction: column;
        gap: 32px;
    }

    .category-group { display: flex; flex-direction: column; gap: 12px; }
    
    .items-stack { display: flex; flex-direction: column; gap: 8px; }

    .menu-item-row {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 12px 16px;
        background: var(--md-sys-color-surface-1);
        cursor: pointer;
        transition: all 0.2s;
        border-radius: 16px;
    }

    .menu-item-row:hover { background: var(--md-sys-color-surface-variant); }
    .menu-item-row.is-selected {
        background: var(--md-sys-color-secondary-container);
        color: var(--md-sys-color-on-secondary-container);
    }

    .item-visual {
        width: 40px; height: 40px; border-radius: 12px;
        background: var(--md-sys-color-surface-3);
        display: flex; align-items: center; justify-content: center;
        opacity: 0.6;
    }
    .is-selected .item-visual { background: var(--md-sys-color-on-secondary-container); color: var(--md-sys-color-secondary-container); opacity: 1; }

    .item-content { flex: 1; display: flex; flex-direction: column; }
    
    .dot-badge {
        width: 8px; height: 8px; border-radius: 50%;
        background: var(--md-sys-color-primary);
    }
    .dot-badge.error { background: var(--md-sys-color-error); }
  `]
})
export class MenuCategoryListComponent {
  public vm = inject(MenuEditorViewModel);
}
