import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { PosTicketHistoryService } from './pos-ticket-history.service';

@Component({
  selector: 'app-pos-ticket-history-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyFormatPipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pos-ticket-history-panel.component.html',
  styles: [':host { display: contents; }'],
})
export class PosTicketHistoryPanelComponent {
  protected readonly history = inject(PosTicketHistoryService);
}
