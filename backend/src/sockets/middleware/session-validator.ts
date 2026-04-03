import { AuthenticatedSocket } from '../../middlewares/socketAuth';
import { TotemSessionRepository, TotemRepository } from '../../repositories';
import { logger } from '../../config/logger';

const totemSessionRepo = new TotemSessionRepository();
const totemRepo = new TotemRepository();

export async function validateSessionAccess(
  socket: AuthenticatedSocket,
  sessionId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const user = socket.user;
  
  if (!user) {
    return { allowed: false, reason: 'AUTHENTICATION_REQUIRED' };
  }
  
  // Super admin puede acceder a todo
  if (user.role === 'SUPER_ADMIN') {
    return { allowed: true };
  }
  
  try {
    const session = await totemSessionRepo.findById(sessionId);
    
    if (!session) {
      return { allowed: false, reason: 'SESSION_NOT_FOUND' };
    }
    
    // Get totem to find restaurant_id
    const totemId = session.totem_id?.toString();
    if (!totemId) {
      return { allowed: false, reason: 'INVALID_SESSION_DATA' };
    }
    
    const totem = await totemRepo.findById(totemId);
    if (!totem) {
      return { allowed: false, reason: 'TOTEM_NOT_FOUND' };
    }
    
    const sessionRestaurantId = totem.restaurant_id?.toString();
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
