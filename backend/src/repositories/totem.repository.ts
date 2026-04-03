import { Types, ClientSession } from 'mongoose';
import { Totem, ITotem, TotemSession, ITotemSession, SessionCustomer, ISessionCustomer } from '../models/totem.model';
import { BaseRepository, validateObjectId, validateObjectIdOptional } from './base.repository';
import { CreateTotemData, UpdateTotemData } from '@disherio/shared';

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

  async createTotem(data: CreateTotemData & { totem_qr: string }): Promise<ITotem> {
    validateObjectId(data.restaurant_id, 'restaurant_id');
    const { restaurant_id, totem_start_date, ...rest } = data;
    return this.create({
      ...rest,
      restaurant_id: new Types.ObjectId(restaurant_id),
      ...(totem_start_date !== undefined && { totem_start_date: new Date(totem_start_date) }),
    });
  }

  async updateTotem(id: string, data: UpdateTotemData & { totem_qr?: string }): Promise<ITotem | null> {
    validateObjectId(id, 'totem_id');
    const { restaurant_id, totem_start_date, ...rest } = data;
    return this.model
      .findByIdAndUpdate(
        id,
        {
          ...rest,
          ...(restaurant_id !== undefined && { restaurant_id: new Types.ObjectId(restaurant_id) }),
          ...(totem_start_date !== undefined && { totem_start_date: new Date(totem_start_date) }),
        },
        { new: true }
      )
      .exec();
  }

  async deleteTotem(id: string): Promise<ITotem | null> {
    validateObjectId(id, 'totem_id');
    return this.model.findByIdAndDelete(id).exec();
  }

  async findByRestaurantIdSelectId(restaurantId: string): Promise<Array<{ _id: Types.ObjectId; totem_name: string }>> {
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model
      .find({ restaurant_id: new Types.ObjectId(restaurantId) })
      .select('_id totem_name')
      .lean()
      .exec() as Promise<Array<{ _id: Types.ObjectId; totem_name: string }>>;
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
      // Normalize session totem_id to string
      let sessionTotemId: string;
      if (typeof session.totem_id === 'string') {
        sessionTotemId = session.totem_id;
      } else if (session.totem_id && typeof session.totem_id === 'object') {
        sessionTotemId = session.totem_id.toString ? session.totem_id.toString() : String(session.totem_id);
      } else {
        sessionTotemId = String(session.totem_id);
      }
      
      const totem = totems.find(t => {
        // Normalize totem _id to string
        let totemId: string;
        if (typeof t._id === 'string') {
          totemId = t._id;
        } else if (t._id && typeof t._id === 'object') {
          totemId = t._id.toString ? t._id.toString() : String(t._id);
        } else {
          totemId = String(t._id);
        }
        return totemId === sessionTotemId;
      });
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
    state: 'STARTED' | 'COMPLETE' | 'PAID',
    session?: ClientSession
  ): Promise<ITotemSession | null> {
    validateObjectId(id, 'session_id');
    return this.model
      .findByIdAndUpdate(id, { totem_state: state }, { new: true, session })
      .exec();
  }

  async findByTotemIdsAndState(
    totemIds: string[],
    state: 'STARTED' | 'COMPLETE' | 'PAID'
  ): Promise<Array<{ _id: Types.ObjectId; totem_id: Types.ObjectId }>> {
    const validIds = totemIds.filter((id) => Types.ObjectId.isValid(id));
    if (validIds.length === 0) return [];

    return this.model
      .find({
        totem_id: { $in: validIds.map((id) => new Types.ObjectId(id)) },
        totem_state: state,
      })
      .select('_id totem_id')
      .lean()
      .exec() as Promise<Array<{ _id: Types.ObjectId; totem_id: Types.ObjectId }>>;
  }
}

export class CustomerRepository extends BaseRepository<ISessionCustomer> {
  constructor() {
    super(SessionCustomer);
  }

  async findBySessionId(sessionId: string): Promise<ISessionCustomer[]> {
    validateObjectId(sessionId, 'session_id');
    return this.model
      .find({ session_id: new Types.ObjectId(sessionId) })
      .lean()
      .exec();
  }

  async createCustomer(
    data: Partial<ISessionCustomer> & { customer_name: string; session_id: string }
  ): Promise<ISessionCustomer> {
    validateObjectId(data.session_id, 'session_id');
    return this.create({
      ...data,
      session_id: new Types.ObjectId(data.session_id),
    });
  }

  async deleteCustomer(id: string): Promise<ISessionCustomer | null> {
    validateObjectId(id, 'customer_id');
    return this.model.findByIdAndDelete(id).exec();
  }
}
