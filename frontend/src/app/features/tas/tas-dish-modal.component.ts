import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { LocalizePipe } from '../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { I18nService } from '../../core/services/i18n.service';
import type { OrderWorkspaceState } from '../../shared/state/order-workspace.state';
import type { Customer, Dish } from '../../types';

@Component({
  selector: 'app-tas-dish-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, A11yModule, CurrencyFormatPipe, LocalizePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tas-dish-modal.component.html',
  styles: [':host { display: contents; }'],
})
export class TasDishModalComponent {
  protected readonly i18n = inject(I18nService);

  readonly state = input.required<OrderWorkspaceState>();
  readonly dish = input.required<Dish>();
  readonly customers = input.required<Customer[]>();
}
