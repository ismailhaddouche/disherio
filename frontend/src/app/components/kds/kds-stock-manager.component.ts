import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';
import { KDSViewModel } from './kds.viewmodel';

@Component({
  selector: 'app-kds-stock-manager',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule],
  template: `
    <div class="stock-drawer-backdrop" (click)="vm.showStockManager.set(false)">
      <aside class="stock-drawer-md3" (click)="$event.stopPropagation()">
        <header class="drawer-header-md3">
          <div>
            <h3 class="text-title-large">{{ 'KDS.AVAILABILITY' | translate }}</h3>
            <p class="text-label-medium opacity-60">{{ 'KDS.AVAILABILITY_DESC' | translate }}</p>
          </div>
          <button class="icon-btn-md3" (click)="vm.showStockManager.set(false)">
            <lucide-icon name="x" [size]="20"></lucide-icon>
          </button>
        </header>
        <div class="stock-list-md3">
          @for (item of vm.productList(); track item._id) {
            <div class="stock-item-row-md3">
              <div class="stock-info">
                <span class="text-title-small">{{ item.name }}</span>
                <span class="text-label-small opacity-60">{{ item.category }}</span>
              </div>
              <button class="md-toggle-btn" 
                      [class.off]="!item.available"
                      [attr.aria-pressed]="item.available"
                      (click)="vm.toggleProduct(item._id)">
                {{ (item.available ? 'KDS.STOCK_ACTIVE' : 'KDS.STOCK_OUT') | translate }}
              </button>
            </div>
          }
        </div>
      </aside>
    </div>
  `,
  styles: [`
    .stock-drawer-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.3);
      z-index: 1000;
      display: flex;
      justify-content: flex-end;
      animation: fadeIn 0.3s ease-out;
      backdrop-filter: blur(12px);
    }

    .stock-drawer-md3 {
      width: 100%;
      max-width: 440px;
      height: 100%;
      background: var(--md-sys-color-surface-container-low);
      box-shadow: -4px 0 32px rgba(0,0,0,0.4);
      padding: 32px;
      display: flex;
      flex-direction: column;
      gap: 28px;
      animation: slideInRight 0.35s cubic-bezier(0.05, 0.7, 0.1, 1);
    }

    .drawer-header-md3 { display: flex; justify-content: space-between; align-items: flex-start; }

    .stock-list-md3 {
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;
      padding-right: 12px;
    }

    .stock-item-row-md3 {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: var(--md-sys-color-surface-container);
      border-radius: 14px;
      border: 1px solid var(--md-sys-color-outline-variant);
      transition: background 0.15s;
    }
    .stock-item-row-md3:hover { background: var(--md-sys-color-surface-container-high); }

    .md-toggle-btn {
      padding: 10px 20px;
      border-radius: 100px;
      border: none;
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
      font-size: 0.75rem;
      font-weight: 900;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .md-toggle-btn:active { transform: scale(0.9); }
    .md-toggle-btn.off {
      background: var(--md-sys-color-surface-variant);
      color: var(--md-sys-color-on-surface-variant);
      box-shadow: none;
    }

    .opacity-60 { opacity: 0.6; }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }

    @media (max-width: 768px) {
      .stock-drawer-md3 { width: 100%; max-width: none; }
    }
  `]
})
export class KDSStockManagerComponent {
  public vm = inject(KDSViewModel);
}
