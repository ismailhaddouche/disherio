import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { I18nService } from '../../core/services/i18n.service';
import type { OrderWorkspaceState } from '../../store/order-workspace.state';

@Component({
  selector: 'app-tas-payment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, A11yModule, CurrencyFormatPipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tas-payment-modal.component.html',
  styles: [':host { display: contents; }'],
})
export class TasPaymentModalComponent {
  protected readonly i18n = inject(I18nService);

  readonly state = input.required<OrderWorkspaceState>();
  readonly total = input.required<number>();

  readonly process = output<void>();

  protected readonly Math = Math;
}
