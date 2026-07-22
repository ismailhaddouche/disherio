import { AuthenticatedSocket } from '../../middlewares/socketAuth';
import { TotemSessionRepository } from '../../repositories';
import { logger } from '../../config/logger';

const totemSessionRepo = new TotemSessionRepository();

export async function validateSessionAccess(
  socket: AuthenticatedSocket,
  sessionId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const user = socket.user;

  if (!user) {
    return { allowed: false, reason: 'AUTHENTICATION_REQUIRED' };
  }

  try {
    const session = await totemSessionRepo.findById(sessionId);

    if (!session) {
      return { allowed: false, reason: 'SESSION_NOT_FOUND' };
    }

    const sessionRestaurantId = session.restaurant_id?.toString();
    if (!sessionRestaurantId) {
      return { allowed: false, reason: 'INVALID_SESSION_DATA' };
    }
    const userRestaurantId = user.restaurantId;

    if (sessionRestaurantId !== userRestaurantId) {
      logger.warn({
        socketId: socket.id,
        userId: user.staffId,
        userRestaurantId,
        attemptedSessionId: sessionId,
        sessionRestaurantId,
      }, 'Cross-restaurant session access attempt detected');

      return { allowed: false, reason: 'UNAUTHORIZED_SESSION' };
    }

    return { allowed: true };
  } catch (err) {
    logger.error({ err, sessionId, userId: user.staffId }, 'Error validating session access');
    return { allowed: false, reason: 'VALIDATION_ERROR' };
  }
}
