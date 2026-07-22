import { z } from 'zod';

export const RoleSchema = z.object({
  restaurant_id: z.string(),
  role_name: z.string().trim().min(2).max(100),
  permissions: z.array(z.string().trim().min(1).max(100)).max(100),
});

// Schema for creating a new staff member (input validation)
// Includes plain password which gets hashed before storage
export const CreateStaffSchema = z.object({
  restaurant_id: z.string(),
  role_id: z.string(),
  staff_name: z.string().trim().min(2).max(100),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/, 'Username must be alphanumeric'),
  password: z.string().min(8).max(128),
  language: z.enum(['es', 'en', 'fr']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
});

// Schema for updating staff (partial update)
export const UpdateStaffSchema = z.object({
  staff_name: z.string().trim().min(2).max(100).optional(),
  role_id: z.string().optional(),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/, 'Username must be alphanumeric').optional(),
  password: z.string().min(8).max(128).optional(),
  language: z.enum(['es', 'en', 'fr']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
});

// Schema for updating preferences only
export const UpdatePreferencesSchema = z.object({
  language: z.enum(['es', 'en', 'fr']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
});
