import type { TotemSession } from '../../types';

export interface OperationalTotem {
  _id: string;
  totem_name: string;
  totem_type: string;
}

export function setOperationalSessionState(
  sessions: TotemSession[],
  sessionId: string,
  state: TotemSession['totem_state'],
  updated?: TotemSession
): TotemSession[] {
  return sessions.map((session) => session._id === sessionId
    ? { ...session, ...updated, totem_state: state }
    : session);
}

export function replaceOperationalSession(
  sessions: TotemSession[],
  replacement: TotemSession
): TotemSession[] {
  return [...sessions.filter((session) => session._id !== replacement._id), replacement];
}

export function removeOperationalSession(
  sessions: TotemSession[],
  sessionId: string
): TotemSession[] {
  return sessions.filter((session) => session._id !== sessionId);
}

export function removeTemporaryTotem(
  totems: OperationalTotem[],
  totemId: string | undefined
): OperationalTotem[] {
  if (!totemId) return totems;
  const target = totems.find((totem) => totem._id === totemId);
  return target?.totem_type === 'TEMPORARY'
    ? totems.filter((totem) => totem._id !== totemId)
    : totems;
}
