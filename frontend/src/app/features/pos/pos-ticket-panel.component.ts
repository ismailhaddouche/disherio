import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { LocalizePipe } from '../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { CaslCanDirective } from '../../shared/directives/casl.directive';
import type { OrderWorkspaceState } from '../../store/order-workspace.state';
import { getItemOrderTotal } from '../../shared/utils/order-item.utils';
import type { ItemOrder, TotemSession } from '../../types';
import type { PosSessionActionsService } from './pos-session-actions.service';

@Component({
  selector: 'app-pos-ticket-panel',
  standalone: true,
  imports: [CommonModule, CurrencyFormatPipe, LocalizePipe, TranslatePipe, CaslCanDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pos-ticket-panel.component.html',
  styles: [':host { display: contents; }'],
})
export class PosTicketPanelComponent {
  readonly state = input.required<OrderWorkspaceState>();
  readonly session = input.required<TotemSession | null>();
  readonly sessionItems = input.required<ItemOrder[]>();
  readonly sessionTotal = input.required<number>();
  readonly isSessionClosed = input.required<boolean>();
  readonly isSendingOrder = input.required<boolean>();
  readonly actions = input.required<PosSessionActionsService>();

  readonly sendOrder = output<void>();
  readonly charge = output<void>();

  getSelectedCustomerTotal(): number {
    const customerId = this.state().selectedCustomerId();
    if (!customerId) return this.sessionTotal();
    return this.sessionItems()
      .filter(i => i.customer_id === customerId && i.item_state !== 'CANCELED')
      .reduce((sum, item) => sum + getItemOrderTotal(item), 0);
  }
}
