import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { POSViewModel } from './pos.viewmodel';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-pos-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, TranslateModule],
  template: `
      <!-- Main Content: Ticket & Billing Detail -->
      <main class="pos-main-md3">
        @if (vm.selectedTable(); as table) {
          @if (table.status === 'occupied') {
            <div class="ticket-view-md3">
              <header class="ticket-header-md3">
                <div class="table-info-md3">
                  <span class="text-label-small opacity-60">#{{ table.order.customId || table.order._id.slice(-6) }}</span>
                  <h1 class="text-headline-small">{{ table.name }}</h1>
                  @if (vm.editMode()) {
                    <div class="md-badge-warning animate-pulse">{{ 'POS.EDIT_MODE' | translate }}</div>
                  }
                </div>

                <div class="header-actions-md3">
                  <div class="payment-method-toggle-md3">
                    <button [class.active]="vm.paymentMethod() === 'cash'" (click)="vm.paymentMethod.set('cash')">
                      <lucide-icon name="banknote" [size]="14"></lucide-icon>
                      <span>{{ 'POS.CASH' | translate }}</span>
                    </button>
                    <button [class.active]="vm.paymentMethod() === 'card'" (click)="vm.paymentMethod.set('card')">
                      <lucide-icon name="credit-card" [size]="14"></lucide-icon>
                      <span>{{ 'POS.CARD' | translate }}</span>
                    </button>
                  </div>
                  <button class="btn-tonal" (click)="vm.toggleEditMode()">
                    <lucide-icon [name]="vm.editMode() ? 'check' : 'pen-line'" [size]="18"></lucide-icon>
                    <span>{{ (vm.editMode() ? 'POS.FINISH_EDIT' : 'POS.EDIT_ORDER') | translate }}</span>
                  </button>
                  <button class="btn-tonal" (click)="vm.openSplitModal()">
                    <lucide-icon name="columns-2" [size]="18"></lucide-icon>
                    <span>{{ 'POS.PAY_SPLIT' | translate }}</span>
                  </button>
                  <button class="btn-primary" (click)="vm.processPayment()">
                    <lucide-icon name="credit-card" [size]="18"></lucide-icon>
                    <span>{{ 'POS.PAY_TOTAL' | translate }}</span>
                  </button>
                </div>
              </header>

              <div class="ticket-content-md3">
                <section class="items-section-md3">
                  <div class="section-title-row">
                    <h3 class="text-title-medium">{{ 'POS.BREAKDOWN' | translate }}</h3>
                    <div class="edit-tools" *ngIf="vm.editMode()">
                      <button class="btn-tonal-sm" (click)="vm.showAddItemModal.set(true)">
                        <lucide-icon name="plus" [size]="14"></lucide-icon>
                        {{ 'POS.ADD_ITEM' | translate }}
                      </button>
                      <button class="btn-tonal-sm" (click)="vm.showCustomLineModal.set(true)">
                        <lucide-icon name="pencil" [size]="14"></lucide-icon>
                        {{ 'POS.CUSTOM' | translate }}
                      </button>
                    </div>
                  </div>

                  <div class="guest-list-md3">
                    @for (user of vm.getComensales(table.order); track user.id) {
                      <div class="guest-group-md3" [class.special-user]="user.id === 'orphan' || user.id === 'staff' || user.id === 'pos'">
                        <header class="guest-header-md3">
                          <div class="guest-name-md3">
                            <div class="guest-avatar">
                              <lucide-icon name="user" [size]="14"></lucide-icon>
                            </div>
                            <span class="text-title-small">{{ user.name }}</span>
                            @if (user.id === 'orphan' || user.id === 'staff' || user.id === 'pos') {
                              <span class="md-badge-error-sm">{{ 'POS.ASSIGN_NAME' | translate }}</span>
                            }
                          </div>
                          <div class="guest-total-actions">
                            <span class="text-title-medium color-primary">{{ user.total | currency:'EUR' }}</span>
                            @if (!vm.editMode()) {
                              <button class="icon-btn-md3 success-tonal-sm" (click)="vm.payByUser(user.id)" [title]="'POS.PAY_USER_TITLE' | translate">
                                <lucide-icon name="credit-card" [size]="16"></lucide-icon>
                              </button>
                            }
                          </div>
                        </header>

                        <div class="guest-items-md3">
                          @for (item of user.items; track item._originalIndex) {
                            <div class="item-row-md3" [class.editing]="vm.editMode()">
                              <div class="item-status-dot" [class.ready]="item.status === 'ready'"></div>
                              <div class="item-details-md3">
                                @if (vm.editMode()) {
                                  <input type="text" class="md-borderless-input text-body-medium" [value]="item.name" (blur)="$any($event.target).value !== item.name && vm.updateItemName(table.order._id, item._originalIndex, $any($event.target).value)">
                                } @else {
                                  <span class="text-body-medium">{{ item.quantity }}x {{ item.name }}</span>
                                  @if (item.isCustom) { <small class="text-label-small opacity-60">({{ 'POS.CUSTOM_ITEM' | translate }})</small> }
                                }
                              </div>
                              <div class="item-pricing-md3">
                                @if (vm.editMode()) {
                                  <div class="price-input-group">
                                    <input type="number" class="md-borderless-input text-label-large align-right" [value]="item.price" (change)="vm.updateItemPrice(table.order._id, item._originalIndex, +$any($event.target).value)">
                                    <span class="currency-symbol text-label-small">€</span>
                                  </div>
                                  <input type="text" class="md-borderless-input text-label-small guest-reassign" [placeholder]="'POS.GUEST_NAME' | translate" [value]="item.orderedBy?.name" (blur)="$any($event.target).value !== item.orderedBy?.name && vm.reassignItem(table.order._id, item._originalIndex, $any($event.target).value)">
                                  <button class="icon-btn-md3 error-tonal-sm" (click)="vm.removeItemFromOrder(table.order._id, item._originalIndex)">
                                    <lucide-icon name="trash-2" [size]="14"></lucide-icon>
                                  </button>
                                } @else {
                                  <span class="text-label-large item-price-badge">{{ (item.price * item.quantity) | currency:'EUR' }}</span>
                                }
                              </div>
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </section>

                <section class="checkout-footer-md3">
                  <div class="summary-rows">
                    <div class="summary-row">
                      <span class="text-body-medium opacity-60">{{ 'POS.SUBTOTAL' | translate }}</span>
                      <span class="text-body-medium">{{ table.order.totalAmount | currency:'EUR' }}</span>
                    </div>

                    @if (vm.calculateBilling(table.order.totalAmount); as billing) {
                      <div class="summary-row tip-row">
                        <div class="tip-info">
                          <span class="text-body-medium">{{ 'POS.TOTAL_TIP' | translate }}</span>
                          <span class="text-label-small opacity-60">{{ billing.tipDescription }}</span>
                        </div>
                        <div class="tip-selector-md3">
                          @for (p of [0, 5, 10, 15]; track p) {
                            <button [class.active]="vm.activeTipPercentage() === p"
                                    (click)="vm.activeTipPercentage.set(p)"
                                    class="tip-chip-md3">{{ p }}%</button>
                          }
                        </div>
                      </div>

                      <div class="summary-row grand-total-row-md3">
                        <span class="text-title-large">{{ 'POS.TOTAL_SIMPLE' | translate }}</span>
                        <span class="text-headline-large color-primary">{{ billing.grandTotal | currency:'EUR' }}</span>
                      </div>
                    } @else {
                      <div class="md-alert-warning">
                        <lucide-icon name="alert-circle" [size]="18"></lucide-icon>
                        <span class="text-label-medium">{{ 'POS.VAT_WARNING' | translate }}</span>
                      </div>
                      <div class="summary-row grand-total-row-md3">
                        <span class="text-title-large">{{ 'POS.TOTAL_SIMPLE' | translate }}</span>
                        <span class="text-headline-large">{{ table.order.totalAmount | currency:'EUR' }}</span>
                      </div>
                    }
                  </div>
                </section>
              </div>
            </div>
          } @else {
            <div class="pos-empty-state-md3">
              <div class="empty-icon-box">
                <lucide-icon name="layout-dashboard" [size]="64"></lucide-icon>
              </div>
              <h2 class="text-headline-small">{{ 'POS.EMPTY_TITLE' | translate }}</h2>
              <p class="text-body-medium opacity-60">{{ table.name }} {{ 'POS.EMPTY_DESC' | translate }}</p>
              <div class="empty-actions-md3">
                <button class="btn-primary" (click)="vm.openTable(table)">
                  <lucide-icon name="circle-plus" [size]="20"></lucide-icon>
                  <span>{{ 'POS.OPEN_TABLE' | translate }}</span>
                </button>
                @if (table.isVirtual) {
                  <button class="btn-error-tonal" (click)="vm.deleteVirtualTable(table.id)">
                    <lucide-icon name="trash-2" [size]="18"></lucide-icon>
                    <span>{{ 'COMMON.DELETE' | translate }}</span>
                  </button>
                }
              </div>
            </div>
          }
        } @else {
          <div class="pos-no-selection-md3">
            <div class="empty-icon-box">
              <lucide-icon name="wallet" [size]="64"></lucide-icon>
            </div>
            <h2 class="text-headline-small">{{ 'POS.NO_SELECTION_TITLE' | translate }}</h2>
            <p class="text-body-medium opacity-60">{{ 'POS.NO_SELECTION_DESC' | translate }}</p>
          </div>
        }
      </main>

      <!-- Modals -->
      <div class="md-modals-overlay" *ngIf="vm.showAddItemModal() || vm.showCustomLineModal() || vm.showSplitDetailedModal()">
        
        <!-- Modal: Add Menu Item -->
        @if (vm.showAddItemModal()) {
          <div class="md-modal-bottom-sheet" (click)="$event.stopPropagation()">
            <header class="modal-header-md3">
              <h2 class="text-title-large">{{ 'POS.ADD_MENU_ITEM' | translate }}</h2>
              <button class="icon-btn-md3" (click)="vm.showAddItemModal.set(false)"><lucide-icon name="x" [size]="24"></lucide-icon></button>
            </header>
            <div class="modal-body-md3">
              <div class="menu-options-grid-md3">
                @for (item of vm.menuItems(); track item._id) {
                  <div class="menu-option-md3" [class.has-image]="!!item.image" (click)="vm.addMenuItemToOrder(vm.selectedTable()?.order?._id!, item)">
                    <div class="option-image-md3" *ngIf="item.image" [style.backgroundImage]="'url(' + item.image + ')'"></div>
                    <div class="option-info-md3">
                      <div class="option-header-md3">
                        <span class="text-title-medium">{{ item.name }}</span>
                        <span class="text-title-medium color-primary">{{ item.basePrice || item.price | currency:'EUR' }}</span>
                      </div>
                      <span class="text-label-small opacity-60">{{ item.category }}</span>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        }

        <!-- Modal: Add Custom Line -->
        @if (vm.showCustomLineModal()) {
          <div class="md-modal-dialog" (click)="$event.stopPropagation()">
            <header class="modal-header-md3">
              <h2 class="text-title-large">{{ 'POS.ADD_CUSTOM_LINE' | translate }}</h2>
              <button class="icon-btn-md3" (click)="vm.showCustomLineModal.set(false)"><lucide-icon name="x" [size]="24"></lucide-icon></button>
            </header>
            <div class="modal-body-md3">
              <form #customForm="ngForm" class="md-form" (ngSubmit)="vm.addCustomLineToOrder(vm.selectedTable()?.order?._id!, customName.value, +customPrice.value); customName.value=''; customPrice.value=''; vm.showCustomLineModal.set(false)">
                <div class="md-field">
                  <label class="text-label-medium">{{ 'POS.CUSTOM_NAME' | translate }}</label>
                  <input type="text" class="md-input" #customName required [placeholder]="'POS.CUSTOM_NAME_PH' | translate">
                </div>
                <div class="md-field">
                  <label class="text-label-medium">{{ 'POS.PRICE' | translate }}</label>
                  <div class="input-with-icon-md3">
                    <input type="number" class="md-input" #customPrice required step="0.01" min="0" placeholder="0.00">
                    <span class="input-suffix">€</span>
                  </div>
                </div>
                <div class="modal-actions-md3">
                  <button type="button" class="btn-text" (click)="vm.showCustomLineModal.set(false)">{{ 'POS.CANCEL' | translate }}</button>
                  <button type="submit" class="btn-primary">{{ 'POS.ADD' | translate }}</button>
                </div>
              </form>
            </div>
          </div>
        }

        <!-- Modal: Split Options -->
        @if (vm.showSplitDetailedModal()) {
          <div class="md-modal-dialog" (click)="$event.stopPropagation()">
            <header class="modal-header-md3">
              <div>
                <h2 class="text-title-large">{{ 'POS.SPLIT_PAYMENT' | translate }}</h2>
                <p class="text-label-small opacity-60">{{ 'POS.SPLIT_DESC' | translate }}</p>
              </div>
              <button class="icon-btn-md3" (click)="vm.showSplitDetailedModal.set(false)"><lucide-icon name="x" [size]="24"></lucide-icon></button>
            </header>

            <div class="modal-body-md3">
              <div class="split-strategies-md3">
                <button class="strategy-card-md3" (click)="vm.processPayment(); vm.showSplitDetailedModal.set(false)">
                  <div class="strategy-icon primary"><lucide-icon name="receipt" [size]="24"></lucide-icon></div>
                  <div class="strategy-info">
                    <span class="text-title-medium">{{ 'POS.FULL_BILL' | translate }}</span>
                    <span class="text-label-small opacity-60">{{ 'POS.PAY_ALL_DESC' | translate }}</span>
                  </div>
                  <span class="text-title-large color-primary">{{ vm.selectedTable()?.order?.totalAmount | currency:'EUR' }}</span>
                </button>

                <button class="strategy-card-md3" (click)="vm.showSplitDetailedModal.set(false)">
                  <div class="strategy-icon secondary"><lucide-icon name="users" [size]="24"></lucide-icon></div>
                  <div class="strategy-info">
                    <span class="text-title-medium">{{ 'POS.BY_CUSTOMER' | translate }}</span>
                    <span class="text-label-small opacity-60">{{ 'POS.PAY_INDIVIDUAL_DESC' | translate }}</span>
                  </div>
                </button>

                <div class="strategy-card-md3 interactive">
                  <div class="strategy-icon accent"><lucide-icon name="grid-2x2" [size]="24"></lucide-icon></div>
                  <div class="strategy-info">
                    <span class="text-title-medium">{{ 'POS.EQUAL_PARTS' | translate }}</span>
                    <span class="text-label-small opacity-60">{{ 'POS.SPLIT_N_DESC' | translate }}</span>
                    <div class="parts-selector-md3">
                      @for (n of [2, 3, 4]; track n) {
                        <button class="part-btn-md3" (click)="vm.processPayment(undefined, 'equal', n); vm.showSplitDetailedModal.set(false)">{{ n }}</button>
                      }
                      <input type="number" #customN class="part-input-md3" placeholder="X" (keyup.enter)="vm.processPayment(undefined, 'equal', +customN.value); vm.showSplitDetailedModal.set(false)">
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
      </div>
  `,
  styles: [`
    :host {
      display: contents;
    }
    
    .pos-main-md3 { grid-row: 2; overflow: hidden; position: relative; }

    .ticket-view-md3 {
      height: 100%;
      display: flex;
      flex-direction: column;
      background: var(--md-sys-color-surface-container-low);
    }

    .ticket-header-md3 {
      padding: 24px 32px;
      background: var(--md-sys-color-surface-1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: var(--md-sys-elevation-1);
      z-index: 10;
    }

    .header-actions-md3 { display: flex; gap: 12px; align-items: center; }

    .payment-method-toggle-md3 {
      display: flex;
      background: var(--md-sys-color-surface-container-high);
      border-radius: 100px;
      padding: 3px;
      gap: 2px;
    }
    .payment-method-toggle-md3 button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border: none;
      background: none;
      border-radius: 100px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--md-sys-color-on-surface-variant);
      transition: all 0.2s;
    }
    .payment-method-toggle-md3 button.active {
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
    }

    .ticket-content-md3 {
      flex: 1;
      overflow-y: auto;
      padding: 32px;
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .items-section-md3 { flex: 1; display: flex; flex-direction: column; gap: 20px; }
    .section-title-row { display: flex; justify-content: space-between; align-items: center; }
    .edit-tools { display: flex; gap: 8px; }

    .guest-list-md3 { display: flex; flex-direction: column; gap: 16px; }
    .guest-group-md3 {
      background: var(--md-sys-color-surface-1);
      border-radius: 20px;
      padding: 20px;
      border: 1px solid var(--md-sys-color-outline-variant);
    }
    .guest-group-md3.special-user { border-left: 4px solid var(--md-sys-color-tertiary); }

    .guest-header-md3 {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
    }
    .guest-name-md3 { display: flex; align-items: center; gap: 12px; }
    .guest-avatar {
      width: 28px; height: 28px; border-radius: 50%;
      background: var(--md-sys-color-surface-variant);
      display: flex; align-items: center; justify-content: center;
    }

    .guest-total-actions { display: flex; align-items: center; gap: 16px; }

    .guest-items-md3 { display: flex; flex-direction: column; gap: 2px; }
    .item-row-md3 {
      display: grid;
      grid-template-columns: 8px 1fr auto;
      align-items: center;
      gap: 16px;
      padding: 8px 0;
      border-bottom: 1px solid var(--md-sys-color-surface-variant);
    }
    
    .item-status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--md-sys-color-outline); }
    .item-status-dot.ready { background: #34d399; box-shadow: 0 0 8px #34d399; }

    .item-pricing-md3 { display: flex; align-items: center; gap: 12px; }
    .item-price-badge {
      background: var(--md-sys-color-surface-container-high);
      padding: 4px 12px; border-radius: 100px;
    }

    .price-input-group { position: relative; width: 80px; }
    .align-right { text-align: right; padding-right: 20px; }
    .currency-symbol { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); opacity: 0.6; }

    .checkout-footer-md3 {
      padding: 24px;
      background: var(--md-sys-color-surface-2);
      border-radius: 24px;
      box-shadow: var(--md-sys-elevation-2);
    }

    .summary-rows { display: flex; flex-direction: column; gap: 12px; }
    .summary-row { display: flex; justify-content: space-between; align-items: center; }
    .tip-row { padding: 12px 0; border-top: 1px dashed var(--md-sys-color-outline-variant); }
    .tip-info { display: flex; flex-direction: column; }
    .tip-selector-md3 { display: flex; gap: 6px; }
    .tip-chip-md3 {
      background: var(--md-sys-color-surface-variant);
      border: none; padding: 6px 12px; border-radius: 100px;
      font-size: 0.75rem; font-weight: 700; cursor: pointer;
    }
    .tip-chip-md3.active { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }

    .grand-total-row-md3 {
      padding-top: 16px;
      border-top: 2px solid var(--md-sys-color-outline-variant);
    }

    .md-modals-overlay {
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      animation: fadeIn 0.2s;
    }

    .md-modal-dialog {
      background: var(--md-sys-color-surface-1);
      border-radius: 28px;
      width: 90%; max-width: 500px;
      padding: 32px;
      box-shadow: var(--md-sys-elevation-3);
      display: flex; flex-direction: column; gap: 24px;
      animation: zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .md-modal-bottom-sheet {
      position: absolute; bottom: 0; left: 0; right: 0;
      background: var(--md-sys-color-surface-1);
      border-radius: 28px 28px 0 0;
      padding: 32px;
      max-height: 80vh; overflow-y: auto;
      animation: slideUp 0.3s cubic-bezier(0, 0, 0.2, 1);
    }

    .modal-header-md3 { display: flex; justify-content: space-between; align-items: flex-start; }
    .modal-body-md3 { display: flex; flex-direction: column; gap: 20px; }

    .menu-options-grid-md3 {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }
    .menu-option-md3 {
      background: var(--md-sys-color-surface-container-low);
      border-radius: 16px; border: 1px solid var(--md-sys-color-outline-variant);
      cursor: pointer; transition: transform 0.2s, background 0.2s;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .menu-option-md3.has-image { padding: 0; }
    .menu-option-md3:not(.has-image) { padding: 16px; }
    .menu-option-md3:hover { background: var(--md-sys-color-surface-container-high); transform: translateY(-2px); }
    .option-image-md3 {
      height: 120px; width: 100%;
      background-size: cover; background-position: center;
      background-color: var(--md-sys-color-surface-variant);
    }
    .option-info-md3 {
      padding: 12px 16px; display: flex; flex-direction: column; gap: 4px;
    }
    .menu-option-md3:not(.has-image) .option-info-md3 { padding: 0; }
    .option-header-md3 { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 0; }

    .split-strategies-md3 { display: flex; flex-direction: column; gap: 12px; }
    .strategy-card-md3 {
      display: flex; align-items: center; gap: 20px; border: none;
      padding: 20px; background: var(--md-sys-color-surface-container-low);
      border-radius: 20px; cursor: pointer; text-align: left;
    }
    .strategy-card-md3:hover { background: var(--md-sys-color-surface-container-high); }
    .strategy-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; }
    .strategy-icon.primary { background: var(--md-sys-color-primary); }
    .strategy-icon.secondary { background: var(--md-sys-color-secondary); }
    .strategy-icon.accent { background: var(--md-sys-color-tertiary); }
    .strategy-info { flex: 1; display: flex; flex-direction: column; }

    .parts-selector-md3 { display: flex; gap: 8px; margin-top: 12px; }
    .part-btn-md3 {
      width: 40px; height: 40px; border-radius: 10px; border: none;
      background: var(--md-sys-color-surface-variant); cursor: pointer;
    }
    .part-btn-md3:hover { background: var(--md-sys-color-primary-container); }
    .part-input-md3 { width: 50px; text-align: center; border-radius: 10px; border: 1px solid var(--md-sys-color-outline-variant); background: transparent; }

    .pos-empty-state-md3, .pos-no-selection-md3 {
      height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 16px; padding: 40px; text-align: center;
    }
    .empty-icon-box {
      width: 120px; height: 120px; border-radius: 50%;
      background: var(--md-sys-color-surface-container-high);
      display: flex; align-items: center; justify-content: center;
      color: var(--md-sys-color-on-surface-variant);
    }
    .empty-actions-md3 { display: flex; gap: 12px; margin-top: 24px; }

    .input-suffix { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); opacity: 0.6; }
    .modal-actions-md3 { display: flex; justify-content: flex-end; gap: 12px; margin-top: 12px; }

    .color-primary { color: var(--md-sys-color-primary); }
    .opacity-60 { opacity: 0.6; }
    .animate-pulse { animation: mdPulse 2s infinite; }
    @keyframes mdPulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes zoomIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    @media (max-width: 1024px) {
      .pos-main-md3 { grid-row: 3; height: calc(100vh - 350px - 70px); }
    }
  `]
})
export class PosTicketComponent {
  public vm = inject(POSViewModel);
}
