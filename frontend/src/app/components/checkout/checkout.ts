import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CheckoutViewModel } from './checkout.viewmodel';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, LucideAngularModule],
  providers: [CheckoutViewModel],
  template: `
    <div class="checkout-container">
      <header class="section-header-md3">
        <div class="header-content">
          <div class="title-with-icon">
            <button routerLink="../" class="icon-btn-md3 tonal-sm">
              <lucide-icon name="chevron-left" [size]="20"></lucide-icon>
            </button>
            <div>
              <h1 class="text-headline-medium">{{ 'CHECKOUT.TITLE' | translate }}</h1>
              <p class="text-body-small opacity-60">Selecciona el método de pago</p>
            </div>
          </div>
        </div>
      </header>

      @if (vm.loading()) {
        <div class="md-loading-state">
          <div class="spinner"></div>
          <p class="text-body-medium opacity-60">{{ 'CHECKOUT.CALCULATING' | translate }}</p>
        </div>
      } @else if (!vm.order()) {
        <div class="md-alert-error m-32">
          <lucide-icon name="alert-circle" [size]="24"></lucide-icon>
          <div class="alert-content">
            <p class="text-title-medium">{{ 'CHECKOUT.NO_ACCOUNT' | translate }}</p>
            <button routerLink="../" class="btn-text btn-sm mt-8">{{ 'CHECKOUT.BACK_TO_MENU' | translate }}</button>
          </div>
        </div>
      } @else {
        <main class="checkout-main-md3">
          <!-- Payment Mode Switcher -->
          <div class="checkout-tabs-md3">
            <button [class.active]="vm.paymentMode() === 'total'" (click)="vm.setPaymentMode('total')">
              <lucide-icon name="receipt" [size]="18"></lucide-icon>
              <span>{{ 'CHECKOUT.MODE_TOTAL' | translate }}</span>
            </button>
            <button [class.active]="vm.paymentMode() === 'individual'" (click)="vm.setPaymentMode('individual')">
              <lucide-icon name="users" [size]="18"></lucide-icon>
              <span>{{ 'CHECKOUT.MODE_INDIVIDUAL' | translate }}</span>
            </button>
            <button [class.active]="vm.paymentMode() === 'equitativo'" (click)="vm.setPaymentMode('equitativo')">
              <lucide-icon name="split" [size]="18"></lucide-icon>
              <span>{{ 'CHECKOUT.MODE_EQUITATIVE' | translate }}</span>
            </button>
          </div>

          <!-- Breakdown Section -->
          <div class="checkout-content-md3 animate-fade-in">
            @if (vm.paymentMode() === 'total') {
              <div class="payment-card-md3">
                <div class="total-display-md3">
                  <span class="text-label-large opacity-60">{{ 'CHECKOUT.TOTAL_PAY' | translate }}</span>
                  <h2 class="text-display-large color-primary">{{ vm.totalAmount() | currency:'EUR' }}</h2>
                </div>
                
                <div class="divider-md3 my-24"></div>

                <div class="items-summary-md3">
                  @for (item of vm.order().items; track item.id) {
                    <div class="item-summary-row">
                      <span class="text-body-medium">{{ item.quantity }}x {{ item.name }}</span>
                      <span class="text-title-small">{{ (item.price * item.quantity) | currency:'EUR' }}</span>
                    </div>
                  }
                </div>
              </div>
            }

            @if (vm.paymentMode() === 'individual') {
              <div class="individual-grid-md3">
                @for (user of vm.comensales(); track user.name) {
                  <div class="user-bill-card-md3">
                    <header class="user-bill-header">
                      <div class="user-avatar-sm">
                        <lucide-icon name="user" [size]="14"></lucide-icon>
                      </div>
                      <span class="text-title-medium">{{ user.name }}</span>
                      <span class="text-title-large color-primary ms-auto">{{ user.total | currency:'EUR' }}</span>
                    </header>
                    <div class="user-bill-items">
                      @for (item of user.items; track item.id) {
                        <div class="user-bill-item-row">
                          <span class="text-body-small opacity-60">{{ item.name }}</span>
                          <span class="text-label-medium">{{ item.price | currency:'EUR' }}</span>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }

            @if (vm.paymentMode() === 'equitativo') {
              <div class="payment-card-md3 text-center">
                <div class="total-display-md3">
                  <span class="text-label-large opacity-60">
                    {{ 'CHECKOUT.EQUITATIVE_PARTS' | translate }} ({{ vm.comensales().length }} {{ 'CHECKOUT.PERS' | translate }})
                  </span>
                  <h2 class="text-display-large color-primary">{{ vm.equitativoAmount() | currency:'EUR' }}</h2>
                  <p class="text-body-small opacity-60 mt-12">{{ 'CHECKOUT.EQUITATIVE_HELPER' | translate }}</p>
                </div>
              </div>
            }
          </div>

          <div class="checkout-footer-md3">
            <button class="btn-primary btn-full btn-lg" (click)="vm.processPayment()">
              <lucide-icon name="credit-card" [size]="20"></lucide-icon>
              <span>{{ 'CHECKOUT.PROCEED_PAY' | translate }}</span>
            </button>
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

    .checkout-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--md-sys-color-surface-container-low);
    }

    .checkout-main-md3 {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 24px;
      gap: 24px;
      max-width: 800px;
      margin: 0 auto;
      width: 100%;
    }

    .checkout-tabs-md3 {
      display: flex;
      background: var(--md-sys-color-surface-container-high);
      padding: 4px;
      border-radius: 100px;
      gap: 4px;
    }
    .checkout-tabs-md3 button {
      flex: 1;
      border: none;
      background: none;
      padding: 12px;
      border-radius: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: var(--md-sys-color-on-surface-variant);
      cursor: pointer;
      transition: all 0.2s;
      font-weight: 600;
      font-size: 0.9rem;
    }
    .checkout-tabs-md3 button.active {
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
    }

    .checkout-content-md3 {
      flex: 1;
    }

    .payment-card-md3 {
      background: var(--md-sys-color-surface-container);
      border-radius: 28px;
      padding: 32px;
      border: 1px solid var(--md-sys-color-outline-variant);
    }

    .total-display-md3 {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      text-align: center;
    }

    .items-summary-md3 {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .item-summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .individual-grid-md3 {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .user-bill-card-md3 {
      background: var(--md-sys-color-surface-container);
      border-radius: 24px;
      padding: 20px;
      border: 1px solid var(--md-sys-color-outline-variant);
    }

    .user-bill-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .user-avatar-sm {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--md-sys-color-secondary-container);
      color: var(--md-sys-color-on-secondary-container);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .user-bill-items {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      background: var(--md-sys-color-surface-container-low);
      border-radius: 12px;
    }

    .user-bill-item-row {
      display: flex;
      justify-content: space-between;
    }

    .checkout-footer-md3 {
      padding: 24px 0;
    }

    .text-center { text-align: center; }
    .color-primary { color: var(--md-sys-color-primary); }
    .opacity-60 { opacity: 0.6; }
    .my-24 { margin-top: 24px; margin-bottom: 24px; }
    .mt-8 { margin-top: 8px; }
    .mt-12 { margin-top: 12px; }
    .ms-auto { margin-left: auto; }
    .m-32 { margin: 32px; }

    .md-loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      gap: 16px;
    }

    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid var(--md-sys-color-secondary-container);
      border-top-color: var(--md-sys-color-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 480px) {
      .checkout-main-md3 { padding: 16px; }
      .payment-card-md3 { padding: 24px; }
      .checkout-tabs-md3 { gap: 2px; }
      .checkout-tabs-md3 button { padding: 10px 4px; font-size: 0.75rem; flex-direction: column; gap: 4px; }
    }
  `]
})
export class CheckoutComponent {
  public vm = inject(CheckoutViewModel);
}
