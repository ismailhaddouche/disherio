import { z } from 'zod';

/** Body of POST /api/customers (staff creating a customer in an active session). */
export const CreateCustomerBodySchema = z.object({
  session_id: z.string().regex(/^[a-f\d]{24}$/i),
  customer_name: z.string().trim().min(2).max(100),
}).strict();
