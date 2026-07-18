import { z } from 'zod';

export const TotemSchema = z.object({
  restaurant_id: z.string(),
  totem_name: z.string().min(1),
  totem_qr: z.string().optional(),
  totem_type: z.enum(['STANDARD', 'TEMPORARY']),
  totem_start_date: z.string().datetime().optional(),
});

export const CreateTotemSchema = TotemSchema.partial({ totem_qr: true }).strict();
export const UpdateTotemSchema = TotemSchema.partial().strict();

export const TotemSessionSchema = z.object({
  totem_id: z.string(),
  session_date_start: z.string().datetime().optional(),
  totem_state: z.enum(['STARTED', 'COMPLETE', 'PAID', 'CANCELLED']).default('STARTED'),
  // Ephemeral per-session credential required to join a session room and to
  // emit totem socket events. Back-filled on legacy sessions on first access.
  session_token: z.string().optional(),
  version: z.number().default(0),  // Added for optimistic concurrency
});

// Socket payload schemas for totem events. Used by the backend to validate
// inbound socket data with Zod (parity with HTTP validation) and by the
// frontend to type emit payloads.
const objectIdString = z.string().min(1);

export const TotemJoinSessionPayloadSchema = z.object({
  sessionId: objectIdString,
  qr: z.string().min(1),
  customerName: z.string().trim().min(2).max(100).optional(),
  customerId: objectIdString.optional(),
  sessionToken: z.string().min(1).optional(),
});

export const TotemRequestBillPayloadSchema = z.object({
  sessionId: objectIdString,
  splitType: z.enum(['ALL', 'BY_USER', 'SHARED']).optional(),
}).strict();

export const TotemCallWaiterPayloadSchema = z.object({
  sessionId: objectIdString,
  tableId: z.string().optional(),
  message: z.string().max(500).optional(),
}).strict();

export const TotemSessionIdPayloadSchema = z.object({
  sessionId: objectIdString,
});

// Schema for creating a session customer
export const SessionCustomerSchema = z.object({
  customer_name: z.string().min(1),
  session_id: z.string(),
  restaurant_id: z.string(),  // Added to link customer to restaurant
});
