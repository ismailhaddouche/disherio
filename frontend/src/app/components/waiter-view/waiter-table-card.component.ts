import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';
import { TotemWithStatus, WaiterViewModel } from './waiter.viewmodel';

@Component({
  selector: 'app-waiter-table-card',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule],
  template: `
    <div class="md-card table-item-md3"
         [class.is-occupied]="!!totem.order"
         [class.is-urgent]="vm.isUrgent(totem.order?.createdAt)"
         (click)="onClick.emit(totem.id)">

      <div class="item-header-row">
        <div class="status-indicators">
          @if (totem.isVirtual) {
            <div class="chip primary text-label-small">{{ 'WAITER.VIRTUAL_TAG' | translate }}</div>
          }
          <div class="chip text-label-small" [class.success]="!totem.order" [class.primary]="totem.order">
            {{ totem.order ? ('WAITER.STATUS_OCCUPIED' | translate) : ('WAITER.STATUS_FREE' | translate) }}
          </div>
        </div>
        <div class="item-actions">
          <button class="md-icon-button-sm" (click)="onOpenQR($event)" [title]="'WAITER.QR_TITLE' | translate">
            <lucide-icon name="qr-code" [size]="18"></lucide-icon>
          </button>
          @if (totem.isVirtual) {
            <button class="md-icon-button-sm error" (click)="onDelete($event)" [title]="'WAITER.DELETE_TITLE' | translate">
              <lucide-icon name="trash-2" [size]="18"></lucide-icon>
            </button>
          }
        </div>
      </div>

      <div class="item-body-md3">
        <div class="icon-surface" [class.occupied]="!!totem.order">
          <lucide-icon [name]="totem.isVirtual ? 'clipboard-list' : 'armchair'" [size]="28"></lucide-icon>
        </div>
        <div class="item-info">
          <div class="text-headline-small color-primary">#{{ totem.id }}</div>
          <div class="text-title-medium">{{ totem.name }}</div>
          
          @if (totem.order) {
            <div class="order-summary-md3">
              <div class="summary-top">
                <span class="text-label-medium opacity-70">
                  {{ totem.order.items?.length || 0 }} {{ 'POS.ITEMS' | translate }}
                </span>
                <span class="text-label-large color-error">{{ vm.getTimeElapsed(totem.order.createdAt) }}</span>
              </div>
              <div class="text-headline-small">{{ totem.order.totalAmount | currency:'EUR' }}</div>
              
              <div class="items-list-preview">
                @for (item of totem.order.items?.slice(0, 4); track $index) {
                  <div class="mini-item-box" [title]="item.name">
                    <img *ngIf="item.image" [src]="item.image" class="mini-item-img">
                    <span *ngIf="!item.image" class="mini-item-fallback">{{ item.quantity }}x</span>
                  </div>
                }
                @if ((totem.order.items?.length || 0) > 4) {
                  <span class="text-label-small opacity-60">+{{ totem.order.items.length - 4 }}</span>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .table-item-md3 {
        padding: 24px;
        background: var(--md-sys-color-surface-1);
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
        display: flex;
        flex-direction: column;
        gap: 20px;
        height: 100%;
        border: 1px solid var(--md-sys-color-outline-variant);
    }

    .table-item-md3:hover {
        background: var(--md-sys-color-surface-2);
        transform: translateY(-4px);
        box-shadow: var(--md-sys-elevation-1);
    }

    .table-item-md3.is-occupied {
        background: var(--md-sys-color-surface-3);
        border-color: var(--md-sys-color-primary-container);
    }

    .table-item-md3.is-urgent {
        border-color: var(--md-sys-color-error);
    }

    .item-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .status-indicators { display: flex; gap: 8px; }

    .md-icon-button-sm {
        width: 36px; height: 36px; border-radius: 50%; border: none;
        background: transparent;
        color: var(--md-sys-color-on-surface-variant);
        display: flex; align-items: center; justify-content: center; cursor: pointer;
        transition: background 0.2s;
    }
    .md-icon-button-sm:hover { background: var(--md-sys-color-surface-variant); }
    .md-icon-button-sm.error:hover { color: var(--md-sys-color-error); }

    .item-body-md3 { display: flex; gap: 24px; align-items: flex-start; }
    
    .icon-surface {
        width: 72px; height: 72px; border-radius: 20px;
        background: var(--md-sys-color-surface-container-high);
        display: flex; align-items: center; justify-content: center;
        color: var(--md-sys-color-on-surface-variant);
        flex-shrink: 0;
    }
    .icon-surface.occupied {
        background: var(--md-sys-color-primary-container);
        color: var(--md-sys-color-on-primary-container);
    }

    .item-info { flex: 1; display: flex; flex-direction: column; gap: 4px; }
    
    .color-primary { color: var(--md-sys-color-primary); }
    .color-error { color: var(--md-sys-color-error); }

    .order-summary-md3 {
        margin-top: 16px; padding-top: 16px;
        border-top: 1px solid var(--md-sys-color-outline-variant);
        display: flex; flex-direction: column; gap: 12px;
    }

    .summary-top { display: flex; justify-content: space-between; align-items: center; }

    .items-list-preview { display: flex; align-items: center; gap: 8px; }
    .mini-item-box { 
      width: 32px; height: 32px; border-radius: 8px; overflow: hidden;
      background: var(--md-sys-color-surface-container-highest); display: flex; align-items: center; justify-content: center;
    }
    .mini-item-img { width: 100%; height: 100%; object-fit: cover; }
    .mini-item-fallback { font-size: 0.7rem; font-weight: 600; opacity: 0.6; }
  `]
})
export class WaiterTableCardComponent {
  @Input({ required: true }) totem!: TotemWithStatus;
  @Output() delete = new EventEmitter<{ event: Event, id: number }>();
  @Output() openQR = new EventEmitter<{ event: Event, id: number }>();
  @Output() onClick = new EventEmitter<number>();

  public vm = inject(WaiterViewModel);

  onDelete(event: Event) {
    this.delete.emit({ event, id: this.totem.id });
  }

  onOpenQR(event: Event) {
    this.openQR.emit({ event, id: this.totem.id });
  }
}
