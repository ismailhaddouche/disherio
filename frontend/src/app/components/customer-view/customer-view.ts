import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomerViewModel } from './customer-view.viewmodel';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-customer-view',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule, TranslateModule],
  providers: [CustomerViewModel],
  template: `
    <div class="customer-container animate-fade-in">
      @if (vm.loading()) {
        <div class="loading-screen">
          <div class="loader-ripple"><div></div><div></div></div>
          <p class="text-title-medium">{{ 'CUSTOMER.CONNECTING' | translate }}</p>
        </div>
      } @else if (!vm.session()?.sessionId || !vm.comms.userName() || vm.comms.userName() === 'Comensal') {
        <div class="name-selection md-card-elevated">
          @if (vm.isStaff()) {
            <h2 class="text-headline-medium">{{ 'WAITER.NEW_ORDER_FOR' | translate }}</h2>
            <p class="text-body-large">{{ 'WAITER.SELECT_NAME_OR_SKIP' | translate }}</p>

            @if (vm.existingNames().length > 0) {
              <div class="existing-names">
                @for (name of vm.existingNames(); track name) {
                  <button class="chip" (click)="vm.registerNameAndStartSession(name)">
                    <lucide-icon name="user" [size]="14"></lucide-icon>
                    {{ name }}
                  </button>
                }
              </div>
            }
            
            <div class="md-input-field">
              <input type="text" #nameInput [placeholder]="'WAITER.NEW_NAME_OPTIONAL' | translate" (keyup.enter)="vm.registerNameAndStartSession(nameInput.value || 'Camarero')" [value]="vm.comms.userName() !== 'Comensal' ? vm.comms.userName() : ''">
            </div>
            
            <button class="btn-primary" (click)="vm.registerNameAndStartSession(nameInput.value || 'Camarero')">
              <lucide-icon name="play" [size]="18"></lucide-icon>
              {{ 'WAITER.START_ORDERING' | translate }}
            </button>
          } @else {
            <h2 class="text-headline-medium">{{ 'CUSTOMER.HELLO' | translate }}</h2>
            <p class="text-body-large">{{ 'CUSTOMER.HOW_TO_CALL' | translate }}</p>
            
            <div class="md-input-field">
              <input type="text" #nameInput [placeholder]="'CUSTOMER.YOUR_NAME' | translate" (keyup.enter)="vm.registerNameAndStartSession(nameInput.value)" [value]="vm.comms.userName() !== 'Comensal' ? vm.comms.userName() : ''">
            </div>
            
            <button class="btn-primary" (click)="vm.registerNameAndStartSession(nameInput.value)">
              <lucide-icon name="chef-hat" [size]="18"></lucide-icon>
              {{ 'CUSTOMER.START_ORDERING' | translate }}
            </button>
          }
        </div>
      } @else {
        <header class="md-card table-header">
          <div class="restaurant-info">
            <span class="restaurant-name text-title-large">{{ vm.restaurantName() }}</span>
            <span class="table-badge text-label-large">
                <lucide-icon name="hash" [size]="12" class="inline-icon"></lucide-icon>
                {{ vm.session()?.tableNumber }}
            </span>
          </div>
          <div class="header-actions">
            @if (vm.session()?.activeOrder) {
                <span class="status-chip">{{ 'CUSTOMER.IN_SESSION' | translate }}</span>
            }
            <button routerLink="checkout" class="btn-secondary btn-sm">
                <lucide-icon name="receipt" [size]="16"></lucide-icon>
                {{ 'CUSTOMER.MY_ACCOUNT' | translate }}
            </button>
          </div>
        </header>

        <main class="menu-content">
          <section class="welcome-hero">
            <div class="restaurant-logo-wrapper">
              <img src="logo.svg" alt="Disher.io Logo" class="restaurant-logo">
            </div>
            <h1 class="text-headline-large">{{ 'CUSTOMER.TIME_TO_EAT' | translate }}</h1>
            <p class="text-body-medium" [innerHTML]="'CUSTOMER.ADD_TO_CART_INFO' | translate"></p>
          </section>

          <!-- Menu Section -->
          <div class="menu-grid">
            @for (item of vm.menu(); track item._id) {
              <div class="md-card menu-item clickable-card" 
                   [class.unavailable]="!item.available"
                   (click)="vm.handleItemClick(item)">
                <div class="item-visual" [style.background]="item.image ? 'transparent' : (item.category === 'Bebidas' ? 'var(--md-sys-color-tertiary-container)' : 'var(--md-sys-color-secondary-container)')" [style.padding]="item.image ? '0' : 'inherit'">
                  <ng-container *ngIf="item.image">
                    <img [src]="item.image" style="width: 100%; height: 100%; object-fit: cover; border-radius: 16px;">
                  </ng-container>
                  <ng-container *ngIf="!item.image">
                    <lucide-icon *ngIf="item.category === 'Bebidas'" name="glass-water" [size]="24" [color]="'var(--md-sys-color-on-tertiary-container)'"></lucide-icon>
                    <lucide-icon *ngIf="item.category !== 'Bebidas'" name="utensils" [size]="24" color="var(--md-sys-color-on-secondary-container)"></lucide-icon>
                  </ng-container>
                </div>
                <div class="item-details">
                  <h3 class="text-title-medium">{{ item.name }}</h3>
                  <p class="text-body-medium">{{ item.description }}</p>
                  <div class="item-footer">
                    <span class="price text-title-large">
                      @if (item.variants?.length > 0) {
                          {{ item.variants[0].price }}€
                      } @else {
                          {{ item.basePrice }}€
                      }
                    </span>
                    @if (item.variants?.length > 0 || item.addons?.length > 0) {
                        <span class="text-label-large" style="opacity: 0.6;">+ {{ 'CUSTOMER.CUSTOMIZE' | translate }}</span>
                    }
                  </div>
                </div>
                
                @if (item.available) {
                  <button class="add-fab">
                    <lucide-icon name="plus" [size]="20"></lucide-icon>
                  </button>
                } @else {
                  <span class="sold-out-badge">{{ 'CUSTOMER.SOLD_OUT' | translate }}</span>
                }
              </div>
            }
          </div>

          <!-- Configuration Modal (Bottom Sheet MD3) -->
          @if (vm.selectedForConfig(); as item) {
            <div class="modal-overlay" (click)="vm.selectedForConfig.set(null)">
                <div class="md-bottom-sheet" (click)="$event.stopPropagation()">
                    <div class="sheet-drag-handle"></div>
                    <header class="config-header" style="display: flex; gap: 16px; align-items: center;">
                        <img *ngIf="vm.selectedVariant()?.image || item.image" [src]="vm.selectedVariant()?.image || item.image" style="width: 64px; height: 64px; border-radius: 16px; object-fit: cover;">
                        <div>
                            <span class="text-label-large">{{ 'CUSTOMER.CUSTOMIZE_ORDER' | translate }}</span>
                            <h2 class="text-headline-small" style="margin: 0;">{{ item.name }}</h2>
                        </div>
                    </header>

                    <div class="config-content">
                        <!-- Menu Course Selection -->
                        @if (item.isMenu) {
                            @for (sec of item.menuSections; track sec.name) {
                                <section class="config-section">
                                    <h4 class="text-title-medium">{{ sec.name }}</h4>
                                    <div class="options-row">
                                        @for (opt of sec.options; track opt) {
                                            <button class="chip" 
                                                 [class.selected]="vm.selectedMenuChoices()[sec.name] === opt"
                                                 (click)="vm.selectMenuChoice(sec.name, opt)">
                                                {{ opt }}
                                            </button>
                                        }
                                    </div>
                                </section>
                            }
                        }

                        <!-- Variants -->
                        @if (!item.isMenu && item.variants?.length > 0) {
                            <section class="config-section">
                                <h4 class="text-title-medium">{{ 'CUSTOMER.SELECT_OPTION' | translate }}</h4>
                                <div class="options-row">
                                    @for (v of item.variants; track v.name) {
                                        <button class="chip variant-chip" 
                                             [class.selected]="vm.selectedVariant()?.name === v.name"
                                             (click)="vm.selectedVariant.set(v)">
                                            <img *ngIf="v.image" [src]="v.image" class="variant-img">
                                            <span>{{ v.name }} • {{ v.price }}€</span>
                                        </button>
                                    }
                                </div>
                            </section>
                        }

                        <!-- Addons -->
                         @if (item.addons?.length > 0) {
                            <section class="config-section">
                                <h4 class="text-title-medium">{{ 'CUSTOMER.EXTRAS_OPTIONAL' | translate }}</h4>
                                <div class="addons-list">
                                    @for (a of item.addons; track a.name) {
                                        <div class="addon-item list-item" 
                                             [class.active]="vm.selectedAddons().includes(a)"
                                             (click)="vm.toggleAddon(a)">
                                            <div class="addon-info">
                                                <lucide-icon [name]="vm.selectedAddons().includes(a) ? 'check-circle-2' : 'plus-circle'" [size]="20"></lucide-icon>
                                                <span class="text-body-large">{{ a.name }}</span>
                                            </div>
                                            <span class="price text-label-large">+{{ a.price }}€</span>
                                        </div>
                                    }
                                </div>
                            </section>
                         }
                    </div>

                    <footer class="config-footer">
                        <button class="btn-primary full-width" (click)="vm.addToCartFromConfig()">
                            <lucide-icon name="shopping-cart" [size]="18"></lucide-icon>
                            {{ 'CUSTOMER.ADD_TO_CART' | translate }}
                        </button>
                    </footer>
                </div>
            </div>
          }

          <!-- ACTIVE ORDER HISTORY -->
          @if (vm.session()?.activeOrder; as order) {
            <div class="order-section mt-32">
              <div class="section-header">
                <h3 class="text-title-large">{{ 'CUSTOMER.YOUR_ORDER' | translate }}</h3>
                <span class="status-badge connected">{{ 'CUSTOMER.IN_KITCHEN' | translate }}</span>
              </div>
              
              <div class="history-grid">
                @for (item of order.items; track $index) {
                  <div class="md-card history-item">
                    <div class="item-main">
                      <span class="qty">{{ item.quantity }}x</span>
                      <span class="name text-title-medium">{{ item.name }}</span>
                    </div>
                    @if (item.menuChoices) {
                        <div class="choices-row">
                            @for (choice of item.menuChoices | keyvalue; track choice.key) {
                                <span class="choice-chip">{{ choice.value }}</span>
                            }
                        </div>
                    }
                    <div class="item-meta">
                      <div class="ordered-by">
                        <lucide-icon name="user" [size]="14"></lucide-icon>
                        {{ item.orderedBy?.name || ('ROLES.Table' | translate) }}
                      </div>
                      <span class="item-status" [class]="item.status">
                        {{ item.status === 'pending' ? ('CUSTOMER.RECEIVED' | translate) : 
                           item.status === 'preparing' ? ('CUSTOMER.ON_FIRE' | translate) : 
                           item.status === 'ready' ? ('CUSTOMER.SERVED' | translate) : ('CUSTOMER.COMPLETED' | translate) }}
                      </span>
                    </div>
                  </div>
                }
              </div>
              
              <div class="md-card total-card mt-16">
                <span class="text-body-large">{{ 'CUSTOMER.TOTAL_ACCUMULATED' | translate }}</span>
                <span class="text-headline-small">{{ order.totalAmount | currency:'EUR' }}</span>
              </div>
            </div>
          }

          <!-- SHOPPING CART -->
          @if (vm.cart().length > 0) {
            <div class="cart-section mt-32 animate-fade-in">
              <h3 class="text-title-large">{{ 'CUSTOMER.NEW_CHOICES' | translate }}</h3>
              <p class="text-body-medium opacity-60">{{ 'CUSTOMER.CART_SUBTITLE' | translate }}</p>
              
              <div class="cart-list mt-16">
                @for (item of vm.cart(); track item.addedAt) {
                  <div class="md-card cart-item">
                    <div class="cart-item-header">
                        <div class="cart-item-name">
                            <span class="qty text-primary-color">1x</span>
                            <span class="text-title-medium">{{ item.name }}</span>
                        </div>
                        <button class="btn-sm" style="padding: 4px; border-radius: 50%; width: 32px; height: 32px; background: var(--md-sys-color-surface-variant);" (click)="vm.removeFromCart(item)">
                            <lucide-icon name="x" [size]="14"></lucide-icon>
                        </button>
                    </div>
                    @if (item.menuChoices) {
                        <div class="choices-row">
                            @for (choice of item.menuChoices | keyvalue; track choice.key) {
                                <span class="choice-chip">{{ choice.value }}</span>
                            }
                        </div>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </main>

        @if (vm.cart().length > 0) {
          <footer class="cart-sticky-footer animate-fade-in">
            <div class="cart-fab-container">
                <div class="cart-info">
                  <span class="text-label-large">{{ vm.cart().length }} {{ 'CUSTOMER.DISHES' | translate }}</span>
                </div>
                <button class="btn-primary checkout-fab" (click)="vm.placeOrder()">
                  <lucide-icon name="send" [size]="20"></lucide-icon>
                  {{ 'CUSTOMER.ORDER_NOW' | translate }}
                </button>
            </div>
          </footer>
        }
      }
    </div>
  `,
  styles: [`
    .customer-container {
      max-width: 600px;
      margin: 0 auto;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding: 16px 16px 120px 16px;
    }

    .loading-screen {
      height: 70vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 24px;
    }

    .name-selection {
      margin-top: 15vh;
      padding: 32px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      text-align: center;
    }

    .existing-names {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: center;
    }

    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      position: sticky;
      top: 16px;
      z-index: 100;
    }

    .restaurant-info { display: flex; flex-direction: column; }
    .table-badge { opacity: 0.7; display: flex; align-items: center; gap: 4px; }
    .header-actions { display: flex; align-items: center; gap: 12px; }

    .status-chip {
        background: var(--md-sys-color-secondary-container);
        color: var(--md-sys-color-on-secondary-container);
        font-size: 0.75rem;
        padding: 4px 12px;
        border-radius: var(--radius-full);
        font-weight: 600;
    }

    .welcome-hero {
      padding: 24px 0;
      text-align: center;
    }

    .restaurant-logo-wrapper {
        width: 80px;
        height: 80px;
        margin: 0 auto 16px;
        background: var(--md-sys-color-surface-variant);
        border-radius: 24px;
        padding: 12px;
    }
    .restaurant-logo { width: 100%; height: 100%; object-fit: contain; }

    .menu-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .menu-item {
      display: flex;
      gap: 16px;
      padding: 16px;
      align-items: flex-start;
      position: relative;
    }

    .item-visual {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .item-details { flex: 1; display: flex; flex-direction: column; gap: 4px; }
    .item-details p { opacity: 0.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    
    .item-footer {
        display: flex;
        align-items: baseline;
        gap: 12px;
        margin-top: 4px;
    }
    .price { color: var(--md-sys-color-primary); font-weight: 600; }

    .add-fab {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      align-self: flex-end;
    }

    .sold-out-badge {
        font-size: 0.75rem;
        background: var(--md-sys-color-error-container);
        color: var(--md-sys-color-on-error-container);
        padding: 4px 12px;
        border-radius: 8px;
        font-weight: bold;
    }

    /* Bottom Sheet Refined */
    .md-bottom-sheet {
        width: 100%;
        max-width: 600px;
        background: var(--md-sys-color-surface-1);
        border-radius: 28px 28px 0 0;
        padding: 16px 24px 32px;
        animation: slideInUp 0.3s cubic-bezier(0.2, 0, 0, 1);
        display: flex;
        flex-direction: column;
        gap: 24px;
        box-shadow: 0 -8px 32px rgba(0,0,0,0.4);
    }

    .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.6);
        z-index: 1000;
        display: flex;
        align-items: flex-end;
        justify-content: center;
    }

    .sheet-drag-handle {
        width: 32px; height: 4px; background: var(--md-sys-color-outline);
        opacity: 0.4; border-radius: 2px; margin: 0 auto;
    }

    .options-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .variant-chip { padding: 4px 16px 4px 4px; display: flex; align-items: center; gap: 8px; }
    .variant-chip:not(:has(img)) { padding-left: 16px; }
    .variant-img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }

    .addon-item { border-radius: 16px; width: 100%; justify-content: space-between; }
    .addon-info { display: flex; align-items: center; gap: 12px; }

    .full-width { width: 100%; padding: 16px; }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .history-grid { display: grid; gap: 12px; }
    .history-item { padding: 16px; border: 1px solid var(--md-sys-color-outline); background: transparent; }
    
    .choices-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
    }
    .choice-chip {
        font-size: 0.75rem;
        background: var(--md-sys-color-surface-variant);
        padding: 4px 10px;
        border-radius: 8px;
        opacity: 0.8;
    }

    .item-meta {
        display: flex;
        justify-content: space-between;
        margin-top: 12px;
        font-size: 0.8rem;
    }
    .ordered-by { display: flex; align-items: center; gap: 6px; opacity: 0.6; }
    .item-status { font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .item-status.preparing { color: var(--md-sys-color-primary); }
    .item-status.ready { color: #b0ffc6; }

    .total-card {
        padding: 16px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: var(--md-sys-color-primary-container);
        color: var(--md-sys-color-on-primary-container);
    }

    .cart-item { display: flex; flex-direction: column; gap: 8px; border: 1px dashed var(--md-sys-color-outline); }
    .cart-item-header { display: flex; justify-content: space-between; align-items: center; }
    .cart-item-name { display: flex; gap: 8px; }

    .cart-sticky-footer {
        position: fixed;
        bottom: 24px;
        left: 24px;
        right: 24px;
        z-index: 500;
        display: flex;
        justify-content: center;
    }

    .cart-fab-container {
        background: var(--md-sys-color-surface-2);
        padding: 12px 12px 12px 24px;
        border-radius: var(--radius-full);
        display: flex;
        align-items: center;
        gap: 24px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        border: 1px solid var(--md-sys-color-outline);
    }

    .checkout-fab {
        padding: 12px 24px;
        height: 56px;
    }

    .opacity-60 { opacity: 0.6; }
    .mt-16 { margin-top: 16px; }

    @keyframes slideInUp {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
    }

    .md-input-field input {
        background: var(--md-sys-color-surface-variant);
        border: none;
        border-radius: 12px;
        padding: 16px 20px;
        color: var(--md-sys-color-on-surface);
        font-family: inherit;
        width: 100%;
        font-size: 1rem;
        text-align: center;
    }
    
    .text-primary-color { color: var(--md-sys-color-primary); }

    .status-badge.connected {
        background: #2e7d32;
        color: white;
        padding: 2px 10px;
        border-radius: 4px;
        font-size: 0.7rem;
        font-weight: bold;
    }
  `]

})
export class CustomerViewComponent {
  public vm = inject(CustomerViewModel);
}
