import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { I18nService } from '../../core/services/i18n.service';
import type { ItemOrder, TotemSession } from '../../types';
import type { TasSessionActionsService } from './tas-session-actions.service';

@Component({
  selector: 'app-tas-session-header',
  standalone: true,
  imports: [CommonModule, CurrencyFormatPipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tas-session-header.component.html',
  styles: [':host { display: contents; }'],
})
export class TasSessionHeaderComponent {
  protected readonly i18n = inject(I18nService);

  readonly session = input.required<TotemSession>();
  readonly sessionItems = input.required<ItemOrder[]>();
  readonly sessionTotal = input.required<number>();
  readonly pendingCount = input.required<number>();
  readonly isProcessingPayment = input.required<boolean>();
  readonly actions = input.required<TasSessionActionsService>();

  readonly toggleTables = output<void>();
  readonly showQr = output<TotemSession>();
  readonly charge = output<void>();
  readonly toggleCart = output<void>();

  protected readonly isSessionClosed = computed(() => this.session().totem_state === 'COMPLETE');

  formatOrderLimit(session: TotemSession): string {
    const status = session.order_limit_status;
    if (!status) return '0';
    const liveLimitedOrders = new Set(
      this.sessionItems()
        .filter(item => item.item_state !== 'CANCELED' && !item.unlimited_order_item)
        .map(item => item.order_id)
    ).size;
    const count = Math.max(status.limited_order_count, liveLimitedOrders);
    if (status.max_orders_per_session > 0) {
      return `${count}/${status.max_orders_per_session}`;
    }
    return `${count}`;
  }
}
