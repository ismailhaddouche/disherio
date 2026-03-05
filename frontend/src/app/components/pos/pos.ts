import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { POSViewModel, POSTable } from './pos.viewmodel';
import { Pipe, PipeTransform } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';

@Pipe({ name: 'filterOccupied', standalone: true })
export class FilterOccupiedPipe implements PipeTransform {
  transform(tables: POSTable[]): POSTable[] {
    return tables.filter(t => t.status === 'occupied');
  }
}

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterOccupiedPipe, LucideAngularModule, TranslateModule],
  providers: [POSViewModel],
  template: `
    <div class="pos-container animate-fade-in">
      <header class="view-header" style="grid-column: 1 / -1; margin-bottom: 0;">
        <div>
          <h1 class="view-title"><lucide-icon name="wallet" [size]="28" class="text-muted"></lucide-icon> {{ 'POS.TITLE' | translate }}</h1>
          <p class="view-desc">{{ 'POS.SUBTITLE' | translate }}</p>
        </div>
      </header>

      <!-- Left Sidebar: Map of Tables or History -->
      <aside class="pos-sidebar glass-card">
        <div class="sidebar-header">
            <div class="view-toggles">
                <button [class.active]="vm.viewMode() === 'tables'" (click)="vm.viewMode.set('tables')">{{ 'POS.TABLES' | translate }}</button>
                <button [class.active]="vm.viewMode() === 'history'" (click)="vm.viewMode.set('history')">{{ 'POS.HISTORY' | translate }}</button>
            </div>
          <span class="occupied-count" *ngIf="vm.viewMode() === 'tables'">{{ (vm.tableStates() | filterOccupied).length }} / {{ vm.tables().length }}</span>
        </div>
        
        @if (vm.viewMode() === 'tables') {
            <div class="tables-grid">
            @for (table of vm.tableStates(); track table.number) {
                <div class="table-card" 
                    [class.occupied]="table.status === 'occupied'"
                    [class.selected]="vm.selectedTable()?.number === table.number"
                    (click)="vm.selectTable(table)">
                <span class="table-num">{{ table.name || ('ROLES.Table' | translate) + ' ' + table.number }}</span>
                @if (table.status === 'occupied') {
                    <span class="total-preview">{{ table.order.totalAmount | currency:'EUR' }}</span>
                }
                </div>
            }
            </div>
        } @else {
            <div class="history-list">
                @for (ticket of vm.tickets(); track ticket._id) {
                    <div class="history-card glass-card">
                        <div class="h-top">
                            <span class="h-id">{{ ticket.customId }}</span>
                            <span class="h-date">{{ ticket.timestamp | date:'shortTime' }}</span>
                        </div>
                        <div class="h-items">
                            {{ ticket.itemsSummary.length }} {{ 'POS.ITEMS' | translate }}
                        </div>
                        <div class="h-bottom">
                            <div class="h-total">{{ ticket.amount | currency:'EUR' }}</div>
                            <div class="h-actions">
                                <button class="btn-icon print" (click)="vm.printTicket(ticket)" [title]="'POS.PRINT_TITLE' | translate"><lucide-icon name="printer" [size]="16"></lucide-icon></button>
                                <button class="btn-icon delete" (click)="vm.deleteTicket(ticket._id)" [title]="'POS.DELETE_TITLE' | translate"><lucide-icon name="trash-2" [size]="16"></lucide-icon></button>
                            </div>
                        </div>
                    </div>
                }
            </div>
        }

        <div class="sidebar-footer" style="margin-top: auto; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.05);">
            <button class="btn-closure" (click)="vm.closeShift()">
                <lucide-icon name="lock" [size]="16" class="inline-icon"></lucide-icon> {{ 'POS.CLOSE_SHIFT' | translate }}
            </button>
        </div>
      </aside>

      <!-- Main Content: Ticket & Billing Detail -->
      <main class="pos-main">
        @if (vm.selectedTable(); as table) {
          @if (table.status === 'occupied') {
            <div class="ticket-view glass-card">
              <div class="ticket-header">
                <div class="table-title">
                  <span class="order-id">#{{ table.order.customId || table.order._id.slice(-6) }}</span>
                  <h1>{{ table.name }}</h1>
                  @if (vm.editMode()) {
                     <div class="edit-hint gradient-text" style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase;">{{ 'POS.EDIT_MODE' | translate }}</div>
                  }
                </div>
                
                <div class="checkout-actions">
                  <button class="btn-edit" (click)="vm.toggleEditMode()">
                    <lucide-icon *ngIf="!vm.editMode()" name="pen-line" [size]="14" class="inline-icon"></lucide-icon>
                    <lucide-icon *ngIf="vm.editMode()" name="check" [size]="14" class="inline-icon"></lucide-icon>
                    {{ (vm.editMode() ? 'POS.FINISH_EDIT' : 'POS.EDIT_ORDER') | translate }}
                  </button>
                  <button class="btn-split" (click)="vm.openSplitModal()">
                    <lucide-icon name="columns" [size]="14" class="inline-icon"></lucide-icon> {{ 'POS.PAY_SPLIT' | translate }}
                  </button>
                  <button class="btn-primary" (click)="vm.processPayment()" style="padding: 12px 24px; font-weight: 900;">
                    <lucide-icon name="credit-card" [size]="16" class="inline-icon"></lucide-icon> {{ 'POS.PAY_TOTAL' | translate }}
                  </button>
                </div>
              </div>

              <div class="ticket-content" style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
                <section class="comensales-breakdown" style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h3 style="margin:0">{{ 'POS.BREAKDOWN' | translate }}</h3>
                    <div style="display: flex; gap: 8px;">
                        @if (vm.editMode()) {
                            <button class="btn-add-item" (click)="vm.showAddItemModal.set(true)">+ {{ 'POS.ADD_ITEM' | translate }}</button>
                            <button class="btn-add-custom" (click)="vm.showCustomLineModal.set(true)">+ {{ 'POS.CUSTOM' | translate }}</button>
                        }
                    </div>
                  </div>

                  <div class="comensales-list" style="overflow-y: auto; flex: 1; min-height: 0; padding-right: 8px;">
                    @for (user of vm.getComensales(table.order); track user.id) {
                      <div class="user-strip glass-card" [class.orphan-warning]="user.id === 'orphan' || user.id === 'staff' || user.id === 'pos'">
                        <div class="user-info">
                          <span class="user-name">
                             <lucide-icon name="user" [size]="14" class="inline-icon"></lucide-icon> {{ user.name }}
                             @if (user.id === 'orphan' || user.id === 'staff' || user.id === 'pos') {
                                <span class="badge-warning" style="margin-left:8px; font-size:0.6rem;">{{ 'POS.ASSIGN_NAME' | translate }}</span>
                             }
                          </span>
                          <span class="user-total">{{ user.total | currency:'EUR' }}</span>
                          @if (!vm.editMode()) {
                            <button class="btn-pay-single" (click)="vm.payByUser(user.id)" [title]="'POS.CHARGE_USER' | translate">
                                <lucide-icon name="credit-card" [size]="14"></lucide-icon>
                            </button>
                          }
                        </div>
                        <div class="user-items">
                          @for (item of user.items; track item._originalIndex) {
                            <div class="pos-item-row" [class.editing-row]="vm.editMode()">
                              <div class="status-dot" [class.ready]="item.status === 'ready'"></div>
                              
                              <div class="item-id-column">
                                @if (vm.editMode()) {
                                    <div class="edit-fields">
                                        <input type="text" class="edit-name-input" [value]="item.name" (blur)="$any($event.target).value !== item.name && vm.updateItemName(table.order._id, item._originalIndex, $any($event.target).value)">
                                    </div>
                                } @else {
                                    <span class="name">
                                        {{ item.quantity }}x {{ item.name }}
                                        @if (item.isCustom) { <small style="opacity: 0.6"> ({{ 'POS.CUSTOM_ITEM' | translate }})</small> }
                                    </span>
                                }
                              </div>

                              <div style="display: flex; align-items: center; gap: 8px; justify-content: flex-end;">
                                @if (vm.editMode()) {
                                    <div class="edit-fields-extended">
                                        <div class="input-with-currency">
                                            <input type="number" class="edit-price-input" [value]="item.price" (change)="vm.updateItemPrice(table.order._id, item._originalIndex, +$any($event.target).value)">
                                            <span>€</span>
                                        </div>
                                        <input type="text" class="edit-user-input" [placeholder]="'POS.GUEST_NAME' | translate" [value]="item.orderedBy.name" (blur)="$any($event.target).value !== item.orderedBy.name && vm.reassignItem(table.order._id, item._originalIndex, $any($event.target).value)">
                                        <button class="btn-delete-item" (click)="vm.removeItemFromOrder(table.order._id, item._originalIndex)">
                                            <lucide-icon name="trash-2" [size]="12"></lucide-icon>
                                        </button>
                                    </div>
                                } @else {
                                    <span class="price-bubble">{{ (item.price * item.quantity) | currency:'EUR' }}</span>
                                }
                              </div>
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </section>

                <section class="pos-total-section">
                  <div class="total-row">
                    <span>{{ 'POS.SUBTOTAL' | translate }}</span>
                    <span>{{ table.order.totalAmount | currency:'EUR' }}</span>
                  </div>
                  @if (vm.calculateBilling(table.order.totalAmount); as billing) {
                    @if (billing) {
                      <div class="total-row subtotal-highlight">
                        <span>{{ 'POS.TOTAL_SIMPLE' | translate }}</span>
                        <span class="gradient-text">{{ billing.subtotal | currency:'EUR' }}</span>
                      </div>
                      <div class="total-row grand-total">
                        <div style="display: flex; flex-direction: column;">
                           <span>{{ 'POS.TOTAL_TIP' | translate }}</span>
                           <small style="opacity: 0.5; font-size: 0.7rem; font-weight: 500;">{{ billing.tipDescription }}</small>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                           <div class="tip-pills" style="display: flex; gap: 4px;">
                              @for (p of [0, 5, 10, 15]; track p) {
                                <button [class.active]="vm.activeTipPercentage() === p"
                                        (click)="vm.activeTipPercentage.set(p)"
                                        class="tip-pill">{{ p }}%</button>
                              }
                           </div>
                           <span class="grand-value">{{ billing.grandTotal | currency:'EUR' }}</span>
                        </div>
                      </div>
                    }
                  } @else {
                    <div class="total-row warning">
                      <span>{{ 'POS.VAT_WARNING' | translate }}</span>
                      <span>{{ table.order.totalAmount | currency:'EUR' }}</span>
                    </div>
                    <div class="hint-message">
                      <small>{{ 'POS.VAT_HINT' | translate }}</small>
                    </div>
                  }
                </section>
              </div>
            </div>
          } @else {
            <div class="empty-detail glass-card">
              <div class="icon"><lucide-icon name="layout-dashboard" [size]="64" color="var(--text-muted)"></lucide-icon></div>
              <h2>{{ 'POS.EMPTY_TITLE' | translate }}</h2>
              <p>{{ table.name }} {{ 'POS.EMPTY_DESC' | translate }}</p>
              <div class="empty-actions" style="display: flex; gap: 12px; margin-top: 12px;">
                <button class="btn-primary" (click)="vm.openTable(table)">{{ 'POS.OPEN_TABLE' | translate }}</button>
                @if (table.isVirtual) {
                  <button class="btn-delete-item" style="padding: 12px 16px; border-radius: 12px;" (click)="vm.deleteVirtualTable(table.id)">
                    <lucide-icon name="trash-2" [size]="14" class="inline-icon"></lucide-icon> {{ 'COMMON.DELETE' | translate }}
                  </button>
                }
              </div>
            </div>
          }
        } @else {
          <div class="no-selection glass-card">
            <h2>{{ 'POS.NO_SELECTION_TITLE' | translate }}</h2>
            <p>{{ 'POS.NO_SELECTION_DESC' | translate }}</p>
          </div>
        }
      </main>

      <!-- Modal: Add Menu Item -->
      @if (vm.showAddItemModal()) {
        <div class="modal-overlay" (click)="vm.showAddItemModal.set(false)">
          <div class="modal-content glass-card" (click)="$event.stopPropagation()">
            <h2>{{ 'POS.ADD_MENU_ITEM' | translate }}</h2>
            <div class="menu-items-list">
              @for (item of vm.menuItems(); track item._id) {
                <div class="menu-item-option" (click)="vm.addMenuItemToOrder(vm.selectedTable()?.order._id!, item)">
                  <span>{{ item.emoji }} {{ item.name }}</span>
                  <span class="price">{{ item.price | currency:'EUR' }}</span>
                </div>
              }
            </div>
            <button class="btn-secondary" (click)="vm.showAddItemModal.set(false)">{{ 'POS.CANCEL' | translate }}</button>
          </div>
        </div>
      }

      <!-- Modal: Add Custom Line -->
      @if (vm.showCustomLineModal()) {
        <div class="modal-overlay" (click)="vm.showCustomLineModal.set(false)">
          <div class="modal-content glass-card" (click)="$event.stopPropagation()">
            <h2>{{ 'POS.ADD_CUSTOM_LINE' | translate }}</h2>
            <form #customForm="ngForm" (ngSubmit)="vm.addCustomLineToOrder(vm.selectedTable()?.order._id!, customName.value, +customPrice.value); customForm.reset()">
              <div class="form-group">
                <label>{{ 'POS.CUSTOM_NAME' | translate }}</label>
                <input type="text" class="glass-input" #customName required [placeholder]="'POS.CUSTOM_NAME_PH' | translate">
              </div>
              <div class="form-group">
                <label>{{ 'POS.PRICE' | translate }}</label>
                <input type="number" class="glass-input" #customPrice required step="0.01" min="0" placeholder="0.00">
              </div>
              <div class="modal-actions">
                <button type="button" class="btn-secondary" (click)="vm.showCustomLineModal.set(false)">{{ 'POS.CANCEL' | translate }}</button>
                <button type="submit" class="btn-primary">{{ 'POS.ADD' | translate }}</button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Modal: Split Options -->
      @if (vm.showSplitDetailedModal()) {
        <div class="modal-overlay" (click)="vm.showSplitDetailedModal.set(false)">
           <div class="modal-content glass-card" (click)="$event.stopPropagation()">
              <header class="modal-header">
                <h2>{{ 'POS.SPLIT_PAYMENT' | translate }}</h2>
                <p class="text-muted">{{ 'POS.SPLIT_DESC' | translate }}</p>
              </header>

              <div class="split-options-grid">
                <button class="split-option-card single" (click)="vm.processPayment(); vm.showSplitDetailedModal.set(false)">
                    <div class="option-icon"><lucide-icon name="receipt" [size]="24"></lucide-icon></div>
                    <div class="option-info">
                        <strong>{{ 'POS.FULL_BILL' | translate }}</strong>
                        <span>{{ 'POS.PAY_ALL_DESC' | translate }}</span>
                    </div>
                    <div class="option-amount">{{ vm.selectedTable()?.order?.totalAmount | currency:'EUR' }}</div>
                </button>

                <button class="split-option-card by-user" (click)="vm.showSplitDetailedModal.set(false)">
                    <div class="option-icon"><lucide-icon name="users" [size]="24"></lucide-icon></div>
                    <div class="option-info">
                        <strong>{{ 'POS.BY_CUSTOMER' | translate }}</strong>
                        <span>{{ 'POS.PAY_INDIVIDUAL_DESC' | translate }}</span>
                    </div>
                </button>

                <div class="split-option-card equal">
                    <div class="option-icon"><lucide-icon name="grid" [size]="24"></lucide-icon></div>
                    <div class="option-info">
                        <strong>{{ 'POS.EQUAL_PARTS' | translate }}</strong>
                        <span>{{ 'POS.SPLIT_N_DESC' | translate }}</span>
                        <div class="equal-parts-selector" style="display: flex; gap: 8px; margin-top: 12px;">
                           @for (n of [2, 3, 4, 5]; track n) {
                              <button class="btn-part" (click)="vm.processPayment(undefined, 'equal', n); vm.showSplitDetailedModal.set(false)">{{ n }}</button>
                           }
                           <input type="number" #customN class="glass-input tiny" placeholder="X" style="width: 50px;" (keyup.enter)="vm.processPayment(undefined, 'equal', +customN.value); vm.showSplitDetailedModal.set(false)">
                        </div>
                    </div>
                </div>
              </div>

              <div class="modal-footer" style="padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.05);">
                <button class="btn-secondary w-full" (click)="vm.showSplitDetailedModal.set(false)">{{ 'POS.CLOSE' | translate }}</button>
              </div>
           </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .pos-container {
      display: grid;
      grid-template-columns: 350px 1fr;
      grid-template-rows: auto 1fr;
      height: 100vh;
      background: transparent;
      gap: 16px;
      padding: 0;
      overflow: hidden;
    }

    @media (max-width: 768px) {
      .pos-container {
        grid-template-columns: 1fr;
        height: auto;
        overflow: visible;
        padding-bottom: 24px;
      }
      .pos-sidebar {
        max-height: 45vh;
        overflow-y: auto;
      }
      .pos-main {
        overflow: visible;
      }
      .ticket-view {
        padding: 20px;
        gap: 20px;
      }
      .ticket-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
      }
      .checkout-actions {
        width: 100%;
        flex-direction: column;
      }
      .checkout-actions button {
        width: 100%;
        justify-content: center;
      }
      .table-title h1 {
        font-size: 1.4rem;
      }
    }

    @media (max-width: 480px) {
      .pos-sidebar { max-height: 35vh; }
      .tables-grid { grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); }
    }

    .pos-sidebar {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 24px;
      overflow-y: auto;
    }

    .sidebar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .view-toggles { display: flex; gap: 8px; }
    .view-toggles button {
      background: none; border: none; color: var(--text-base); opacity: 0.5; font-weight: bold; cursor: pointer; padding-bottom: 4px;
      border-bottom: 2px solid transparent;
    }
    .view-toggles button.active { opacity: 1; border-color: var(--accent-primary); color: var(--accent-primary); }

    .occupied-count { font-size: 0.8rem; color: var(--text-muted); }

    .tables-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
      gap: 12px;
    }

    .history-list { display: flex; flex-direction: column; gap: 12px; }
    .history-card { padding: 16px; border: 1px solid rgba(255,255,255,0.05); cursor: default; }
    .h-top { display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 8px; }
    .h-id { font-family: monospace; color: var(--text-muted); }
    .h-date { color: var(--text-muted); opacity: 0.8; }
    .h-total { font-size: 1.3rem; font-weight: bold; color: var(--highlight); }
    
    .h-bottom { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
    .h-actions { display: flex; gap: 12px; }
    .btn-icon {
      background: none; border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px; padding: 10px 14px; cursor: pointer; color: var(--text-base);
      opacity: 0.8; transition: all 0.2s; font-size: 1.2rem;
      display: flex; align-items: center; justify-content: center;
    }
    .btn-icon:hover { opacity: 1; background: rgba(255,255,255,0.1); }
    .btn-icon.print { border-color: var(--highlight); color: var(--highlight); }
    .btn-icon.delete { border-color: #ef4444; color: #ef4444; }

    .btn-closure {
      width: 100%;
      background: rgba(239, 68, 68, 0.1);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.2);
      padding: 12px;
      border-radius: 12px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
    }
    .btn-closure:hover {
      background: #ef4444;
      color: white;
    }

    .table-card {
      aspect-ratio: 1;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .table-card:hover { transform: translateY(-4px); background: rgba(255,255,255,0.08); }
    .table-card.selected { border-color: var(--accent-primary); box-shadow: 0 0 20px rgba(79, 70, 229, 0.1); }
    .table-card.occupied { border-color: var(--highlight); background: rgba(34, 197, 94, 0.05); }

    .table-num { font-size: 0.9rem; font-weight: bold; word-break: break-word; }
    .total-preview { font-size: 0.7rem; color: var(--accent-primary); margin-top: 4px; }

    .pos-main { overflow: hidden; display: flex; flex-direction: column; }

    .ticket-view {
      margin: 0;
      padding: 32px;
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .ticket-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      padding-bottom: 20px;
      flex-shrink: 0;
    }

    .checkout-actions { display: flex; gap: 12px; }

    .btn-edit {
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.4);
      padding: 12px 18px;
      border-radius: 12px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-edit:hover { background: #3b82f6; color: white; }

    .btn-split {
        background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.1);
        padding: 12px 18px; border-radius: 12px; font-weight: bold; cursor: pointer;
    }

    .btn-pay-single {
        background: var(--highlight); color: var(--bg-dark); border: none;
        width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
        cursor: pointer;
    }

    .user-strip {
      padding: 16px;
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 16px;
      margin-bottom: 16px;
    }

    .user-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 800;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      color: var(--text-base);
    }

    .user-total { font-family: monospace; color: var(--highlight); }

    .badge-warning { background: #f59e0b; color: #000; padding: 2px 6px; border-radius: 4px; font-weight: 900; }

    .pos-item-row {
      display: grid;
      grid-template-columns: 12px 1fr auto;
      align-items: center;
      gap: 12px;
      font-size: 0.9rem;
      padding: 6px 0;
      border-bottom: 1px solid rgba(255,255,255,0.02);
    }

    .pos-item-row.editing-row { grid-template-columns: 12px 1fr auto; }

    .edit-fields { display: flex; flex: 1; }
    .edit-name-input { 
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); 
        color: white; border-radius: 6px; padding: 4px 8px; width: 100%; 
    }

    .edit-fields-extended { display: flex; align-items: center; gap: 8px; }
    
    .input-with-currency { position: relative; width: 80px; }
    .input-with-currency input { width: 100%; padding: 4px 20px 4px 8px; text-align: right; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 6px; }
    .input-with-currency span { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); opacity: 0.5; font-size: 0.7rem; }

    .edit-price-input, .edit-user-input {
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); 
        color: white; border-radius: 6px; padding: 4px 8px; 
    }
    .edit-user-input { width: 120px; }

    .price-bubble { background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 100px; font-family: monospace; font-size: 0.8rem; }

    .pos-total-section {
      flex-shrink: 0;
      padding-top: 24px;
      border-top: 2px solid rgba(255,255,255,0.1);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .total-row { display: flex; justify-content: space-between; font-size: 0.9rem; opacity: 0.7; }
    .subtotal-highlight {
      opacity: 1;
      font-size: 1.6rem;
      font-weight: 900;
      color: var(--highlight);
    }

    .grand-total { 
        opacity: 1; font-weight: 900; font-size: 1.4rem; padding-top: 8px; margin-top: 8px; 
        border-top: 1px dashed rgba(255,255,255,0.2); align-items: center; 
    }
    .grand-value { color: var(--highlight); text-shadow: 0 0 20px rgba(34, 197, 94, 0.3); }

    .tip-pills { display: flex; gap: 4px; }
    .tip-pill {
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
        color: white; font-size: 0.7rem; padding: 4px 8px; border-radius: 100px; cursor: pointer;
    }
    .tip-pill.active { background: var(--highlight); color: black; border-color: var(--highlight); }

    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(8px);
    }
    .modal-content {
      width: 100%;
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
      padding: 32px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      border-radius: 24px 24px 0 0;
      background: #111;
      border: 1px solid rgba(255,255,255,0.1);
      animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @media (min-width: 768px) {
      .modal-overlay { align-items: center; }
      .modal-content { border-radius: 24px; margin: 20px; }
    }

    @keyframes slideUp {
      from { transform: translateY(100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .split-options-grid { display: flex; flex-direction: column; gap: 12px; }
    .split-option-card {
        background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
        border-radius: 16px; padding: 20px; display: flex; align-items: center; gap: 20px;
        text-align: left; cursor: pointer; transition: all 0.2s; color: white;
    }
    .split-option-card:hover { background: rgba(255,255,255,0.08); border-color: var(--accent-primary); }
    
    .option-icon { width: 48px; height: 48px; border-radius: 12px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; }
    .option-info { flex: 1; display: flex; flex-direction: column; }
    .option-info strong { font-size: 1.1rem; }
    .option-info span { font-size: 0.8rem; opacity: 0.6; }
    .option-amount { font-size: 1.2rem; font-weight: 900; font-family: monospace; color: var(--highlight); }

    .btn-part { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 6px 12px; border-radius: 8px; cursor: pointer; }
    .btn-part:hover { background: var(--accent-primary); color: black; }

    .btn-add-item, .btn-add-custom {
      background: rgba(16, 185, 129, 0.1); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.2);
      padding: 8px 12px; border-radius: 8px; font-size: 0.75rem; font-weight: bold; cursor: pointer;
    }

    .btn-delete-item {
      background: rgba(239, 68, 68, 0.1);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.2);
      padding: 4px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.75rem;
      font-weight: bold;
      transition: all 0.2s;
    }
    .btn-delete-item:hover { background: var(--danger); color: white; }

    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #ccc; }
    .status-dot.ready { background: var(--highlight); box-shadow: 0 0 8px var(--highlight); }

    .w-full { width: 100%; }
    
    .menu-items-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 400px;
      overflow-y: auto;
    }
    .menu-item-option {
      display: flex;
      justify-content: space-between;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .menu-item-option:hover {
      background: rgba(255, 255, 255, 0.1);
      transform: translateX(4px);
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }
    .form-group label {
      font-size: 0.9rem;
      font-weight: bold;
      opacity: 0.8;
    }
    .modal-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    @media (min-width: 480px) {
        .modal-actions {
            flex-direction: row;
            justify-content: flex-end;
        }
    }
    
    .modal-actions button { width: 100%; }
    @media (min-width: 480px) {
        .modal-actions button { width: auto; }
    }
  `]
})
export class POSComponent {
  public vm = inject(POSViewModel);
}
