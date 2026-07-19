import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { LocalizePipe } from '../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import type { OrderWorkspaceState } from '../../store/order-workspace.state';
import type { LocalizedField } from '../../types';

@Component({
  selector: 'app-tas-dish-grid',
  standalone: true,
  imports: [CommonModule, CurrencyFormatPipe, LocalizePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tas-dish-grid.component.html',
  styles: [':host { display: contents; }'],
})
export class TasDishGridComponent {
  readonly state = input.required<OrderWorkspaceState>();
  readonly categories = input.required<Array<{ _id: string; category_name: LocalizedField }>>();
}
