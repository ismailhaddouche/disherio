import { Types } from 'mongoose';
import { Totem, ITotem, TotemSession, ITotemSession, Customer, ICustomer } from '../models/totem.model';
import { BaseRepository, validateObjectId, validateObjectIdOptional } from './base.repository';

export { validateObjectId, validateObjectIdOptional };

export class TotemRepository extends BaseRepository<ITotem> {
  constructor() {
    super(Totem);
  }

  async findByRestaurantId(restaurantId: string): Promise<ITotem[]> {
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model
      .find({ restaurant_id: new Types.ObjectId(restaurantId) })
      .lean()
      .exec();
  }

  async findByQR(qr: string): Promise<ITotem | null> {
    return this.model.findOne({ totem_qr: qr }).lean().exec();
  }

  async createTotem(
    data: Partial<ITotem> & {
      restaurant_id: string;
      totem_name: string;
      totem_type: 'STANDARD' | 'TEMPORARY';
    }
  ): Promise<ITotem> {
    validateObjectId(data.restaurant_id, 'restaurant_id');
    return this.create({
      ...data,
      restaurant_id: new Types.ObjectId(data.restaurant_id),
    });
  }

  async updateTotem(
    id: string,
    data: Omit<Partial<ITotem>, 'restaurant_id'> & { restaurant_id?: string }
  ): Promise<ITotem | null> {
    validateObjectId(id, 'totem_id');
    const { restaurant_id, ...rest } = data;
    return this.model
      .findByIdAndUpdate(
        id,
        {
          ...rest,
          ...(restaurant_id !== undefined && { restaurant_id: new Types.ObjectId(restaurant_id) }),
        },
        { new: true }
      )
      .exec();
  }

  async deleteTotem(id: string): Promise<ITotem | null> {
    validateObjectId(id, 'totem_id');
    return this.model.findByIdAndDelete(id).exec();
  }

  async findByRestaurantIdSelectId(restaurantId: string): Promise<Array<{ _id: Types.ObjectId }>> {
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model
      .find({ restaurant_id: new Types.ObjectId(restaurantId) })
      .select('_id')
      .lean()
      .exec() as Promise<Array<{ _id: Types.ObjectId }>>;
  }
}

export class TotemSessionRepository extends BaseRepository<ITotemSession> {
  constructor() {
    super(TotemSession);
  }

  async findActiveByRestaurantId(restaurantId: string): Promise<Array<Record<string, unknown>>> {
    validateObjectId(restaurantId, 'restaurant_id');
    // First get all totems for this restaurant
    const totems = await Totem.find({ restaurant_id: new Types.ObjectId(restaurantId) }).lean().exec();
    const totemIds = totems.map(t => t._id.toString());
    
    if (totemIds.length === 0) return [];
    
    // Then get active sessions for these totems
    const sessions = await this.model
      .find({
        totem_id: { $in: totemIds.map(id => new Types.ObjectId(id)) },
        totem_state: 'STARTED',
      })
      .sort({ session_date_start: -1 })
      .lean()
      .exec();
    
    // Attach totem info to each session
    return sessions.map(session => {
      const totem = totems.find(t => t._id.toString() === (session.totem_id as Types.ObjectId).toString());
      return { ...session, totem };
    });
  }

  async findByTotemId(totemId: string): Promise<ITotemSession[]> {
    validateObjectId(totemId, 'totem_id');
    return this.model
      .find({ totem_id: new Types.ObjectId(totemId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findActiveByTotemId(totemId: string): Promise<ITotemSession | null> {
    validateObjectId(totemId, 'totem_id');
    return this.model.findOne({
      totem_id: new Types.ObjectId(totemId),
      totem_state: 'STARTED',
    }).exec();
  }

  async createSession(totemId: string): Promise<ITotemSession> {
    validateObjectId(totemId, 'totem_id');
    return this.create({
      totem_id: new Types.ObjectId(totemId),
      session_date_start: new Date(),
      totem_state: 'STARTED',
    });
  }

  async updateState(
    id: string,
    state: 'STARTED' | 'COMPLETE' | 'PAID'
  ): Promise<ITotemSession | null> {
    validateObjectId(id, 'session_id');
    return this.model
      .findByIdAndUpdate(id, { totem_state: state }, { new: true })
      .exec();
  }

  async findByTotemIdsAndState(
    totemIds: string[],
    state: 'STARTED' | 'COMPLETE' | 'PAID'
  ): Promise<Array<{ _id: Types.ObjectId }>> {
    const validIds = totemIds.filter((id) => Types.ObjectId.isValid(id));
    if (validIds.length === 0) return [];

    return this.model
      .find({
        totem_id: { $in: validIds.map((id) => new Types.ObjectId(id)) },
        totem_state: state,
      })
      .select('_id')
      .lean()
      .exec() as Promise<Array<{ _id: Types.ObjectId }>>;
  }
}

export class CustomerRepository extends BaseRepository<ICustomer> {
  constructor() {
    super(Customer);
  }

  async findBySessionId(sessionId: string): Promise<ICustomer[]> {
    validateObjectId(sessionId, 'session_id');
    return this.model
      .find({ session_id: new Types.ObjectId(sessionId) })
      .lean()
      .exec();
  }

  async createCustomer(
    data: Partial<ICustomer> & { customer_name: string; session_id: string }
  ): Promise<ICustomer> {
    validateObjectId(data.session_id, 'session_id');
    return this.create({
      ...data,
      session_id: new Types.ObjectId(data.session_id),
    });
  }

  async deleteCustomer(id: string): Promise<ICustomer | null> {
    validateObjectId(id, 'customer_id');
    return this.model.findByIdAndDelete(id).exec();
  }
}
