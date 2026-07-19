import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { LocalizePipe } from '../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { I18nService } from '../../core/services/i18n.service';
import type { OrderWorkspaceState } from '../../store/order-workspace.state';
import type { Customer, ItemOrder } from '../../types';

export interface TasAssignItemEvent {
  itemId: string;
  customerId: string | null;
}

@Component({
  selector: 'app-tas-session-items',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyFormatPipe, LocalizePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tas-session-items.component.html',
  styles: [':host { display: contents; }'],
})
export class TasSessionItemsComponent {
  protected readonly i18n = inject(I18nService);

  readonly state = input.required<OrderWorkspaceState>();
  readonly sessionItems = input.required<ItemOrder[]>();
  readonly customers = input.required<Customer[]>();

  readonly deleteItem = output<string>();
  readonly serveItem = output<string>();
  readonly assignItem = output<TasAssignItemEvent>();

  protected readonly kitchenItems = computed(() =>
    this.sessionItems().filter(i => i.item_disher_type === 'KITCHEN')
  );

  protected readonly serviceItemsSession = computed(() =>
    this.sessionItems().filter(i => i.item_disher_type === 'SERVICE')
  );

  getStateLabel(state: ItemOrder['item_state']): string {
    const keyMap: Record<string, string> = {
      ORDERED: 'tas.state.ordered',
      ON_PREPARE: 'tas.state.on_prepare',
      SERVED: 'tas.state.served',
      CANCELED: 'tas.state.canceled',
    };
    return keyMap[state] ? this.i18n.translate(keyMap[state]) : state;
  }
}
