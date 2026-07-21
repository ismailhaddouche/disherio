import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string().min(2).max(50),
  password: z.string().min(6),
  restaurant_id: z.string().optional(),
});
