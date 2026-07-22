import { Schema, model, Document, Types } from 'mongoose';

// Localized field snapshot: array of { lang, value } where lang is an app
// language code ('es' | 'en' | 'fr') captured at order time.
const LocalizedFieldSnapshotSchema = [
  {
    lang: { type: String, required: true },
    value: { type: String, default: '' },
    _id: false,
  },
];

export interface IOrder extends Document {
  session_id: Types.ObjectId;
  customer_id?: Types.ObjectId;
  staff_id?: Types.ObjectId;
  order_number: number;
  order_date: Date;
  request_id?: string;
  request_hash?: string;
}

const OrderSchema = new Schema<IOrder>(
  {
    session_id: { type: Schema.Types.ObjectId, ref: 'TotemSession', required: true },
    customer_id: { type: Schema.Types.ObjectId, ref: 'Customer' },
    staff_id: { type: Schema.Types.ObjectId, ref: 'Staff' },
    order_number: { type: Number, required: true, min: 1 },
    order_date: { type: Date, default: Date.now },
    request_id: { type: String },
    request_hash: { type: String, select: false },
  },
  { timestamps: true }
);

// Index for session-based queries with sorting
OrderSchema.index({ session_id: 1, order_date: -1 });
OrderSchema.index(
  { session_id: 1, order_number: 1 },
  { unique: true, partialFilterExpression: { order_number: { $exists: true } } }
);
OrderSchema.index(
  { session_id: 1, request_id: 1 },
  { unique: true, partialFilterExpression: { request_id: { $type: 'string' } } }
);

// Index for customer order history
OrderSchema.index({ customer_id: 1, order_date: -1 });

// Index for staff order queries
OrderSchema.index({ staff_id: 1, order_date: -1 });

// Compound index for date range queries
OrderSchema.index({ order_date: -1 });

// Note: Removed redundant indexes on { _id: 1, session_id: 1 } and { session_id: 1, _id: 1 }
// _id is already the primary key and MongoDB automatically indexes it.

export const Order = model<IOrder>('Order', OrderSchema);

export interface ILocalizedSnapshot {
  lang: string;
  value: string;
}

export interface IItemOrder extends Document {
  order_id: Types.ObjectId;
  session_id: Types.ObjectId;
  item_dish_id: Types.ObjectId;
  customer_id?: Types.ObjectId;
  customer_name?: string;
  last_activity_source?: 'KDS' | 'POS' | 'TAS' | 'CUSTOMER';
  last_activity_user_id?: Types.ObjectId;
  order_number?: number;
  item_state: 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED';
  item_disher_type: 'KITCHEN' | 'SERVICE';
  item_name_snapshot: ILocalizedSnapshot[];
  item_base_price: number;
  item_disher_variant?: { variant_id: string; name: ILocalizedSnapshot[]; price: number } | null;
  item_disher_extras: { extra_id: string; name: ILocalizedSnapshot[]; price: number }[];
  unlimited_order_item: boolean;
  batch_id?: string;
  request_id?: string;
  request_hash?: string;
  version: number;
}

const ItemOrderSchema = new Schema<IItemOrder>(
  {
    order_id: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    session_id: { type: Schema.Types.ObjectId, ref: 'TotemSession', required: true, index: true },
    item_dish_id: { type: Schema.Types.ObjectId, ref: 'Dish', required: true, index: true },
    customer_id: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
    customer_name: String,
    last_activity_source: {
      type: String,
      enum: ['KDS', 'POS', 'TAS', 'CUSTOMER'],
    },
    last_activity_user_id: { type: Schema.Types.ObjectId },
    order_number: { type: Number, min: 1, index: true },
    item_state: {
      type: String,
      enum: ['ORDERED', 'ON_PREPARE', 'SERVED', 'CANCELED'],
      default: 'ORDERED',
      index: true,
    },
    item_disher_type: { type: String, enum: ['KITCHEN', 'SERVICE'], required: true, index: true },
    item_name_snapshot: LocalizedFieldSnapshotSchema,
    item_base_price: { type: Number, required: true, min: 0 },
    item_disher_variant: {
      variant_id: String,
      name: LocalizedFieldSnapshotSchema,
      price: Number,
    },
    item_disher_extras: [
      {
        extra_id: String,
        name: LocalizedFieldSnapshotSchema,
        price: Number,
      },
    ],
    unlimited_order_item: { type: Boolean, default: false, index: true },
    batch_id: { type: String, index: true },
    request_id: { type: String },
    request_hash: { type: String, select: false },
    version: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    optimisticConcurrency: true
  }
);

