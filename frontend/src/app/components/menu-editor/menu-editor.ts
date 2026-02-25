import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuEditorViewModel } from './menu-editor.viewmodel';

@Component({
  selector: 'app-menu-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [MenuEditorViewModel],
  template: `
    <div class="editor-container">
      <aside class="menu-structure glass-card">
        <header class="section-header">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="logo.svg" alt="Disher.io Logo" style="height: 32px; border-radius: 6px;">
            <h2 class="gradient-text" style="margin: 0;">CARTAS DISHER</h2>
          </div>
          <button class="btn-primary" (click)="vm.selectItem(null)">+ Nuevo Plato</button>
        </header>

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
                      <span class="allergen-count">🚫 {{ item.allergens.length }}</span>
                      <span class="variant-count">📦 {{ item.variants.length }} var.</span>
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
              <h2 class="gradient-text">{{ vm.selectedItem()?._id ? 'Editar Plato' : 'Nuevo Plato' }}</h2>
              <div class="form-actions">
                <button class="btn-secondary" (click)="vm.isEditing.set(false)">Cancelar</button>
                <button class="btn-primary" (click)="vm.saveItem()">Guardar Cambios</button>
              </div>
            </header>

            <div class="form-grid">
              <!-- Basic Info -->
              <section class="form-section">
                <h3>Información Básica</h3>
                <div class="input-group">
                  <label>Nombre del Plato</label>
                  <input type="text" [(ngModel)]="vm.selectedItem()!.name" class="glass-input">
                </div>
                <div class="input-group">
                  <label>Categoría</label>
                  <input type="text" [(ngModel)]="vm.selectedItem()!.category" list="categoryOptions" class="glass-input" placeholder="Nueva o existente...">
                  <datalist id="categoryOptions">
                    @for (cat of vm.categories(); track cat.name) {
                        <option [value]="cat.name">
                    }
                  </datalist>
                </div>
                <div class="input-group">
                  <label>Precio Base (€)</label>
                  <input type="number" 
                         [(ngModel)]="vm.selectedItem()!.basePrice" 
                         class="glass-input"
                         [disabled]="vm.selectedItem()!.variants.length > 0"
                         [placeholder]="vm.selectedItem()!.variants.length > 0 ? 'Definido por variantes' : '0.00'">
                  @if (vm.selectedItem()!.variants.length > 0) {
                    <span class="input-hint">El precio base se ignora cuando hay variantes.</span>
                  }
                </div>
                <div class="input-group full">
                  <label>Descripción</label>
                  <textarea [(ngModel)]="vm.selectedItem()!.description" class="glass-input"></textarea>
                </div>
              </section>

              <!-- Allergens & Tags -->
              <section class="form-section">
                <h3>Alérgenos y Etiquetas</h3>
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
                  <label>Etiquetas (separadas por coma)</label>
                  <input type="text" placeholder="Vegano, Picante, Chef..." class="glass-input">
                </div>
              </section>

              <!-- Type Toggle -->
              <section class="form-section full">
                <div class="toggle-container glass-card" (click)="vm.selectedItem()!.isMenu = !vm.selectedItem()!.isMenu; vm.selectedItem.set({...vm.selectedItem()!})">
                    <div class="toggle-status">
                        <h4>¿Es un Menú? (Ej: Menú del día)</h4>
                        <p>{{ vm.selectedItem()!.isMenu ? 'Sí, permite elegir varios platos por un precio fijo.' : 'No, es un plato individual.' }}</p>
                    </div>
                    <div class="toggle-switch" [class.on]="vm.selectedItem()!.isMenu"></div>
                </div>
              </section>

              @if (vm.selectedItem()!.isMenu) {
                <!-- Menu Structure Editor -->
                <section class="form-section full">
                    <div class="section-title-action">
                        <h3>Estructura del Menú (Primeros, Segundos...)</h3>
                        <button class="btn-add" (click)="vm.addMenuSection()">+ Añadir Sección</button>
                    </div>
                    
                    <div class="menu-sections-grid">
                        @for (sec of vm.selectedItem()!.menuSections; track $index; let sIdx = $index) {
                            <div class="menu-section-card glass-card">
                                <div class="section-head">
                                    <input type="text" [(ngModel)]="sec.name" placeholder="Ej: Primer Plato" class="glass-input sec-name">
                                    <button class="btn-del" (click)="vm.removeMenuSection(sIdx)">×</button>
                                </div>
                                
                                <div class="options-list">
                                    <label>Opciones disponibles:</label>
                                    @for (opt of sec.options; track $index; let oIdx = $index) {
                                        <div class="option-row">
                                            <input type="text" [(ngModel)]="sec.options[oIdx]" placeholder="Nombre del plato" class="glass-input">
                                            <button class="btn-del-mini" (click)="vm.removeMenuOption(sIdx, oIdx)">×</button>
                                        </div>
                                    }
                                    <button class="btn-add-mini" (click)="vm.addMenuOption(sIdx)">+ Añadir Plato</button>
                                </div>
                            </div>
                        }
                    </div>
                </section>
              }

              <!-- Variants -->
              <section class="form-section">
                <div class="section-title-action">
                  <h3>Variantes (Tamaños/Versiones)</h3>
                  <button class="btn-add" (click)="vm.addVariant()">+ Añadir</button>
                </div>
                <div class="list-editor">
                  @for (v of vm.selectedItem()!.variants; track $index) {
                    <div class="list-item">
                      <input type="text" [(ngModel)]="v.name" placeholder="Nombre (ej: XL)" class="glass-input flex-2">
                      <input type="number" [(ngModel)]="v.price" placeholder="Precio Total" class="glass-input flex-1">
                      <button class="btn-del" (click)="vm.removeVariant($index)">×</button>
                    </div>
                  }
                </div>
              </section>

              <!-- Addons -->
              <section class="form-section">
                <div class="section-title-action">
                  <h3>Complementos / Extras</h3>
                  <button class="btn-add" (click)="vm.addAddon()">+ Añadir</button>
                </div>
                <div class="list-editor">
                  @for (a of vm.selectedItem()!.addons; track $index) {
                    <div class="list-item">
                      <input type="text" [(ngModel)]="a.name" placeholder="Extra (ej: Queso)" class="glass-input flex-2">
                      <input type="number" [(ngModel)]="a.price" placeholder="Precio" class="glass-input flex-1">
                      <button class="btn-del" (click)="vm.removeAddon($index)">×</button>
                    </div>
                  }
                </div>
              </section>
            </div>

            @if (vm.selectedItem()?._id) {
              <div class="danger-zone">
                <button class="btn-danger" (click)="vm.deleteItem(vm.selectedItem()!._id!)">Eliminar Plato Permanentemente</button>
              </div>
            }
          </div>
        } @else {
          <div class="no-selection-empty glass-card">
            <div class="icon">📖</div>
            <h2>Gestor de Menú Profesional</h2>
            <p>Selecciona un plato para editar sus detalles o crea uno nuevo desde cero.</p>
          </div>
        }
      </main>
    </div>
  `,
  styles: [`
    .editor-container {
      display: grid;
      grid-template-columns: 400px 1fr;
      gap: 24px;
      height: 100vh;
      padding: 24px;
      background: var(--bg-dark);
      overflow: hidden;
    }

    @media (max-width: 1024px) {
      .editor-container { grid-template-columns: 320px 1fr; gap: 16px; padding: 16px; }
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

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
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
