import { z } from 'zod';
import { ObjectIdSchema, StaffPasswordSchema } from './common.schema';

export const RoleSchema = z.object({
  restaurant_id: ObjectIdSchema,
  role_name: z.string().trim().min(2).max(100),
  permissions: z.array(z.string().trim().min(1).max(100)).max(100),
}).strict();

// Schema for creating a new staff member (input validation)
// Includes plain password which gets hashed before storage
export const CreateStaffSchema = z.object({
  restaurant_id: ObjectIdSchema,
  role_id: ObjectIdSchema,
  staff_name: z.string().trim().min(2).max(100),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/, 'Username must be alphanumeric'),
  password: StaffPasswordSchema,
  language: z.enum(['es', 'en', 'fr']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
}).strict();

// Schema for updating staff (partial update)
export const UpdateStaffSchema = z.object({
  staff_name: z.string().trim().min(2).max(100).optional(),
  role_id: ObjectIdSchema.optional(),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/, 'Username must be alphanumeric').optional(),
  password: StaffPasswordSchema.optional(),
  language: z.enum(['es', 'en', 'fr']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
}).strict();

// Schema for updating preferences only
export const UpdatePreferencesSchema = z.object({
  language: z.enum(['es', 'en', 'fr']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
}).strict();
