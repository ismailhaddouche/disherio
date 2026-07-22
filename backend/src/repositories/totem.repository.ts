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
    return this.findByQRScoped(qr);
  }

  async findByQRScoped(qr: string, restaurantId?: string): Promise<ITotem | null> {
    const filter: Record<string, unknown> = { totem_qr: qr };
    if (restaurantId) {
      validateObjectId(restaurantId, 'restaurant_id');
      filter.restaurant_id = new Types.ObjectId(restaurantId);
    }
    return this.model.findOne(filter).lean().exec();
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
        { returnDocument: 'after' }
      )
      .exec();
  }

  async deleteTotem(id: string, session?: ClientSession): Promise<ITotem | null> {
    validateObjectId(id, 'totem_id');
    return this.model.findByIdAndDelete(id, { session }).exec();
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
    const sessions = await this.model
      .find({
        restaurant_id: new Types.ObjectId(restaurantId),
        totem_state: { $in: ['STARTED', 'COMPLETE'] },
      })
      .sort({ session_date_start: -1 })
      .lean()
      .exec();

    const totems = await Totem.find({
      _id: { $in: sessions.map((session) => session.totem_id) },
      restaurant_id: new Types.ObjectId(restaurantId),
    }).lean().exec();

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
      return {
        ...session,
        totem: totem ?? {
          _id: session.totem_snapshot?.totem_id,
          restaurant_id: session.restaurant_id,
          totem_name: session.totem_snapshot?.totem_name,
          totem_type: session.totem_snapshot?.totem_type,
        },
      };
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

  async findOperationalByTotemId(totemId: string, session?: ClientSession): Promise<ITotemSession | null> {
    validateObjectId(totemId, 'totem_id');
    return this.model.findOne({
      totem_id: new Types.ObjectId(totemId),
      totem_state: { $in: ['STARTED', 'COMPLETE'] },
    }, null, { session }).exec();
  }

  async createSession(totem: ITotem, sessionToken: string): Promise<ITotemSession> {
    const totemId = totem._id.toString();
    validateObjectId(totemId, 'totem_id');
    const totemObjectId = new Types.ObjectId(totemId);
    try {
      return await this.model.findOneAndUpdate(
        { totem_id: totemObjectId, totem_state: 'STARTED' },
        {
          $setOnInsert: {
            totem_id: totemObjectId,
            restaurant_id: totem.restaurant_id,
            totem_snapshot: {
              totem_id: totem._id,
              totem_name: totem.totem_name,
              totem_type: totem.totem_type,
            },
            session_date_start: new Date(),
            totem_state: 'STARTED',
            session_token: sessionToken,
          },
        },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
      ).exec();
    } catch (error) {
      // A concurrent upsert can lose the unique-index race. Return the winner
      // so session creation remains idempotent across processes.
      if ((error as { code?: number }).code === 11000) {
        const activeSession = await this.findActiveByTotemId(totemId);
        if (activeSession) return activeSession;
      }
      throw error;
    }
  }

  /**
   * Atomically transition a session to `toState` only if its current state is
   * one of `fromStates`. Returns the updated session, or null when the current
   * state does not match (idempotent: the caller must not re-emit events).
   * Replaces the previous unconditional `updateState` to prevent cross-node
   * race conditions on close, reopen, and archive.
   */
  async updateStateIf(
    id: string,
    fromStates: ReadonlyArray<'STARTED' | 'COMPLETE' | 'PAID' | 'CANCELLED'>,
    toState: 'STARTED' | 'COMPLETE' | 'PAID' | 'CANCELLED',
    session?: ClientSession
  ): Promise<ITotemSession | null> {
    validateObjectId(id, 'session_id');
    return this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), totem_state: { $in: [...fromStates] } },
        { totem_state: toState },
        { returnDocument: 'after', session }
      )
      .exec() as Promise<ITotemSession | null>;
  }

  /** Atomically reopen a completed session while rotating its public token. */
  async reopenWithToken(
    id: string,
    sessionToken: string,
    session: ClientSession
  ): Promise<ITotemSession | null> {
    validateObjectId(id, 'session_id');
    return this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), totem_state: 'COMPLETE' },
        {
          $set: {
            totem_state: 'STARTED',
            session_token: sessionToken,
          },
          $inc: { version: 1 },
        },
        { returnDocument: 'after', session }
      )
      .exec() as Promise<ITotemSession | null>;
  }

  /** Serialize a mutation against session payment/closure transitions. */
  async lockIfStateIn(
    id: string,
    states: ReadonlyArray<'STARTED' | 'COMPLETE'>,
    session: ClientSession
  ): Promise<ITotemSession | null> {
    validateObjectId(id, 'session_id');
    return this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(id), totem_state: { $in: [...states] } },
      { $inc: { version: 1 } },
      { returnDocument: 'after', session }
    ).exec();
  }

  /** Serialize a mutation regardless of the session's current state. */
  async lockById(id: string, session: ClientSession): Promise<ITotemSession | null> {
    validateObjectId(id, 'session_id');
    return this.model.findByIdAndUpdate(
      new Types.ObjectId(id),
      { $inc: { version: 1 } },
      { returnDocument: 'after', session }
    ).exec();
  }

  /** Back-fill a session token on legacy sessions that do not have one yet. */
  async setSessionToken(id: string, sessionToken: string): Promise<ITotemSession | null> {
    validateObjectId(id, 'session_id');
    return this.model
      .findByIdAndUpdate(id, { session_token: sessionToken }, { returnDocument: 'after' })
      .exec();
  }

  async findByTotemIdsAndState(
    totemIds: string[],
    state: 'STARTED' | 'COMPLETE' | 'PAID'
  ): Promise<Array<{ _id: Types.ObjectId; totem_id: Types.ObjectId; totem_state: string }>> {
    const validIds = totemIds.filter((id) => Types.ObjectId.isValid(id));
    if (validIds.length === 0) return [];

    return this.model
      .find({
        totem_id: { $in: validIds.map((id) => new Types.ObjectId(id)) },
        totem_state: state,
      })
      .select('_id totem_id totem_state')
      .lean()
      .exec() as Promise<Array<{ _id: Types.ObjectId; totem_id: Types.ObjectId; totem_state: string }>>;
  }

  async findByTotemIds(
    totemIds: string[],
    dateRange?: { from?: Date; to?: Date }
  ): Promise<Array<{ _id: Types.ObjectId; totem_state: string }>> {
    const validIds = totemIds.filter((id) => Types.ObjectId.isValid(id));
    if (validIds.length === 0) return [];

    const match: Record<string, unknown> = {
      totem_id: { $in: validIds.map((id) => new Types.ObjectId(id)) },
    };
    if (dateRange?.from) match['session_date_start'] = { $gte: dateRange.from };
    if (dateRange?.to) {
      match['session_date_start'] = { ...(match['session_date_start'] as object || {}), $lte: dateRange.to };
    }

    return this.model
      .find(match)
      .select('_id totem_state')
      .lean()
      .exec() as Promise<Array<{ _id: Types.ObjectId; totem_state: string }>>;
  }

  async findByRestaurantId(
    restaurantId: string,
    dateRange?: { from?: Date; to?: Date }
  ): Promise<Array<{ _id: Types.ObjectId; totem_state: string }>> {
    validateObjectId(restaurantId, 'restaurant_id');
    const match: Record<string, unknown> = {
      restaurant_id: new Types.ObjectId(restaurantId),
    };
    if (dateRange?.from) match.session_date_start = { $gte: dateRange.from };
    if (dateRange?.to) {
      match.session_date_start = {
        ...(match.session_date_start as object || {}),
        $lte: dateRange.to,
      };
    }
    return this.model
      .find(match)
      .select('_id totem_state')
      .lean()
      .exec() as Promise<Array<{ _id: Types.ObjectId; totem_state: string }>>;
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

  /**
   * Find a customer by case-insensitive name within a session.
   * Used to reject duplicate names at the same table.
   */
  async findByNameInSession(
    sessionId: string,
    customerName: string,
    session?: ClientSession
  ): Promise<ISessionCustomer | null> {
    validateObjectId(sessionId, 'session_id');
    const customerNameKey = customerName.trim().normalize('NFKC').toLocaleLowerCase('en');
    return this.model
      .findOne({
        session_id: new Types.ObjectId(sessionId),
        customer_name_key: customerNameKey,
      })
      .session(session ?? null)
      .lean()
      .exec();
  }

  async createCustomer(
    data: { customer_name: string; session_id: string },
    session?: ClientSession
  ): Promise<ISessionCustomer> {
    validateObjectId(data.session_id, 'session_id');
    return this.create({
      ...data,
      customer_name_key: data.customer_name.trim().normalize('NFKC').toLocaleLowerCase('en'),
      session_id: new Types.ObjectId(data.session_id),
    }, session);
  }

  async deleteCustomer(id: string): Promise<ISessionCustomer | null> {
    validateObjectId(id, 'customer_id');
    return this.model.findByIdAndDelete(id).exec();
  }
}
