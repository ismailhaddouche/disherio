import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreConfigViewModel } from './store-config.viewmodel';
import { AuthService } from '../../services/auth.service';
import { LucideAngularModule } from 'lucide-angular';
import { environment } from '../../../environments/environment';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-store-config',
    standalone: true,
    imports: [CommonModule, FormsModule, LucideAngularModule, TranslateModule],
    providers: [StoreConfigViewModel],
    template: `
    <div class="md-page-shell config-container animate-fade-in">
      <header class="section-header-md3">
        <div class="header-content">
          <div class="title-with-icon">
            <div class="icon-box-md3 primary">
              <lucide-icon name="sliders-horizontal" [size]="24"></lucide-icon>
            </div>
            <div>
              <h1 class="text-headline-medium">{{ 'STORE_CONFIG.TITLE' | translate }}</h1>
              <p class="text-body-small opacity-60">{{ 'STORE_CONFIG.SUBTITLE' | translate }}</p>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn-primary" (click)="vm.saveConfig()" [disabled]="vm.saving()">
            <lucide-icon [name]="vm.saving() ? 'loader-2' : 'save'" [size]="20" [class.animate-spin]="vm.saving()"></lucide-icon>
            <span>{{ vm.saving() ? ('STORE_CONFIG.SAVING' | translate) : ('STORE_CONFIG.SAVE' | translate) }}</span>
          </button>
        </div>
      </header>

      @if (vm.message()) {
        <div class="md-alert-success mx-32">
          <lucide-icon name="check-circle" [size]="20"></lucide-icon>
          <span>{{ vm.message() }}</span>
        </div>
      }

      @if (vm.loading()) {
        <div class="md-loading-state">
          <div class="spinner"></div>
          <p class="text-body-medium opacity-60">{{ 'STORE_CONFIG.LOADING' | translate }}</p>
        </div>
      } @else if (vm.error()) {
        <div class="md-alert-error mx-32">
          <lucide-icon name="alert-circle" [size]="24"></lucide-icon>
          <div class="alert-content">
            <p class="text-title-medium">{{ vm.error() }}</p>
            <button class="btn-text btn-sm mt-8" (click)="vm.loadConfig()">{{ 'COMMON.RETRY' | translate }}</button>
          </div>
        </div>
      } @else {
        <main class="config-main-md3">
          <div class="config-column-md3">
            
            <!-- General Info -->
            <section class="card-section-md3">
              <h2 class="text-title-large mb-24">{{ 'STORE_CONFIG.GEN_INFO' | translate }}</h2>
              
              <div class="md-form-grid">
                <div class="md-field">
                  <label class="text-label-medium">{{ 'STORE_CONFIG.REST_NAME' | translate }}</label>
                  <input type="text" [ngModel]="vm.config().name" (ngModelChange)="vm.updateConfig('name', $event)" class="md-input">
                </div>

                <div class="md-field">
                  <label class="text-label-medium">{{ 'STORE_CONFIG.REST_LOGO' | translate }}</label>
                  <div class="logo-upload-group">
                    <input type="text" [ngModel]="vm.config().logo" (ngModelChange)="vm.updateConfig('logo', $event)" class="md-input" placeholder="https://..." style="flex:1">
                    <button class="icon-btn-md3 tonal" (click)="logoInput.click()" [title]="'STORE_CONFIG.UPLOAD_IMG' | translate">
                      <lucide-icon name="camera" [size]="18"></lucide-icon>
                    </button>
                    <input type="file" #logoInput hidden (change)="vm.uploadLogo(logoInput.files![0])" accept="image/*">
                  </div>
                  @if (vm.config().logo) {
                    <div class="logo-preview-box">
                      <img [src]="vm.config().logo.startsWith('/') ? environment.apiUrl + vm.config().logo : vm.config().logo">
                      <span class="text-label-small opacity-60">{{ 'STORE_CONFIG.PREVIEW' | translate }}</span>
                    </div>
                  }
                </div>
              </div>

              <div class="md-field mt-20">
                <label class="text-label-medium">{{ 'STORE_CONFIG.DESC_SLOGAN' | translate }}</label>
                <textarea [ngModel]="vm.config().description" (ngModelChange)="vm.updateConfig('description', $event)" class="md-input" rows="3"></textarea>
              </div>

              <div class="md-form-grid mt-20">
                <div class="md-field">
                  <label class="text-label-medium">{{ 'STORE_CONFIG.PHONE' | translate }}</label>
                  <input type="tel" [ngModel]="vm.config().phone" (ngModelChange)="vm.updateConfig('phone', $event)" class="md-input">
                </div>

                <div class="md-field">
                  <label class="text-label-medium">{{ 'STORE_CONFIG.DOMAIN' | translate }}</label>
                  <input type="url" [ngModel]="vm.config().domain" class="md-input-readonly" readonly [title]="'STORE_CONFIG.DOMAIN_HINT' | translate">
                </div>
              </div>
            </section>

            <!-- Social Networks -->
            <section class="card-section-md3">
              <h2 class="text-title-large mb-24">{{ 'STORE_CONFIG.SOCIALS' | translate }}</h2>
              
              <div class="md-form-grid">
                <div class="md-field">
                  <label class="text-label-medium">Instagram</label>
                  <div class="input-with-icon-md3">
                    <lucide-icon name="instagram" [size]="18" class="opacity-60"></lucide-icon>
                    <input type="text" [ngModel]="vm.config().socials?.instagram" (ngModelChange)="vm.updateSocial('instagram', $event)" class="md-input" [placeholder]="'STORE_CONFIG.INSTAGRAM_PH' | translate">
                  </div>
                </div>

                <div class="md-field">
                  <label class="text-label-medium">Facebook</label>
                  <div class="input-with-icon-md3">
                    <lucide-icon name="facebook" [size]="18" class="opacity-60"></lucide-icon>
                    <input type="text" [ngModel]="vm.config().socials?.facebook" (ngModelChange)="vm.updateSocial('facebook', $event)" class="md-input">
                  </div>
                </div>
              </div>

              <div class="md-field mt-20">
                <label class="text-label-medium">{{ 'STORE_CONFIG.WEBSITE' | translate }}</label>
                <div class="input-with-icon-md3">
                  <lucide-icon name="globe" [size]="18" class="opacity-60"></lucide-icon>
                  <input type="text" [ngModel]="vm.config().socials?.website" (ngModelChange)="vm.updateSocial('website', $event)" class="md-input">
                </div>
              </div>
            </section>

            <!-- Appearance -->
            <section class="card-section-md3">
              <h2 class="text-title-large mb-8">{{ 'STORE_CONFIG.APP_APPEARANCE' | translate }}</h2>
              <p class="text-body-small opacity-60 mb-24">{{ 'STORE_CONFIG.APPEARANCE_SUB' | translate }}</p>

              <div class="md-field mb-24">
                <label class="text-label-medium">{{ 'STORE_CONFIG.LANGUAGE' | translate }}</label>
                <select class="md-select max-w-300" [ngModel]="translate.currentLang" (ngModelChange)="changeLanguage($event)">
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div class="themes-grid-md3">
                @for (theme of vm.predefinedThemes; track theme.id) {
                  <div class="theme-card-md3" 
                       [class.active]="vm.isThemeActive(theme.id)"
                       (click)="vm.selectPredefinedTheme(theme.id)">
                    
                    <div class="theme-preview-md3" [style.background]="theme.colors.backgroundColor">
                      <div class="theme-accent-md3" [style.background]="'linear-gradient(135deg, ' + theme.colors.primaryColor + ', ' + theme.colors.secondaryColor + ')'"></div>
                      <span class="theme-text-md3" [style.color]="theme.colors.textColor">Aa</span>
                    </div>
                    
                    <div class="theme-info-md3">
                      <span class="text-label-large">{{ theme.nameKey | translate }}</span>
                      @if (vm.isThemeActive(theme.id)) {
                        <lucide-icon name="check-circle-2" [size]="18" class="color-primary"></lucide-icon>
                      }
                    </div>
                  </div>
                }
              </div>
            </section>
          </div>

          <div class="config-column-md3">
            <!-- Billing Configuration -->
            <section class="card-section-md3 billing-accent">
              <h2 class="text-title-large mb-8">
                <lucide-icon name="credit-card" [size]="20" class="inline-icon"></lucide-icon>
                {{ 'STORE_CONFIG.BILLING' | translate }}
              </h2>
              <p class="text-body-small opacity-60 mb-24">{{ 'STORE_CONFIG.BILLING_SUB' | translate }}</p>
              
              <div class="md-field mb-24">
                <label class="text-label-medium">{{ 'STORE_CONFIG.VAT' | translate }}</label>
                <div class="input-with-suffix-md3">
                  <input type="number" 
                         [ngModel]="vm.config().billing?.vatPercentage" 
                         (ngModelChange)="vm.updateBilling('vatPercentage', $event ? +$event  : null)" 
                         class="md-input" 
                         placeholder="10"
                         min="0" max="100">
                  <span class="suffix">%</span>
                </div>
              </div>

              <div class="md-switch-row mb-24">
                <div class="switch-info">
                  <span class="text-title-small">{{ 'STORE_CONFIG.TIP_ENABLE' | translate }}</span>
                  <p class="text-body-extra-small opacity-60">{{ 'STORE_CONFIG.TIP_ENABLE_DESC' | translate }}</p>
                </div>
                <label class="md-switch">
                  <input type="checkbox" [ngModel]="vm.config().billing?.tipEnabled" (ngModelChange)="vm.updateBilling('tipEnabled', $event)">
                  <span class="slider"></span>
                </label>
              </div>

              @if (vm.config().billing?.tipEnabled) {
                <div class="indent-section">
                  <div class="md-field mb-20">
                    <label class="text-label-medium">{{ 'STORE_CONFIG.TIP_PCT' | translate }}</label>
                    <div class="input-with-suffix-md3">
                      <input type="number" 
                             [ngModel]="vm.config().billing?.tipPercentage" 
                             (ngModelChange)="vm.updateBilling('tipPercentage', +$event)" 
                             class="md-input" 
                             placeholder="5">
                      <span class="suffix">%</span>
                    </div>
                  </div>

                  <div class="md-field">
                    <label class="text-label-medium">{{ 'STORE_CONFIG.TIP_DESC' | translate }}</label>
                    <input type="text" 
                           [ngModel]="vm.config().billing?.tipDescription" 
                           (ngModelChange)="vm.updateBilling('tipDescription', $event)" 
                           class="md-input" 
                           [placeholder]="'STORE_CONFIG.TIP_DESC_PH' | translate">
                  </div>
                </div>
              }
            </section>

            <!-- Printer Configuration -->
            <section class="card-section-md3 printer-accent">
              <div class="section-title-row">
                <div>
                  <h2 class="text-title-large mb-4">
                    <lucide-icon name="printer" [size]="20" class="inline-icon"></lucide-icon>
                    {{ 'STORE_CONFIG.PRINTERS' | translate }}
                  </h2>
                  <p class="text-body-small opacity-60">{{ 'STORE_CONFIG.PRINTERS_SUB' | translate }}</p>
                </div>
                <button class="btn-tonal btn-sm" (click)="vm.addPrinter()">
                  <lucide-icon name="plus" [size]="16"></lucide-icon>
                  <span>{{ 'MENU_EDITOR.ADD' | translate }}</span>
                </button>
              </div>
              
              <div class="printers-list-md3 mt-24">
                @for (printer of vm.config().printers; track printer.id; let i = $index) {
                  <div class="printer-card-md3">
                    <div class="printer-header-md3">
                      <input type="text" [(ngModel)]="printer.name" class="md-borderless-input text-title-medium" [placeholder]="'STORE_CONFIG.NAME_PH' | translate" style="flex:1;">
                      <button class="icon-btn-md3 error-tonal-sm" (click)="vm.removePrinter(i)">
                        <lucide-icon name="trash-2" [size]="16"></lucide-icon>
                      </button>
                    </div>
                    <div class="md-form-grid">
                      <div class="md-field">
                        <label class="text-label-small">{{ 'STORE_CONFIG.IP_PATH' | translate }}</label>
                        <input type="text" [(ngModel)]="printer.address" class="md-input-sm" placeholder="192.168.1.100">
                      </div>
                      <div class="md-field">
                        <label class="text-label-small">{{ 'STORE_CONFIG.CONN_TYPE' | translate }}</label>
                        <select [(ngModel)]="printer.type" class="md-select-sm">
                          <option value="network">{{ 'STORE_CONFIG.NET_WIFI' | translate }}</option>
                          <option value="usb">{{ 'STORE_CONFIG.USB' | translate }}</option>
                          <option value="cloud">{{ 'STORE_CONFIG.CLOUD' | translate }}</option>
                        </select>
                      </div>
                    </div>
                  </div>
                }
                @if (!vm.config().printers || vm.config().printers.length === 0) {
                  <div class="empty-printers-md3">
                    <lucide-icon name="printer" [size]="32"></lucide-icon>
                    <p class="text-body-small opacity-60">{{ 'STORE_CONFIG.NO_PRINTERS' | translate }}</p>
                  </div>
                }
              </div>
            </section>

            <!-- Local Device -->
            <section class="card-section-md3 device-accent">
              <h2 class="text-title-large mb-8">
                <lucide-icon name="monitor" [size]="20" class="inline-icon"></lucide-icon>
                {{ 'STORE_CONFIG.THIS_DEVICE' | translate }}
              </h2>
              <p class="text-body-small opacity-60 mb-24">{{ 'STORE_CONFIG.DEVICE_SUB' | translate }}</p>
              
              <div class="md-field mb-24">
                <label class="text-label-medium">{{ 'STORE_CONFIG.ASSIGNED_PRINTER' | translate }}</label>
                <select [ngModel]="vm.getLocalPrinterId()" (ngModelChange)="vm.setLocalPrinter($event)" class="md-select">
                  <option [ngValue]="null">{{ 'STORE_CONFIG.NO_PRINTER' | translate }}</option>
                  @for (printer of vm.config().printers; track printer.id) {
                    <option [value]="printer.id">{{ printer.name }} ({{ printer.type }})</option>
                  }
                </select>
              </div>
              
              <div class="md-switch-row">
                <div class="switch-info">
                  <span class="text-title-small">{{ 'STORE_CONFIG.AUTO_PRINT' | translate }}</span>
                  <p class="text-body-extra-small opacity-60">{{ 'STORE_CONFIG.AUTO_PRINT_DESC' | translate }}</p>
                </div>
                <label class="md-switch">
                  <input type="checkbox" [ngModel]="vm.getLocalAutoPrint()" (ngModelChange)="vm.setLocalAutoPrint($event)">
                  <span class="slider"></span>
                </label>
              </div>
            </section>
          </div>
        </main>
      }
    </div>
  `,
    styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .config-container {
      width: 100%;
    }

    .config-main-md3 {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      padding: 32px;
      overflow-y: auto;
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
    }

    .config-column-md3 {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .card-section-md3 {
      background: var(--md-sys-color-surface-container);
      border-radius: 28px;
      padding: 32px;
      border: 1px solid var(--md-sys-color-outline-variant);
      transition: all 0.2s;
    }
    .card-section-md3:hover {
      box-shadow: var(--md-sys-elevation-1);
    }

    .billing-accent { border-left: 4px solid var(--md-sys-color-primary); }
    .printer-accent { border-left: 4px solid var(--md-sys-color-secondary); }
    .device-accent { border-left: 4px solid var(--md-sys-color-tertiary); }

    .logo-upload-group {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .logo-preview-box {
      margin-top: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: var(--md-sys-color-surface-container-high);
      border-radius: 12px;
    }
    .logo-preview-box img {
      height: 48px;
      border-radius: 8px;
      object-fit: contain;
    }

    .themes-grid-md3 { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); 
      gap: 16px; 
    }

    .theme-card-md3 { 
      cursor: pointer; 
      padding: 12px; 
      background: var(--md-sys-color-surface-container-low);
      border-radius: 20px;
      border: 2px solid transparent; 
      transition: all 0.2s;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .theme-card-md3:hover { 
      background: var(--md-sys-color-surface-container-high);
      transform: translateY(-2px);
    }
    .theme-card-md3.active { 
      border-color: var(--md-sys-color-primary); 
      background: var(--md-sys-color-surface-container-highest);
    }

    .theme-preview-md3 { 
      height: 80px; 
      border-radius: 12px; 
      position: relative; 
      overflow: hidden; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      border: 1px solid var(--md-sys-color-outline-variant);
    }
    .theme-accent-md3 { 
      position: absolute; 
      top: 0; left: 0; right: 0; height: 6px; 
    }
    .theme-text-md3 { 
      font-size: 1.5rem; font-weight: 800; 
    }

    .theme-info-md3 { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
    }

    .indent-section {
      margin-left: 12px;
      padding-left: 20px;
      border-left: 2px dashed var(--md-sys-color-outline-variant);
    }

    .printers-list-md3 {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .printer-card-md3 {
      background: var(--md-sys-color-surface-container-high);
      border-radius: 20px;
      padding: 20px;
      border: 1px solid var(--md-sys-color-outline-variant);
    }

    .printer-header-md3 {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
    }

    .empty-printers-md3 {
      text-align: center;
      padding: 40px;
      opacity: 0.5;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .section-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .mx-32 { margin-left: 32px; margin-right: 32px; }
    .mt-8 { margin-top: 8px; }
    .mt-20 { margin-top: 20px; }
    .max-w-300 { max-width: 300px; }
    .mb-8 { margin-bottom: 8px; }
    .color-primary { color: var(--md-sys-color-primary); }

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

    @media (max-width: 1024px) {
      .config-main-md3 { grid-template-columns: 1fr; }
    }

    @media (max-width: 768px) {
      .config-main-md3 { padding: 16px; }
      .card-section-md3 { padding: 20px; }
      .md-form-grid { grid-template-columns: 1fr; }
      .mx-32 { margin-left: 16px; margin-right: 16px; }
    }
  `]
})
export class StoreConfigComponent {
    public vm = inject(StoreConfigViewModel);
    public environment = environment;
    public translate = inject(TranslateService);

    changeLanguage(lang: string) {
        this.translate.use(lang);
        localStorage.setItem('appLang', lang);
    }
}
