import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { LocalizePipe } from '../../shared/pipes/localize.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import type { OrderWorkspaceState } from '../../shared/state/order-workspace.state';
import type { LocalizedField } from '../../types';

@Component({
  selector: 'app-pos-menu-panel',
  standalone: true,
  imports: [CommonModule, CurrencyFormatPipe, LocalizePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pos-menu-panel.component.html',
  styles: [':host { display: contents; }'],
})
export class PosMenuPanelComponent {
  readonly state = input.required<OrderWorkspaceState>();
  readonly categories = input.required<Array<{ _id: string; category_name: LocalizedField }>>();

  readonly closed = output<void>();
}
