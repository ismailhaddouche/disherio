import { z } from 'zod';
import { LocalizedEntrySchema } from './localized-string.schema';
import { ObjectIdSchema } from './common.schema';

const itemPriceValidation = z.number().min(0).max(999999);
const paymentPriceValidation = z.number().positive().max(999999);
export const RequestIdSchema = z.string().uuid();

export const OrderSchema = z.object({
  session_id: ObjectIdSchema,
  customer_id: ObjectIdSchema.optional(),
  staff_id: ObjectIdSchema.optional(),
  order_number: z.number().int().min(1).optional(),
  order_date: z.string().datetime().optional(),
  request_id: RequestIdSchema.optional(),
}).strict();

const VariantSnapshotSchema = z.object({
  variant_id: ObjectIdSchema,
  name: z.array(LocalizedEntrySchema),
  price: itemPriceValidation,
}).strict().nullable();

const ExtraSnapshotSchema = z.object({
  extra_id: ObjectIdSchema,
  name: z.array(LocalizedEntrySchema),
  price: itemPriceValidation,
}).strict();

export const ItemOrderSchema = z.object({
  order_id: ObjectIdSchema,
  session_id: ObjectIdSchema,
  item_dish_id: ObjectIdSchema,
  customer_id: ObjectIdSchema.optional(),
  customer_name: z.string().optional(),
  order_number: z.number().int().min(1).optional(),
  item_state: z.enum(['ORDERED', 'ON_PREPARE', 'SERVED', 'CANCELED']).default('ORDERED'),
  item_disher_type: z.enum(['KITCHEN', 'SERVICE']),
  item_name_snapshot: z.array(LocalizedEntrySchema),
  item_base_price: itemPriceValidation,
  item_disher_variant: VariantSnapshotSchema.optional().default(null),
  item_disher_extras: z.array(ExtraSnapshotSchema).max(50).default([]),
  version: z.number().default(0),  // Added for optimistic concurrency
}).strict();

export const PaymentTicketSchema = z.object({
  ticket_id: ObjectIdSchema.optional(),
  ticket_part: z.number().int().min(1),
  ticket_total_parts: z.number().int().min(1),
  ticket_amount: paymentPriceValidation,
  ticket_customer_name: z.string().optional(),
  paid: z.boolean().default(false),  // Added - tracks if ticket is paid
}).strict();

export const PaymentSchema = z.object({
  session_id: ObjectIdSchema,
  payment_type: z.enum(['ALL', 'BY_USER', 'SHARED']),
  payment_total: paymentPriceValidation,
  payment_date: z.string().datetime().optional(),
  tickets: z.array(PaymentTicketSchema).max(100).default([]),
}).strict();

// API validation schemas shared with the backend.
export const CreatePaymentSchema = PaymentSchema.omit({ payment_date: true });

