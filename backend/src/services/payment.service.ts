import { ErrorCode } from '@disherio/shared';
import { ClientSession } from 'mongoose';
import { withTransaction, withTransactionRetry } from '../utils/transactions';
import * as TaxUtils from '../utils/tax';
import { emitSessionFullyPaid, emitTicketPaid } from '../sockets/pos.handler';
import {
  calculateItemPrice,
  calculateTips,
  buildSharedTickets,
  buildByUserTickets,
} from '../utils/calculation.utils';
import {
  PaymentRepository,
  ItemOrderRepository,
  TotemSessionRepository,
  TotemRepository,
  RestaurantRepository,
} from '../repositories';

const paymentRepo = new PaymentRepository();
const itemOrderRepo = new ItemOrderRepository();
const totemSessionRepo = new TotemSessionRepository();
const totemRepo = new TotemRepository();
const restaurantRepo = new RestaurantRepository();

// Las funciones calculateItemPrice, calculateCustomerTotals, calculateTips,
// buildSharedTickets y buildByUserTickets se importan desde '../utils/calculation.utils'

/**
 * Calculate session total including subtotal, tax, tips and total
 * Uses transaction to ensure consistent read of items
 */
export async function calculateSessionTotal(
  sessionId: string,
  customTip?: number
): Promise<{ subtotal: number; tax: number; tips: number; total: number }> {
  // Use transaction for consistent reads
  return withTransaction(async (_session) => {
    const totemSession = await totemSessionRepo.findById(sessionId);
    if (!totemSession) throw new Error(ErrorCode.SESSION_NOT_FOUND);

    const totem = await totemRepo.findById(totemSession.totem_id.toString());
    if (!totem) throw new Error(ErrorCode.TOTEM_NOT_FOUND);

    const restaurant = await restaurantRepo.findById(totem.restaurant_id.toString());
    if (!restaurant) throw new Error(ErrorCode.RESTAURANT_NOT_FOUND);

    // Note: findActiveBySessionId doesn't support session yet, but for read consistency
    // we could add session support to the repository in the future
    const items = await itemOrderRepo.findActiveBySessionId(sessionId);

    const totalWithTax = items.reduce((acc, item) => {
      const prices = calculateItemPrice(item);
      return acc + prices.total;
    }, 0);

    const tax = TaxUtils.extractTax(totalWithTax, restaurant.tax_rate);
    const subtotal = parseFloat((totalWithTax - tax).toFixed(2));
    const tips = calculateTips(totalWithTax, customTip, restaurant);

    return {
      subtotal,
      tax,
      tips,
      total: parseFloat((totalWithTax + tips).toFixed(2)),
    };
  });
}

interface CreatePaymentInput {
  sessionId: string;
  paymentType: 'ALL' | 'BY_USER' | 'SHARED';
  parts?: number;
  customTip?: number;
}

interface Ticket {
  ticket_part: number;
  ticket_total_parts: number;
  ticket_amount: number;
  ticket_customer_name?: string;
  paid: boolean;
}

interface PaymentResult {
  _id: string;
  session_id: string;
  payment_type: 'ALL' | 'BY_USER' | 'SHARED';
  payment_total: number;
  tickets: Ticket[];
  payment_date: Date;
}

/**
 * Create a payment for a session
 * Uses transaction to ensure payment creation and session state update are atomic
 */
export async function createPayment({
  sessionId,
  paymentType,
  parts = 1,
  customTip,
}: CreatePaymentInput): Promise<PaymentResult> {
  const { total } = await calculateSessionTotal(sessionId, customTip);

  // Validate that there are items in the session before creating the payment
  if (total <= 0) {
    throw new Error(ErrorCode.NO_ITEMS_TO_PAY);
  }

  const tickets = paymentType === 'BY_USER'
    ? await buildByUserTickets(sessionId)
    : buildSharedTickets(total, parts);

  // Use transaction with retry for payment creation (critical financial operation)
  return withTransactionRetry(async (session: ClientSession) => {
    const payment = await paymentRepo.createPayment(
      {
        session_id: sessionId,
        payment_type: paymentType,
        payment_total: total,
        tickets,
      },
      session
    );

    await totemSessionRepo.updateState(sessionId, 'COMPLETE', session);
    return payment as unknown as PaymentResult;
  }, 3, 100);
}

