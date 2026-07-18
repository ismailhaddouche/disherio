import { getIO } from '../config/socket';
import { logger } from '../config/logger';

export async function disconnectStaffSockets(staffId: string): Promise<void> {
  const room = `user:${staffId}`;
  getIO().in(room).disconnectSockets(true);
  logger.info({ staffId }, 'Disconnected staff socket sessions');
}
