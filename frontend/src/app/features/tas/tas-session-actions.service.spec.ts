import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { TasService } from '../../core/services/tas.service';
import { SocketService } from '../../core/services/socket/socket.service';
import { tasStore } from '../../store/tas.store';
import type { TotemSession } from '../../types';
import { TasSessionActionsService } from './tas-session-actions.service';

function createSession(overrides: Partial<TotemSession> = {}): TotemSession {
  return {
    _id: 'session-1',
    totem_id: 'totem-1',
    session_date_start: '2026-07-18T10:00:00.000Z',
    totem_state: 'STARTED',
    ...overrides,
  };
}

describe('TasSessionActionsService', () => {
  let service: TasSessionActionsService;
  let tasService: jasmine.SpyObj<TasService>;
  let socketService: { leaveTasSession: jasmine.Spy };
  let notification: { success: jasmine.Spy; error: jasmine.Spy };
  let confirmation: { confirm: jasmine.Spy };
  let selectSession: jasmine.Spy;

  beforeEach(() => {
    tasService = jasmine.createSpyObj<TasService>('TasService', [
      'getTotemSessions',
      'createTotem',
      'deleteTotem',
      'startSession',
      'closeSession',
      'reopenSession',
      'archiveSession',
      'cancelSession',
    ]);
    socketService = { leaveTasSession: jasmine.createSpy('leaveTasSession') };
    notification = {
      success: jasmine.createSpy('success'),
      error: jasmine.createSpy('error'),
    };
    confirmation = { confirm: jasmine.createSpy('confirm').and.returnValue(of(true)) };
    selectSession = jasmine.createSpy('selectSession');

    TestBed.configureTestingModule({
      providers: [
        TasSessionActionsService,
        { provide: TasService, useValue: tasService },
        { provide: SocketService, useValue: socketService },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: NotificationService, useValue: notification },
        { provide: ConfirmationService, useValue: confirmation },
      ],
    });
    tasStore.acquireReference();
    tasStore.setSessions([]);
    tasStore.selectSession(null);
    tasStore.setAllTotems([]);

    service = TestBed.inject(TasSessionActionsService);
    service.init({ selectSession });
  });

  afterEach(() => {
    service.ngOnDestroy();
    tasStore.releaseReference();
  });

  describe('loadTotemSessions', () => {
    it('keeps only operational sessions and tracks the selected totem', () => {
      tasService.getTotemSessions.and.returnValue(of([
        createSession({ _id: 'session-1', totem_state: 'STARTED' }),
        createSession({ _id: 'session-2', totem_state: 'COMPLETE' }),
        createSession({ _id: 'session-3', totem_state: 'PAID' }),
        createSession({ _id: 'session-4', totem_state: 'CANCELLED' }),
      ]));

      service.loadTotemSessions('totem-1');

      expect(service.selectedTotemId()).toBe('totem-1');
      expect(service.totemSessions().map(session => session._id)).toEqual(['session-1', 'session-2']);
    });
  });

  describe('refreshTotemSessions', () => {
    it('merges refreshed data and drops sessions that no longer exist', () => {
      service.totemSessions.set([
        createSession({ _id: 'session-1', totem_state: 'STARTED' }),
        createSession({ _id: 'session-2', totem_state: 'STARTED' }),
      ]);

      service.refreshTotemSessions([
        createSession({ _id: 'session-1', totem_state: 'COMPLETE' }),
      ]);

      expect(service.totemSessions().map(session => session._id)).toEqual(['session-1']);
      expect(service.totemSessions()[0].totem_state).toBe('COMPLETE');
    });
  });

  describe('startSession', () => {
    it('attaches totem info, stores the session and selects it', () => {
      service.setTotems([{ _id: 'totem-1', totem_name: 'Table 1', totem_type: 'STANDARD' }]);
      const session = createSession();
      tasService.startSession.and.returnValue(of(session));

      service.startSession('totem-1');

      expect(session.totem?.totem_name).toBe('Table 1');
      expect(tasStore.sessions()).toEqual([session]);
      expect(selectSession).toHaveBeenCalledOnceWith(session);
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

    it('shows a specific message when the session was already closed', () => {
      tasService.startSession.and.returnValue(
        throwError(() => ({ error: { errorCode: 'SESSION_NOT_ACTIVE' } }))
      );

      service.startSession('totem-1');

      expect(service.isStartingSession()).toBeFalse();
      expect(notification.error).toHaveBeenCalledOnceWith('tas.session_already_closed');
    });
  });

  describe('closeSession', () => {
    it('marks the session as COMPLETE in the store, the totem list and the selection', () => {
      const session = createSession();
      tasStore.setSessions([session]);
      tasStore.selectSession(session);
      service.totemSessions.set([session]);
      tasService.closeSession.and.returnValue(of({ ...session, totem_state: 'COMPLETE' }));

      service.closeSession('session-1');

      expect(tasStore.sessions()[0].totem_state).toBe('COMPLETE');
      expect(service.totemSessions()[0].totem_state).toBe('COMPLETE');
      expect(tasStore.selectedSession()?.totem_state).toBe('COMPLETE');
      expect(service.isClosingSession()).toBeFalse();
      expect(notification.success).toHaveBeenCalledOnceWith('tas.session_closed');
    });
  });

  describe('reopenSession', () => {
    it('replaces the session in the store and selects it', () => {
      tasStore.setSessions([createSession({ totem_state: 'COMPLETE' })]);
      service.setTotems([{ _id: 'totem-1', totem_name: 'Table 1', totem_type: 'STANDARD' }]);
      const reopened = createSession({ totem_state: 'STARTED' });
      tasService.reopenSession.and.returnValue(of(reopened));

      service.reopenSession('session-1', 'totem-1');

      expect(tasStore.sessions()).toEqual([reopened]);
      expect(selectSession).toHaveBeenCalledOnceWith(reopened);
      expect(service.isReopeningSession()).toBeFalse();
      expect(notification.success).toHaveBeenCalledOnceWith('tas.session_reopened');
    });
  });

  describe('archiveSession', () => {
    it('does nothing when the confirmation is rejected', () => {
      confirmation.confirm.and.returnValue(of(false));

      service.archiveSession('session-1');

      expect(tasService.archiveSession).not.toHaveBeenCalled();
    });

    it('removes the session from the active view after confirmation', () => {
      const session = createSession({ totem_state: 'COMPLETE' });
      tasStore.setSessions([session]);
      tasStore.selectSession(session);
      service.totemSessions.set([session]);
      service.setTotems([
        { _id: 'totem-1', totem_name: 'Patio', totem_type: 'TEMPORARY' },
        { _id: 'totem-2', totem_name: 'Table 2', totem_type: 'STANDARD' },
      ]);
      tasService.archiveSession.and.returnValue(of({ ...session, totem_state: 'PAID' }));

      service.archiveSession('session-1');

      expect(tasStore.sessions()).toEqual([]);
      expect(service.totemSessions()).toEqual([]);
      expect(socketService.leaveTasSession).toHaveBeenCalledOnceWith('session-1');
      expect(service.isArchivingSession()).toBeFalse();
      expect(notification.success).toHaveBeenCalledOnceWith('tas.session_archived');
      // The temporary totem backing the archived session disappears from the sidebar
      expect(service.allTotems()).toEqual([
        { _id: 'totem-2', totem_name: 'Table 2', totem_type: 'STANDARD' },
      ]);
    });
  });

  describe('cancelSession', () => {
    it('removes the session and notifies after confirmation', () => {
      const session = createSession();
      tasStore.setSessions([session]);
      tasService.cancelSession.and.returnValue(of({ ...session, totem_state: 'CANCELLED' }));

      service.cancelSession('session-1');

      expect(tasStore.sessions()).toEqual([]);
      expect(service.isCancellingSession()).toBeFalse();
      expect(socketService.leaveTasSession).toHaveBeenCalledOnceWith('session-1');
      expect(notification.success).toHaveBeenCalledOnceWith('tas.session_cancelled');
    });
  });

  describe('createTemporaryTotem', () => {
    it('ignores blank names', () => {
      service.newTotemName.set('  ');

      service.createTemporaryTotem();

      expect(tasService.createTotem).not.toHaveBeenCalled();
    });

    it('creates the totem and auto-starts its session', () => {
      service.newTotemName.set('Terrace');
      tasService.createTotem.and.returnValue(
        of({ _id: 'totem-9', totem_name: 'Terrace', totem_qr: 'qr-9' })
      );
      tasService.startSession.and.returnValue(of(createSession({ totem_id: 'totem-9' })));

      service.createTemporaryTotem();

      expect(tasService.createTotem).toHaveBeenCalledOnceWith({
        totem_name: 'Terrace',
        totem_type: 'TEMPORARY',
      });
      expect(service.newTotemName()).toBe('');
      expect(service.isCreatingTotem()).toBeFalse();
      expect(tasService.startSession).toHaveBeenCalledOnceWith('totem-9');
    });
  });

  describe('closeTemporaryTotem', () => {
    it('does nothing when the confirmation is rejected', () => {
      confirmation.confirm.and.returnValue(of(false));

      service.closeTemporaryTotem('totem-1');

      expect(tasService.deleteTotem).not.toHaveBeenCalled();
    });

    it('removes the totem, its sessions and the selection after confirmation', () => {
      const session = createSession({ totem_id: 'totem-1' });
      tasStore.setSessions([session, createSession({ _id: 'session-2', totem_id: 'totem-2' })]);
      tasStore.selectSession(session);
      service.setTotems([
        { _id: 'totem-1', totem_name: 'Patio', totem_type: 'TEMPORARY' },
        { _id: 'totem-2', totem_name: 'Table 2', totem_type: 'STANDARD' },
      ]);
      tasService.deleteTotem.and.returnValue(of(void 0));

      service.closeTemporaryTotem('totem-1');

      expect(tasService.deleteTotem).toHaveBeenCalledOnceWith('totem-1');
      expect(tasStore.sessions().map(s => s._id)).toEqual(['session-2']);
      expect(service.allTotems()).toEqual([
        { _id: 'totem-2', totem_name: 'Table 2', totem_type: 'STANDARD' },
      ]);
      expect(tasStore.selectedSession()).toBeNull();
      expect(notification.success).toHaveBeenCalledOnceWith('tas.totem_closed');
    });
  });
});