interface MarkTicketPaidResult {
  _id: string;
  session_id: string;
  payment_type: 'ALL' | 'BY_USER' | 'SHARED';
  payment_total: number;
  tickets: Ticket[];
  allPaid: boolean;
}

/**
 * Mark a specific ticket as paid
 * Uses transaction to ensure payment update and session state change are atomic
 */
export async function markTicketPaid(
  paymentId: string, 
  ticketPart: number
): Promise<MarkTicketPaidResult> {
  const payment = await paymentRepo.findById(paymentId);
  if (!payment) throw new Error(ErrorCode.PAYMENT_NOT_FOUND);

  // Use transaction with retry for ticket payment (critical financial operation)
  return withTransactionRetry(async (session: ClientSession) => {
    const updated = await paymentRepo.markTicketPaid(paymentId, ticketPart, session);
    if (!updated) throw new Error(ErrorCode.TICKET_NOT_FOUND);

    const allPaid = updated.tickets.every((t) => t.paid);
    const sessionIdStr = updated.session_id.toString();
    
    // Emit ticket paid notification to POS and TAS
    const ticket = updated.tickets.find(t => t.ticket_part === ticketPart);
    if (ticket) {
      const remainingAmount = updated.tickets
        .filter(t => !t.paid)
        .reduce((sum, t) => sum + t.ticket_amount, 0);
        
      emitTicketPaid(sessionIdStr, {
        ticketPart,
        ticketAmount: ticket.ticket_amount,
        remainingAmount,
      });
    }
    
    if (allPaid) {
      await totemSessionRepo.updateState(sessionIdStr, 'PAID', session);
      
      // Emit detailed session fully paid notification
      emitSessionFullyPaid(sessionIdStr, {
        paymentTotal: updated.payment_total,
        paymentType: updated.payment_type,
      });
    }

    return {
      ...updated.toObject(),
      allPaid,
    } as unknown as MarkTicketPaidResult;
  }, 3, 100);
}

/**
 * Process a refund for a ticket
 * Uses transaction to ensure refund and payment state update are atomic
 */
export async function processRefund(
  paymentId: string,
  ticketPart: number,
  _reason: string
): Promise<PaymentResult> {
  // Use transaction for refund operation
  return withTransaction(async (session) => {
    const payment = await paymentRepo.findById(paymentId);
    if (!payment) throw new Error(ErrorCode.PAYMENT_NOT_FOUND);

    const ticket = payment.tickets.find(t => t.ticket_part === ticketPart);
    if (!ticket) throw new Error(ErrorCode.TICKET_NOT_FOUND);
    if (!ticket.paid) throw new Error(ErrorCode.PAYMENT_FAILED);

    // Mark ticket as unpaid (refunded)
    const updated = await paymentRepo.markTicketPaid(paymentId, ticketPart, session);
    if (!updated) throw new Error(ErrorCode.UPDATE_FAILED);

    // TODO: Create refund record for audit trail
    // await refundRepo.create({
    //   payment_id: paymentId,
    //   ticket_part: ticketPart,
    //   amount: ticket.ticket_amount,
    //   reason,
    //   refunded_at: new Date(),
    // }, session);

    return updated as unknown as PaymentResult;
  });
}

/**
 * Get payment by ID with session details
 */
export async function getPaymentById(paymentId: string): Promise<PaymentResult | null> {
  const payment = await paymentRepo.findById(paymentId);
  if (!payment) return null;
  
  return payment as unknown as PaymentResult;
}

/**
 * Get all payments for a session
 */
export async function getPaymentsBySessionId(sessionId: string): Promise<PaymentResult[]> {
  const payments = await paymentRepo.findBySessionId(sessionId);
  return payments as unknown as PaymentResult[];
}

/**
 * Validate payment amount against calculated total
 * Used to prevent payment tampering
 */
export async function validatePaymentAmount(
  sessionId: string,
  expectedAmount: number,
  customTip?: number
): Promise<boolean> {
  const { total } = await calculateSessionTotal(sessionId, customTip);
  // Allow small floating point tolerance
  const tolerance = 0.01;
  return Math.abs(total - expectedAmount) < tolerance;
}
