import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import type { OrderWorkspaceState } from '../../store/order-workspace.state';

@Component({
  selector: 'app-pos-payment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, A11yModule, CurrencyFormatPipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pos-payment-modal.component.html',
  styles: [':host { display: contents; }'],
})
export class PosPaymentModalComponent {
  readonly state = input.required<OrderWorkspaceState>();
  readonly total = input.required<number>();

  readonly process = output<void>();

  protected readonly Math = Math;
}
