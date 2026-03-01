import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { POSViewModel, POSTable } from './pos.viewmodel';
import { Pipe, PipeTransform } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Pipe({ name: 'filterOccupied', standalone: true })
export class FilterOccupiedPipe implements PipeTransform {
  transform(tables: POSTable[]): POSTable[] {
    return tables.filter(t => t.status === 'occupied');
  }
}

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterOccupiedPipe, LucideAngularModule],
  providers: [POSViewModel],
  template: `
    <div class="pos-container animate-fade-in">
      <header class="view-header" style="grid-column: 1 / -1; margin-bottom: 0;">
        <div>
          <h1 class="view-title"><lucide-icon name="wallet" [size]="28" class="text-muted"></lucide-icon> Punto de Venta (POS)</h1>
          <p class="view-desc">Gestión de comandas, cobros y mesas activas.</p>
        </div>
      </header>

      <!-- Left Sidebar: Map of Tables or History -->
      <aside class="pos-sidebar glass-card">
        <div class="sidebar-header">
            <div class="view-toggles">
                <button [class.active]="vm.viewMode() === 'tables'" (click)="vm.viewMode.set('tables')">MESAS</button>
                <button [class.active]="vm.viewMode() === 'history'" (click)="vm.viewMode.set('history')">HISTORIAL</button>
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
                <span class="table-num">{{ table.name || 'Mesa ' + table.number }}</span>
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
                            {{ ticket.itemsSummary.length }} items
                        </div>
                        <div class="h-bottom">
                            <div class="h-total">{{ ticket.amount | currency:'EUR' }}</div>
                            <div class="h-actions">
                                <button class="btn-icon print" (click)="vm.printTicket(ticket)" title="Imprimir"><lucide-icon name="printer" [size]="16"></lucide-icon></button>
                                <button class="btn-icon delete" (click)="vm.deleteTicket(ticket._id)" title="Eliminar"><lucide-icon name="trash-2" [size]="16"></lucide-icon></button>
                            </div>
                        </div>
                    </div>
                }
            </div>
        }
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
                 <div class="edit-hint gradient-text" style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase;">Modo Edición Activo</div>
              }
            </div>
            
            <div class="checkout-actions">
              <button class="btn-edit" (click)="vm.toggleEditMode()">
                <lucide-icon *ngIf="!vm.editMode()" name="pen-line" [size]="14" class="inline-icon"></lucide-icon>
                {{ vm.editMode() ? 'Listo' : 'Editar' }}
              </button>
              <button class="btn-split" (click)="vm.openSplitModal()">
                <lucide-icon name="users" [size]="14" class="inline-icon"></lucide-icon> Dividir
              </button>
              <button class="btn-print" (click)="vm.processPayment()">
                <lucide-icon name="credit-card" [size]="14" class="inline-icon"></lucide-icon> PAGAR TOTAL
              </button>
            </div>
          </div>
              <div class="ticket-content">
                <section class="comensales-breakdown">
                  <h3>Desglose por Comensales</h3>
                  <div class="comensales-list">
                    @for (user of vm.getComensales(table.order); track user.id) {
                      <div class="user-strip glass-card clickable" 
                           [class.orphan-warning]="user.id === 'orphan'"
                           (click)="vm.payByUser(user.id)"
                           title="Cobrar solo a este comensal">
                        <div class="user-info">
                          <span class="user-name"><lucide-icon name="user" [size]="14" class="inline-icon"></lucide-icon> {{ user.name }}</span>
                          <span class="user-total">{{ user.total | currency:'EUR' }}</span>
                        </div>
                        <div class="user-items">
                          @for (item of user.items; track $index; let idx = $index) {
                            <div class="pos-item-row">
                      <div class="status-dot" [class.ready]="item.status === 'ready'"></div>
                      <span class="name">
                        {{ item.quantity }}x {{ item.name }}
                        @if (item.isCustom) { <small style="opacity: 0.6"> (Personalizado)</small> }
                      </span>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="price">{{ (item.price * item.quantity) | currency:'EUR' }}</span>
                        @if (vm.editMode()) {
                          <button class="btn-delete-item" (click)="vm.removeItemFromOrder(table.order._id, item._originalIndex)">
                            <lucide-icon name="trash-2" [size]="12"></lucide-icon>
                          </button>
                        }
                      </div>
                    </div>      }
                        </div>
                      </div>
                    }
                  </div>
                </section>

                <section class="pos-total-section">
                  @if (vm.calculateBilling(table.order.totalAmount); as billing) {
                    <div class="total-row">
                      <span>Base Imponible</span>
                      <span>{{ billing.basePrice | currency:'EUR' }}</span>
                    </div>
                    <div class="total-row">
                      <span>IVA ({{ billing.vatPercentage }}%)</span>
                      <span>{{ billing.vatAmount | currency:'EUR' }}</span>
                    </div>
                    <div class="total-row subtotal-highlight">
                      <span>TOTAL</span>
                      <span class="gradient-text">{{ billing.subtotal | currency:'EUR' }}</span>
                    </div>
                    @if (billing.tipEnabled) {
                      <div class="total-row tip-row">
                        <span>{{ billing.tipDescription }} ({{ billing.tipPercentage }}%)</span>
                        <span>{{ billing.tipAmount | currency:'EUR' }}</span>
                      </div>
                      <div class="total-row grand-total">
                        <span>TOTAL CON PROPINA</span>
                        <span>{{ billing.grandTotal | currency:'EUR' }}</span>
                      </div>
                    }
                  } @else {
                    <div class="total-row warning">
                      <span>⚠️ IVA no configurado</span>
                      <span>{{ table.order.totalAmount | currency:'EUR' }}</span>
                    </div>
                    <div class="hint-message">
                      <small>Configure el IVA en Configuración para generar tickets.</small>
                    </div>
                  }
                </section>
              </div>
            </div>
          } @else {
            <div class="empty-detail glass-card">
              <div class="icon"><lucide-icon name="layout-dashboard" [size]="64" color="var(--text-muted)"></lucide-icon></div>
              <h2>Mesa Vacía</h2>
              <p>{{ table.name }} no tiene una sesión activa.</p>
              <button class="btn-primary" (click)="vm.openTable(table)">Abrir Mesa (Manual)</button>
            </div>
          }
        } @else {
          <div class="no-selection glass-card">
            <h2>Selecciona una mesa para gestionar la caja</h2>
            <p>Monitorea pedidos en tiempo real y finaliza tickets.</p>
          </div>
        }
      </main>

      <!-- Modal: Add Menu Item -->
      @if (vm.showAddItemModal()) {
        <div class="modal-overlay" (click)="vm.showAddItemModal.set(false)">
          <div class="modal-content glass-card" (click)="$event.stopPropagation()">
            <h2>Añadir Producto del Menú</h2>
            <div class="menu-items-list">
              @for (item of vm.menuItems(); track item._id) {
                <div class="menu-item-option" (click)="vm.addMenuItemToOrder(vm.selectedTable()?.order._id!, item)">
                  <span>{{ item.emoji }} {{ item.name }}</span>
                  <span class="price">{{ item.price | currency:'EUR' }}</span>
                </div>
              }
            </div>
            <button class="btn-secondary" (click)="vm.showAddItemModal.set(false)">Cancelar</button>
          </div>
        </div>
      }

      <!-- Modal: Add Custom Line -->
      @if (vm.showCustomLineModal()) {
        <div class="modal-overlay" (click)="vm.showCustomLineModal.set(false)">
          <div class="modal-content glass-card" (click)="$event.stopPropagation()">
            <h2>Añadir Línea Personalizada</h2>
            <form #customForm="ngForm" (ngSubmit)="vm.addCustomLineToOrder(vm.selectedTable()?.order._id!, customName.value, +customPrice.value); customForm.reset()">
              <div class="form-group">
                <label>Nombre del servicio/producto</label>
                <input type="text" class="glass-input" #customName required placeholder="Ej: Servicio extra, Descorche, etc.">
              </div>
              <div class="form-group">
                <label>Precio (€)</label>
                <input type="number" class="glass-input" #customPrice required step="0.01" min="0" placeholder="0.00">
              </div>
              <div class="modal-actions">
                <button type="button" class="btn-secondary" (click)="vm.showCustomLineModal.set(false)">Cancelar</button>
                <button type="submit" class="btn-primary">Añadir</button>
              </div>
            </form>
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
      .pos-container { grid-template-columns: 1fr; height: auto; }
      .pos-sidebar { max-height: 40vh; }
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
      transition: all 0.2s ease;
      text-align: center; padding: 4px;
    }

    .table-card:hover { background: rgba(255,255,255,0.08); }
    .table-card.selected { border-color: var(--accent-primary); box-shadow: 0 0 15px rgba(56, 189, 248, 0.2); }
    .table-card.occupied { background: rgba(56, 189, 248, 0.1); border-color: var(--accent-primary); }
    
    .table-num { font-size: 0.9rem; font-weight: bold; word-break: break-word; }
    .total-preview { font-size: 0.7rem; color: var(--accent-primary); margin-top: 4px; }

    .pos-main { overflow-y: auto; }

    .ticket-view {
      padding: 32px;
      min-height: 100%;
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .ticket-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      padding-bottom: 24px;
    }
    
    .checkout-actions { display: flex; gap: 12px; flex-wrap: wrap; }

    .order-id { font-size: 0.85rem; color: var(--text-muted); font-family: monospace; }
    .btn-print {
      background: var(--highlight);
      color: var(--bg-dark);
      border: none;
      padding: 16px 24px;
      border-radius: 12px;
      font-weight: 900;
      font-size: 1rem;
      cursor: pointer;
      flex: 1;
    }
    .btn-split {
        background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2);
        padding: 16px 20px; border-radius: 12px; font-weight: bold; cursor: pointer;
        flex: 1;
    }

    .comensales-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-top: 16px;
    }

    .user-strip {
      padding: 16px;
      background: rgba(255,255,255,0.02);
    }

    .user-info {
      display: flex;
      justify-content: space-between;
      font-weight: bold;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .user-items { display: flex; flex-direction: column; gap: 8px; }
    .pos-item-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #ccc; }
    .status-dot.ready { background: var(--highlight); box-shadow: 0 0 8px var(--highlight); }

    .pos-total-section {
      margin-top: auto;
      padding-top: 32px;
      border-top: 2px solid rgba(255,255,255,0.1);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .icon { font-size: 4rem; opacity: 0.3; margin-bottom: 24px; color: var(--text-base); }

    /* Custom Scrollbar for a premium feel */
    *::-webkit-scrollbar { width: 6px; height: 6px; }
    *::-webkit-scrollbar-track { background: transparent; }
    *::-webkit-scrollbar-thumb { 
        background: rgba(255, 255, 255, 0.1); 
        border-radius: 10px; 
    }
    *::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }

    /* Fix layout shifts and improve structure */
    .pos-item-row {
      display: grid;
      grid-template-columns: 24px 1fr auto;
      align-items: center;
      gap: 12px;
      font-size: 0.9rem;
      padding: 4px 0;
    }

    .pos-item-row .name { font-weight: 500; }
    .pos-item-row .price { font-family: monospace; font-weight: bold; }

    .ticket-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      padding-bottom: 20px;
      flex-wrap: wrap; /* Safety for mobile */
    }

    .table-title {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0; /* Allow shrinking for long names */
    }

    .table-title h1 { 
        margin: 0; 
        font-size: 1.8rem; 
        white-space: nowrap; 
        overflow: hidden; 
        text-overflow: ellipsis; 
    }

    .total-row.subtotal-highlight {
      background: linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.05), transparent);
      opacity: 1;
      font-size: 1.6rem;
      font-weight: 900;
      padding: 16px 0;
      border-top: 1px dashed rgba(255,255,255,0.2);
      border-bottom: 1px dashed rgba(255,255,255,0.2);
      margin: 12px 0;
      color: var(--highlight);
    }


    /* Edit Mode Styles */
    .btn-edit {
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.4);
      padding: 12px 16px;
      border-radius: 12px;
      font-weight: bold;
      cursor: pointer;
    }
    .btn-add-item, .btn-add-custom {
      background: rgba(16, 185, 129, 0.2);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.4);
      padding: 12px 16px;
      border-radius: 12px;
      font-weight: bold;
      cursor: pointer;
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


    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
    }
    .modal-content {
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      padding: 32px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
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
    }
    .form-group label {
      font-size: 0.9rem;
      font-weight: bold;
      opacity: 0.8;
    }
    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }
  `]
})
export class POSComponent {
  public vm = inject(POSViewModel);
}