// Compound index for kitchen queries
ItemOrderSchema.index({ session_id: 1, item_disher_type: 1, item_state: 1 });

// Index for order lookups with items
ItemOrderSchema.index({ order_id: 1, item_state: 1 });

// Index for customer item queries
ItemOrderSchema.index({ customer_id: 1, createdAt: -1 });

// Compound index for KDS queries with time sorting
ItemOrderSchema.index({ item_disher_type: 1, item_state: 1, createdAt: 1 });

// Index for active items by session
ItemOrderSchema.index({ session_id: 1, item_state: 1, createdAt: 1 });
ItemOrderSchema.index({ session_id: 1, unlimited_order_item: 1, order_id: 1 });
ItemOrderSchema.index(
  { session_id: 1, request_id: 1 },
  { unique: true, partialFilterExpression: { request_id: { $type: 'string' } } }
);
ItemOrderSchema.index({ last_activity_source: 1, updatedAt: -1 });
ItemOrderSchema.index({ last_activity_user_id: 1, updatedAt: -1 });

// Index for dish sales aggregation and revenue calculations
ItemOrderSchema.index({ item_dish_id: 1, item_state: 1, createdAt: -1 });

// Compound index for optimistic locking
ItemOrderSchema.index({ _id: 1, version: 1 });

export const ItemOrder = model<IItemOrder>('ItemOrder', ItemOrderSchema);

export interface IPayment extends Document {
  session_id: Types.ObjectId;
  restaurant_id: Types.ObjectId;
  totem_snapshot: {
    totem_id: Types.ObjectId;
    totem_name: string;
    totem_type: 'STANDARD' | 'TEMPORARY';
  };
  payment_type: 'ALL' | 'BY_USER' | 'SHARED';
  payment_total: number;
  payment_date: Date;
  tickets: {
    ticket_id?: Types.ObjectId;
    ticket_part: number;
    ticket_total_parts: number;
    ticket_amount: number;
    ticket_customer_name?: string;
    paid: boolean;
  }[];
}

const PaymentSchema = new Schema<IPayment>(
  {
    session_id: { type: Schema.Types.ObjectId, ref: 'TotemSession', required: true },
    restaurant_id: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    totem_snapshot: {
      totem_id: { type: Schema.Types.ObjectId, required: true },
      totem_name: { type: String, required: true },
      totem_type: { type: String, enum: ['STANDARD', 'TEMPORARY'], required: true },
    },
    payment_type: { type: String, enum: ['ALL', 'BY_USER', 'SHARED'], required: true },
    payment_total: { type: Number, required: true, min: 0 },
    payment_date: { type: Date, default: Date.now },
    tickets: [
      {
        ticket_part: { type: Number, required: true },
        ticket_total_parts: { type: Number, required: true },
        ticket_amount: { type: Number, required: true, min: 0 },
        ticket_customer_name: String,
        paid: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

// Unique index enforcing at most one Payment per session at the DB level. This
// is the definitive guard against concurrent createPayment races: a second
// insert for the same session_id aborts with a duplicate-key error. The
// application-level pre-check in OrderService.createPayment surfaces a clean
// ORDER_ALREADY_PAID error code for the common single-request case.
// The service also creates the payment and transitions/validates the session
// as COMPLETE in the same MongoDB transaction.
PaymentSchema.index({ session_id: 1 }, { unique: true });

PaymentSchema.index({ restaurant_id: 1, payment_date: -1 });
PaymentSchema.index({ payment_date: -1 });

export const Payment = model<IPayment>('Payment', PaymentSchema);
