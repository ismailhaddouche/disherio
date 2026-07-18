import { ChangeDetectionStrategy, Component, inject, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { I18nService } from '../../core/services/i18n.service';
import type { OrderWorkspaceState } from '../../shared/state/order-workspace.state';
import type { Customer } from '../../types';

@Component({
  selector: 'app-tas-customers-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tas-customers-bar.component.html',
  styles: [':host { display: contents; }'],
})
export class TasCustomersBarComponent {
  protected readonly i18n = inject(I18nService);

  readonly state = input.required<OrderWorkspaceState>();
  readonly customers = input.required<Customer[]>();

  readonly showAddCustomer = model.required<boolean>();
  readonly newCustomerName = model.required<string>();

  readonly addCustomer = output<void>();
}
