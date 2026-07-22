import * as crypto from 'crypto';
import { TotemSession } from '../models/totem.model';
import { logger } from '../config/logger';

/**
 * Back-fills session_token on legacy active sessions. Sessions predate the
 * ephemeral per-table credential; every active session must carry one before
 * traffic is accepted. Done per-document (not an aggregation pipeline) so
 * each session gets its own random UUID.
 */
export const migration0002 = {
  name: '0002-session-token-backfill',
  async up(): Promise<void> {
    const legacySessions = TotemSession.find({
      totem_state: 'STARTED',
      $or: [{ session_token: { $exists: false } }, { session_token: null }],
    }).cursor();
    let backfilled = 0;
    for await (const session of legacySessions) {
      await TotemSession.updateOne(
        { _id: session._id },
        { $set: { session_token: crypto.randomUUID() } }
      );
      backfilled++;
    }
    if (backfilled > 0) {
      logger.info({ backfilled }, 'Back-filled session_token on legacy sessions');
    }
  },
};
