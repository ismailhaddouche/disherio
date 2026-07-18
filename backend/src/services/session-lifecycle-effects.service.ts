import { ITotemSession } from '../models/totem.model';
import { logger } from '../config/logger';
import { emitSessionClosed, emitSessionReopened } from '../sockets/pos.handler';
import { closeSessionForCustomers } from '../sockets/totem.handler';
import * as TotemService from './totem.service';

export async function notifySessionClosed(
  sessionId: string,
  options: {
    restaurantId: string;
    state: 'COMPLETE' | 'CANCELLED';
    closedBy?: 'waiter' | 'pos';
    closedByName?: string;
    reason?: string;
  }
): Promise<void> {
  emitSessionClosed(sessionId, options.state, options.closedBy ?? 'waiter', options.restaurantId);
  await closeSessionForCustomers(sessionId, {
    closedBy: options.closedBy ?? 'waiter',
    closedByName: options.closedByName,
    reason: options.reason,
    stateAlreadyTransitioned: true,
  });
}

export function notifySessionReopened(sessionId: string, restaurantId: string, reopenedBy?: string): void {
  emitSessionReopened(sessionId, reopenedBy, restaurantId);
}

export async function cleanupTemporaryTotem(session: ITotemSession): Promise<void> {
  try {
    await TotemService.deleteTemporaryTotemForSession(session);
  } catch (err) {
    logger.error(
      { err, sessionId: session._id.toString() },
      'Failed to delete temporary totem after terminal session transition'
    );
  }
}
