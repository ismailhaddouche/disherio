import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuEditorViewModel } from './menu-editor.viewmodel';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-menu-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, TranslateModule],
  providers: [MenuEditorViewModel],
  template: `
    <div class="editor-container animate-fade-in">
      <header class="view-header" style="grid-column: 1 / -1; margin-bottom: 0;">
        <div>
          <h1 class="view-title"><lucide-icon name="utensils" [size]="28" class="text-muted"></lucide-icon> {{ 'MENU_EDITOR.TITLE' | translate }}</h1>
          <p class="view-desc">{{ 'MENU_EDITOR.DESC' | translate }}</p>
        </div>
        <button class="btn-primary" (click)="vm.selectItem(null)"><lucide-icon name="plus" [size]="16" class="inline-icon mr-2"></lucide-icon>{{ 'MENU_EDITOR.NEW_ITEM' | translate }}</button>
      </header>

      <aside class="menu-structure glass-card">
        <div class="categories-list">
          @for (cat of vm.categories(); track cat.name) {
            <div class="category-group">
              <h3 class="category-title">{{ cat.name }}</h3>
              <div class="items-grid">
                @for (item of cat.items; track item._id) {
                  <div class="menu-item-card glass-card" 
                       [class.selected]="vm.selectedItem()?._id === item._id"
                       (click)="vm.selectItem(item)">
                    <div class="item-meta">
                      <span class="price-badge">{{ item.basePrice }}€</span>
                    </div>
                    <h4>{{ item.name }}</h4>
                    <p class="description">{{ item.description }}</p>
                    <div class="item-footer">
                      <span class="allergen-count"><lucide-icon name="alert-triangle" [size]="12" class="inline-icon"></lucide-icon> {{ item.allergens.length }}</span>
                      <span class="variant-count"><lucide-icon name="package" [size]="12" class="inline-icon"></lucide-icon> {{ item.variants.length }} {{ 'MENU_EDITOR.VAR' | translate }}</span>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </aside>

      <main class="editor-detail">
        @if (vm.isEditing(); as item) {
          <div class="edit-form glass-card">
            <header class="form-header">
              <h2 class="gradient-text">{{ vm.selectedItem()?._id ? ('MENU_EDITOR.EDIT_ITEM' | translate) : ('MENU_EDITOR.NEW_ITEM' | translate) }}</h2>
              <div class="form-actions">
                <button class="btn-secondary" (click)="vm.isEditing.set(false)">{{ 'MENU_EDITOR.CANCEL' | translate }}</button>
                <button class="btn-primary" (click)="vm.saveItem()">{{ 'MENU_EDITOR.SAVE_CHANGES' | translate }}</button>
              </div>
            </header>

            <div class="form-grid">
              <!-- Basic Info -->
              <section class="form-section">
                <h3>{{ 'MENU_EDITOR.BASIC_INFO' | translate }}</h3>
                <div class="input-group">
                  <label>{{ 'MENU_EDITOR.ITEM_NAME' | translate }}</label>
                  <input type="text" [(ngModel)]="vm.selectedItem()!.name" class="glass-input">
                </div>
                <div class="input-group">
                  <label>{{ 'MENU_EDITOR.CATEGORY' | translate }}</label>
                  <input type="text" [(ngModel)]="vm.selectedItem()!.category" list="categoryOptions" class="glass-input" [placeholder]="'MENU_EDITOR.CAT_PLACEHOLDER' | translate">
                  <datalist id="categoryOptions">
                    @for (cat of vm.categories(); track cat.name) {
                        <option [value]="cat.name">
                    }
                  </datalist>
                </div>
                <div class="input-group">
                  <label>{{ 'MENU_EDITOR.BASE_PRICE' | translate }}</label>
                  <input type="number" 
                         [(ngModel)]="vm.selectedItem()!.basePrice" 
                         class="glass-input"
                         [disabled]="vm.selectedItem()!.variants.length > 0"
                         [placeholder]="vm.selectedItem()!.variants.length > 0 ? ('MENU_EDITOR.PRICE_DEF_VAR' | translate) : '0.00'">
                  @if (vm.selectedItem()!.variants.length > 0) {
                    <span class="input-hint">{{ 'MENU_EDITOR.PRICE_HINT' | translate }}</span>
                  }
                </div>
                <div class="input-group full">
                  <label>{{ 'MENU_EDITOR.DESCRIPTION' | translate }}</label>
                  <textarea [(ngModel)]="vm.selectedItem()!.description" class="glass-input"></textarea>
                </div>
              </section>

              <!-- Allergens & Tags -->
              <section class="form-section">
                <h3>{{ 'MENU_EDITOR.ALLERGENS_TAGS' | translate }}</h3>
                <div class="allergens-selector">
                  @for (alg of ['Gluten', 'Lácteos', 'Frutos Secos', 'Huevo', 'Pescado', 'Soja']; track alg) {
                    <button class="chip" 
                            [class.active]="vm.selectedItem()!.allergens.includes(alg)"
                            (click)="vm.toggleAllergen(alg)">
                      {{ alg }}
                    </button>
                  }
                </div>
                <div class="input-group mt-16">
                  <label>{{ 'MENU_EDITOR.TAGS' | translate }}</label>
                  <input type="text" [placeholder]="'MENU_EDITOR.TAGS_PLACEHOLDER' | translate" class="glass-input">
                </div>
              </section>

              <!-- Type Toggle -->
              <section class="form-section full">
                <div class="toggle-container glass-card" (click)="vm.selectedItem()!.isMenu = !vm.selectedItem()!.isMenu; vm.selectedItem.set({...vm.selectedItem()!})">
                    <div class="toggle-status">
                        <h4>{{ 'MENU_EDITOR.IS_MENU' | translate }}</h4>
                        <p>{{ vm.selectedItem()!.isMenu ? ('MENU_EDITOR.YES_MENU' | translate) : ('MENU_EDITOR.NO_MENU' | translate) }}</p>
                    </div>
                    <div class="toggle-switch" [class.on]="vm.selectedItem()!.isMenu"></div>
                </div>
              </section>

              @if (vm.selectedItem()!.isMenu) {
                <!-- Menu Structure Editor -->
                <section class="form-section full">
                    <div class="section-title-action">
                        <h3>{{ 'MENU_EDITOR.MENU_STRUCT' | translate }}</h3>
                        <button class="btn-add" (click)="vm.addMenuSection()">{{ 'MENU_EDITOR.ADD_SEC' | translate }}</button>
                    </div>
                    
                    <div class="menu-sections-grid">
                        @for (sec of vm.selectedItem()!.menuSections; track $index; let sIdx = $index) {
                            <div class="menu-section-card glass-card">
                                <div class="section-head">
                                    <input type="text" [(ngModel)]="sec.name" placeholder="Ej: Primer Plato" class="glass-input sec-name">
                                    <button class="btn-del" (click)="vm.removeMenuSection(sIdx)">×</button>
                                </div>
                                
                                <div class="options-list">
                                    <label>{{ 'MENU_EDITOR.AVAILABLE_OPTS' | translate }}</label>
                                    @for (opt of sec.options; track $index; let oIdx = $index) {
                                        <div class="option-row">
                                            <input type="text" [(ngModel)]="sec.options[oIdx]" [placeholder]="'MENU_EDITOR.OPT_PLACEHOLDER' | translate" class="glass-input">
                                            <button class="btn-del-mini" (click)="vm.removeMenuOption(sIdx, oIdx)">×</button>
                                        </div>
                                    }
                                    <button class="btn-add-mini" (click)="vm.addMenuOption(sIdx)">{{ 'MENU_EDITOR.ADD_DISH' | translate }}</button>
                                </div>
                            </div>
                        }
                    </div>
                </section>
              }

              <!-- Variants -->
              <section class="form-section">
                <div class="section-title-action">
                  <h3>{{ 'MENU_EDITOR.VARIANTS' | translate }}</h3>
                  <button class="btn-add" (click)="vm.addVariant()">{{ 'MENU_EDITOR.ADD' | translate }}</button>
                </div>
                <div class="list-editor">
                  @for (v of vm.selectedItem()!.variants; track $index) {
                    <div class="list-item">
                      <input type="text" [(ngModel)]="v.name" [placeholder]="'MENU_EDITOR.VAR_NAME_PH' | translate" class="glass-input flex-2">
                      <input type="number" [(ngModel)]="v.price" [placeholder]="'MENU_EDITOR.TOTAL_PRICE_PH' | translate" class="glass-input flex-1">
                      <button class="btn-del" (click)="vm.removeVariant($index)">×</button>
                    </div>
                  }
                </div>
              </section>

              <!-- Addons -->
              <section class="form-section">
                <div class="section-title-action">
                  <h3>{{ 'MENU_EDITOR.ADDONS' | translate }}</h3>
                  <button class="btn-add" (click)="vm.addAddon()">{{ 'MENU_EDITOR.ADD' | translate }}</button>
                </div>
                <div class="list-editor">
                  @for (a of vm.selectedItem()!.addons; track $index) {
                    <div class="list-item">
                      <input type="text" [(ngModel)]="a.name" [placeholder]="'MENU_EDITOR.ADDON_PH' | translate" class="glass-input flex-2">
                      <input type="number" [(ngModel)]="a.price" [placeholder]="'MENU_EDITOR.PRICE_PH' | translate" class="glass-input flex-1">
                      <button class="btn-del" (click)="vm.removeAddon($index)">×</button>
                    </div>
                  }
                </div>
              </section>
            </div>

            @if (vm.selectedItem()?._id) {
              <div class="danger-zone">
                <button class="btn-danger" (click)="vm.deleteItem(vm.selectedItem()!._id!)">{{ 'MENU_EDITOR.DEL_PERMANENTLY' | translate }}</button>
              </div>
            }
          </div>
        } @else {
          <div class="no-selection-empty glass-card">
            <div class="icon"><lucide-icon name="book-open" [size]="64" color="var(--text-muted)"></lucide-icon></div>
            <h2>{{ 'MENU_EDITOR.PRO_MANAGER' | translate }}</h2>
            <p>{{ 'MENU_EDITOR.SELECT_HINT' | translate }}</p>
          </div>
        }
      </main>
    </div>
  `,
  styles: [`
    .editor-container {
      display: grid;
      grid-template-columns: 400px 1fr;
      grid-template-rows: auto 1fr;
      gap: 24px;
      height: 100vh;
      padding: 0;
      background: transparent;
      overflow: hidden;
    }

    @media (max-width: 1024px) {
      .editor-container { grid-template-columns: 320px 1fr; gap: 16px; }
    }
    @media (max-width: 768px) {
      .editor-container { grid-template-columns: 1fr; height: auto; }
      .menu-structure { max-height: 40vh; }
      .form-grid { grid-template-columns: 1fr; }
    }

    .menu-structure {
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding: 24px;
      overflow-y: auto;
    }

    .categories-list {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .category-title {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      opacity: 0.5;
      margin-bottom: 16px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      padding-bottom: 8px;
    }

    .items-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .menu-item-card {
      padding: 16px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.3s ease;
    }

    .menu-item-card:hover { background: rgba(255,255,255,0.05); }
    .menu-item-card.selected { 
      border-color: var(--accent-primary); 
      background: rgba(56, 189, 248, 0.05);
      box-shadow: 0 0 20px rgba(56, 189, 248, 0.1);
    }

    .item-meta { display: flex; justify-content: flex-end; }
    .price-badge { font-size: 0.8rem; font-weight: bold; color: var(--accent-primary); }
    .menu-item-card h4 { margin: 4px 0; font-size: 1.1rem; }
    .menu-item-card .description { font-size: 0.8rem; opacity: 0.5; height: 2.4em; overflow: hidden; }
    
    .item-footer { 
      margin-top: 12px; 
      display: flex; 
      gap: 12px; 
      font-size: 0.7rem; 
      opacity: 0.6;
    }
    
    .inline-icon { display: inline-block; vertical-align: text-bottom; margin-right: 4px; }
    .mr-2 { margin-right: 8px; }

    .editor-detail { overflow-y: auto; padding-right: 8px; }

    .edit-form { padding: 40px; display: flex; flex-direction: column; gap: 32px; }

    .form-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      padding-bottom: 24px;
    }

    .form-actions { display: flex; gap: 12px; }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
    }

    .form-section { display: flex; flex-direction: column; gap: 16px; }
    .form-section h3 { font-size: 0.9rem; opacity: 0.8; margin-bottom: 8px; color: var(--accent-secondary); }

    .input-group { display: flex; flex-direction: column; gap: 6px; }
    .input-group.full { grid-column: 1 / -1; }
    .input-group label { font-size: 0.75rem; opacity: 0.5; }

    /* glass-input now defined globally */
    .glass-input:focus { border-color: var(--accent-primary); }
    .input-hint { font-size: 0.65rem; color: var(--accent-secondary); margin-top: 4px; }

    .allergens-selector { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      color: white;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.75rem;
      cursor: pointer;
    }
    .chip.active { background: #ef4444; border-color: #ef4444; color: white; }

    .section-title-action { display: flex; justify-content: space-between; align-items: center; }
    .btn-add { background: none; border: 1px dashed var(--accent-secondary); color: var(--accent-secondary); padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 0.7rem; }

    .list-editor { display: flex; flex-direction: column; gap: 8px; }
    .list-item { display: flex; gap: 8px; }
    .flex-2 { flex: 2; }
    .flex-1 { flex: 1; }
    .btn-del { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: none; width: 32px; border-radius: 8px; cursor: pointer; }

    .danger-zone { margin-top: 40px; border-top: 1px solid rgba(239, 68, 68, 0.2); padding-top: 24px; text-align: right; }

    .no-selection-empty {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      opacity: 0.5;
    }
    .no-selection-empty .icon { font-size: 5rem; margin-bottom: 24px; }

    .mt-16 { margin-top: 16px; }

    .toggle-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        cursor: pointer;
        border: 1px solid rgba(255,255,255,0.1);
        transition: all 0.3s ease;
    }
    .toggle-container:hover { border-color: var(--accent-primary); }
    .toggle-status h4 { margin: 0; font-size: 1rem; }
    .toggle-status p { margin: 4px 0 0 0; font-size: 0.8rem; opacity: 0.5; }

    .toggle-switch {
        width: 48px; height: 24px; background: rgba(255,255,255,0.1);
        border-radius: 12px; position: relative; transition: 0.3s;
    }
    .toggle-switch::after {
        content: ''; position: absolute; left: 4px; top: 4px;
        width: 16px; height: 16px; background: white; border-radius: 50%;
        transition: 0.3s;
    }
    .toggle-switch.on { background: var(--accent-primary); }
    .toggle-switch.on::after { left: 28px; }

    .menu-sections-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 16px;
        margin-top: 16px;
    }

    .menu-section-card { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .section-head { display: flex; gap: 12px; }
    .sec-name { font-weight: bold; flex: 1; border-color: var(--accent-secondary); }

    .options-list { display: flex; flex-direction: column; gap: 8px; }
    .options-list label { font-size: 0.7rem; opacity: 0.5; margin-bottom: 4px; }

    .option-row { display: flex; gap: 8px; }
    .btn-del-mini { background: none; border: none; color: #ef4444; opacity: 0.5; cursor: pointer; padding: 0 4px; }
    .btn-del-mini:hover { opacity: 1; }

    .btn-add-mini {
        background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.2);
        color: white; padding: 8px; border-radius: 8px; font-size: 0.75rem; cursor: pointer;
        transition: 0.3s;
    }
    .btn-add-mini:hover { border-color: var(--accent-primary); color: var(--accent-primary); }
  `]
})
export class MenuEditorComponent {
  public vm = inject(MenuEditorViewModel);
}
