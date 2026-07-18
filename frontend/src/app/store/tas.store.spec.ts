import type { TotemSession } from '../types';
import { tasStore } from './tas.store';

describe('tasStore session lifecycle', () => {
  const session: TotemSession = {
    _id: 'session-1',
    totem_id: 'totem-1',
    session_date_start: '2026-07-16T10:00:00.000Z',
    totem_state: 'STARTED',
  };

  beforeEach(() => {
    tasStore.setSessions([session]);
    tasStore.selectSession(session);
  });

  afterEach(() => {
    tasStore.setSessions([]);
    tasStore.selectSession(null);
  });

  it('keeps a completed session selected so it can be paid', () => {
    tasStore.updateSessionState('session-1', 'COMPLETE');

    expect(tasStore.sessions()[0].totem_state).toBe('COMPLETE');
    expect(tasStore.selectedSession()?.totem_state).toBe('COMPLETE');
  });

  it('clears a selected session after it is archived', () => {
    tasStore.updateSessionState('session-1', 'PAID');

    expect(tasStore.sessions()[0].totem_state).toBe('PAID');
    expect(tasStore.selectedSession()).toBeNull();
  });

  it('clears a selected session after it is cancelled', () => {
    tasStore.updateSessionState('session-1', 'CANCELLED');

    expect(tasStore.sessions()[0].totem_state).toBe('CANCELLED');
    expect(tasStore.selectedSession()).toBeNull();
  });
});
