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
            
            <div class="form-row">
                <div class="form-group">
                    <label>Nombre del Restaurante</label>
                    <input type="text" [(ngModel)]="vm.config().name" class="glass-input">
                </div>

                <div class="form-group">
                    <label>Logo (URL)</label>
                    <input type="url" [(ngModel)]="vm.config().logo" class="glass-input" placeholder="https://ejemplo.com/logo.png">
                    <small *ngIf="vm.config().logo">Vista previa: <img [src]="vm.config().logo" style="height: 20px; vertical-align: middle"></small>
                </div>
            </div>

            <div class="form-group">
                <label>Descripción / Slogan</label>
                <textarea [(ngModel)]="vm.config().description" class="glass-input" rows="3"></textarea>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Teléfono de Contacto</label>
                    <input type="tel" [(ngModel)]="vm.config().phone" class="glass-input">
                </div>

                <div class="form-group">
                    <label>Dominio (URL)</label>
                    <input type="url" [(ngModel)]="vm.config().domain" class="glass-input" placeholder="https://mirestaurante.com">
                    <small>Enlace principal para QR y compartidos.</small>
                </div>
            </div>
          </section>

          <!-- Social Networks -->
          <section class="card-section glass-card">
            <h2 class="card-title">Redes Sociales</h2>
            
            <div class="form-row">
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
            <p class="card-subtitle">Personaliza los colores que ven tus clientes y tu equipo.</p>

            <div class="themes-grid">
                @for (theme of vm.predefinedThemes; track theme.id) {
                    <div class="theme-card glass-card" 
                         [class.active]="vm.isThemeActive(theme.id)"
                         (click)="vm.selectPredefinedTheme(theme.id)">
                        
                        <div class="theme-preview" [style.background]="theme.colors.backgroundColor">
                            <div class="theme-accent" [style.background]="'linear-gradient(135deg, ' + theme.colors.primaryColor + ', ' + theme.colors.secondaryColor + ')'"></div>
                            <div class="theme-text" [style.color]="theme.colors.textColor">Aa</div>
                        </div>
                        
                        <div class="theme-info">
                            <span class="theme-name">{{ theme.name }}</span>
                            <lucide-icon *ngIf="vm.isThemeActive(theme.id)" name="check-circle-2" [size]="18" class="text-primary"></lucide-icon>
                        </div>
                    </div>
                }
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

          <!-- Printer Configuration (Global) -->
          <section class="card-section glass-card printer-section">
            <div style="display:flex; justify-content: space-between; align-items:center;">
                <div>
                    <h2 class="card-title"><lucide-icon name="printer" class="inline-icon mr-2"></lucide-icon>Impresoras del Local</h2>
                    <p class="card-subtitle">Registra las impresoras disponibles para asignar a los usuarios.</p>
                </div>
                <button class="btn-primary" style="padding: 8px 12px; font-size: 0.8rem;" (click)="vm.addPrinter()">+ Añadir</button>
            </div>
            
            <div class="printers-list">
                @for (printer of vm.config().printers; track printer.id; let i = $index) {
                    <div class="printer-card glass-card" style="padding: 16px; margin-bottom: 12px;">
                        <div style="display:flex; justify-content: space-between; margin-bottom: 12px;">
                            <input type="text" [(ngModel)]="printer.name" class="glass-input" placeholder="Nombre (Ej: Barra, Cocina)" style="flex:1; font-weight:bold;">
                            <button class="btn-del" style="margin-left: 12px;" (click)="vm.removePrinter(i)"><lucide-icon name="trash-2" [size]="16"></lucide-icon></button>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Dirección IP o Ruta</label>
                                <input type="text" [(ngModel)]="printer.address" class="glass-input" placeholder="Ej: 192.168.1.100">
                            </div>
                            <div class="form-group">
                                <label>Tipo de Conexión</label>
                                <select [(ngModel)]="printer.type" class="glass-input">
                                    <option value="network">Red (IP/WiFi)</option>
                                    <option value="usb">USB Local</option>
                                    <option value="cloud">Nube</option>
                                </select>
                            </div>
                        </div>
                    </div>
                }
                @if (!vm.config().printers || vm.config().printers.length === 0) {
                    <p style="opacity:0.5; text-align:center; padding: 20px;">No hay impresoras configuradas.</p>
                }
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
      display: flex;
      flex-direction: column;
      gap: 32px;
      padding-bottom: 40px;
      max-width: 900px;
      margin: 0 auto;
      width: 100%;
    }

    @media (max-width: 768px) {
      .btn-save { width: 100%; }
    }

    .inline-icon { display: inline-block; vertical-align: text-bottom; }
    .mr-2 { margin-right: 8px; }
    .text-muted { color: var(--text-muted); opacity: 0.8; }
    
    .input-icon { display: flex; align-items: center; gap: 8px; width: 100%; }
    .input-icon span { font-size: 1.2rem; }
    .input-icon input { flex: 1; }

    .themes-grid { 
        display: grid; 
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); 
        gap: 16px; 
        margin-top: 12px; 
    }
    .theme-card { 
        cursor: pointer; 
        padding: 12px; 
        border: 2px solid transparent; 
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    .theme-card:hover { 
        border-color: rgba(255,255,255,0.2); 
        transform: translateY(-2px); 
    }
    .theme-card.active { 
        border-color: var(--accent-primary); 
        background: rgba(255,255,255,0.05);
        box-shadow: 0 8px 24px -4px rgba(99, 102, 241, 0.3); 
    }
    .theme-preview { 
        height: 80px; 
        border-radius: 8px; 
        position: relative; 
        overflow: hidden; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        border: 1px solid rgba(255,255,255,0.1); 
    }
    .theme-accent { 
        position: absolute; 
        top: 0; 
        left: 0; 
        right: 0; 
        height: 6px; 
    }
    .theme-text { 
        font-family: 'Space Grotesk', sans-serif; 
        font-weight: 800; 
        font-size: 1.5rem; 
    }
    .theme-info { 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
    }
    .theme-name { 
        font-weight: 600; 
        font-size: 0.85rem; 
    }
    .text-primary { color: var(--accent-primary); }

    /* Billing Section */
    .billing-section { background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(16, 185, 129, 0.05)); }
    .printer-section { background: linear-gradient(135deg, rgba(168, 85, 247, 0.05), rgba(236, 72, 153, 0.05)); }
    .checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .checkbox-label input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; }
    .form-group.indent { margin-left: 24px; padding-left: 16px; border-left: 2px solid rgba(59, 130, 246, 0.3); }

    .btn-del {
      background: rgba(239, 68, 68, 0.05);
      color: var(--danger); 
      border: 1px solid rgba(239, 68, 68, 0.2);
      padding: 8px 12px; 
      border-radius: 8px; 
      cursor: pointer;
      transition: all 0.2s;
      display: flex; align-items: center; justify-content: center;
    }
    .btn-del:hover { background: var(--danger); color: white; }

    /* fadeIn animation now in global styles.css */
  `]
})
export class StoreConfigComponent {
  public vm = inject(StoreConfigViewModel);
}
