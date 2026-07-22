import { Types, ClientSession, PipelineStage } from 'mongoose';
import { Payment, IPayment } from '../../models/order.model';
import { BaseRepository, validateObjectId } from '../base.repository';
import { QueryProfiler } from '../../utils/query-profiler';

export interface PaymentHistoryEntry {
  _id: Types.ObjectId;
  session_id: Types.ObjectId;
  payment_type: 'ALL' | 'BY_USER' | 'SHARED';
  payment_total: number;
  payment_date: Date;
  tickets: Array<{
    ticket_part: number;
    ticket_total_parts: number;
    ticket_amount: number;
    ticket_customer_name?: string;
    paid: boolean;
  }>;
  session: {
    _id: Types.ObjectId;
    totem_state: 'STARTED' | 'COMPLETE' | 'PAID' | 'CANCELLED';
    session_date_start: Date;
  };
  totem: {
    _id: Types.ObjectId;
    totem_name: string;
    totem_type: 'STANDARD' | 'TEMPORARY';
  };
}

interface PaymentStats {
  totalRevenue: number;
  totalTransactions: number;
  averageTicket: number;
  paidTickets: number;
  pendingTickets: number;
}

export class PaymentRepository extends BaseRepository<IPayment> {
  constructor() {
    super(Payment);
  }

  async createPayment(
    data: {
      session_id: string;
      restaurant_id: string;
      totem_snapshot: {
        totem_id: string;
        totem_name: string;
        totem_type: 'STANDARD' | 'TEMPORARY';
      };
      payment_type: 'ALL' | 'BY_USER' | 'SHARED';
      payment_total: number;
      tickets: {
        ticket_part: number;
        ticket_total_parts: number;
        ticket_amount: number;
        ticket_customer_name?: string;
        paid: boolean;
      }[];
    },
    session?: ClientSession
  ): Promise<IPayment> {
    validateObjectId(data.session_id, 'session_id');
    validateObjectId(data.restaurant_id, 'restaurant_id');
    validateObjectId(data.totem_snapshot.totem_id, 'totem_id');
    return this.create(
      {
        ...data,
        session_id: new Types.ObjectId(data.session_id),
        restaurant_id: new Types.ObjectId(data.restaurant_id),
        totem_snapshot: {
          ...data.totem_snapshot,
          totem_id: new Types.ObjectId(data.totem_snapshot.totem_id),
        },
        payment_date: new Date(),
      },
      session
    );
  }

  async findBySessionId(sessionId: string, session?: ClientSession): Promise<IPayment[]> {
    validateObjectId(sessionId, 'session_id');
    const query = this.model.find({ session_id: new Types.ObjectId(sessionId) });
    if (session) query.session(session);
    return query.exec();
  }

