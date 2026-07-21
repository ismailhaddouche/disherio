import { ErrorCode } from '@disherio/shared';
import { ClientSession } from 'mongoose';
import { IItemOrder } from '../models/order.model';
import { ITotemSession } from '../models/totem.model';
import { AppError } from '../utils/async-handler';
import {
  buildByUserTickets,
  buildSharedTickets,
  calculateItemPrice,
  calculateTips,
} from '../utils/calculation.utils';
import { CircuitBreaker } from '../utils/circuit-breaker';
import { circuitBreakerMonitor } from '../utils/circuit-breaker-monitor';
import * as TaxUtils from '../utils/tax';
import { withTransaction } from '../utils/transactions';
import { getRestaurantIdForSession } from './order-access.service';
import { validateOrderPrice } from './order-price-policy';
import { orderRealtimeEffects } from './order-realtime-effects.service';
import { orderRepositories } from './order-repositories';
import * as SessionLifecycleEffects from './session-lifecycle-effects.service';

const {
  items: itemRepository,
  payments: paymentRepository,
  restaurants: restaurantRepository,
  totems: totemRepository,
  sessions: sessionRepository,
} = orderRepositories;

export async function calculateSessionTotal(
  sessionId: string,
  customTip?: number,
  activeItems?: IItemOrder[],
  dbSession?: ClientSession
): Promise<{ subtotal: number; tax: number; tips: number; total: number }> {
  if (customTip !== undefined) {
    const validation = validateOrderPrice(customTip, 'tips');
    if (!validation.valid) {
      throw new AppError(ErrorCode.INVALID_PRICE, 400, {
        invalidPrices: [{ field: validation.field, value: validation.value }],
      });
    }
  }

  const session = await sessionRepository.findById(sessionId, dbSession);
  if (!session) throw new Error(ErrorCode.SESSION_NOT_FOUND);
  const totem = await totemRepository.findById(session.totem_id.toString(), dbSession);
  if (!totem) throw new Error(ErrorCode.TOTEM_NOT_FOUND);
  const restaurant = await restaurantRepository.findById(totem.restaurant_id.toString(), dbSession);
  if (!restaurant) throw new Error(ErrorCode.RESTAURANT_NOT_FOUND);

  const items = activeItems ?? await itemRepository.findActiveBySessionId(sessionId, dbSession);
  const totalWithTax = items.reduce(
    (total, item) => total + calculateItemPrice(item).total,
    0
  );
  const tax = TaxUtils.extractTax(totalWithTax, restaurant.tax_rate);
  const subtotal = Number((totalWithTax - tax).toFixed(2));
  const tips = calculateTips(totalWithTax, customTip, restaurant);

  return {
    subtotal,
    tax,
    tips,
    total: Number((totalWithTax + tips).toFixed(2)),
  };
}

const createPaymentBreaker = new CircuitBreaker(
  async (args: {
    sessionId: string;
    paymentType: 'ALL' | 'BY_USER' | 'SHARED';
    parts: number;
    customTip?: number;
  }) => {
    const { sessionId, paymentType, parts, customTip } = args;
    const result = await withTransaction(async (session) => {
      const lockedSession = await sessionRepository.lockIfStateIn(
        sessionId,
        ['STARTED', 'COMPLETE'],
        session
      );
      if (!lockedSession) throw new Error(ErrorCode.SESSION_NOT_ACTIVE);
      const closedFromStarted = lockedSession.totem_state === 'STARTED';
      const completedSession = closedFromStarted
        ? await sessionRepository.updateStateIf(sessionId, ['STARTED'], 'COMPLETE', session)
        : lockedSession;
      if (!completedSession) throw new Error(ErrorCode.SESSION_NOT_ACTIVE);
      if ((await paymentRepository.findBySessionId(sessionId, session)).length > 0) {
        throw new Error(ErrorCode.ORDER_ALREADY_PAID);
      }

      const activeItems = await itemRepository.findActiveBySessionId(sessionId, session);
      const { total } = await calculateSessionTotal(sessionId, customTip, activeItems, session);
      if (total <= 0) throw new Error(ErrorCode.NO_ITEMS_TO_PAY);
      const tickets = paymentType === 'BY_USER'
        ? buildByUserTickets(activeItems, total)
        // ALL always settles in a single ticket; only SHARED honors `parts`.
        : buildSharedTickets(total, paymentType === 'SHARED' ? parts : 1);
      const totem = await totemRepository.findById(completedSession.totem_id.toString());
      if (!totem) throw new Error(ErrorCode.TOTEM_NOT_FOUND);

      const payment = await paymentRepository.createPayment({
        session_id: sessionId,
        restaurant_id: totem.restaurant_id.toString(),
        totem_snapshot: {
          totem_id: totem._id.toString(),
          totem_name: totem.totem_name,
          totem_type: totem.totem_type,
        },
        payment_type: paymentType,
        payment_total: total,
        tickets,
      }, session);
      return { payment, closedFromStarted, restaurantId: totem.restaurant_id.toString() };
    });

    if (result.closedFromStarted) {
      await SessionLifecycleEffects.notifySessionClosed(sessionId, {
        restaurantId: result.restaurantId,
        state: 'COMPLETE',
        closedBy: 'pos',
      });
    }
    return result.payment;
  },
  { failureThreshold: 3, resetTimeout: 15000, halfOpenMaxCalls: 2 },
  'OrderService.createPayment'
);

