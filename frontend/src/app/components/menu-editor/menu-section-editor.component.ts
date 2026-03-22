import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';
import { MenuEditorViewModel } from './menu-editor.viewmodel';

@Component({
  selector: 'app-menu-section-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, TranslateModule],
  template: `
    @if (vm.selectedItem(); as item) {
      <section class="form-section-md3 full-span">
          <div class="section-title-md3">
              <h3 class="text-title-medium">{{ 'MENU_EDITOR.MENU_STRUCT' | translate }}</h3>
              <button class="btn-text" (click)="vm.addMenuSection()">
                  <lucide-icon name="plus" [size]="16"></lucide-icon>
                  {{ 'MENU_EDITOR.ADD_SEC' | translate }}
              </button>
          </div>
          
          <div class="menu-sections-column">
              @for (sec of item.menuSections; track $index; let sIdx = $index) {
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
  `,
  styles: [`
    .form-section-md3 { display: flex; flex-direction: column; gap: 20px; }
    .full-span { grid-column: 1 / -1; }
    .section-title-md3 { display: flex; justify-content: space-between; align-items: center; }
    .menu-sections-column { display: flex; flex-direction: column; gap: 16px; }
    .section-editor-card { padding: 16px; background: var(--md-sys-color-surface-2); border-radius: 12px; }
    .section-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .options-container { display: flex; flex-direction: column; gap: 12px; }
    .option-field-row { display: flex; gap: 8px; }
    .uppercase { text-transform: uppercase; letter-spacing: 1px; }
  `]
})
export class MenuSectionEditorComponent {
  public vm = inject(MenuEditorViewModel);
}
