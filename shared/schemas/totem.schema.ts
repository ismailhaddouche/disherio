import { z } from 'zod';
import { RequestIdSchema } from './order.schema';
import { ObjectIdSchema } from './common.schema';

export const TotemSchema = z.object({
  restaurant_id: ObjectIdSchema,
  totem_name: z.string().min(1),
  totem_qr: z.string().optional(),
  totem_type: z.enum(['STANDARD', 'TEMPORARY']),
  totem_start_date: z.string().datetime().optional(),
}).strict();

// Socket payload schemas for totem events. Used by the backend to validate
// inbound socket data with Zod (parity with HTTP validation) and by the
// frontend to type emit payloads.
const objectIdString = ObjectIdSchema;

export const TotemJoinSessionPayloadSchema = z.object({
  sessionId: objectIdString,
  qr: z.string().min(1),
  customerName: z.string().trim().min(2).max(100).optional(),
  customerId: objectIdString.optional(),
  sessionToken: z.string().min(1).optional(),
}).strict();

export const TotemRequestBillPayloadSchema = z.object({
  sessionId: objectIdString,
  splitType: z.enum(['ALL', 'BY_USER', 'SHARED']).optional(),
}).strict();

export const TotemCallWaiterPayloadSchema = z.object({
  sessionId: objectIdString,
  tableId: objectIdString.optional(),
  message: z.string().max(500).optional(),
}).strict();

export const TotemSessionIdPayloadSchema = z.object({
  sessionId: objectIdString,
}).strict();

// ---------------------------------------------------------------------------
// HTTP request bodies for /api/totems routes (validated by the backend's
// `validate` middleware). Kept in shared because the frontend totem and TAS
// flows produce these payloads.
// ---------------------------------------------------------------------------

const objectIdHex = ObjectIdSchema;

export const TASAddItemPayloadSchema = z.object({
  requestId: RequestIdSchema,
  sessionId: objectIdHex,
  orderId: objectIdHex,
  dishId: objectIdHex,
  customerId: objectIdHex.optional(),
  variantId: objectIdHex.optional(),
  extras: z.array(objectIdHex).max(50).optional(),
}).strict();

export const TASRequestBillPayloadSchema = z.object({
  sessionId: objectIdHex,
  requestedBy: z.enum(['waiter', 'customer']),
  customerId: objectIdHex.optional(),
  splitType: z.enum(['ALL', 'BY_USER', 'SHARED']).optional(),
}).strict();

export const TASCallWaiterResponsePayloadSchema = z.object({
  sessionId: objectIdHex,
  customerId: objectIdHex.optional(),
  tableId: objectIdHex.optional(),
  acknowledged: z.boolean(),
  message: z.string().trim().max(500).optional(),
}).strict();

export const TASNotifyCustomersPayloadSchema = z.object({
  sessionId: objectIdHex,
  message: z.string().trim().min(1).max(500),
  type: z.enum(['info', 'warning', 'success']).optional(),
}).strict();

// Ephemeral per-session credential echoed back by the public totem client.
// Required for any session whose session_token has been back-filled.
export const SessionTokenFieldSchema = z.string().trim().max(200).optional();

export const CreateSessionCustomerBodySchema = z.object({
  customer_name: z.string().trim().min(2).max(100),
  session_token: SessionTokenFieldSchema,
}).strict();

export const CreateTotemBodySchema = z.object({
  totem_name: z.string().trim().min(1).max(100),
  totem_type: z.enum(['STANDARD', 'TEMPORARY']),
  totem_start_date: z.coerce.date().optional(),
}).strict();

// A totem's type is immutable after creation: allowing it in an update body
// would let TAS promote a TEMPORARY totem to STANDARD, because
// assertCanMutateTotem authorizes against the EXISTING type. Only the mutable
// display fields are accepted here.
export const UpdateTotemBodySchema = CreateTotemBodySchema.partial().omit({ totem_type: true });

export const PublicOrderBodySchema = z.object({
  request_id: RequestIdSchema,
  session_id: objectIdHex,
  customer_id: objectIdHex.optional(),
  session_token: SessionTokenFieldSchema,
  items: z.array(z.object({
    dishId: objectIdHex,
    quantity: z.number().int().min(1).max(50),
    variantId: objectIdHex.optional(),
    extras: z.array(objectIdHex).max(50).optional(),
  }).strict()).min(1).max(100),
}).strict().refine(
  ({ items }) => items.reduce((total, item) => total + item.quantity, 0) <= 100,
  { path: ['items'], message: 'Total item quantity cannot exceed 100' }
);
