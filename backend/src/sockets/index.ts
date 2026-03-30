/**
 * Socket Handlers Index
 * 
 * Exports all socket handlers and helper functions for emitting events
 * from other parts of the application.
 */

export { 
  registerKdsHandlers, 
  emitToKDS, 
  notifyKDSNewItem, 
  notifyKDSItemCanceled,
  kdsSessionSubscriptions 
} from './kds.handler';
export { 
  registerPosHandlers, 
  emitSessionClosed, 
  emitSessionPaid, 
  emitSessionFullyPaid, 
  emitTicketPaid 
} from './pos.handler';
export { 
  registerTotemHandlers, 
  emitToCustomers, 
  notifyCustomerItemUpdate, 
  notifyCustomerFromWaiter,
  getActiveCustomerCount,
  closeSessionForCustomers
} from './totem.handler';
export { 
  registerTasHandlers, 
  emitToTAS, 
  notifyTASNewOrder, 
  notifyTASHelpRequest, 
  notifyTASBillRequest,
  tasSessionSubscriptions 
} from './tas.handler';
