import { Types } from 'mongoose';
import { ItemOrder, Payment } from '../models/order.model';
import { TotemSession } from '../models/totem.model';
import { createError } from '../utils/async-handler';

export async function assertSessionInRestaurant(sessionId: string, restaurantId: string): Promise<void> {
  const session = await TotemSession.findById(new Types.ObjectId(sessionId)).select('restaurant_id').lean();
  if (!session) {
    throw createError.notFound('SESSION_NOT_FOUND');
  }
  if (session.restaurant_id.toString() !== restaurantId) {
    throw createError.forbidden('FORBIDDEN');
  }
}

export async function assertItemInRestaurant(itemId: string, restaurantId: string): Promise<void> {
  const item = await ItemOrder.findById(new Types.ObjectId(itemId)).select('session_id').lean();
  if (!item) {
    throw createError.notFound('ITEM_NOT_FOUND');
  }
  await assertSessionInRestaurant(item.session_id.toString(), restaurantId);
}

export async function assertPaymentInRestaurant(paymentId: string, restaurantId: string): Promise<string> {
  const payment = await Payment.findById(new Types.ObjectId(paymentId)).select('session_id').lean();
  if (!payment) {
    throw createError.notFound('PAYMENT_NOT_FOUND');
  }
  const sessionId = payment.session_id.toString();
  await assertSessionInRestaurant(sessionId, restaurantId);
  return sessionId;
}
