import { getIO } from '../config/socket';
import { logger } from '../config/logger';
import { extractSocketToken, AuthenticatedSocket } from '../middlewares/socketAuth';

export async function disconnectStaffSockets(staffId: string): Promise<void> {
  const room = `user:${staffId}`;
  getIO().in(room).disconnectSockets(true);
  logger.info({ staffId }, 'Disconnected staff socket sessions');
}

/**
 * Disconnect only the sockets authenticated with this exact access token —
 * i.e. the device that is logging out. Staff members may be connected from
 * several devices (POS terminal + tablet); revoking one session must not
 * kick the others, matching the refresh-family-scoped revocation in logout.
 */
export async function disconnectSocketsByAccessToken(accessToken: string): Promise<void> {
  let disconnected = 0;
  for (const socket of getIO().sockets.sockets.values()) {
    if (extractSocketToken(socket as AuthenticatedSocket) === accessToken) {
      socket.disconnect(true);
      disconnected += 1;
    }
  }
  if (disconnected > 0) {
    logger.info({ disconnected }, 'Disconnected sockets of the logged-out device');
  }
}
