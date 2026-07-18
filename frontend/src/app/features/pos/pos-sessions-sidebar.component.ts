import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { CaslCanDirective } from '../../shared/directives/casl.directive';
import { getSessionListItemCount } from '../../shared/utils/order-item.utils';
import type { ItemOrder, TotemSession } from '../../types';
import type { PosSessionActionsService, PosTotemRef } from './pos-session-actions.service';

@Component({
  selector: 'app-pos-sessions-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, CaslCanDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pos-sessions-sidebar.component.html',
  styles: [':host { display: contents; }'],
})
export class PosSessionsSidebarComponent {
  readonly isConnected = input.required<boolean>();
  readonly isLoading = input.required<boolean>();
  readonly activeSessions = input.required<TotemSession[]>();
  readonly closedSessions = input.required<TotemSession[]>();
  readonly selectedSessionId = input<string | undefined>();
  readonly sessionItems = input.required<ItemOrder[]>();
  readonly availableTotems = input.required<PosTotemRef[]>();
  readonly hasOpenSession = input.required<boolean>();
  readonly showTicketHistory = input.required<boolean>();
  readonly actions = input.required<PosSessionActionsService>();

  readonly sessionSelect = output<TotemSession>();
  readonly openHistory = output<void>();

  getSessionItemCount(session: TotemSession): number {
    return getSessionListItemCount(session, this.selectedSessionId(), this.sessionItems());
  }
}
