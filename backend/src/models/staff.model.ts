import { Schema, model, Document, Types } from 'mongoose';

export interface IRole extends Document {
  restaurant_id: Types.ObjectId;
  role_name: string;
  permissions: string[];
}

const RoleSchema = new Schema<IRole>(
  {
    restaurant_id: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    role_name: { type: String, required: true },
    permissions: [{ type: String }],
  },
  { timestamps: true }
);

// Index for restaurant role lookups
RoleSchema.index({ restaurant_id: 1 });

export const Role = model<IRole>('Role', RoleSchema);

export interface IStaff extends Document {
  restaurant_id: Types.ObjectId;
  role_id: Types.ObjectId;
  staff_name: string;
  username: string;
  password_hash: string;
  pin_code_hash: string;
  language?: 'es' | 'en';
  theme?: 'light' | 'dark';
}

const StaffSchema = new Schema<IStaff>(
  {
    restaurant_id: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    role_id: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    staff_name: { type: String, required: true },
    username: { type: String, required: true, lowercase: true },
    password_hash: { type: String, required: true },
    pin_code_hash: { type: String, required: true },
    language: { type: String, enum: ['es', 'en'], default: null },
    theme: { type: String, enum: ['light', 'dark'], default: null },
  },
  { timestamps: true }
);

// Index for efficient lookups by restaurant
StaffSchema.index({ restaurant_id: 1 });

// Unique username per restaurant
StaffSchema.index({ restaurant_id: 1, username: 1 }, { unique: true });

// Note: Index on pin_code_hash is intentionally NOT created
// because bcrypt generates different hashes for the same PIN due to salting.
// PIN authentication requires iterating through staff members of the restaurant.
// For restaurants with many staff, consider adding a PIN salt field for faster lookup.

export const Staff = model<IStaff>('Staff', StaffSchema);
