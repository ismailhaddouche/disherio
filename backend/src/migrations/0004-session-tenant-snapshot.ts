import { Payment } from '../models/order.model';
import { Totem, TotemSession } from '../models/totem.model';
import { logger } from '../config/logger';

/** Preserve tenant and table ownership after temporary totems are deleted. */
export const migration0004 = {
  name: '0004-session-tenant-snapshot',
  async up(): Promise<void> {
    const sessions = TotemSession.find({
      $or: [
        { restaurant_id: { $exists: false } },
        { totem_snapshot: { $exists: false } },
      ],
    }).cursor();
    let backfilled = 0;

    for await (const session of sessions) {
      const totem = await Totem.findById(session.totem_id).lean().exec();
      const payment = totem
        ? null
        : await Payment.findOne({ session_id: session._id }).lean().exec();
      const restaurantId = totem?.restaurant_id ?? payment?.restaurant_id;
      const snapshot = totem
        ? {
            totem_id: totem._id,
            totem_name: totem.totem_name,
            totem_type: totem.totem_type,
          }
        : payment?.totem_snapshot;

      if (!restaurantId || !snapshot?.totem_id || !snapshot.totem_name || !snapshot.totem_type) {
        logger.warn({ sessionId: session._id }, 'Unable to recover tenant snapshot for legacy session');
        continue;
      }

      await TotemSession.updateOne(
        { _id: session._id },
        { $set: { restaurant_id: restaurantId, totem_snapshot: snapshot } }
      );
      backfilled++;
    }

    if (backfilled > 0) {
      logger.info({ backfilled }, 'Back-filled session tenant snapshots');
    }
  },
};
