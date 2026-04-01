import { Schema, model, Document, Types } from 'mongoose';

export interface ICustomer extends Document {
  restaurant_id: Types.ObjectId;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  created_at: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    restaurant_id: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    customer_name: { type: String, required: true },
    customer_email: { type: String },
    customer_phone: { type: String },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

// Unique index for customer email (when provided)
CustomerSchema.index({ customer_email: 1 }, { unique: true, sparse: true });

// Index for phone lookups
CustomerSchema.index({ customer_phone: 1 }, { sparse: true });

// Index for restaurant customer listings
CustomerSchema.index({ restaurant_id: 1, created_at: -1 });

// Compound index for name search within restaurant
CustomerSchema.index({ restaurant_id: 1, customer_name: 1 });

export const Customer = model<ICustomer>('Customer', CustomerSchema);
