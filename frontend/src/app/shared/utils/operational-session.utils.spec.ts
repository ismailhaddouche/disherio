import {
  removeOperationalSession,
  removeTemporaryTotem,
  replaceOperationalSession,
  setOperationalSessionState,
} from './operational-session.utils';
import type { TotemSession } from '../../types';

const session: TotemSession = {
  _id: 'session-1',
  totem_id: 'totem-1',
  session_date_start: '2026-01-01T00:00:00.000Z',
  totem_state: 'STARTED',
};

describe('operational session utilities', () => {
  it('updates only the selected session state', () => {
    expect(setOperationalSessionState([session], 'session-1', 'COMPLETE')[0].totem_state)
      .toBe('COMPLETE');
  });

  it('replaces and removes sessions by identity', () => {
    const replacement = { ...session, totem_state: 'COMPLETE' as const };
    expect(replaceOperationalSession([session], replacement)).toEqual([replacement]);
    expect(removeOperationalSession([session], 'session-1')).toEqual([]);
  });

  it('removes only temporary totems', () => {
    const totems = [
      { _id: 'standard', totem_name: 'Table', totem_type: 'STANDARD' },
      { _id: 'temporary', totem_name: 'Terrace', totem_type: 'TEMPORARY' },
    ];
    expect(removeTemporaryTotem(totems, 'standard')).toEqual(totems);
    expect(removeTemporaryTotem(totems, 'temporary')).toEqual([totems[0]]);
  });
});
