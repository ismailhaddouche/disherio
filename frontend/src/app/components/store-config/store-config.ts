import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreConfigViewModel } from './store-config.viewmodel';
import { AuthService } from '../../services/auth.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-store-config',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  providers: [StoreConfigViewModel],
  template: `
    <div class="config-container animate-fade-in">
      <header class="view-header">
        <h1 class="view-title"><lucide-icon name="settings" class="inline-icon text-muted"></lucide-icon>Configuración de Tienda</h1>
        <button class="btn-save" (click)="vm.saveConfig()">
          {{ vm.saving() ? 'Guardando...' : 'GUARDAR CAMBIOS' }}
        </button>
      </header>

      @if (vm.message()) {
        <div class="alert glass-card">
            {{ vm.message() }}
        </div>
      }

      @if (vm.loading()) {
        <div class="loader">Cargando configuración...</div>
      } @else {
        <main class="config-grid">
          
          <!-- General Info -->
          <section class="card-section glass-card">
            <h2 class="card-title">Información General</h2>
            
            <div class="form-group">
                <label>Nombre del Restaurante</label>
                <input type="text" [(ngModel)]="vm.config().name" class="glass-input">
            </div>

            <div class="form-group">
                <label>Logo (URL)</label>
                <input type="url" [(ngModel)]="vm.config().logo" class="glass-input" placeholder="https://ejemplo.com/logo.png">
                <small *ngIf="vm.config().logo">Vista previa: <img [src]="vm.config().logo" style="height: 20px; vertical-align: middle"></small>
            </div>

            <div class="form-group">
                <label>Descripción / Slogan</label>
                <textarea [(ngModel)]="vm.config().description" class="glass-input" rows="3"></textarea>
            </div>

            <div class="form-group">
                <label>Teléfono de Contacto</label>
                <input type="tel" [(ngModel)]="vm.config().phone" class="glass-input">
            </div>

            <div class="form-group">
                <label>Dominio (URL)</label>
                <input type="url" [(ngModel)]="vm.config().domain" class="glass-input" placeholder="https://mirestaurante.com">
                <small>Enlace principal para QR y compartidos.</small>
            </div>
          </section>

          <!-- Social Networks -->
          <section class="card-section glass-card">
            <h2 class="card-title">Redes Sociales</h2>
            
            <div class="form-group">
                <label>Instagram</label>
                <div class="input-icon">
                    <lucide-icon name="camera" class="text-muted"></lucide-icon>
                    <input type="text" [ngModel]="vm.config().socials?.instagram" (ngModelChange)="vm.updateSocial('instagram', $event)" class="glass-input" placeholder="@usuario">
                </div>
            </div>

            <div class="form-group">
                <label>Facebook</label>
                <div class="input-icon">
                    <lucide-icon name="facebook" class="text-muted"></lucide-icon>
                    <input type="text" [ngModel]="vm.config().socials?.facebook" (ngModelChange)="vm.updateSocial('facebook', $event)" class="glass-input">
                </div>
            </div>

            <div class="form-group">
                <label>Sitio Web</label>
                <div class="input-icon">
                    <lucide-icon name="globe" class="text-muted"></lucide-icon>
                    <input type="text" [ngModel]="vm.config().socials?.website" (ngModelChange)="vm.updateSocial('website', $event)" class="glass-input">
                </div>
            </div>
          </section>

          <!-- Appearance -->
          <section class="card-section glass-card">
            <h2 class="card-title">Apariencia de la App</h2>
            <p class="card-subtitle">Personaliza los colores que ven tus clientes.</p>

            <div class="colors-grid">
                <div class="color-picker">
                    <label>Color Principal</label>
                    <div class="cp-wrapper">
                        <input type="color" [ngModel]="vm.config().theme?.primaryColor" (ngModelChange)="vm.updateTheme('primaryColor', $event)">
                        <input type="text" [ngModel]="vm.config().theme?.primaryColor" (ngModelChange)="vm.updateTheme('primaryColor', $event)" class="glass-input code">
                    </div>
                </div>

                <div class="color-picker">
                    <label>Color Secundario</label>
                    <div class="cp-wrapper">
                        <input type="color" [ngModel]="vm.config().theme?.secondaryColor" (ngModelChange)="vm.updateTheme('secondaryColor', $event)">
                        <input type="text" [ngModel]="vm.config().theme?.secondaryColor" (ngModelChange)="vm.updateTheme('secondaryColor', $event)" class="glass-input code">
                    </div>
                </div>

                <div class="color-picker">
                    <label>Fondo App</label>
                    <div class="cp-wrapper">
                        <input type="color" [ngModel]="vm.config().theme?.backgroundColor" (ngModelChange)="vm.updateTheme('backgroundColor', $event)">
                        <input type="text" [ngModel]="vm.config().theme?.backgroundColor" (ngModelChange)="vm.updateTheme('backgroundColor', $event)" class="glass-input code">
                    </div>
                </div>

                <div class="color-picker">
                    <label>Color de Texto</label>
                    <div class="cp-wrapper">
                        <input type="color" [ngModel]="vm.config().theme?.textColor" (ngModelChange)="vm.updateTheme('textColor', $event)">
                        <input type="text" [ngModel]="vm.config().theme?.textColor" (ngModelChange)="vm.updateTheme('textColor', $event)" class="glass-input code">
                    </div>
                </div>
            </div>

            <div class="preview-box" [style.background]="vm.config().theme?.backgroundColor">
                <div class="preview-card" 
                     [style.border-top-color]="vm.config().theme?.primaryColor"
                     [style.color]="vm.config().theme?.textColor">
                    <h3 [style.color]="vm.config().theme?.textColor">{{ vm.config().name || 'Nombre Restaurante' }}</h3>
                    <p style="font-size: 0.8rem; opacity: 0.8">Ejemplo de texto con el color seleccionado.</p>
                    <button [style.background]="vm.config().theme?.secondaryColor">Botón Acción</button>
                </div>
            </div>
          </section>

          <!-- Billing Configuration -->
          <section class="card-section glass-card billing-section">
            <h2 class="card-title"><lucide-icon name="credit-card" class="inline-icon mr-2"></lucide-icon>Configuración de Facturación</h2>
            <p class="card-subtitle">Configura cómo se calculan los tickets e impuestos.</p>
            
            <div class="form-group">
                <label>IVA (%)</label>
                <input type="number" 
                       [ngModel]="vm.config().billing?.vatPercentage" 
                       (ngModelChange)="vm.updateBilling('vatPercentage', $event ? +$event  : null)" 
                       class="glass-input" 
                       placeholder="Ej: 10"
                       min="0"
                       max="100"
                       step="0.1">
                <small>⚠️ Obligatorio para generar tickets. Los precios se introducen con IVA incluido.</small>
            </div>

            <div class="form-group">
                <label class="checkbox-label">
                    <input type="checkbox" 
                           [ngModel]="vm.config().billing?.tipEnabled" 
                           (ngModelChange)="vm.updateBilling('tipEnabled', $event)">
                    <span>Activar Propinas</span>
                </label>
            </div>

            @if (vm.config().billing?.tipEnabled) {
                <div class="form-group indent">
                    <label>Porcentaje de Propina (%)</label>
                    <input type="number" 
                           [ngModel]="vm.config().billing?.tipPercentage" 
                           (ngModelChange)="vm.updateBilling('tipPercentage', +$event)" 
                           class="glass-input" 
                           placeholder="Ej: 5"
                           min="0"
                           max="100"
                           step="0.5">
                </div>

                <div class="form-group indent">
                    <label>Descripción de la Propina</label>
                    <input type="text" 
                           [ngModel]="vm.config().billing?.tipDescription" 
                           (ngModelChange)="vm.updateBilling('tipDescription', $event)" 
                           class="glass-input" 
                           placeholder="Ej: La propina es opcional">
                    <small>Este texto se muestra en el ticket.</small>
                </div>
            }
          </section>

          <!-- Printer Configuration (Local) -->
          <section class="card-section glass-card printer-section">
            <h2 class="card-title"><lucide-icon name="printer" class="inline-icon mr-2"></lucide-icon>Configuración de Impresora</h2>
            <p class="card-subtitle">Configuración específica de este dispositivo.</p>
            
            <div class="form-group">
                <label>Dirección IP de la Impresora</label>
                <input type="text" 
                       [ngModel]="vm.localConfig().printer?.ip" 
                       (ngModelChange)="vm.updateLocalConfig('printer', 'ip', $event)" 
                       class="glass-input" 
                       placeholder="Ej: 192.168.1.100">
            </div>

            <div class="form-group">
                <label>Puerto</label>
                <input type="text" 
                       [ngModel]="vm.localConfig().printer?.port" 
                       (ngModelChange)="vm.updateLocalConfig('printer', 'port', $event)" 
                       class="glass-input" 
                       placeholder="9100">
            </div>

            <div class="form-group">
                <label>Tipo de Impresora</label>
                <select [ngModel]="vm.localConfig().printer?.type" 
                        (ngModelChange)="vm.updateLocalConfig('printer', 'type', $event)" 
                        class="glass-input">
                    <option value="thermal">Térmica (ESC/POS)</option>
                    <option value="system">Sistema (Windows/Mac/Android)</option>
                </select>
            </div>

            <div class="form-group">
                <label>Ancho de Papel</label>
                <select [ngModel]="vm.localConfig().printer?.paperWidth" 
                        (ngModelChange)="vm.updateLocalConfig('printer', 'paperWidth', $event)" 
                        class="glass-input">
                    <option value="80mm">80mm</option>
                    <option value="58mm">58mm</option>
                </select>
            </div>

            <div class="form-group">
                <label class="checkbox-label">
                    <input type="checkbox" 
                           [ngModel]="vm.localConfig().printer?.autoPrint" 
                           (ngModelChange)="vm.updateLocalConfig('printer', 'autoPrint', $event)">
                    <span>Impresión Automática al Cobrar</span>
                </label>
            </div>
          </section>
        </main>
      }
    </div>
  `,
  styles: [`
    .config-container {
      padding: 0;
      background: transparent;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .btn-save {
      background: var(--highlight);
      color: var(--bg-dark);
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 900;
      cursor: pointer;
    }

    .alert {
        padding: 12px; text-align: center; color: var(--highlight); font-weight: bold;
        border: 1px solid var(--highlight);
        animation: fadeIn 0.3s;
    }

    .config-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 24px;
      padding-bottom: 40px;
    }

    @media (max-width: 768px) {
      .btn-save { width: 100%; }
      .config-grid { grid-template-columns: 1fr; }
    }

    .inline-icon { display: inline-block; vertical-align: text-bottom; }
    .mr-2 { margin-right: 8px; }
    .text-muted { color: var(--text-muted); opacity: 0.8; }
    
    .form-group { display: flex; flex-direction: column; gap: 6px; color: var(--text-base); }
    label { font-size: 0.8rem; font-weight: bold; color: var(--text-base); opacity: 0.8; }
    
    .glass-input {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      color: var(--text-base);
      padding: 10px;
      border-radius: 8px;
    }

    .input-icon { display: flex; align-items: center; gap: 8px; }
    .input-icon span { font-size: 1.2rem; }
    .input-icon input { flex: 1; }

    .colors-grid { display: flex; flex-direction: column; gap: 12px; }
    .color-picker { display: flex; justify-content: space-between; align-items: center; }
    .cp-wrapper { display: flex; gap: 8px; align-items: center; }
    
    input[type="color"] {
        width: 40px; height: 40px; padding: 0; border: none; cursor: pointer; background: none;
    }
    .glass-input.code { width: 80px; text-align: center; font-family: monospace; }

    .preview-box {
        margin-top: 16px;
        padding: 24px;
        border-radius: 12px;
        border: 1px dashed rgba(255,255,255,0.2);
        display: flex; justify-content: center;
    }
    .preview-card {
        padding: 16px;
        background: rgba(255,255,255,0.1);
        border-radius: 8px;
        border-top: 4px solid;
        text-align: center;
        width: 100%;
    }
    .preview-card button {
        margin-top: 8px; border: none; padding: 8px 16px; border-radius: 4px; color: white; font-weight: bold;
    }

    /* Billing Section */
    .billing-section { background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(16, 185, 129, 0.05)); }
    .printer-section { background: linear-gradient(135deg, rgba(168, 85, 247, 0.05), rgba(236, 72, 153, 0.05)); }
    .checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .checkbox-label input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; }
    .form-group.indent { margin-left: 24px; padding-left: 16px; border-left: 2px solid rgba(59, 130, 246, 0.3); }
    small { font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; }
    select.glass-input { width: 100%; cursor: pointer; color: var(--text-base); }
    select.glass-input option { background: var(--bg-dark); color: var(--text-base); }

    /* fadeIn animation now in global styles.css */
  `]
})
export class StoreConfigComponent {
  public vm = inject(StoreConfigViewModel);
}
