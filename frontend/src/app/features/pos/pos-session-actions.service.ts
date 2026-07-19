import { Injectable, OnDestroy, inject, signal, type WritableSignal } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TasService } from '../../core/services/tas.service';
import { SocketService } from '../../core/services/socket/socket.service';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import {
  removeOperationalSession,
  removeTemporaryTotem,
  replaceOperationalSession,
  setOperationalSessionState,
} from '../../shared/utils/operational-session.utils';
import type { Customer, ItemOrder, TotemSession } from '../../types';

export type PosTotemRef = { _id: string; totem_name: string; totem_type: string };

export interface PosSessionActionsContext {
  sessions: WritableSignal<TotemSession[]>;
  selectedSession: WritableSignal<TotemSession | null>;
  sessionItems: WritableSignal<ItemOrder[]>;
  customers: WritableSignal<Customer[]>;
  selectSession(session: TotemSession): void;
}

@Injectable()
export class PosSessionActionsService implements OnDestroy {
  private readonly tasService = inject(TasService);
  private readonly socketService = inject(SocketService);
  private readonly i18n = inject(I18nService);
  private readonly notify = inject(NotificationService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroy$ = new Subject<void>();
  private context!: PosSessionActionsContext;

  // Temporary totem creation
  readonly newTotemName = signal('');
  readonly isCreatingTotem = signal(false);
  readonly isStartingSession = signal(false);
  readonly isClosingSession = signal(false);
  readonly isReopeningSession = signal(false);
  readonly isArchivingSession = signal(false);
  readonly isCancellingSession = signal(false);

  readonly allTotems = signal<PosTotemRef[]>([]);

  init(context: PosSessionActionsContext): void {
    this.context = context;
  }

  setTotems(totems: PosTotemRef[]): void {
    this.allTotems.set(totems);
  }

  startSession(totemId: string): void {
    if (this.isStartingSession()) return;
    this.isStartingSession.set(true);

    this.tasService.startSession(totemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          this.context.sessions.update(s => [...s, session]);
          this.context.selectSession(session);
          this.isStartingSession.set(false);
          this.notify.success(this.i18n.translate('tas.session_started'));
        },
        error: (err) => {
          this.isStartingSession.set(false);
          this.notify.error(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  closeSession(sessionId: string): void {
    if (this.isClosingSession()) return;
    this.isClosingSession.set(true);

    this.tasService.closeSession(sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.markSessionComplete(sessionId, updated);
          this.isClosingSession.set(false);
          this.notify.success(this.i18n.translate('tas.session_closed'));
        },
        error: (err) => {
          this.isClosingSession.set(false);
          const code = err.error?.errorCode;
          if (code === 'SESSION_NOT_ACTIVE') {
            this.notify.error(this.i18n.translate('tas.session_already_closed'));
          } else {
            this.notify.error(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
          }
        },
      });
  }

  reopenSession(sessionId: string): void {
    if (this.isReopeningSession()) return;
    this.isReopeningSession.set(true);

    this.tasService.reopenSession(sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          this.context.sessions.update(current => replaceOperationalSession(current, session));
          if (this.context.selectedSession()?._id === sessionId) {
            this.context.selectedSession.set(session);
          }
          this.isReopeningSession.set(false);
          this.notify.success(this.i18n.translate('tas.session_reopened'));
        },
        error: (err) => {
          this.isReopeningSession.set(false);
          this.notify.error(err.error?.message || this.i18n.translate('tas.session_reopen_error'));
        },
      });
  }

  archiveSession(sessionId: string): void {
    if (this.isArchivingSession()) return;
    this.confirmation.confirm(this.i18n.translate('tas.confirm_archive_session'), { destructive: true })
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmed => {
        if (confirmed) this.archiveSessionConfirmed(sessionId);
      });
  }

  private archiveSessionConfirmed(sessionId: string): void {
    if (this.isArchivingSession()) return;
    this.isArchivingSession.set(true);
    this.tasService.archiveSession(sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.isArchivingSession.set(false);
          this.removeSessionFromActiveView(sessionId, updated);
          this.notify.success(this.i18n.translate('tas.session_archived'));
        },
        error: (err) => {
          this.isArchivingSession.set(false);
          this.notify.error(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  cancelSession(sessionId: string): void {
    if (this.isCancellingSession()) return;
    this.confirmation.confirm(this.i18n.translate('tas.confirm_cancel_session') + '?', { destructive: true })
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmed => {
        if (confirmed) this.cancelSessionConfirmed(sessionId);
      });
  }

  private cancelSessionConfirmed(sessionId: string): void {
    if (this.isCancellingSession()) return;
    this.isCancellingSession.set(true);
    this.tasService.cancelSession(sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.isCancellingSession.set(false);
          this.removeSessionFromActiveView(sessionId, updated);
          this.notify.success(this.i18n.translate('tas.session_cancelled'));
        },
        error: (err) => {
          this.isCancellingSession.set(false);
          this.notify.error(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  createTemporaryTotem(): void {
    const name = this.newTotemName().trim();
    if (!name) return;

    this.isCreatingTotem.set(true);
    this.tasService.createTotem({
      totem_name: name,
      totem_type: 'TEMPORARY',
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (totem) => {
        this.allTotems.update(current => [...current, { ...totem, totem_type: 'TEMPORARY' }]);
        this.newTotemName.set('');
        this.isCreatingTotem.set(false);
        this.notify.success(this.i18n.translate('tas.totem_created'));

        // Auto-start session
        this.startSession(totem._id!);
      },
      error: (err) => {
        this.isCreatingTotem.set(false);
        this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
      },
    });
  }

  markSessionComplete(sessionId: string, updated?: TotemSession): void {
    this.context.sessions.update(sessions => setOperationalSessionState(
      sessions,
      sessionId,
      'COMPLETE',
      updated
    ));
    const selected = this.context.selectedSession();
    if (selected?._id === sessionId) {
      this.context.selectedSession.set({ ...selected, ...updated, totem_state: 'COMPLETE' });
    }
  }

  markSessionStarted(sessionId: string): void {
    this.context.sessions.update(sessions => setOperationalSessionState(sessions, sessionId, 'STARTED'));
    const selected = this.context.selectedSession();
    if (selected?._id === sessionId) {
      this.context.selectedSession.set({ ...selected, totem_state: 'STARTED' });
    }
  }

  removeSessionFromActiveView(sessionId: string, updated?: TotemSession): void {
    const session = this.context.sessions().find(candidate => candidate._id === sessionId) ?? updated;
    this.context.sessions.update(sessions => removeOperationalSession(sessions, sessionId));
    if (this.context.selectedSession()?._id === sessionId) {
      this.context.selectedSession.set(null);
      this.context.sessionItems.set([]);
      this.context.customers.set([]);
    }
    this.socketService.leaveSession(sessionId);
    this.removeTemporaryTotemIfAny(session?.totem_id?.toString());
  }

  /**
   * Remove a temporary totem from the sidebar after its session reaches a
   * terminal state. The backend already deletes it; this keeps the UI in sync.
   */
  private removeTemporaryTotemIfAny(totemId: string | undefined): void {
    this.allTotems.update(current => removeTemporaryTotem(current, totemId));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
