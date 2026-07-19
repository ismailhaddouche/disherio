import { ChangeDetectionStrategy, Component, inject, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { LocalizePipe } from '../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { I18nService } from '../../core/services/i18n.service';
import type { OrderWorkspaceState } from '../../store/order-workspace.state';
import type { Customer, TotemSession } from '../../types';

export interface PosAssignSelectEvent {
  itemId: string;
  event: Event;
}

@Component({
  selector: 'app-pos-session-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyFormatPipe, LocalizePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pos-session-panel.component.html',
  styles: [':host { display: contents; }'],
})
export class PosSessionPanelComponent {
  private readonly i18n = inject(I18nService);

  readonly session = input.required<TotemSession>();
  readonly state = input.required<OrderWorkspaceState>();
  readonly customers = input.required<Customer[]>();

  readonly showAddCustomer = model.required<boolean>();
  readonly newCustomerName = model.required<string>();

  readonly addCustomer = output<void>();
  readonly assignSelect = output<PosAssignSelectEvent>();
  readonly addOrder = output<void>();

  getStateLabel(state: string): string {
    switch (state) {
      case 'ORDERED': return this.i18n.translate('order_state.ordered');
      case 'ON_PREPARE': return this.i18n.translate('order_state.preparing');
      case 'SERVED': return this.i18n.translate('order_state.served');
      case 'CANCELED': return this.i18n.translate('order_state.canceled');
      default: return state;
    }
  }
}
