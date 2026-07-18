import { Types, ClientSession } from 'mongoose';
import { Order, IOrder } from '../../models/order.model';
import { BaseRepository, validateObjectId, validateObjectIdOptional } from '../base.repository';

export class OrderRepository extends BaseRepository<IOrder> {
  constructor() {
    super(Order);
  }

  async createOrder(
    sessionId: string,
    staffId?: string,
    customerId?: string,
    session?: ClientSession,
    idempotency?: { requestId: string; requestHash: string }
  ): Promise<IOrder> {
    validateObjectId(sessionId, 'session_id');
    validateObjectIdOptional(staffId, 'staff_id');
    validateObjectIdOptional(customerId, 'customer_id');

    const sessionObjectId = new Types.ObjectId(sessionId);
    const latestOrder = await this.model
      .findOne({ session_id: sessionObjectId, order_number: { $exists: true } })
      .sort({ order_number: -1, order_date: -1 })
      .select('order_number')
      .session(session ?? null)
      .lean()
      .exec();

    return this.create({
      session_id: sessionObjectId,
      staff_id: staffId ? new Types.ObjectId(staffId) : undefined,
      customer_id: customerId ? new Types.ObjectId(customerId) : undefined,
      order_number: (latestOrder?.order_number ?? 0) + 1,
      order_date: new Date(),
      request_id: idempotency?.requestId,
      request_hash: idempotency?.requestHash,
    }, session);
  }

  async findByRequestId(
    sessionId: string,
    requestId: string,
    session: ClientSession
  ): Promise<IOrder | null> {
    validateObjectId(sessionId, 'session_id');
    return this.model.findOne({
      session_id: new Types.ObjectId(sessionId),
      request_id: requestId,
    }).select('+request_hash').session(session).exec();
  }

}
