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

export const Staff = model<IStaff>('Staff', StaffSchema);
