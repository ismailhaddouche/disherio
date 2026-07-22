import { z } from 'zod';
import { ObjectIdSchema } from '@disherio/shared';

export const LoginSchema = z.object({
  username: z.string().min(2).max(50),
  // Login must remain compatible with legacy hashes; cap input to prevent
  // needless bcrypt work on attacker-controlled oversized strings.
  password: z.string().min(1).max(128),
  restaurant_id: ObjectIdSchema.optional(),
}).strict();
