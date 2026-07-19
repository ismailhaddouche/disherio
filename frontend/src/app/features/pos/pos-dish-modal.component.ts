import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { LocalizePipe } from '../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import type { OrderWorkspaceState } from '../../store/order-workspace.state';
import type { Customer, Dish } from '../../types';

@Component({
  selector: 'app-pos-dish-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, A11yModule, CurrencyFormatPipe, LocalizePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pos-dish-modal.component.html',
  styles: [':host { display: contents; }'],
})
export class PosDishModalComponent {
  readonly state = input.required<OrderWorkspaceState>();
  readonly dish = input.required<Dish>();
  readonly customers = input.required<Customer[]>();
}
