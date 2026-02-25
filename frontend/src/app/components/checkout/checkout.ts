import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CheckoutViewModel } from './checkout.viewmodel';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, RouterLink],
  providers: [CheckoutViewModel],
  template: `
    <div class="checkout-container">
      <header class="checkout-header">
        <button routerLink="../" class="back-btn">← Botón Volver</button>
        <h1 class="gradient-text">Finalizar Cuenta</h1>
      </header>

      @if (vm.loading()) {
        <div class="loader">Calculando costes...</div>
      } @else if (!vm.order()) {
        <div class="glass-card error-card">
          <p>No hay una cuenta activa para esta mesa.</p>
          <button routerLink="../" class="btn-primary">Volver a la carta</button>
        </div>
      } @else {
        <!-- Payment Mode Switcher -->
        <div class="glass-card mode-switcher">
          <button [class.active]="vm.paymentMode() === 'total'" (click)="vm.setPaymentMode('total')">
            Total
          </button>
          <button [class.active]="vm.paymentMode() === 'individual'" (click)="vm.setPaymentMode('individual')">
            Comensal
          </button>
          <button [class.active]="vm.paymentMode() === 'equitativo'" (click)="vm.setPaymentMode('equitativo')">
            Equitativo
          </button>
        </div>

        <!-- Breakdown Section -->
        <div class="glass-card breakdown-section">
          @if (vm.paymentMode() === 'total') {
            <div class="total-view">
              <span class="label">Total a Pagar</span>
              <h2 class="amount gradient-text">{{ vm.totalAmount() | currency:'EUR' }}</h2>
              <div class="item-list">
                @for (item of vm.order().items; track item.id) {
                  <div class="item-row">
                    <span>{{ item.quantity }}x {{ item.name }}</span>
                    <span>{{ (item.price * item.quantity) | currency:'EUR' }}</span>
                  </div>
                }
              </div>
            </div>
          }

          @if (vm.paymentMode() === 'individual') {
            <div class="individual-view">
              <h3>Desglose por Comensal</h3>
              @for (user of vm.comensales(); track user.name) {
                <div class="user-bill glass-card">
                  <div class="user-header">
                    <span class="name">{{ user.name }}</span>
                    <span class="total">{{ user.total | currency:'EUR' }}</span>
                  </div>
                  <div class="user-items">
                    @for (item of user.items; track item.id) {
                      <div class="mini-item">
                        <span>{{ item.name }}</span>
                        <span>{{ item.price | currency:'EUR' }}</span>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }

          @if (vm.paymentMode() === 'equitativo') {
            <div class="equitativo-view">
              <span class="label">A partes iguales ({{ vm.comensales().length }} pers.)</span>
              <h2 class="amount gradient-text">{{ vm.equitativoAmount() | currency:'EUR' }}</h2>
              <p class="helper-text">Cada persona paga una parte proporcional de la cuenta total.</p>
            </div>
          }
        </div>

        <button class="btn-primary pay-now-btn" (click)="vm.processPayment()">
          Proceder al Pago
        </button>
      }
    </div>
  `,
  styles: [`
    .checkout-container {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      animation: fadeIn 0.4s ease-out;
    }

    .checkout-header {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .back-btn {
      background: none;
      border: none;
      color: white;
      font-size: 1.2rem;
      cursor: pointer;
    }

    .mode-switcher {
      display: flex;
      padding: 6px;
      gap: 4px;
    }

    .mode-switcher button {
      flex: 1;
      background: none;
      border: none;
      color: white;
      padding: 12px;
      border-radius: 12px;
      font-weight: 600;
      opacity: 0.6;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .mode-switcher button.active {
      background: var(--accent-primary);
      color: var(--bg-dark);
      opacity: 1;
    }

    .breakdown-section {
      padding: 32px;
    }

    .total-view, .equitativo-view {
      text-align: center;
    }

    .amount {
      font-size: 3.5rem;
      margin: 16px 0;
    }

    .item-list {
      margin-top: 32px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .item-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
      opacity: 0.8;
    }

    .individual-view {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .user-bill {
      padding: 20px;
      background: rgba(255,255,255,0.03);
    }

    .user-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      font-weight: bold;
    }

    .user-items {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .mini-item {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      opacity: 0.6;
    }

    .pay-now-btn {
      padding: 20px;
      font-size: 1.2rem;
      box-shadow: 0 10px 30px rgba(56, 189, 248, 0.3);
    }

    .helper-text {
      opacity: 0.6;
      font-size: 0.9rem;
    }

    /* fadeIn animation now in global styles.css */

    @media (max-width: 480px) {
      .amount { font-size: 2.5rem; }
      .checkout-container { padding: 16px; }
    }
  `]
})
export class CheckoutComponent {
  public vm = inject(CheckoutViewModel);
}
