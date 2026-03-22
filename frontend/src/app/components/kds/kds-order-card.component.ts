import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';
import { KDSViewModel } from './kds.viewmodel';
import { IOrder, IOrderItem } from '../../core/interfaces/order.interface';

@Component({
  selector: 'app-kds-order-card',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule],
  template: `
    <div class="order-card-md3" [class.urgent]="order.urgent">
      <header class="order-header-md3">
        <div class="order-meta">
            <span class="text-title-large color-primary">{{ 'ROLES.Table' | translate }} #{{ order.totemId || order.tableNumber }}</span>
            <div class="time-badge">
               <lucide-icon name="clock" [size]="14"></lucide-icon>
               <span class="text-label-medium">{{ vm.getTimeDiff(order.createdAt?.toString() || '') }}</span>
            </div>
        </div>
        <div class="bulk-actions-md3">
            <button class="icon-btn-md3 success-tonal" (click)="vm.bulkUpdateItemsStatus(order._id!, 'ready')" [attr.aria-label]="'KDS.ALL_READY' | translate" [title]="'KDS.ALL_READY' | translate">
                <lucide-icon name="check-check" [size]="18"></lucide-icon>
            </button>
            <button class="icon-btn-md3 info-tonal" (click)="vm.bulkUpdateItemsStatus(order._id!, 'served')" [attr.aria-label]="'KDS.ALL_SERVED' | translate" [title]="'KDS.ALL_SERVED' | translate">
                <lucide-icon name="bell-ring" [size]="18"></lucide-icon>
            </button>
        </div>
      </header>

      <div class="items-list-md3">
        @for (item of order.kitchenItems; track $index) {
          <div class="kds-item-md3" [class]="item.status">
            <div class="item-thumb-md3" *ngIf="item.image" [style.backgroundImage]="'url(' + item.image + ')'"></div>
            <div class="item-main-md3">
              <div class="item-name-row">
                  <span class="text-title-medium item-qty">{{ item.quantity }}x</span>
                  <span class="text-title-medium item-name">{{ item.name }}</span>

                  @if (item.createdAt && item.status !== 'ready') {
                      <span class="item-timer-md3" [class.urgent]="vm.getTimeDiffMinutes(item.createdAt.toString()) >= 15">
                        {{ vm.getTimeDiff(item.createdAt.toString()) }}
                      </span>
                  }
              </div>
              
              <div class="item-sub-info">
                  <span class="text-label-medium opacity-60">
                    <lucide-icon name="user" [size]="12"></lucide-icon>
                    {{ item.orderedBy?.name }}
                  </span>
                  @if (item.notes) {
                      <span class="item-note-md3">
                        <lucide-icon name="message-square" [size]="12"></lucide-icon>
                        "{{ item.notes }}"
                      </span>
                  }
              </div>
            </div>
            
            <div class="item-actions-md3">
              @if (item.status === 'pending') {
                  <button class="btn-primary-sm" (click)="vm.updateItemStatus(order._id!, (item._id || '').toString(), 'preparing')">
                    {{ 'KDS.MARK_PREPARING' | translate }}
                  </button>
                  <button class="icon-btn-md3 error-tonal-sm" (click)="vm.cancelItem(order._id!, (item._id || '').toString())">
                    <lucide-icon name="x" [size]="16"></lucide-icon>
                  </button>
              }
              @if (item.status === 'preparing') {
                  <div class="ready-action-group">
                      <button class="btn-success-sm" (click)="vm.updateItemStatus(order._id!, (item._id || '').toString(), 'ready', false)">
                        <lucide-icon name="check" [size]="16"></lucide-icon>
                        {{ 'KDS.MARK_READY' | translate }}
                      </button>
                      <button class="icon-btn-md3 success-tonal-sm" (click)="vm.updateItemStatus(order._id!, (item._id || '').toString(), 'ready', true)">
                        <lucide-icon name="printer" [size]="16"></lucide-icon>
                      </button>
                  </div>
              }
              @if (item.status === 'ready') {
                  <div class="ready-status-md3">
                      <div class="status-icon success">
                        <lucide-icon name="check-circle" [size]="20"></lucide-icon>
                      </div>
                      <button class="icon-btn-md3 tonal-sm" (click)="vm.printItemTicket(order, item)" [attr.aria-label]="'KDS.REPRINT' | translate" [title]="'KDS.REPRINT' | translate">
                        <lucide-icon name="printer" [size]="16"></lucide-icon>
                      </button>
                  </div>
              }
              @if (item.status === 'cancelled') {
                  <span class="text-label-small status-tag error">{{ 'KDS.CANCELLED' | translate }}</span>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .order-card-md3 {
      background: var(--md-sys-color-surface-container);
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid var(--md-sys-color-outline-variant);
      box-shadow: var(--md-sys-elevation-1);
      transition: border-color 0.2s;
      animation: slideUp 0.4s ease-out;
    }
    
    .order-card-md3:hover { 
      border-color: rgba(var(--md-sys-color-primary-rgb), 0.4);
    }
    
    .order-card-md3.urgent {
      border: 2px solid var(--md-sys-color-error);
      background: rgba(var(--md-sys-color-error-container-rgb), 0.25);
      animation: urgentPulse 2s infinite;
    }

    @keyframes urgentPulse {
      0% { box-shadow: 0 0 0 0 rgba(186, 26, 26, 0.4); }
      70% { box-shadow: 0 0 20px 10px rgba(186, 26, 26, 0); }
      100% { box-shadow: 0 0 0 0 rgba(186, 26, 26, 0); }
    }

    .order-header-md3 {
      padding: 16px 20px;
      background: var(--md-sys-color-surface-container-high);
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
    }

    .order-meta { display: flex; flex-direction: column; gap: 4px; }
    
    .time-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: rgba(0,0,0,0.05);
      border-radius: 20px;
      color: var(--md-sys-color-on-surface-variant);
    }

    .bulk-actions-md3 { display: flex; gap: 8px; }

    .items-list-md3 { padding: 16px; display: flex; flex-direction: column; gap: 12px; }

    .kds-item-md3 {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-radius: 12px;
      background: var(--md-sys-color-surface-container-high);
      border: 1px solid var(--md-sys-color-outline-variant);
      transition: background 0.2s;
    }

    .kds-item-md3:hover {
      background: var(--md-sys-color-surface-container-highest);
    }

    .kds-item-md3.preparing {
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
      border-color: var(--md-sys-color-primary);
    }
    .kds-item-md3.preparing .opacity-60 { color: var(--md-sys-color-on-primary-container); opacity: 0.7; }

    .kds-item-md3.ready {
      opacity: 0.65;
      background: var(--md-sys-color-surface-container-highest);
    }

    .kds-item-md3.cancelled {
      opacity: 0.4;
      text-decoration: line-through;
      border: 1px dashed var(--md-sys-color-error);
      background: transparent;
    }

    .item-thumb-md3 {
      width: 48px; height: 48px; border-radius: 12px;
      background-size: cover; background-position: center;
      background-color: var(--md-sys-color-surface-variant);
      flex-shrink: 0;
    }

    .item-main-md3 { flex: 1; display: flex; flex-direction: column; gap: 6px; }
    .item-name-row { display: flex; align-items: baseline; gap: 12px; }
    .item-qty { font-weight: 900; color: var(--md-sys-color-primary); font-size: 1.1rem; }
    .item-name { font-weight: 600; }
    
    .kds-item-md3.preparing .item-qty { color: inherit; }

    .item-timer-md3 {
      padding: 4px 12px;
      border-radius: 12px;
      background: rgba(0,0,0,0.08);
      font-size: 0.75rem;
      font-weight: 800;
      color: var(--md-sys-color-on-surface-variant);
    }
    .item-timer-md3.urgent { 
      background: var(--md-sys-color-error); 
      color: var(--md-sys-color-on-error);
      animation: blink 1s infinite;
    }

    @keyframes blink { 50% { opacity: 0.7; } }

    .item-sub-info { display: flex; align-items: center; gap: 12px; }
    
    .item-note-md3 {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      background: rgba(var(--md-sys-color-secondary-container-rgb), 0.3);
      border-radius: 8px;
      font-size: 0.75rem;
      color: var(--md-sys-color-secondary);
      font-weight: 600;
    }

    .item-actions-md3 { display: flex; align-items: center; gap: 10px; }

    .ready-action-group { display: flex; gap: 8px; }

    .ready-status-md3 { display: flex; align-items: center; gap: 16px; }
    .status-icon.success { color: #10b981; }

    .status-tag {
      padding: 6px 14px;
      border-radius: 100px;
      text-transform: uppercase;
      font-weight: 900;
      font-size: 0.7rem;
      letter-spacing: 0.05em;
    }
    .status-tag.error { background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); }

    .color-primary { color: var(--md-sys-color-primary); }
    .opacity-60 { opacity: 0.6; }

    .btn-primary-sm, .btn-success-sm {
       padding: 10px 20px; border-radius: 100px; border: none; font-weight: 800; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 8px;
       transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .btn-primary-sm:hover, .btn-success-sm:hover { transform: scale(1.05); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .btn-primary-sm:active, .btn-success-sm:active { transform: scale(0.95); }
    
    .btn-primary-sm { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
    .btn-success-sm { background: #10b981; color: white; }

    @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  `]
})
export class KDSOrderCardComponent {
  @Input({ required: true }) order!: IOrder & { kitchenItems: IOrderItem[], urgent: boolean };
  public vm = inject(KDSViewModel);
}
