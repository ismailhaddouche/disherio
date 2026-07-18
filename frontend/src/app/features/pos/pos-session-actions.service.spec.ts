import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { TasService } from '../../services/tas.service';
import { SocketService } from '../../services/socket/socket.service';
import type { Customer, ItemOrder, TotemSession } from '../../types';
import {
  PosSessionActionsService,
  type PosSessionActionsContext,
  type PosTotemRef,
} from './pos-session-actions.service';

function createSession(overrides: Partial<TotemSession> = {}): TotemSession {
  return {
    _id: 'session-1',
    totem_id: 'totem-1',
    session_date_start: '2026-07-18T10:00:00.000Z',
    totem_state: 'STARTED',
    ...overrides,
  };
}

describe('PosSessionActionsService', () => {
  let service: PosSessionActionsService;
  let tasService: jasmine.SpyObj<TasService>;
  let socketService: { leaveSession: jasmine.Spy };
  let notification: { success: jasmine.Spy; error: jasmine.Spy };
  let confirmation: { confirm: jasmine.Spy };
  let context: PosSessionActionsContext;
  let selectSessionSpy: jasmine.Spy;

  beforeEach(() => {
    tasService = jasmine.createSpyObj<TasService>('TasService', [
      'startSession',
      'closeSession',
      'reopenSession',
      'archiveSession',
      'cancelSession',
      'createTotem',
    ]);
    socketService = { leaveSession: jasmine.createSpy('leaveSession') };
    notification = {
      success: jasmine.createSpy('success'),
      error: jasmine.createSpy('error'),
    };
    confirmation = { confirm: jasmine.createSpy('confirm').and.returnValue(of(true)) };

    TestBed.configureTestingModule({
      providers: [
        PosSessionActionsService,
        { provide: TasService, useValue: tasService },
        { provide: SocketService, useValue: socketService },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: NotificationService, useValue: notification },
        { provide: ConfirmationService, useValue: confirmation },
      ],
    });

    selectSessionSpy = jasmine.createSpy('selectSession');
    const sessions = signal<TotemSession[]>([]);
    const selectedSession = signal<TotemSession | null>(null);
    context = {
      sessions,
      selectedSession,
      sessionItems: signal<ItemOrder[]>([]),
      customers: signal<Customer[]>([]),
      selectSession: (session: TotemSession) => {
        selectSessionSpy(session);
        selectedSession.set(session);
      },
    };

    service = TestBed.inject(PosSessionActionsService);
    service.init(context);
  });

  afterEach(() => service.ngOnDestroy());

  describe('startSession', () => {
    it('adds the new session, selects it and notifies on success', () => {
      const session = createSession();
      tasService.startSession.and.returnValue(of(session));

      service.startSession('totem-1');

      expect(tasService.startSession).toHaveBeenCalledOnceWith('totem-1');
      expect(context.sessions()).toEqual([session]);
      expect(selectSessionSpy).toHaveBeenCalledOnceWith(session);
      expect(service.isStartingSession()).toBeFalse();
      expect(notification.success).toHaveBeenCalledOnceWith('tas.session_started');
    });

    it('ignores a second call while a start is already in flight', () => {
      const pending = new Subject<TotemSession>();
      tasService.startSession.and.returnValue(pending.asObservable());

      service.startSession('totem-1');
      service.startSession('totem-1');

      expect(tasService.startSession).toHaveBeenCalledTimes(1);
      expect(service.isStartingSession()).toBeTrue();
    });

    it('resets the busy flag and notifies the server message on error', () => {
      tasService.startSession.and.returnValue(
        throwError(() => ({ error: { message: 'boom' } }))
      );

      service.startSession('totem-1');

      expect(service.isStartingSession()).toBeFalse();
      expect(notification.error).toHaveBeenCalledOnceWith('boom');
    });
  });

  describe('closeSession', () => {
    it('marks the session as COMPLETE in the list and the selection', () => {
      const session = createSession();
      context.sessions.set([session]);
      context.selectedSession.set(session);
      tasService.closeSession.and.returnValue(of({ ...session, totem_state: 'COMPLETE' }));

      service.closeSession('session-1');

      expect(context.sessions()[0].totem_state).toBe('COMPLETE');
      expect(context.selectedSession()?.totem_state).toBe('COMPLETE');
      expect(service.isClosingSession()).toBeFalse();
      expect(notification.success).toHaveBeenCalledOnceWith('tas.session_closed');
    });

    it('shows a specific message when the session was already closed', () => {
      tasService.closeSession.and.returnValue(
        throwError(() => ({ error: { errorCode: 'SESSION_NOT_ACTIVE' } }))
      );

      service.closeSession('session-1');

      expect(service.isClosingSession()).toBeFalse();
      expect(notification.error).toHaveBeenCalledOnceWith('tas.session_already_closed');
    });
  });

  describe('reopenSession', () => {
    it('replaces the session and updates the selection when it is selected', () => {
      const closed = createSession({ totem_state: 'COMPLETE' });
      context.sessions.set([closed]);
      context.selectedSession.set(closed);
      const reopened = createSession({ totem_state: 'STARTED' });
      tasService.reopenSession.and.returnValue(of(reopened));

      service.reopenSession('session-1');

      expect(context.sessions()).toEqual([reopened]);
      expect(context.selectedSession()).toEqual(reopened);
      expect(service.isReopeningSession()).toBeFalse();
      expect(notification.success).toHaveBeenCalledOnceWith('tas.session_reopened');
    });

    it('keeps the current selection when reopening another session', () => {
      const selected = createSession({ _id: 'session-2' });
      context.sessions.set([createSession(), selected]);
      context.selectedSession.set(selected);
      tasService.reopenSession.and.returnValue(of(createSession({ totem_state: 'STARTED' })));

      service.reopenSession('session-1');

      expect(context.selectedSession()?._id).toBe('session-2');
    });
  });

  describe('archiveSession', () => {
    it('does nothing when the confirmation is rejected', () => {
      confirmation.confirm.and.returnValue(of(false));

      service.archiveSession('session-1');

      expect(confirmation.confirm).toHaveBeenCalledOnceWith('tas.confirm_archive_session', { destructive: true });
      expect(tasService.archiveSession).not.toHaveBeenCalled();
    });

    it('removes the session from the active view after confirmation', () => {
      const session = createSession({ totem_state: 'COMPLETE' });
      context.sessions.set([session]);
      context.selectedSession.set(session);
      context.sessionItems.set([{ _id: 'item-1' } as ItemOrder]);
      context.customers.set([{ _id: 'customer-1', session_id: 'session-1', customer_name: 'Alex' }]);
      service.setTotems([
        { _id: 'totem-1', totem_name: 'Patio', totem_type: 'TEMPORARY' },
        { _id: 'totem-2', totem_name: 'Table 2', totem_type: 'STANDARD' },
      ]);
      tasService.archiveSession.and.returnValue(of({ ...session, totem_state: 'PAID' }));

      service.archiveSession('session-1');

      expect(context.sessions()).toEqual([]);
      expect(context.selectedSession()).toBeNull();
      expect(context.sessionItems()).toEqual([]);
      expect(context.customers()).toEqual([]);
      expect(socketService.leaveSession).toHaveBeenCalledOnceWith('session-1');
      expect(notification.success).toHaveBeenCalledOnceWith('tas.session_archived');
      // The temporary totem backing the archived session disappears from the sidebar
      expect(service.allTotems()).toEqual([
        { _id: 'totem-2', totem_name: 'Table 2', totem_type: 'STANDARD' },
      ]);
    });
  });

  describe('cancelSession', () => {
    it('does nothing when the confirmation is rejected', () => {
      confirmation.confirm.and.returnValue(of(false));

      service.cancelSession('session-1');

      expect(tasService.cancelSession).not.toHaveBeenCalled();
    });

    it('removes the session and notifies after confirmation', () => {
      const session = createSession();
      context.sessions.set([session]);
      tasService.cancelSession.and.returnValue(of({ ...session, totem_state: 'CANCELLED' }));

      service.cancelSession('session-1');

      expect(context.sessions()).toEqual([]);
      expect(service.isCancellingSession()).toBeFalse();
      expect(socketService.leaveSession).toHaveBeenCalledOnceWith('session-1');
      expect(notification.success).toHaveBeenCalledOnceWith('tas.session_cancelled');
    });
  });

  describe('createTemporaryTotem', () => {
    it('ignores blank names', () => {
      service.newTotemName.set('   ');

      service.createTemporaryTotem();

      expect(tasService.createTotem).not.toHaveBeenCalled();
    });

    it('creates the totem and auto-starts its session', () => {
      service.newTotemName.set('  Patio  ');
      tasService.createTotem.and.returnValue(
        of({ _id: 'totem-9', totem_name: 'Patio', totem_qr: 'qr-9' })
      );
      tasService.startSession.and.returnValue(of(createSession({ totem_id: 'totem-9' })));

      service.createTemporaryTotem();

      expect(tasService.createTotem).toHaveBeenCalledOnceWith({
        totem_name: 'Patio',
        totem_type: 'TEMPORARY',
      });
      expect(service.allTotems()).toEqual([
        { _id: 'totem-9', totem_name: 'Patio', totem_qr: 'qr-9', totem_type: 'TEMPORARY' } as PosTotemRef,
      ]);
      expect(service.newTotemName()).toBe('');
      expect(service.isCreatingTotem()).toBeFalse();
      expect(tasService.startSession).toHaveBeenCalledOnceWith('totem-9');
    });
  });

  describe('state markers', () => {
    it('markSessionComplete updates list and selected session state', () => {
      const session = createSession();
      context.sessions.set([session]);
      context.selectedSession.set(session);

      service.markSessionComplete('session-1');

      expect(context.sessions()[0].totem_state).toBe('COMPLETE');
      expect(context.selectedSession()?.totem_state).toBe('COMPLETE');
    });

    it('markSessionStarted updates list and selected session state', () => {
      const session = createSession({ totem_state: 'COMPLETE' });
      context.sessions.set([session]);
      context.selectedSession.set(session);

      service.markSessionStarted('session-1');

      expect(context.sessions()[0].totem_state).toBe('STARTED');
      expect(context.selectedSession()?.totem_state).toBe('STARTED');
    });
  });
});
