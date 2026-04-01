/**
 * Socket Handlers Index
 * 
 * Exports all socket handlers and helper functions for emitting events
 * from other parts of the application.
 */

// Export handler functions
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

// Export connection tracking utilities
export {
  trackSocketConnection,
  cleanupSocketConnection,
  updateSocketActivity,
  trackSocketJoinRoom,
  trackSocketLeaveRoom,
  registerGlobalDisconnectHandler,
  getActiveConnectionsCount,
  getConnectionStats,
  getUserConnections,
  getConnectionMetadata,
  disconnectUserSockets,
  getAllTrackedSocketIds,
  checkMemoryHealth,
  type ConnectionMetadata,
} from './middleware/connection-tracker';

// Export rate limiting utilities
export {
  checkRateLimit,
  recordRequest,
  cleanupSocketRateLimits,
  cleanupExpiredRateLimits,
  rateLimitMiddleware,
  getRateLimitStatus,
  socketRateLimits,
} from './middleware/rate-limiter';
