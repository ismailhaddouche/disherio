import { Types } from 'mongoose';
import { Order, IOrder, ItemOrder, IItemOrder, Payment, IPayment } from '../models/order.model';
import { BaseRepository, validateObjectId, validateObjectIdOptional } from './base.repository';

export { validateObjectId, validateObjectIdOptional };

export class OrderRepository extends BaseRepository<IOrder> {
  constructor() {
    super(Order);
  }

  async createOrder(
    sessionId: string,
    staffId?: string,
    customerId?: string
  ): Promise<IOrder> {
    validateObjectId(sessionId, 'session_id');
    validateObjectIdOptional(staffId, 'staff_id');
    validateObjectIdOptional(customerId, 'customer_id');

    return this.create({
      session_id: new Types.ObjectId(sessionId),
      staff_id: staffId ? new Types.ObjectId(staffId) : undefined,
      customer_id: customerId ? new Types.ObjectId(customerId) : undefined,
      order_date: new Date(),
    });
  }

  async findBySessionId(sessionId: string): Promise<IOrder[]> {
    validateObjectId(sessionId, 'session_id');
    return this.model.find({ session_id: new Types.ObjectId(sessionId) }).exec();
  }
}

export class ItemOrderRepository extends BaseRepository<IItemOrder> {
  constructor() {
    super(ItemOrder);
  }

  async createItem(data: {
    order_id: string;
    session_id: string;
    item_dish_id: string;
    customer_id?: string;
    item_disher_type: 'KITCHEN' | 'SERVICE';
    item_name_snapshot: { es: string; en: string; fr: string; ar: string };
    item_base_price: number;
    item_disher_variant?: { variant_id: string; name: object; price: number } | null;
    item_disher_extras: { extra_id: string; name: object; price: number }[];
  }): Promise<IItemOrder> {
    validateObjectId(data.order_id, 'order_id');
    validateObjectId(data.session_id, 'session_id');
    validateObjectId(data.item_dish_id, 'item_dish_id');
    validateObjectIdOptional(data.customer_id, 'customer_id');

    return this.create({
      ...data,
      order_id: new Types.ObjectId(data.order_id),
      session_id: new Types.ObjectId(data.session_id),
      item_dish_id: new Types.ObjectId(data.item_dish_id),
      customer_id: data.customer_id ? new Types.ObjectId(data.customer_id) : undefined,
      item_state: 'ORDERED',
    });
  }

  async findBySessionId(sessionId: string): Promise<IItemOrder[]> {
    validateObjectId(sessionId, 'session_id');
    return this.model
      .find({ session_id: new Types.ObjectId(sessionId) })
      .sort({ createdAt: 1 })
      .exec();
  }

  async findBySessionIdLean(sessionId: string): Promise<IItemOrder[]> {
    validateObjectId(sessionId, 'session_id');
    return this.model
      .find({ session_id: new Types.ObjectId(sessionId) })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
  }

  async findKitchenItemsBySessionIds(sessionIds: string[]): Promise<IItemOrder[]> {
    const validIds = sessionIds.filter((id) => Types.ObjectId.isValid(id));
    if (validIds.length === 0) return [];

    return this.model
      .find({
        session_id: { $in: validIds.map((id) => new Types.ObjectId(id)) },
        item_disher_type: 'KITCHEN',
        item_state: { $in: ['ORDERED', 'ON_PREPARE'] },
      })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
  }

  async updateState(
    itemId: string,
    newState: 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED'
  ): Promise<IItemOrder | null> {
    validateObjectId(itemId, 'item_id');
    return this.model.findByIdAndUpdate(
      itemId,
      { item_state: newState },
      { new: true }
    ).exec();
  }

  async findActiveBySessionId(sessionId: string): Promise<IItemOrder[]> {
    validateObjectId(sessionId, 'session_id');
    return this.model
      .find({
        session_id: new Types.ObjectId(sessionId),
        item_state: { $ne: 'CANCELED' },
      })
      .lean()
      .exec();
  }

  async deleteItem(itemId: string): Promise<IItemOrder | null> {
    validateObjectId(itemId, 'item_id');
    // Only allow deletion if item is in ORDERED state
    return this.model.findOneAndDelete({
      _id: new Types.ObjectId(itemId),
      item_state: 'ORDERED',
    }).exec();
  }

  async assignItemToCustomer(itemId: string, customerId: string | null): Promise<IItemOrder | null> {
    validateObjectId(itemId, 'item_id');
    validateObjectIdOptional(customerId, 'customer_id');
    return this.model.findByIdAndUpdate(
      itemId,
      { customer_id: customerId ? new Types.ObjectId(customerId) : null },
      { new: true }
    ).exec();
  }

  async findServiceItemsBySessionIds(sessionIds: string[]): Promise<IItemOrder[]> {
    const validIds = sessionIds.filter((id) => Types.ObjectId.isValid(id));
    if (validIds.length === 0) return [];

    // SERVICE items (drinks) only have ORDERED and SERVED states
    // They skip ON_PREPARE since they don't need kitchen preparation
    return this.model
      .find({
        session_id: { $in: validIds.map((id) => new Types.ObjectId(id)) },
        item_disher_type: 'SERVICE',
        item_state: { $in: ['ORDERED'] },  // SERVICE items are only ORDERED before served
      })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
  }
}

export class PaymentRepository extends BaseRepository<IPayment> {
  constructor() {
    super(Payment);
  }

  async createPayment(data: {
    session_id: string;
    payment_type: 'ALL' | 'BY_USER' | 'SHARED';
    payment_total: number;
    tickets: {
      ticket_part: number;
      ticket_total_parts: number;
      ticket_amount: number;
      ticket_customer_name?: string;
      paid: boolean;
    }[];
  }): Promise<IPayment> {
    validateObjectId(data.session_id, 'session_id');
    return this.create({
      ...data,
      session_id: new Types.ObjectId(data.session_id),
      payment_date: new Date(),
    });
  }

  async findBySessionId(sessionId: string): Promise<IPayment[]> {
    validateObjectId(sessionId, 'session_id');
    return this.model.find({ session_id: new Types.ObjectId(sessionId) }).exec();
  }

  async markTicketPaid(paymentId: string, ticketPart: number): Promise<IPayment | null> {
    validateObjectId(paymentId, 'payment_id');
    return this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(paymentId), 'tickets.ticket_part': ticketPart },
      { $set: { 'tickets.$.paid': true } },
      { new: true }
    ).exec();
  }
}
