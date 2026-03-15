import { Component, inject, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuEditorViewModel } from './menu-editor.viewmodel';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-menu-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, TranslateModule],
  providers: [MenuEditorViewModel],
  template: `
    <div class="editor-container animate-fade-in">
      <header class="section-header-md3">
        <div class="header-text">
          <h1 class="text-headline-medium">
            <lucide-icon name="menu" [size]="28"></lucide-icon>
            {{ 'MENU_EDITOR.TITLE' | translate }}
          </h1>
          <p class="text-body-large opacity-60">{{ 'MENU_EDITOR.DESC' | translate }}</p>
        </div>
        <button class="btn-primary" (click)="vm.selectItem(null)">
            <lucide-icon name="plus" [size]="18"></lucide-icon>
            {{ 'MENU_EDITOR.NEW_ITEM' | translate }}
        </button>
      </header>

      <div class="editor-main-layout">
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
                        <lucide-icon [name]="item.isMenu ? 'layers' : 'utensils-crossomer'" [size]="18"></lucide-icon>
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

        <main class="editor-detail">
          @if (vm.isEditing(); as item) {
            <div class="md-card detail-form">
              <header class="form-header-row">
                <h2 class="text-headline-small">{{ vm.selectedItem()?._id ? ('MENU_EDITOR.EDIT_ITEM' | translate) : ('MENU_EDITOR.NEW_ITEM' | translate) }}</h2>
                <div class="form-actions-md3">
                  <button class="btn-outline" (click)="vm.isEditing.set(false)">{{ 'MENU_EDITOR.CANCEL' | translate }}</button>
                  <button class="btn-primary" (click)="vm.saveItem()">
                    <lucide-icon name="check" [size]="18"></lucide-icon>
                    {{ 'MENU_EDITOR.SAVE_CHANGES' | translate }}
                  </button>
                </div>
              </header>

              <div class="form-scrollable">
                <div class="form-grid-md3">
                  <!-- Fundamental Data -->
                  <section class="form-section-md3">
                    <h3 class="text-title-medium">{{ 'MENU_EDITOR.BASIC_INFO' | translate }}</h3>
                    
                    <div class="image-upload-row md-card-elevated" style="margin-bottom: 16px; display: flex; align-items: center; gap: 16px; padding: 16px; border-radius: 12px; background: var(--md-sys-color-surface-2);">
                        <img *ngIf="vm.selectedItem()!.image" [src]="vm.resolveImageUrl(vm.selectedItem()!.image)" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
                        <div *ngIf="!vm.selectedItem()!.image" style="width: 80px; height: 80px; border-radius: 8px; background: var(--md-sys-color-surface-variant); display: flex; align-items: center; justify-content: center; opacity: 0.5;">
                            <lucide-icon name="camera" [size]="24"></lucide-icon>
                        </div>
                        <div style="flex: 1;">
                            <span class="text-label-large">Imagen del Plato</span>
                            <p class="text-body-small opacity-60">Recomendado formato cuadrado.</p>
                        </div>
                        <button class="btn-outline" (click)="mainImageInput.click()">Subir WebP</button>
                        <input #mainImageInput type="file" style="display: none" accept="image/*" (change)="onFileSelected($event, 'main')">
                    </div>

                    <div class="field-row">
                                            <div class="md-field">
                        <label class="text-label-large">{{ 'MENU_EDITOR.ITEM_NAME' | translate }}</label>
                        <input type="text" [(ngModel)]="vm.selectedItem()!.name" class="md-input">
                      </div>
                      <div class="md-field">
                        <label class="text-label-large">{{ 'MENU_EDITOR.CATEGORY' | translate }}</label>
                        <input type="text" [(ngModel)]="vm.selectedItem()!.category" list="cat-select" class="md-input" [placeholder]="'MENU_EDITOR.CAT_PLACEHOLDER' | translate">
                        <datalist id="cat-select">
                          @for (cat of vm.categories(); track cat.name) {
                              <option [value]="cat.name">
                          }
                        </datalist>
                      </div>
                    </div>
                    
                    <div class="field-row">
                      <div class="md-field">
                        <label class="text-label-large">{{ 'MENU_EDITOR.BASE_PRICE' | translate }}</label>
                        <div class="input-with-icon">
                            <input type="number" [(ngModel)]="vm.selectedItem()!.basePrice" class="md-input" [disabled]="vm.selectedItem()!.variants.length > 0">
                            <span class="icon-suffix">€</span>
                        </div>
                        @if (vm.selectedItem()!.variants.length > 0) {
                          <span class="text-label-small opacity-60">{{ 'MENU_EDITOR.PRICE_HINT' | translate }}</span>
                        }
                      </div>
                    </div>

                    <div class="md-field">
                      <label class="text-label-large">{{ 'MENU_EDITOR.DESCRIPTION' | translate }}</label>
                      <textarea [(ngModel)]="vm.selectedItem()!.description" class="md-input" rows="3"></textarea>
                    </div>
                  </section>

                  <!-- Allergens Selection -->
                  <section class="form-section-md3">
                    <h3 class="text-title-medium">{{ 'MENU_EDITOR.ALLERGENS_TAGS' | translate }}</h3>
                    <div class="chip-row">
                      @for (alg of ['Gluten', 'Lácteos', 'Frutos Secos', 'Huevo', 'Pescado', 'Soja']; track alg) {
                        <button class="chip" 
                                [class.is-active]="vm.selectedItem()!.allergens.includes(alg)"
                                (click)="vm.toggleAllergen(alg)">
                          <lucide-icon name="alert-circle" [size]="14" *ngIf="vm.selectedItem()!.allergens.includes(alg)"></lucide-icon>
                          {{ alg }}
                        </button>
                      }
                    </div>
                  </section>

                  <!-- Switch Component for Menu Type -->
                  <section class="form-section-md3 full-span">
                    <div class="md-card-elevated switch-card" (click)="vm.selectedItem()!.isMenu = !vm.selectedItem()!.isMenu; vm.selectedItem.set({...vm.selectedItem()!})">
                        <div class="switch-text">
                            <span class="text-title-medium">{{ 'MENU_EDITOR.IS_MENU' | translate }}</span>
                            <span class="text-body-medium opacity-60">{{ vm.selectedItem()!.isMenu ? ('MENU_EDITOR.YES_MENU' | translate) : ('MENU_EDITOR.NO_MENU' | translate) }}</span>
                        </div>
                        <div class="md-switch" [class.is-on]="vm.selectedItem()!.isMenu">
                            <div class="switch-handle"></div>
                        </div>
                    </div>
                  </section>

                  @if (vm.selectedItem()!.isMenu) {
                    <section class="form-section-md3 full-span">
                        <div class="section-title-md3">
                            <h3 class="text-title-medium">{{ 'MENU_EDITOR.MENU_STRUCT' | translate }}</h3>
                            <button class="btn-text" (click)="vm.addMenuSection()">
                                <lucide-icon name="plus" [size]="16"></lucide-icon>
                                {{ 'MENU_EDITOR.ADD_SEC' | translate }}
                            </button>
                        </div>
                        
                        <div class="menu-sections-column">
                            @for (sec of vm.selectedItem()!.menuSections; track $index; let sIdx = $index) {
                                <div class="md-card section-editor-card">
                                    <div class="section-header-row">
                                        <input type="text" [(ngModel)]="sec.name" placeholder="Ej: Primer Plato" class="md-input-transparent text-title-medium">
                                        <button class="icon-btn error" (click)="vm.removeMenuSection(sIdx)">
                                            <lucide-icon name="x" [size]="16"></lucide-icon>
                                        </button>
                                    </div>
                                    
                                    <div class="options-container">
                                        <span class="text-label-small opacity-40 uppercase">{{ 'MENU_EDITOR.AVAILABLE_OPTS' | translate }}</span>
                                        @for (opt of sec.options; track $index; let oIdx = $index) {
                                            <div class="option-field-row">
                                                <input type="text" [(ngModel)]="sec.options[oIdx]" class="md-input-compact">
                                                <button class="icon-btn-xs" (click)="vm.removeMenuOption(sIdx, oIdx)">
                                                    <lucide-icon name="minus" [size]="14"></lucide-icon>
                                                </button>
                                            </div>
                                        }
                                        <button class="btn-tonal-sm" (click)="vm.addMenuOption(sIdx)">
                                            <lucide-icon name="plus" [size]="14"></lucide-icon>
                                            {{ 'MENU_EDITOR.ADD_DISH' | translate }}
                                        </button>
                                    </div>
                                </div>
                            }
                        </div>
                    </section>
                  }

                  <div class="field-row full-span">
                    <!-- Complex List Editors (Variants / Addons) -->
                    <section class="form-section-md3 flex-1">
                      <div class="section-title-md3">
                        <h3 class="text-title-medium">{{ 'MENU_EDITOR.VARIANTS' | translate }}</h3>
                        <button class="btn-icon-add" (click)="vm.addVariant()"><lucide-icon name="plus" [size]="18"></lucide-icon></button>
                      </div>
                      <div class="list-stack">
                        @for (v of vm.selectedItem()!.variants; track $index; let vIdx = $index) {
                          <div class="list-item-row-md3" style="align-items: center;">
                            <img *ngIf="v.image" [src]="vm.resolveImageUrl(v.image)" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px;">
                            <button class="icon-btn" (click)="variantImageInput.click()" [title]="'Subir imagen de la variante'"><lucide-icon name="camera" [size]="14"></lucide-icon></button>
                            <input #variantImageInput type="file" style="display: none" accept="image/*" (change)="onFileSelected($event, 'variant', vIdx)">

                            <input type="text" [(ngModel)]="v.name" class="md-input-compact flex-2" [placeholder]="'MENU_EDITOR.VAR_NAME_PH' | translate">
                            <input type="number" [(ngModel)]="v.price" class="md-input-compact flex-1" placeholder="0.00">
                            <button class="icon-btn error" (click)="vm.removeVariant(vIdx)"><lucide-icon name="trash-2" [size]="14"></lucide-icon></button>
                          </div>
                        }
                      </div>
                    </section>

                    <section class="form-section-md3 flex-1">
                      <div class="section-title-md3">
                        <h3 class="text-title-medium">{{ 'MENU_EDITOR.ADDONS' | translate }}</h3>
                        <button class="btn-icon-add" (click)="vm.addAddon()"><lucide-icon name="plus" [size]="18"></lucide-icon></button>
                      </div>
                      <div class="list-stack">
                        @for (a of vm.selectedItem()!.addons; track $index) {
                          <div class="list-item-row-md3">
                            <input type="text" [(ngModel)]="a.name" class="md-input-compact flex-2" [placeholder]="'MENU_EDITOR.ADDON_PH' | translate">
                            <input type="number" [(ngModel)]="a.price" class="md-input-compact flex-1" placeholder="0.00">
                            <button class="icon-btn error" (click)="vm.removeAddon($index)"><lucide-icon name="trash-2" [size]="14"></lucide-icon></button>
                          </div>
                        }
                      </div>
                    </section>
                  </div>
                </div>

                @if (vm.selectedItem()?._id) {
                  <div class="danger-section-md3">
                    <div class="danger-header">
                        <lucide-icon name="alert-triangle" [size]="20"></lucide-icon>
                        <span class="text-title-small">{{ 'MENU_EDITOR.DANGER_ZONE' | translate }}</span>
                    </div>
                    <p class="text-body-small opacity-60">{{ 'MENU_EDITOR.DANGER_DESC' | translate }}</p>
                    <button class="btn-error" (click)="vm.deleteItem(vm.selectedItem()!._id!)">
                        {{ 'MENU_EDITOR.DEL_PERMANENTLY' | translate }}
                    </button>
                  </div>
                }
              </div>
            </div>
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
    </div>
  `,
  styles: [`
    .editor-container {
      display: flex;
      flex-direction: column;
      gap: 32px;
      height: calc(100vh - 120px);
    }

    .section-header-md3 {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 24px;
    }

    .editor-main-layout {
        display: grid;
        grid-template-columns: 320px 1fr;
        gap: 32px;
        flex: 1;
        min-height: 0; /* Important for scroll */
    }

    @media (max-width: 1024px) {
        .editor-main-layout { grid-template-columns: 1fr; }
        .menu-structure { max-height: 300px; overflow-y: auto; }
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

    .editor-detail { 
        height: 100%;
        min-height: 0;
    }

    .detail-form {
        height: 100%;
        background: var(--md-sys-color-surface-1);
        display: flex;
        flex-direction: column;
        padding: 0;
        overflow: hidden;
    }

    .form-header-row {
        padding: 24px 32px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--md-sys-color-outline-variant);
        background: var(--md-sys-color-surface-1);
        z-index: 10;
    }

    .form-actions-md3 { display: flex; gap: 12px; }

    .form-scrollable {
        flex: 1;
        overflow-y: auto;
        padding: 32px;
        display: flex;
        flex-direction: column;
        gap: 32px;
    }

    .form-grid-md3 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 32px;
    }

    .full-span { grid-column: 1 / -1; }

    .form-section-md3 { display: flex; flex-direction: column; gap: 20px; }
    
    .field-row { display: flex; gap: 20px; }
    .field-row .md-field { flex: 1; }

    .md-field { display: flex; flex-direction: column; gap: 6px; }
    
    .md-input {
        background: var(--md-sys-color-surface-variant);
        border: none; border-radius: 8px; padding: 12px 16px;
        color: var(--md-sys-color-on-surface); font-family: inherit;
        transition: box-shadow 0.2s;
    }
    .md-input:focus { box-shadow: 0 0 0 2px var(--md-sys-color-primary); outline: none; }

    .input-with-icon { position: relative; }
    .icon-suffix { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); opacity: 0.4; }

    .chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 16px; border-radius: 20px; border: 1px solid var(--md-sys-color-outline);
        background: transparent; color: var(--md-sys-color-on-surface);
        cursor: pointer; transition: 0.2s; font-size: 0.85rem;
    }
    .chip.is-active {
        background: var(--md-sys-color-primary-container);
        border-color: var(--md-sys-color-primary-container);
        color: var(--md-sys-color-on-primary-container);
        font-weight: 600;
    }

    .switch-card {
        padding: 20px 24px;
        display: flex; justify-content: space-between; align-items: center;
        background: var(--md-sys-color-surface-2);
        cursor: pointer;
    }

    .switch-text { display: flex; flex-direction: column; }

    .md-switch {
        width: 52px; height: 32px; border-radius: 16px;
        background: var(--md-sys-color-surface-variant);
        position: relative; transition: background 0.2s;
    }
    .md-switch.is-on { background: var(--md-sys-color-primary); }
    
    .switch-handle {
        width: 24px; height: 24px; border-radius: 50%;
        background: var(--md-sys-color-on-surface-variant);
        position: absolute; left: 4px; top: 4px;
        transition: transform 0.2s, background 0.2s;
    }
    .md-switch.is-on .switch-handle {
        transform: translateX(20px);
        background: var(--md-sys-color-on-primary);
    }

    .section-title-md3 { display: flex; justify-content: space-between; align-items: center; }

    .section-editor-card { padding: 16px; background: var(--md-sys-color-surface-2); }
    .section-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    
    .md-input-transparent {
        background: transparent; border: none; border-bottom: 2px solid var(--md-sys-color-outline-variant);
        padding: 8px 0; color: var(--md-sys-color-on-surface); width: 100%;
    }
    .md-input-transparent:focus { border-color: var(--md-sys-color-primary); outline: none; }

    .options-container { display: flex; flex-direction: column; gap: 12px; }
    .option-field-row { display: flex; gap: 8px; }
    .md-input-compact {
        background: var(--md-sys-color-surface-3); border: none; border-radius: 6px;
        padding: 8px 12px; color: var(--md-sys-color-on-surface); font-size: 0.9rem;
    }

    .list-stack { display: flex; flex-direction: column; gap: 8px; }
    .list-item-row-md3 { display: flex; gap: 8px; }

    .btn-icon-add {
        width: 32px; height: 32px; border-radius: 50%; border: none;
        background: var(--md-sys-color-primary-container);
        color: var(--md-sys-color-on-primary-container);
        display: flex; align-items: center; justify-content: center; cursor: pointer;
    }

    .danger-section-md3 {
        margin-top: 32px; padding: 24px;
        border: 1px solid var(--md-sys-color-error-container);
        background: color-mix(in srgb, var(--md-sys-color-error) 4%, transparent);
        border-radius: 16px;
        display: flex; flex-direction: column; gap: 12px;
    }
    .danger-header { display: flex; align-items: center; gap: 12px; color: var(--md-sys-color-error); }
    
    .empty-detail-state {
        height: 100%; display: flex; flex-direction: column;
        align-items: center; justify-content: center; text-align: center;
        opacity: 0.2;
    }
    .empty-icon-box { margin-bottom: 24px; }

    .uppercase { text-transform: uppercase; letter-spacing: 1px; }
    .mt-16 { margin-top: 16px; }
    .opacity-60 { opacity: 0.6; }
    .opacity-40 { opacity: 0.4; }
    .flex-1 { flex: 1; }
    .flex-2 { flex: 2; }
  `]
})
export class MenuEditorComponent implements OnInit {
  public vm = inject(MenuEditorViewModel);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.vm.loadMenu();

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((e: any) => {
      if (e.url?.includes('/menu')) {
        this.vm.loadMenu();
      }
    });
  }

  async onFileSelected(event: any, target: 'main' | 'variant', variantIndex?: number) {
    const file = event.target.files?.[0];
    if (!file) return;

    this.vm.loading.set(true);
    const imageUrl = await this.vm.uploadImage(file);
    if (imageUrl) {
        const item = this.vm.selectedItem();
        if (item) {
            if (target === 'main') {
                item.image = imageUrl;
            } else if (target === 'variant' && variantIndex !== undefined) {
                item.variants[variantIndex].image = imageUrl;
            }
            this.vm.selectedItem.set({ ...item });
        }
    }
    this.vm.loading.set(false);
    event.target.value = ''; // Reset input
  }
}
