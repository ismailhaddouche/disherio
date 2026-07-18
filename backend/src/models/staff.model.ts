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
  pin_lookup?: string;
  auth_version: number;
  language?: 'es' | 'en' | 'fr';
  theme?: 'light' | 'dark';
}

const StaffSchema = new Schema<IStaff>(
  {
    restaurant_id: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    role_id: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    staff_name: { type: String, required: true },
    username: { type: String, required: true, lowercase: true },
    password_hash: { type: String, required: true, select: false },
    pin_code_hash: { type: String, required: true, select: false },
    // Deterministic HMAC-SHA256 of the PIN with PIN_LOOKUP_PEPPER. Optional
    // because documents created before this field exist are migrated
    // opportunistically on their next successful PIN login.
    pin_lookup: { type: String, select: false },
    auth_version: { type: Number, default: 0, min: 0, select: false },
    language: { type: String, enum: ['es', 'en', 'fr'], default: null },
    theme: { type: String, enum: ['light', 'dark'], default: null },
  },
  { timestamps: true }
);

// Index for efficient lookups by restaurant
StaffSchema.index({ restaurant_id: 1 });

// Unique username per restaurant
StaffSchema.index({ restaurant_id: 1, username: 1 }, { unique: true });

// A PIN identifies exactly one staff member inside a restaurant. Legacy
// documents without pin_lookup are excluded until they are migrated.
StaffSchema.index(
  { restaurant_id: 1, pin_lookup: 1 },
  {
    unique: true,
    partialFilterExpression: { pin_lookup: { $type: 'string' } },
  }
);

export const Staff = model<IStaff>('Staff', StaffSchema);