const markTicketPaidBreaker = new CircuitBreaker(
  async (args: { paymentId: string; ticketPart: number }) => {
    const { paymentId, ticketPart } = args;
    if (!await paymentRepository.findById(paymentId)) throw new Error(ErrorCode.PAYMENT_NOT_FOUND);

    const result = await withTransaction(async (session) => {
      const updated = await paymentRepository.markTicketPaid(paymentId, ticketPart, session);
      if (!updated) throw new Error(ErrorCode.TICKET_NOT_FOUND);
      const allPaid = updated.tickets.every((ticket) => ticket.paid);
      const sessionId = updated.session_id.toString();
      const ticket = updated.tickets.find((candidate) => candidate.ticket_part === ticketPart);
      let archivedSession: ITotemSession | undefined;

      if (allPaid) {
        const paidSession = await sessionRepository.updateStateIf(
          sessionId,
          ['COMPLETE'],
          'PAID',
          session
        );
        if (!paidSession) throw new Error(ErrorCode.INVALID_STATE_TRANSITION);
        archivedSession = paidSession;
      }

      return {
        updated,
        allPaid,
        sessionId,
        ticket,
        archivedSession,
        remainingAmount: updated.tickets
          .filter((candidate) => !candidate.paid)
          .reduce((sum, candidate) => sum + candidate.ticket_amount, 0),
      };
    });

    if (result.ticket && !result.allPaid) {
      orderRealtimeEffects.emitTicketPaid(result.sessionId, {
        ticketPart,
        ticketAmount: result.ticket.ticket_amount,
        remainingAmount: result.remainingAmount,
      });
    }
    if (result.allPaid) {
      const restaurantId = await getRestaurantIdForSession(result.sessionId, ['PAID']);
      orderRealtimeEffects.emitSessionArchived(result.sessionId, {
        paymentTotal: result.updated.payment_total,
        paymentType: result.updated.payment_type,
      }, restaurantId);
      if (result.archivedSession) {
        await SessionLifecycleEffects.cleanupTemporaryTotem(result.archivedSession);
      }
    }
    return result.updated;
  },
  { failureThreshold: 3, resetTimeout: 15000, halfOpenMaxCalls: 2 },
  'OrderService.markTicketPaid'
);

circuitBreakerMonitor.register(createPaymentBreaker);
circuitBreakerMonitor.register(markTicketPaidBreaker);

export async function createPayment(
  sessionId: string,
  paymentType: 'ALL' | 'BY_USER' | 'SHARED',
  parts: number = 1,
  customTip?: number
) {
  return createPaymentBreaker.execute({ sessionId, paymentType, parts, customTip });
}

export async function markTicketPaid(paymentId: string, ticketPart: number) {
  return markTicketPaidBreaker.execute({ paymentId, ticketPart });
}

export async function archiveSession(sessionId: string) {
  const result = await withTransaction(async (session) => {
    const completedSession = await sessionRepository.updateStateIf(
      sessionId,
      ['COMPLETE'],
      'COMPLETE',
      session
    );
    if (!completedSession) throw new Error(ErrorCode.INVALID_STATE_TRANSITION);

    if ((await paymentRepository.findBySessionId(sessionId, session)).length === 0) {
      const { total } = await calculateSessionTotal(sessionId, undefined, undefined, session);
      if (total <= 0) throw new Error(ErrorCode.NO_ITEMS_TO_PAY);
      const totem = await totemRepository.findById(completedSession.totem_id.toString());
      if (!totem) throw new Error(ErrorCode.TOTEM_NOT_FOUND);
      await paymentRepository.createPayment({
        session_id: sessionId,
        restaurant_id: totem.restaurant_id.toString(),
        totem_snapshot: {
          totem_id: totem._id.toString(),
          totem_name: totem.totem_name,
          totem_type: totem.totem_type,
        },
        payment_type: 'ALL',
        payment_total: total,
        tickets: buildSharedTickets(total, 1),
      }, session);
    }

    const payment = await paymentRepository.markAllTicketsPaidForSession(sessionId, session);
    if (!payment) throw new Error(ErrorCode.PAYMENT_NOT_FOUND);
    const paidSession = await sessionRepository.updateStateIf(
      sessionId,
      ['COMPLETE'],
      'PAID',
      session
    );
    if (!paidSession) throw new Error(ErrorCode.INVALID_STATE_TRANSITION);
    return { session: paidSession, payment };
  });

  const restaurantId = await getRestaurantIdForSession(sessionId, ['PAID']);
  orderRealtimeEffects.emitSessionArchived(sessionId, {
    paymentTotal: result.payment.payment_total,
    paymentType: result.payment.payment_type,
  }, restaurantId);
  await SessionLifecycleEffects.cleanupTemporaryTotem(result.session);
  return result.session;
}

export async function getPaymentHistory(
  restaurantId: string,
  filters: { from?: Date; to?: Date; search?: string; limit?: number }
) {
  return paymentRepository.getPaymentHistory(restaurantId, filters);
}
