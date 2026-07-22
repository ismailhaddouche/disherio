import { z } from 'zod';

export const ObjectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

// Creation/reset policy. Login remains compatible with existing credentials;
// this policy applies only when a new bcrypt hash is produced.
export const StaffPasswordSchema = z.string().min(12).max(72);
