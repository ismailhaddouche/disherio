import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomerViewModel } from './customer-view.viewmodel';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-customer-view',
  standalone: true,
  imports: [CommonModule, RouterLink],
  providers: [CustomerViewModel],
  template: `
    <div class="customer-container">
      @if (vm.loading()) {
        <div class="loading-screen">
          <div class="loader-ripple"><div></div><div></div></div>
          <p class="gradient-text">Conectando con la mesa...</p>
        </div>
      } @else if (!vm.comms.userName() || vm.comms.userName() === 'Comensal') {
        <div class="name-selection glass-card">
          <h2 class="gradient-text">¡Hola!</h2>
          <p>¿Cómo prefieres que te llamemos?</p>
          <input type="text" #nameInput placeholder="Tu nombre..." class="glass-input">
          <button class="btn-primary" (click)="vm.comms.setUserName(nameInput.value)">
            Comenzar a pedir
          </button>
        </div>
      } @else {
        <header class="glass-card table-header">
          <div class="restaurant-info">
            <span class="restaurant-name gradient-text">{{ vm.restaurantName() }}</span>
            <span class="table-badge">Tótem asignado: <b>#{{ vm.session()?.tableNumber }}</b></span>
          </div>
          <div class="header-actions">
            @if (vm.session()?.activeOrder) {
                <span class="status-pulse">En Sesión</span>
            }
            <button routerLink="checkout" class="btn-checkout">Mi Cuenta</button>
          </div>
        </header>

        <main class="menu-content">
          <section class="welcome-hero" style="text-align: center;">
            <div style="display: flex; justify-content: center; margin-bottom: 20px;">
              <img src="logo.svg" alt="Disher.io Logo" style="height: 64px; border-radius: 12px;">
            </div>
            <h1>¡Hora de comer! 👋</h1>
            <p>Añade tus platos al carrito global. <br>Tus elecciones quedarán marcadas a tu nombre.</p>
          </section>

          <!-- Menu Section -->
          <div class="menu-grid">
            @for (item of vm.menu(); track item._id) {
              <div class="glass-card menu-item" 
                   [class.unavailable]="!item.available"
                   (click)="vm.handleItemClick(item)">
                <div class="item-visual">{{ item.category === 'Bebidas' ? '🍹' : '🍽️' }}</div>
                <div class="item-details">
                  <h3>{{ item.name }}</h3>
                  <p>{{ item.description }}</p>
                  <span class="price">
                    @if (item.variants?.length > 0) {
                        Desde {{ item.variants[0].price }}€
                    } @else {
                        {{ item.basePrice }}€
                    }
                  </span>
                </div>
                
                @if (item.available) {
                  <button class="add-btn">{{ item.variants?.length > 0 || item.addons?.length > 0 ? '⚙️' : '+' }}</button>
                } @else {
                  <span class="sold-out-tag">AGOTADO</span>
                }
              </div>
            }
          </div>

          <!-- Configuration Modal (Sheet) -->
          @if (vm.selectedForConfig(); as item) {
            <div class="modal-overlay" (click)="vm.selectedForConfig.set(null)">
                <div class="config-sheet glass-card" (click)="$event.stopPropagation()">
                    <div class="sheet-handle"></div>
                    <header class="config-header">
                        <h2>Personaliza tu pedido</h2>
                        <h3 class="gradient-text">{{ item.name }}</h3>
                    </header>

                    <div class="config-content">
                        <!-- Menu Course Selection -->
                        @if (item.isMenu) {
                            @for (sec of item.menuSections; track sec.name) {
                                <section class="config-section">
                                    <h4>{{ sec.name }}</h4>
                                    <div class="options-grid">
                                        @for (opt of sec.options; track opt) {
                                            <div class="option-card" 
                                                 [class.selected]="vm.selectedMenuChoices()[sec.name] === opt"
                                                 (click)="vm.selectMenuChoice(sec.name, opt)">
                                                <span class="name">{{ opt }}</span>
                                            </div>
                                        }
                                    </div>
                                </section>
                            }
                        }

                        <!-- Variants -->
                        @if (!item.isMenu && item.variants?.length > 0) {
                            <section class="config-section">
                                <h4>Selecciona una opción</h4>
                                <div class="options-grid">
                                    @for (v of item.variants; track v.name) {
                                        <div class="option-card" 
                                             [class.selected]="vm.selectedVariant()?.name === v.name"
                                             (click)="vm.selectedVariant.set(v)">
                                            <span class="name">{{ v.name }}</span>
                                            <span class="price-val">{{ v.price }}€</span>
                                        </div>
                                    }
                                </div>
                            </section>
                        }

                        <!-- Addons -->
                         @if (item.addons?.length > 0) {
                            <section class="config-section">
                                <h4>Extras (Opcional)</h4>
                                <div class="addons-list">
                                    @for (a of item.addons; track a.name) {
                                        <div class="addon-row" 
                                             [class.selected]="vm.selectedAddons().includes(a)"
                                             (click)="vm.toggleAddon(a)">
                                            <div class="addon-info">
                                                <span class="checkbox">{{ vm.selectedAddons().includes(a) ? '✅' : '⬜' }}</span>
                                                <span class="name">{{ a.name }}</span>
                                            </div>
                                            <span class="price">+{{ a.price }}€</span>
                                        </div>
                                    }
                                </div>
                            </section>
                         }
                    </div>

                    <footer class="config-footer">
                        <button class="btn-primary" (click)="vm.addToCartFromConfig()">
                            Añadir al carrito
                        </button>
                    </footer>
                </div>
            </div>
          }

          <!-- ACTIVE ORDER HISTORY (PERSISTENCE) -->
          @if (vm.session()?.activeOrder; as order) {
            <div class="order-history glass-card mt-32">
              <div class="history-header">
                <h3>Vuestra Comanda</h3>
                <span class="live-pulse">En Cocina</span>
              </div>
              <div class="history-list">
                @for (item of order.items; track $index) {
                  <div class="history-item">
                    <div class="item-main">
                      <span class="qty">{{ item.quantity }}x</span>
                      <span class="name">{{ item.name }}</span>
                    </div>
                    @if (item.menuChoices) {
                        <div class="item-choices">
                            @for (choice of item.menuChoices | keyvalue; track choice.key) {
                                <span class="choice-tag">{{ choice.value }}</span>
                            }
                        </div>
                    }
                    <div class="item-status-info">
                      <span class="who">👤 {{ item.orderedBy?.name || 'Mesa' }}</span>
                        <span class="status-badge" [class]="item.status">
                        {{ item.status === 'pending' ? 'Recibido' : 
                           item.status === 'preparing' ? 'En Fuego' : 
                           item.status === 'ready' ? 'Servido' : 'Completado' }}
                      </span>
                    </div>
                  </div>
                }
              </div>
              <div class="history-total">
                <span>Total acumulado:</span>
                <span class="val">{{ order.totalAmount | currency:'EUR' }}</span>
              </div>
            </div>
          }

          <!-- SHOPPING CART (PENSONAL ITEMS) -->
          @if (vm.cart().length > 0) {
            <div class="cart-preview glass-card mt-32">
              <h3 class="gradient-text">Tus nuevas elecciones</h3>
              <p class="cart-subtitle">Pulsa "Pedir Ahora" para enviar estos platos a la cocina.</p>
              <div class="cart-items">
                @for (item of vm.cart(); track item.addedAt) {
                  <div class="cart-item-row-complex">
                    <div class="item-header">
                        <div class="item-name">
                            <span class="qty">1x</span>
                            <span>{{ item.name }}</span>
                        </div>
                        <span class="user-badge is-me">Tú</span>
                    </div>
                    @if (item.menuChoices) {
                        <div class="item-choices">
                            @for (choice of item.menuChoices | keyvalue; track choice.key) {
                                <span class="choice-tag">{{ choice.value }}</span>
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
          <footer class="cart-footer glass-card">
            <div class="cart-summary">
              <span class="count">{{ vm.cart().length }} platos</span>
              <span class="total">{{ vm.cart().length > 0 ? 'Total' : '' }}</span>
            </div>
            <button class="btn-primary checkout-btn" (click)="vm.placeOrder()">
              Pedir Ahora
            </button>
          </footer>
        }
      }
    </div>
  `,
  styles: [`
    .customer-container {
      min-height: 100vh;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding-bottom: 100px;
      animation: slideUp 0.6s cubic-bezier(0.23, 1, 0.32, 1);
    }

    .loading-screen {
      height: 80vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 20px;
    }

    .table-header {
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 16px;
      z-index: 100;
    }

    .restaurant-name {
      font-weight: 800;
      text-transform: uppercase;
      font-size: 1.1rem;
      display: block;
    }

    .table-badge {
      font-size: 0.8rem;
      opacity: 0.7;
    }

    .btn-checkout {
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--accent-secondary);
      color: var(--accent-secondary);
      padding: 6px 12px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .btn-checkout:hover {
      background: var(--accent-secondary);
      color: var(--bg-dark);
    }

    .status-indicator {
      font-size: 0.7rem;
      font-weight: bold;
      color: var(--highlight);
      border: 1px solid var(--highlight);
      padding: 2px 8px;
      border-radius: 12px;
    }

    .welcome-hero {
      margin: 20px 0 32px 0;
    }

    .welcome-hero h1 { font-size: 2.2rem; margin-bottom: 8px; }
    .welcome-hero p { opacity: 0.7; line-height: 1.5; }

    .menu-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .menu-item {
      display: flex;
      gap: 16px;
      padding: 16px;
      align-items: center;
      position: relative;
    }

    .item-visual {
      font-size: 2.5rem;
      background: rgba(255,255,255,0.05);
      width: 60px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 15px;
    }

    .item-details { flex: 1; }
    .item-details h3 { font-size: 1.1rem; margin-bottom: 4px; }
    .item-details p { font-size: 0.85rem; opacity: 0.6; margin-bottom: 8px; }
    .item-details .price { font-weight: bold; color: var(--accent-primary); }

    .menu-item.unavailable {
      opacity: 0.5;
      filter: grayscale(1);
      cursor: not-allowed;
    }

    .sold-out-tag {
      font-size: 0.75rem;
      font-weight: 900;
      color: #ef4444;
      border: 1px solid #ef4444;
      padding: 4px 10px;
      border-radius: 8px;
    }

    .add-btn {
      background: var(--accent-primary);
      border: none;
      color: var(--bg-dark);
      width: 32px;
      height: 32px;
      border-radius: 10px;
      font-weight: bold;
      font-size: 1.2rem;
      cursor: pointer;
    }

    .cart-footer {
      position: fixed;
      bottom: 16px;
      left: 16px;
      right: 16px;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 200;
      animation: slideInBottom 0.4s ease-out;
    }

    .checkout-btn {
      width: 60%;
      box-shadow: 0 10px 20px rgba(56, 189, 248, 0.3);
    }

    .name-selection {
      padding: 40px;
      text-align: center;
      margin-top: 20vh;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    /* glass-input now defined globally */
    .name-selection .glass-input {
      text-align: center;
      font-size: 1rem;
      padding: 16px;
    }

    .cart-preview {
      margin-top: 40px;
      padding: 24px;
    }

    .cart-items {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .cart-item-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.9rem;
    }

    .user-badge {
      font-size: 0.7rem;
      background: rgba(255,255,255,0.1);
      padding: 4px 10px;
      border-radius: 20px;
      opacity: 0.8;
    }

    .user-badge.is-me {
      background: rgba(192, 132, 252, 0.2);
      color: var(--accent-secondary);
      border: 1px solid var(--accent-secondary);
    }

    .mt-32 { margin-top: 32px; }

    .order-history {
      padding: 24px;
      background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(34, 197, 94, 0.05) 100%);
      border: 1px solid rgba(34, 197, 94, 0.2);
    }

    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .live-pulse {
      font-size: 0.7rem;
      color: var(--highlight);
      font-weight: bold;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .live-pulse::before {
      content: '';
      width: 8px;
      height: 8px;
      background: var(--highlight);
      border-radius: 50%;
      animation: pulse-ring 1.5s infinite;
    }

    .history-list { display: flex; flex-direction: column; gap: 16px; }
    
    .history-item {
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .item-main { display: flex; gap: 8px; font-weight: 600; font-size: 1rem; }
    .item-main .qty { color: var(--accent-primary); }

    .item-status-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 6px;
    }

    .item-status-info .who { font-size: 0.75rem; opacity: 0.5; }

    .status-badge {
      font-size: 0.65rem;
      padding: 2px 8px;
      border-radius: 4px;
      background: rgba(255,255,255,0.05);
      font-weight: bold;
      text-transform: uppercase;
    }

    .status-badge.preparing { color: var(--accent-secondary); border: 1px solid var(--accent-secondary); }
    .status-badge.ready { color: var(--highlight); border: 1px solid var(--highlight); }

    .history-total {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid rgba(255,255,255,0.1);
      display: flex;
      justify-content: space-between;
      font-weight: bold;
    }

    .cart-subtitle { font-size: 0.8rem; opacity: 0.6; margin: 4px 0 16px 0; }
    .item-name { display: flex; gap: 8px; }

    @keyframes pulse-ring {
      0% { transform: scale(0.8); opacity: 0.5; }
      50% { transform: scale(1.2); opacity: 1; }
      100% { transform: scale(0.8); opacity: 0.5; }
    }

    /* slideUp, slideInBottom, loader-ripple now in global styles.css */

    /* Modal & Config Sheet */
    .modal-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.8);
        backdrop-filter: blur(8px);
        z-index: 1000;
        display: flex;
        align-items: flex-end;
    }

    .config-sheet {
        width: 100%;
        background: var(--bg-dark);
        border-radius: 30px 30px 0 0;
        padding: 24px;
        animation: slideInBottom 0.3s ease-out;
        max-height: 90vh;
        overflow-y: auto;
    }

    .sheet-handle {
        width: 40px; height: 4px; background: rgba(255,255,255,0.1);
        border-radius: 2px; margin: 0 auto 20px;
    }

    .config-header h2 { font-size: 0.9rem; opacity: 0.5; margin: 0; }
    .config-header h3 { font-size: 1.8rem; margin: 4px 0 24px; }

    .config-section { margin-bottom: 32px; }
    .config-section h4 { font-size: 0.9rem; margin-bottom: 16px; opacity: 0.7; }

    .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .option-card {
        padding: 16px; border-radius: 16px; background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; gap: 4px;
        transition: all 0.3s ease;
    }
    .option-card.selected { border-color: var(--accent-primary); background: rgba(56,189,248,0.1); }
    .option-card .name { font-weight: bold; }
    .option-card .price-val { font-size: 0.8rem; color: var(--accent-primary); }

    .addons-list { display: flex; flex-direction: column; gap: 8px; }
    .addon-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 12px 16px; background: rgba(255,255,255,0.02); border-radius: 12px;
        border: 1px solid transparent;
    }
    .addon-row.selected { border-color: var(--accent-secondary); background: rgba(192,132,252,0.05); }
    .addon-info { display: flex; gap: 12px; }
    .addon-row .price { font-size: 0.8rem; opacity: 0.6; }

    .config-footer { margin-top: 20px; }
    .config-footer .btn-primary { width: 100%; padding: 16px; font-size: 1.1rem; }

    .item-choices {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 8px 0;
    }

    .choice-tag {
        font-size: 0.7rem;
        background: rgba(56, 189, 248, 0.1);
        color: var(--accent-primary);
        padding: 4px 10px;
        border-radius: 8px;
        border: 1px solid rgba(56, 189, 248, 0.2);
    }

    .cart-item-row-complex {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding-bottom: 12px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .status-pulse {
        font-size: 0.65rem;
        background: rgba(34, 197, 94, 0.1);
        color: var(--highlight);
        padding: 4px 10px;
        border-radius: 20px;
        border: 1px solid rgba(34, 197, 94, 0.3);
        font-weight: bold;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .status-pulse::before {
        content: ''; width: 6px; height: 6px; background: var(--highlight);
        border-radius: 50%; animation: disher-pulse 1.5s infinite;
    }

    @keyframes disher-pulse {
        0% { transform: scale(0.9); opacity: 0.5; }
        50% { transform: scale(1.2); opacity: 1; }
        100% { transform: scale(0.9); opacity: 0.5; }
    }
  `]
})
export class CustomerViewComponent {
  public vm = inject(CustomerViewModel);
}
