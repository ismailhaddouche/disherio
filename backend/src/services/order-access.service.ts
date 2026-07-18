import { ErrorCode } from '@disherio/shared';
import { orderRepositories } from './order-repositories';

export type SessionState = 'STARTED' | 'COMPLETE' | 'PAID' | 'CANCELLED';

export async function getRestaurantIdForSession(
  sessionId: string,
  allowedStates?: ReadonlyArray<SessionState>
): Promise<string> {
  const session = await orderRepositories.sessions.findById(sessionId);
  if (!session) throw new Error(ErrorCode.SESSION_NOT_FOUND);
  if (allowedStates && !allowedStates.includes(session.totem_state)) {
    throw new Error(ErrorCode.SESSION_NOT_ACTIVE);
  }

  const totem = await orderRepositories.totems.findById(session.totem_id.toString());
  if (!totem) throw new Error(ErrorCode.TOTEM_NOT_FOUND);

  return totem.restaurant_id.toString();
}

export async function getCustomerInSession(customerId: string, sessionId: string) {
  const customer = await orderRepositories.customers.findById(customerId);
  if (!customer || customer.session_id.toString() !== sessionId) {
    throw new Error(ErrorCode.CUSTOMER_NOT_FOUND);
  }
  return customer;
}
