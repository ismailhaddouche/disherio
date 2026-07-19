import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TasService } from '../../core/services/tas.service';
import { TasSocketService } from '../../core/services/socket/tas-socket.service';
import { tasStore } from '../../store/tas.store';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import {
  removeOperationalSession,
  removeTemporaryTotem,
  replaceOperationalSession,
  setOperationalSessionState,
} from '../../shared/utils/operational-session.utils';
import type { TotemSession } from '../../types';

export type TasTotemRef = { _id: string; totem_name: string; totem_type: string };

export interface TasSessionActionsContext {
  selectSession(session: TotemSession): void;
}

@Injectable()
export class TasSessionActionsService implements OnDestroy {
  private readonly tasService = inject(TasService);
  private readonly tasSocket = inject(TasSocketService);
  private readonly i18n = inject(I18nService);
  private readonly notify = inject(NotificationService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroy$ = new Subject<void>();
  private context!: TasSessionActionsContext;

  // Temporary totem creation
  readonly newTotemName = signal('');
  readonly isCreatingTotem = signal(false);
  readonly isStartingSession = signal(false);
  readonly isClosingSession = signal(false);
  readonly isReopeningSession = signal(false);
  readonly isArchivingSession = signal(false);
  readonly isCancellingSession = signal(false);

  // Local state for all totems (synced with store)
  readonly allTotems = signal<TasTotemRef[]>([]);
  readonly selectedTotemId = signal<string | null>(null);
  // Totem sessions: all sessions for selected totem (STARTED + COMPLETE, not PAID)
  readonly totemSessions = signal<TotemSession[]>([]);

  init(context: TasSessionActionsContext): void {
    this.context = context;
  }

  setTotems(totems: TasTotemRef[]): void {
    this.allTotems.set(totems);
    tasStore.setAllTotems(totems);
  }

  /** Keep per-totem sessions in sync after a full sessions refresh. */
  refreshTotemSessions(sessions: TotemSession[]): void {
    const sessionsById = new Map(sessions.map(session => [session._id, session]));
    this.totemSessions.update(current => current
      .filter(session => sessionsById.has(session._id))
      .map(session => {
        const refreshed = sessionsById.get(session._id);
        return refreshed ? { ...session, ...refreshed } : session;
      }));
  }

  loadTotemSessions(totemId: string): void {
    this.selectedTotemId.set(totemId);
    this.tasService.getTotemSessions(totemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sessions) => {
          // Filter out PAID and CANCELLED sessions — those are archived
          this.totemSessions.set(sessions.filter(s => s.totem_state !== 'PAID' && s.totem_state !== 'CANCELLED'));
        },
        error: () => undefined,
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
        tasStore.setAllTotems([...this.allTotems()]);
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

  startSession(totemId: string): void {
    if (this.isStartingSession()) return;
    this.isStartingSession.set(true);

    this.tasService.startSession(totemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          // Attach totem info so the name displays immediately (backend may not populate it)
          const totem = this.allTotems().find(t => t._id === totemId);
          if (totem && !session.totem) {
            session.totem = {
              _id: totem._id,
              restaurant_id: '',
              totem_name: totem.totem_name,
              totem_qr: '',
              totem_type: totem.totem_type as 'STANDARD' | 'TEMPORARY',
            };
          }
          tasStore.setSessions([...tasStore.sessions(), session]);
          this.context.selectSession(session);
          this.isStartingSession.set(false);
          this.notify.success(this.i18n.translate('tas.session_started'));
        },
        error: (err) => {
          this.isStartingSession.set(false);
          const code = err.error?.errorCode;
          if (code === 'SESSION_NOT_ACTIVE') {
            this.notify.error(this.i18n.translate('tas.session_already_closed'));
          } else {
            this.notify.error(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
          }
        },
      });
  }

  closeTemporaryTotem(totemId: string): void {
    this.confirmation.confirm(this.i18n.translate('tas.close_temp_table') + '?', { destructive: true })
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmed => {
        if (confirmed) this.closeTemporaryTotemConfirmed(totemId);
      });
  }

  private closeTemporaryTotemConfirmed(totemId: string): void {
    this.tasService.deleteTotem(totemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Remove from sessions if active
          tasStore.setSessions(tasStore.sessions().filter(s => s.totem_id !== totemId));
          this.allTotems.update(current => current.filter(t => t._id !== totemId));
          tasStore.setAllTotems([...this.allTotems()]);

          if (tasStore.selectedSession()?.totem_id === totemId) {
            tasStore.selectSession(null);
          }
          this.notify.success(this.i18n.translate('tas.totem_closed'));
        },
        error: (err) => {
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
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

  reopenSession(sessionId: string, totemId: string): void {
    if (this.isReopeningSession()) return;
    this.isReopeningSession.set(true);

    this.tasService.reopenSession(sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          const totem = this.allTotems().find(t => t._id === totemId);
          if (totem && !session.totem) {
            session.totem = {
              _id: totem._id, restaurant_id: '', totem_name: totem.totem_name, totem_qr: '', totem_type: totem.totem_type as 'STANDARD' | 'TEMPORARY',
            };
          }
          // Replace any existing session with the same id, or add the reopened one.
          tasStore.setSessions(replaceOperationalSession(tasStore.sessions(), session));
          this.context.selectSession(session);
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

  markSessionComplete(sessionId: string, updated?: TotemSession): void {
    tasStore.setSessions(setOperationalSessionState(tasStore.sessions(), sessionId, 'COMPLETE', updated));
    this.totemSessions.update(sessions => setOperationalSessionState(
      sessions,
      sessionId,
      'COMPLETE',
      updated
    ));
    const selected = tasStore.selectedSession();
    if (selected?._id === sessionId) {
      tasStore.selectSession({ ...selected, ...updated, totem_state: 'COMPLETE' });
    }
  }

  markSessionStarted(sessionId: string): void {
    tasStore.setSessions(setOperationalSessionState(tasStore.sessions(), sessionId, 'STARTED'));
    this.totemSessions.update(sessions => setOperationalSessionState(sessions, sessionId, 'STARTED'));
    const selected = tasStore.selectedSession();
    if (selected?._id === sessionId) {
      tasStore.selectSession({ ...selected, totem_state: 'STARTED' });
    }
  }

  removeSessionFromActiveView(sessionId: string, updated?: TotemSession): void {
    const session = tasStore.sessions().find(candidate => candidate._id === sessionId)
      ?? this.totemSessions().find(candidate => candidate._id === sessionId)
      ?? updated;
    tasStore.removeSession(sessionId);
    this.totemSessions.update(sessions => removeOperationalSession(sessions, sessionId));
    this.tasSocket.leaveTasSession(sessionId);
    this.removeTemporaryTotemIfAny(session?.totem_id?.toString());
  }

  /**
   * Remove a temporary totem from the sidebar after its session reaches a
   * terminal state (PAID or CANCELLED). The backend already deletes it; this
   * keeps the UI in sync without a full reload.
   */
  private removeTemporaryTotemIfAny(totemId: string | undefined): void {
    this.allTotems.update(current => removeTemporaryTotem(current, totemId));
    tasStore.setAllTotems([...this.allTotems()]);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
