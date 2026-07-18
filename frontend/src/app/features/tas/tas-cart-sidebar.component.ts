import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { LocalizePipe } from '../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { I18nService } from '../../core/services/i18n.service';
import type { OrderWorkspaceState } from '../../shared/state/order-workspace.state';

@Component({
  selector: 'app-tas-cart-sidebar',
  standalone: true,
  imports: [CommonModule, A11yModule, CurrencyFormatPipe, LocalizePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tas-cart-sidebar.component.html',
  styles: [':host { display: contents; }'],
})
export class TasCartSidebarComponent {
  protected readonly i18n = inject(I18nService);

  readonly state = input.required<OrderWorkspaceState>();
  readonly isSendingOrder = input.required<boolean>();

  readonly closed = output<void>();
  readonly sendOrder = output<void>();
}
