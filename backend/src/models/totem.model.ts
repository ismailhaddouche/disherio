import { Schema, model, Document, Types } from 'mongoose';

export interface ITotem extends Document {
  restaurant_id: Types.ObjectId;
  totem_name: string;
  totem_qr: string;
  totem_type: 'STANDARD' | 'TEMPORARY';
  totem_start_date: Date;
}

const TotemSchema = new Schema<ITotem>(
  {
    restaurant_id: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    totem_name: { type: String, required: true },
    totem_qr: { type: String },
    totem_type: { type: String, enum: ['STANDARD', 'TEMPORARY'], required: true },
    totem_start_date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Index for restaurant-based searches
TotemSchema.index({ restaurant_id: 1, totem_type: 1 });

// Unique index for QR lookup
TotemSchema.index({ totem_qr: 1 }, { unique: true, sparse: true });

export const Totem = model<ITotem>('Totem', TotemSchema);

export interface ITotemSession extends Document {
  totem_id: Types.ObjectId;
  restaurant_id: Types.ObjectId;
  totem_snapshot: {
    totem_id: Types.ObjectId;
    totem_name: string;
    totem_type: 'STANDARD' | 'TEMPORARY';
  };
  session_date_start: Date;
  totem_state: 'STARTED' | 'COMPLETE' | 'PAID' | 'CANCELLED';
  session_token: string;
  version: number;
}

const TotemSessionSchema = new Schema<ITotemSession>(
  {
    totem_id: { type: Schema.Types.ObjectId, ref: 'Totem', required: true },
    restaurant_id: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    totem_snapshot: {
      totem_id: { type: Schema.Types.ObjectId, required: true },
      totem_name: { type: String, required: true },
      totem_type: { type: String, enum: ['STANDARD', 'TEMPORARY'], required: true },
    },
    session_date_start: { type: Date, default: Date.now },
    totem_state: { type: String, enum: ['STARTED', 'COMPLETE', 'PAID', 'CANCELLED'], default: 'STARTED' },
    // Ephemeral per-session credential. Required to join a session room and to
    // emit totem socket events, so a printed QR alone cannot impersonate a
    // customer or close another table's session. Sparse so legacy sessions
    // predating migration 0002 may omit it.
    session_token: { type: String, index: true, sparse: true },
    version: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    optimisticConcurrency: true
  }
);

// Index for totem state queries
TotemSessionSchema.index({ totem_id: 1, totem_state: 1 });
TotemSessionSchema.index({ restaurant_id: 1, session_date_start: -1 });

// A physical totem can have only one active session. The partial unique index
// is the definitive concurrency guard for simultaneous staff/public opens.
TotemSessionSchema.index(
  { totem_id: 1 },
  {
    name: 'unique_started_session_per_totem',
    unique: true,
    partialFilterExpression: { totem_state: 'STARTED' },
  }
);

// Index for active sessions by state and time
TotemSessionSchema.index({ totem_state: 1, createdAt: -1 });

// Compound index for optimistic locking
TotemSessionSchema.index({ _id: 1, version: 1 });

export const TotemSession = model<ITotemSession>('TotemSession', TotemSessionSchema);

// Renamed to ISessionCustomer to avoid conflict with ICustomer from customer.model.ts
export interface ISessionCustomer extends Document {
  customer_name: string;
  customer_name_key: string;
  session_id: Types.ObjectId;
}

const SessionCustomerSchema = new Schema<ISessionCustomer>(
  {
    customer_name: { type: String, required: true },
    customer_name_key: { type: String, required: true, select: false },
    session_id: { type: Schema.Types.ObjectId, ref: 'TotemSession', required: true },
  },
  { timestamps: true }
);

SessionCustomerSchema.pre('validate', function normalizeCustomerNameKey() {
  this.customer_name_key = this.customer_name.trim().normalize('NFKC').toLocaleLowerCase('en');
});

// Index for session-based customer lookups and per-table name uniqueness.
SessionCustomerSchema.index({ session_id: 1 });
SessionCustomerSchema.index(
  { session_id: 1, customer_name_key: 1 },
  { unique: true, partialFilterExpression: { customer_name_key: { $type: 'string' } } }
);

export const SessionCustomer = model<ISessionCustomer>('SessionCustomer', SessionCustomerSchema);
