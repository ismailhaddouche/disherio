import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { I18nService } from '../../core/services/i18n.service';
import type { TotemSession } from '../../types';
import type { TasSessionActionsService } from './tas-session-actions.service';

@Component({
  selector: 'app-tas-tables-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, A11yModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tas-tables-sidebar.component.html',
  styles: [':host { display: contents; }'],
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class TasTablesSidebarComponent {
  protected readonly i18n = inject(I18nService);

  readonly actions = input.required<TasSessionActionsService>();
  readonly selectedSessionId = input<string | undefined>();
  readonly sessions = input.required<TotemSession[]>();

  hasOpenSession(totemId: string): boolean {
    return this.sessions().some(session => session.totem_id === totemId && session.totem_state === 'STARTED');
  }

  readonly sessionSelect = output<TotemSession>();
  readonly closed = output<void>();
}
