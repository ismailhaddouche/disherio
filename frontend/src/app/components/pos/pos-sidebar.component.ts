import { Component, inject, Pipe, PipeTransform } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { POSViewModel, POSTable } from './pos.viewmodel';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';

@Pipe({ name: 'filterOccupied', standalone: true })
export class FilterOccupiedPipe implements PipeTransform {
  transform(tables: POSTable[]): POSTable[] {
    return tables.filter(t => t.status === 'occupied');
  }
}

@Component({
  selector: 'app-pos-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterOccupiedPipe, LucideAngularModule, TranslateModule],
  template: `
      <aside class="pos-sidebar-md3">
        <div class="sidebar-header-md3">
          <div class="view-toggles-md3">
            <button [class.active]="vm.viewMode() === 'tables'" (click)="vm.viewMode.set('tables')" class="text-label-large">
              {{ 'POS.TABLES' | translate }}
              <div class="active-indicator"></div>
            </button>
            <button [class.active]="vm.viewMode() === 'history'" (click)="vm.viewMode.set('history')" class="text-label-large">
              {{ 'POS.HISTORY' | translate }}
              <div class="active-indicator"></div>
            </button>
          </div>
          <span class="text-label-small opacity-60" *ngIf="vm.viewMode() === 'tables'">
            {{ (vm.tableStates() | filterOccupied).length }} / {{ vm.tables().length }}
          </span>
        </div>

        <div class="sidebar-content-md3">
          @if (vm.viewMode() === 'tables') {
            <div class="tables-grid-md3">
              @for (table of vm.tableStates(); track table.number) {
                <div class="table-item-md3"
                     [class.occupied]="table.status === 'occupied'"
                     [class.selected]="vm.selectedTable()?.number === table.number"
                     (click)="vm.selectTable(table)">
                  <span class="text-title-medium">{{ table.name || ('ROLES.Table' | translate) + ' ' + table.number }}</span>
                  @if (table.status === 'occupied') {
                    <span class="text-label-medium table-total-md3">{{ table.order.totalAmount | currency:'EUR' }}</span>
                  }
                </div>
              }
            </div>
          } @else {
            <div class="history-list-md3">
              @for (ticket of vm.tickets(); track ticket._id) {
                <div class="ticket-card-md3">
                  <div class="ticket-meta-md3">
                    <span class="text-label-small opacity-60">#{{ ticket.customId }}</span>
                    <span class="text-label-small opacity-60">{{ ticket.timestamp | date:'shortTime' }}</span>
                  </div>
                  <div class="ticket-body-md3">
                    <span class="text-body-medium">{{ ticket.itemsSummary.length }} {{ 'POS.ITEMS' | translate }}</span>
                    <span class="text-title-large color-primary">{{ ticket.amount | currency:'EUR' }}</span>
                  </div>
                  <div class="ticket-actions-md3">
                    <button class="icon-btn-md3 tonal-sm" (click)="vm.printTicket(ticket)" [title]="'POS.PRINT_TITLE' | translate">
                      <lucide-icon name="printer" [size]="18"></lucide-icon>
                    </button>
                    <button class="icon-btn-md3 error-tonal-sm" (click)="vm.deleteTicket(ticket._id)" [title]="'POS.DELETE_TITLE' | translate">
                      <lucide-icon name="trash-2" [size]="18"></lucide-icon>
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <div class="sidebar-footer-md3">
          <button class="btn-error btn-full" (click)="vm.closeShift()">
            <lucide-icon name="lock" [size]="18"></lucide-icon>
            <span>{{ 'POS.CLOSE_SHIFT' | translate }}</span>
          </button>
        </div>
      </aside>
  `,
  styles: [`
    :host {
      display: contents;
    }
    
    .pos-sidebar-md3 {
      grid-row: 2;
      background: var(--md-sys-color-surface-1);
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--md-sys-color-outline-variant);
      height: 100%;
    }

    .sidebar-header-md3 {
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
    }

    .view-toggles-md3 { display: flex; gap: 24px; }
    .view-toggles-md3 button {
      background: none; border: none; padding: 12px 0;
      color: var(--md-sys-color-on-surface-variant);
      cursor: pointer; position: relative;
    }
    .view-toggles-md3 button.active { color: var(--md-sys-color-primary); font-weight: 700; }
    .active-indicator {
      position: absolute; bottom: 0; left: 0; right: 0; height: 3px;
      background: var(--md-sys-color-primary);
      border-radius: 3px 3px 0 0;
      transform: scaleX(0); transition: transform 0.2s;
    }
    button.active .active-indicator { transform: scaleX(1); }

    .sidebar-content-md3 { flex: 1; overflow-y: auto; padding: 16px; }

    .tables-grid-md3 {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 12px;
    }

    .table-item-md3 {
      aspect-ratio: 1;
      background: var(--md-sys-color-surface-container-high);
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
      border: 2px solid transparent;
      text-align: center;
      padding: 8px;
    }
    .table-item-md3:hover { background: var(--md-sys-color-surface-container-highest); }
    .table-item-md3.selected { border-color: var(--md-sys-color-primary); background: var(--md-sys-color-surface-container-highest); }
    .table-item-md3.occupied { background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); }
    
    .table-total-md3 { margin-top: 4px; font-weight: 800; opacity: 0.8; }

    .history-list-md3 { display: flex; flex-direction: column; gap: 12px; }
    .ticket-card-md3 {
      padding: 16px;
      background: var(--md-sys-color-surface-2);
      border-radius: 16px;
      border: 1px solid var(--md-sys-color-outline-variant);
    }
    .ticket-meta-md3 { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .ticket-body-md3 { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
    .ticket-actions-md3 { display: flex; gap: 8px; justify-content: flex-end; }

    .sidebar-footer-md3 { padding: 16px 24px; border-top: 1px solid var(--md-sys-color-outline-variant); }
    .color-primary { color: var(--md-sys-color-primary); }
    .opacity-60 { opacity: 0.6; }

    @media (max-width: 1024px) {
      .pos-sidebar-md3 { height: 350px; }
    }
  `]
})
export class PosSidebarComponent {
  public vm = inject(POSViewModel);
}
