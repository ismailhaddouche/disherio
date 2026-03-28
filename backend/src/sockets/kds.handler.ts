import { Server } from 'socket.io';
import { ItemOrder } from '../models/order.model';
import { logger } from '../config/logger';
import { AuthenticatedSocket } from '../middlewares/socketAuth';

export function registerKdsHandlers(io: Server, socket: AuthenticatedSocket): void {
  // Verify user has kitchen permissions (KTS = Kitchen Table Service)
  const user = socket.user;
  if (!user || !user.permissions.includes('KTS')) {
    logger.warn({ socketId: socket.id }, 'Unauthorized KDS connection attempt');
    socket.emit('kds:error', { message: 'INSUFFICIENT_PERMISSIONS', required: 'KTS' });
    socket.disconnect();
    return;
  }

  socket.on('kds:join', (sessionId: string) => {
    // Validate sessionId format
    if (!sessionId || typeof sessionId !== 'string') {
      socket.emit('kds:error', { message: 'INVALID_SESSION_ID' });
      return;
    }
    
    socket.join(`session:${sessionId}`);
    logger.info({ socketId: socket.id, userId: user.staffId, sessionId }, 'KDS joined session room');
    socket.emit('kds:joined', { sessionId });
  });

  socket.on('kds:item_prepare', async ({ itemId }: { itemId: string }) => {
    try {
      // Validate itemId
      if (!itemId || typeof itemId !== 'string') {
        socket.emit('kds:error', { message: 'INVALID_ITEM_ID', itemId });
        return;
      }

      // Get item first to check type
      const itemToUpdate = await ItemOrder.findById(itemId);
      if (!itemToUpdate) {
        socket.emit('kds:error', { message: 'ITEM_NOT_FOUND', itemId });
        return;
      }

      // KDS only handles KITCHEN items
      if (itemToUpdate.item_disher_type === 'SERVICE') {
        socket.emit('kds:error', { 
          message: 'INVALID_ITEM_TYPE', 
          itemId,
          details: 'SERVICE items do not go through kitchen preparation'
        });
        return;
      }

      // Atomic update to prevent race conditions
      const item = await ItemOrder.findOneAndUpdate(
        { _id: itemId, item_state: 'ORDERED', item_disher_type: 'KITCHEN' },
        { item_state: 'ON_PREPARE' },
        { new: true }
      );

      if (!item) {
        logger.warn({ itemId, userId: user.staffId }, 'Item not found or not in ORDERED state');
        socket.emit('kds:error', { 
          message: 'ITEM_NOT_FOUND_OR_INVALID_STATE', 
          itemId,
          details: 'Item may not exist or is not in ORDERED state'
        });
        return;
      }

      io.to(`session:${item.session_id.toString()}`).emit('item:state_changed', {
        itemId: item._id,
        newState: 'ON_PREPARE',
      });

      socket.emit('kds:item_prepared', { itemId, newState: 'ON_PREPARE' });
      logger.info({ itemId, userId: user.staffId }, 'Item marked as ON_PREPARE');
    } catch (err: any) {
      logger.error({ err, itemId, userId: user.staffId }, 'kds:item_prepare error');
      socket.emit('kds:error', { 
        message: 'INTERNAL_ERROR', 
        itemId,
        details: err.message 
      });
    }
  });

  socket.on('kds:item_serve', async ({ itemId }: { itemId: string }) => {
    try {
      // Validate itemId
      if (!itemId || typeof itemId !== 'string') {
        socket.emit('kds:error', { message: 'INVALID_ITEM_ID', itemId });
        return;
      }

      // Get item to determine valid previous states
      const itemToUpdate = await ItemOrder.findById(itemId);
      if (!itemToUpdate) {
        socket.emit('kds:error', { message: 'ITEM_NOT_FOUND', itemId });
        return;
      }

      // KITCHEN items must be ON_PREPARE, SERVICE items can be ORDERED
      const validPreviousState = itemToUpdate.item_disher_type === 'SERVICE' 
        ? 'ORDERED' 
        : 'ON_PREPARE';

      // Atomic update to prevent race conditions
      const item = await ItemOrder.findOneAndUpdate(
        { _id: itemId, item_state: validPreviousState },
        { item_state: 'SERVED' },
        { new: true }
      );

      if (!item) {
        logger.warn({ itemId, userId: user.staffId }, `Item not found or not in ${validPreviousState} state`);
        socket.emit('kds:error', { 
          message: 'ITEM_NOT_FOUND_OR_INVALID_STATE', 
          itemId,
          details: `Item may not exist or is not in ${validPreviousState} state`
        });
        return;
      }

      io.to(`session:${item.session_id.toString()}`).emit('item:state_changed', {
        itemId: item._id,
        newState: 'SERVED',
      });

      socket.emit('kds:item_served', { itemId, newState: 'SERVED' });
      logger.info({ itemId, userId: user.staffId }, 'Item marked as SERVED');
    } catch (err: any) {
      logger.error({ err, itemId, userId: user.staffId }, 'kds:item_serve error');
      socket.emit('kds:error', { 
        message: 'INTERNAL_ERROR', 
        itemId,
        details: err.message 
      });
    }
  });
}
