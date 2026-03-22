import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';
import { MenuEditorViewModel } from './menu-editor.viewmodel';
import { MenuSectionEditorComponent } from './menu-section-editor.component';

@Component({
  selector: 'app-menu-item-form',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, TranslateModule, MenuSectionEditorComponent],
  template: `
    @if (vm.selectedItem(); as item) {
      <div class="md-form-panel detail-form">
        <header class="md-form-panel-header">
          <div>
            <h2 class="text-headline-small">{{ item._id ? ('MENU_EDITOR.EDIT_ITEM' | translate) : ('MENU_EDITOR.NEW_ITEM' | translate) }}</h2>
            <p class="text-body-small opacity-60">{{ 'MENU_EDITOR.PRO_MANAGER' | translate }}</p>
          </div>
          <div class="form-actions-md3">
            <button class="btn-outline" (click)="vm.isEditing.set(false)">{{ 'MENU_EDITOR.CANCEL' | translate }}</button>
            <button class="btn-primary" (click)="vm.saveItem()">
              <lucide-icon name="check" [size]="18"></lucide-icon>
              {{ 'MENU_EDITOR.SAVE_CHANGES' | translate }}
            </button>
          </div>
        </header>

        <div class="md-form-panel-body form-scrollable">
          <div class="form-grid-md3">
            <!-- Fundamental Data -->
            <section class="form-section-md3">
              <h3 class="text-title-medium">{{ 'MENU_EDITOR.BASIC_INFO' | translate }}</h3>
              
              <div class="image-upload-row md-card-elevated" style="margin-bottom: 16px; display: flex; align-items: center; gap: 16px; padding: 16px; border-radius: 12px; background: var(--md-sys-color-surface-2);">
                  <img *ngIf="item.image" [src]="vm.resolveImageUrl(item.image)" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
                  <div *ngIf="!item.image" style="width: 80px; height: 80px; border-radius: 8px; background: var(--md-sys-color-surface-variant); display: flex; align-items: center; justify-content: center; opacity: 0.5;">
                      <lucide-icon name="camera" [size]="24"></lucide-icon>
                  </div>
                  <div style="flex: 1;">
                      <span class="text-label-large">{{ 'MENU_EDITOR.DISH_IMAGE' | translate }}</span>
                      <p class="text-body-small opacity-60">{{ 'MENU_EDITOR.IMAGE_HINT' | translate }}</p>
                  </div>
                  <button class="btn-outline" (click)="mainImageInput.click()">{{ 'MENU_EDITOR.UPLOAD_BTN' | translate }}</button>
                  <input #mainImageInput type="file" style="display: none" accept="image/*" (change)="onFileSelected($event, 'main')">
              </div>

              <div class="field-row">
                <div class="md-field">
                  <label class="text-label-large">{{ 'MENU_EDITOR.ITEM_NAME' | translate }}</label>
                  <input type="text" [(ngModel)]="item.name" class="md-input">
                </div>
                <div class="md-field">
                  <label class="text-label-large">{{ 'MENU_EDITOR.CATEGORY' | translate }}</label>
                  <input type="text" [(ngModel)]="item.category" list="cat-select" class="md-input" [placeholder]="'MENU_EDITOR.CAT_PLACEHOLDER' | translate">
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
                      <input type="number" [(ngModel)]="item.basePrice" class="md-input" [disabled]="item.variants.length > 0">
                      <span class="icon-suffix">€</span>
                  </div>
                  @if (item.variants.length > 0) {
                    <span class="text-label-small opacity-60">{{ 'MENU_EDITOR.PRICE_HINT' | translate }}</span>
                  }
                </div>
              </div>

              <div class="md-field">
                <label class="text-label-large">{{ 'MENU_EDITOR.DESCRIPTION' | translate }}</label>
                <textarea [(ngModel)]="item.description" class="md-input" rows="3"></textarea>
              </div>
            </section>

            <!-- Allergens Selection -->
            <section class="form-section-md3">
              <h3 class="text-title-medium">{{ 'MENU_EDITOR.ALLERGENS_TAGS' | translate }}</h3>
              <div class="chip-row">
                @for (alg of ['Gluten', 'Lácteos', 'Frutos Secos', 'Huevo', 'Pescado', 'Soja']; track alg) {
                  <button class="chip" 
                          [class.is-active]="item.allergens.includes(alg)"
                          (click)="vm.toggleAllergen(alg)">
                    <lucide-icon name="alert-circle" [size]="14" *ngIf="item.allergens.includes(alg)"></lucide-icon>
                    {{ alg }}
                  </button>
                }
              </div>
            </section>

            <!-- Switch Component for Menu Type -->
            <section class="form-section-md3 full-span">
              <div class="md-card-elevated switch-card" (click)="item.isMenu = !item.isMenu; vm.selectedItem.set({...item})">
                  <div class="switch-text">
                      <span class="text-title-medium">{{ 'MENU_EDITOR.IS_MENU' | translate }}</span>
                      <span class="text-body-medium opacity-60">{{ item.isMenu ? ('MENU_EDITOR.YES_MENU' | translate) : ('MENU_EDITOR.NO_MENU' | translate) }}</span>
                  </div>
                  <div class="md-switch" [class.is-on]="item.isMenu">
                      <div class="switch-handle"></div>
                  </div>
              </div>
            </section>

            @if (item.isMenu) {
              <app-menu-section-editor></app-menu-section-editor>
            }

            <div class="field-row full-span">
              <!-- Complex List Editors (Variants / Addons) -->
              <section class="form-section-md3 flex-1">
                <div class="section-title-md3">
                  <h3 class="text-title-medium">{{ 'MENU_EDITOR.VARIANTS' | translate }}</h3>
                  <button class="btn-icon-add" (click)="vm.addVariant()"><lucide-icon name="plus" [size]="18"></lucide-icon></button>
                </div>
                <div class="list-stack">
                  @for (v of item.variants; track $index; let vIdx = $index) {
                    <div class="list-item-row-md3" style="align-items: center;">
                      <img *ngIf="v.image" [src]="vm.resolveImageUrl(v.image)" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px;">
                      <button class="icon-btn" (click)="variantImageInput.click()" [title]="'MENU_EDITOR.UPLOAD_VARIANT_IMAGE' | translate"><lucide-icon name="camera" [size]="14"></lucide-icon></button>
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
                  @for (a of item.addons; track $index) {
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

          @if (item._id) {
            <div class="danger-section-md3">
              <div class="danger-header">
                  <lucide-icon name="alert-triangle" [size]="20"></lucide-icon>
                  <span class="text-title-small">{{ 'MENU_EDITOR.DANGER_ZONE' | translate }}</span>
              </div>
              <p class="text-body-small opacity-60">{{ 'MENU_EDITOR.DANGER_DESC' | translate }}</p>
              <button class="btn-error" (click)="vm.deleteItem(item._id)">
                  {{ 'MENU_EDITOR.DEL_PERMANENTLY' | translate }}
              </button>
            </div>
          }
        </div>

        <footer class="md-form-panel-footer">
          <button class="btn-outline" (click)="vm.isEditing.set(false)">{{ 'MENU_EDITOR.CANCEL' | translate }}</button>
          <button class="btn-primary" (click)="vm.saveItem()">
            <lucide-icon name="check" [size]="18"></lucide-icon>
            {{ 'MENU_EDITOR.SAVE_CHANGES' | translate }}
          </button>
        </footer>
      </div>
    }
  `,
  styles: [`
    .detail-form {
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 0;
        overflow: hidden;
    }

    .form-actions-md3 { display: flex; gap: 12px; }

    .form-scrollable {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 32px;
        padding: 24px;
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
        border-radius: 12px;
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

    .opacity-60 { opacity: 0.6; }
    .flex-1 { flex: 1; }
    .flex-2 { flex: 2; }
  `]
})
export class MenuItemFormComponent {
  public vm = inject(MenuEditorViewModel);

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