  async markTicketPaid(
    paymentId: string,
    ticketPart: number,
    session?: ClientSession
  ): Promise<IPayment | null> {
    validateObjectId(paymentId, 'payment_id');
    return this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(paymentId), tickets: { $elemMatch: { ticket_part: ticketPart, paid: false } } },
      { $set: { 'tickets.$.paid': true } },
      { returnDocument: 'after', session }
    ).exec();
  }

  async markAllTicketsPaidForSession(
    sessionId: string,
    session?: ClientSession
  ): Promise<IPayment | null> {
    validateObjectId(sessionId, 'session_id');
    return this.model.findOneAndUpdate(
      { session_id: new Types.ObjectId(sessionId) },
      { $set: { 'tickets.$[].paid': true } },
      { returnDocument: 'after', session }
    ).exec();
  }

  async getPaymentHistory(
    restaurantId: string,
    filters: { from?: Date; to?: Date; search?: string; limit?: number } = {}
  ): Promise<PaymentHistoryEntry[]> {
    validateObjectId(restaurantId, 'restaurant_id');

    // Tenant pre-filter on the indexed restaurant_id field: without it the
    // lookups below would join every tenant's payments before the restaurant
    // match could discard rows. Legacy payments without restaurant_id are
    // kept and validated against the joined totem after the lookup.
    const matchStage: Record<string, unknown> = {
      $or: [
        { restaurant_id: new Types.ObjectId(restaurantId) },
        { restaurant_id: { $exists: false } },
      ],
    };
    if (filters.from || filters.to) {
      matchStage.payment_date = {};
      if (filters.from) (matchStage.payment_date as Record<string, Date>).$gte = filters.from;
      if (filters.to) (matchStage.payment_date as Record<string, Date>).$lte = filters.to;
    }

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'totemsessions',
          localField: 'session_id',
          foreignField: '_id',
          as: 'session',
        },
      },
      { $unwind: '$session' },
      {
        $lookup: {
          from: 'totems',
          localField: 'session.totem_id',
          foreignField: '_id',
          as: 'totem',
        },
      },
      { $unwind: { path: '$totem', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $or: [
            { restaurant_id: new Types.ObjectId(restaurantId) },
            {
              restaurant_id: { $exists: false },
              'totem.restaurant_id': new Types.ObjectId(restaurantId),
            },
          ],
        },
      },
    ];

    const search = filters.search?.trim().slice(0, 100);
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pipeline.push({
        $match: {
          $or: [
            { 'totem.totem_name': { $regex: escapedSearch, $options: 'i' } },
            { 'totem_snapshot.totem_name': { $regex: escapedSearch, $options: 'i' } },
            { 'tickets.ticket_customer_name': { $regex: escapedSearch, $options: 'i' } },
          ],
        },
      });
    }

    pipeline.push(
      { $sort: { payment_date: -1 } },
      { $limit: Math.min(Math.max(filters.limit ?? 100, 1), 300) },
      {
        $project: {
          _id: 1,
          session_id: 1,
          payment_type: 1,
          payment_total: 1,
          payment_date: 1,
          tickets: 1,
          session: {
            _id: '$session._id',
            totem_state: '$session.totem_state',
            session_date_start: '$session.session_date_start',
          },
          totem: {
            _id: { $ifNull: ['$totem_snapshot.totem_id', '$totem._id'] },
            totem_name: { $ifNull: ['$totem_snapshot.totem_name', '$totem.totem_name'] },
            totem_type: { $ifNull: ['$totem_snapshot.totem_type', '$totem.totem_type'] },
          },
        },
      }
    );

    return QueryProfiler.profileAggregation(
      this.model,
      pipeline,
      'PaymentRepository.getPaymentHistory',
      { explain: false }
    );
  }

  /**
   * Get payment statistics using aggregation.
   */
  async getPaymentStats(
    restaurantId: string,
    dateRange?: { from?: Date; to?: Date }
  ): Promise<{
    totalRevenue: number;
    totalTransactions: number;
    averageTicket: number;
    paidTickets: number;
    pendingTickets: number;
  }> {
    validateObjectId(restaurantId, 'restaurant_id');

    const matchStage: Record<string, unknown> = {
      restaurant_id: new Types.ObjectId(restaurantId),
    };

    if (dateRange?.from || dateRange?.to) {
      matchStage.payment_date = {};
      if (dateRange.from) (matchStage.payment_date as Record<string, Date>).$gte = dateRange.from;
      if (dateRange.to) (matchStage.payment_date as Record<string, Date>).$lte = dateRange.to;
    }

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          // Collected revenue only: sum the amounts of tickets actually paid.
          // A Payment document is created when the bill is issued, but its
          // tickets may never be settled (e.g. a shared bill nobody paid);
          // counting payment_total here inflated the dashboard versus
          // getSalesByDish/getDishStats, which only count PAID sessions.
          // Ticket splits are cent-exact (calculation.utils), so the paid
          // tickets of a fully settled payment add up to payment_total.
          totalRevenue: {
            $sum: {
              $reduce: {
                input: {
                  $filter: { input: '$tickets', as: 'ticket', cond: '$$ticket.paid' },
                },
                initialValue: 0,
                in: { $add: ['$$value', '$$this.ticket_amount'] },
              },
            },
          },
          totalTransactions: { $sum: 1 },
          averageTicket: { $avg: '$payment_total' },
          allTickets: { $push: '$tickets' },
        },
      },
      {
        $addFields: {
          flattenedTickets: {
            $reduce: {
              input: '$allTickets',
              initialValue: [],
              in: { $concatArrays: ['$$value', '$$this'] },
            },
          },
        },
      },
      {
        $addFields: {
          paidTickets: {
            $size: {
              $filter: {
                input: '$flattenedTickets',
                as: 'ticket',
                cond: '$$ticket.paid',
              },
            },
          },
          pendingTickets: {
            $size: {
              $filter: {
                input: '$flattenedTickets',
                as: 'ticket',
                cond: { $eq: ['$$ticket.paid', false] },
              },
            },
          },
        },
      },
      {
        $project: {
          totalRevenue: { $round: ['$totalRevenue', 2] },
          totalTransactions: 1,
          averageTicket: { $round: ['$averageTicket', 2] },
          paidTickets: 1,
          pendingTickets: 1,
        },
      },
    ];

    const result = await QueryProfiler.profileAggregation<IPayment, PaymentStats>(
      this.model,
      pipeline,
      'PaymentRepository.getPaymentStats',
      { explain: false }
    );

    if (result.length === 0) {
      return {
        totalRevenue: 0,
        totalTransactions: 0,
        averageTicket: 0,
        paidTickets: 0,
        pendingTickets: 0,
      };
    }

    return result[0];
  }
}
