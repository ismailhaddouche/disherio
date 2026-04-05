import { z } from 'zod';

export const RoleSchema = z.object({
  restaurant_id: z.string(),
  role_name: z.string().min(2),
  permissions: z.array(z.string()),
});

// Schema for creating a new staff member (input validation)
// Includes plain password and pin_code which get hashed before storage
export const CreateStaffSchema = z.object({
  restaurant_id: z.string(),
  role_id: z.string(),
  staff_name: z.string().min(2),
  username: z.string().min(3),
  password: z.string().min(6),
  pin_code: z.string().length(4).regex(/^\d{4}$/),
  language: z.enum(['es', 'en']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
});

// Schema for the stored staff member (database representation)
// Uses password_hash and pin_code_hash as stored in MongoDB
export const StaffSchema = z.object({
  restaurant_id: z.string(),
  role_id: z.string(),
  staff_name: z.string().min(2),
  username: z.string().min(3),
  password_hash: z.string(),
  pin_code_hash: z.string(),
  language: z.enum(['es', 'en']).nullable().optional(),
  theme: z.enum(['light', 'dark']).nullable().optional(),
});

// Schema for updating staff (partial update)
export const UpdateStaffSchema = z.object({
  staff_name: z.string().min(2).optional(),
  role_id: z.string().optional(),
  username: z.string().min(3).optional(),
  password: z.string().min(6).optional(),
  pin_code: z.string().length(4).regex(/^\d{4}$/).optional(),
  language: z.enum(['es', 'en']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
});

// Schema for updating preferences only
export const UpdatePreferencesSchema = z.object({
  language: z.enum(['es', 'en']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
});

// Schema for login with username/password
export const StaffLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// Schema for login with PIN
export const StaffPinSchema = z.object({
  pin_code: z.string().length(4).regex(/^\d{4}$/),
  restaurant_id: z.string(),
});
