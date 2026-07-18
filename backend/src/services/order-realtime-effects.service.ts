import { getIO } from '../config/socket';
import { ILocalizedEntry } from '../models/dish.model';
import { notifyKDSNewItem } from '../sockets/kds.handler';
import { emitSessionArchived, emitTicketPaid, notifyPOSNewOrder } from '../sockets/pos.handler';
import { notifyTASNewOrder } from '../sockets/tas.handler';
import { notifyCustomerItemUpdate } from '../sockets/totem.handler';

export function emitItemStateChanged(
  sessionId: string,
  itemId: string,
  newState: string,
  itemName?: ILocalizedEntry[]
): void {
  getIO().to(`session:${sessionId}`).emit('item:state_changed', { itemId, newState });
  notifyCustomerItemUpdate(sessionId, itemId, newState, itemName);
}

export function emitItemDeleted(sessionId: string, itemId: string): void {
  getIO().to(`session:${sessionId}`).emit('item:deleted', { itemId });
}

export function emitCustomerAssigned(
  sessionId: string,
  itemId: string,
  customerId: string | null
): void {
  getIO().to(`session:${sessionId}`).emit('item:customer_assigned', { itemId, customerId });
}

export function emitNewKitchenItem(sessionId: string, restaurantId: string, item: unknown): void {
  getIO()
    .to(`kitchen:session:${sessionId}`)
    .to(`kds:restaurant:${restaurantId}`)
    .emit('kds:new_item', item);
}

export const orderRealtimeEffects = {
  emitCustomerAssigned,
  emitItemDeleted,
  emitItemStateChanged,
  emitNewKitchenItem,
  emitSessionArchived,
  emitTicketPaid,
  notifyKDSNewItem,
  notifyPOSNewOrder,
  notifyTASNewOrder,
};
