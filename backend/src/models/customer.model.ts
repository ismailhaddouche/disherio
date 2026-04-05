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

// Unique compound index for customer email within a restaurant
// Allows same email in different restaurants, but unique within one restaurant
CustomerSchema.index({ restaurant_id: 1, customer_email: 1 }, { unique: true, sparse: true });

// Unique compound index for phone within a restaurant
CustomerSchema.index({ restaurant_id: 1, customer_phone: 1 }, { unique: true, sparse: true });

// Index for restaurant customer listings
CustomerSchema.index({ restaurant_id: 1, created_at: -1 });

// Compound index for name search within restaurant
CustomerSchema.index({ restaurant_id: 1, customer_name: 1 });

export const Customer = model<ICustomer>('Customer', CustomerSchema);
