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
    totem_qr: { type: String, unique: true },
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
  session_date_start: Date;
  totem_state: 'STARTED' | 'COMPLETE' | 'PAID';
  version: number;
}

const TotemSessionSchema = new Schema<ITotemSession>(
  {
    totem_id: { type: Schema.Types.ObjectId, ref: 'Totem', required: true },
    session_date_start: { type: Date, default: Date.now },
    totem_state: { type: String, enum: ['STARTED', 'COMPLETE', 'PAID'], default: 'STARTED' },
    version: { type: Number, default: 0 },
  },
  { 
    timestamps: true,
    optimisticConcurrency: true 
  }
);

// Index for totem state queries
TotemSessionSchema.index({ totem_id: 1, totem_state: 1 });

// Index for active sessions by state and time
TotemSessionSchema.index({ totem_state: 1, createdAt: -1 });

// Compound index for optimistic locking
TotemSessionSchema.index({ _id: 1, version: 1 });

export const TotemSession = model<ITotemSession>('TotemSession', TotemSessionSchema);

// Renombrar a ISessionCustomer para evitar conflicto con ICustomer de customer.model.ts
export interface ISessionCustomer extends Document {
  customer_name: string;
  session_id: Types.ObjectId;
}

const SessionCustomerSchema = new Schema<ISessionCustomer>(
  {
    customer_name: { type: String, required: true },
    session_id: { type: Schema.Types.ObjectId, ref: 'TotemSession', required: true },
  },
  { timestamps: true }
);

// Index for session-based customer lookups
SessionCustomerSchema.index({ session_id: 1 });

export const SessionCustomer = model<ISessionCustomer>('SessionCustomer', SessionCustomerSchema);
