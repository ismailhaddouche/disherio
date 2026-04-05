import { z } from 'zod';
import { LocalizedEntrySchema } from './localized-string.schema';

// Price validation helper - positive number with max limit
const priceValidation = z.number().positive().max(999999);

export const OrderSchema = z.object({
  session_id: z.string(),
  customer_id: z.string().optional(),
  staff_id: z.string().optional(),
  order_date: z.string().datetime().optional(),
});

const VariantSnapshotSchema = z.object({
  variant_id: z.string(),
  name: z.array(LocalizedEntrySchema),
  price: priceValidation,
}).nullable();

const ExtraSnapshotSchema = z.object({
  extra_id: z.string(),
  name: z.array(LocalizedEntrySchema),
  price: priceValidation,
});

export const ItemOrderSchema = z.object({
  order_id: z.string(),
  session_id: z.string(),
  item_dish_id: z.string(),
  customer_id: z.string().optional(),
  customer_name: z.string().optional(),
  item_state: z.enum(['ORDERED', 'ON_PREPARE', 'SERVED', 'CANCELED']).default('ORDERED'),
  item_disher_type: z.enum(['KITCHEN', 'SERVICE']),
  item_name_snapshot: z.array(LocalizedEntrySchema),
  item_base_price: priceValidation,
  item_disher_variant: VariantSnapshotSchema.optional().default(null),
  item_disher_extras: z.array(ExtraSnapshotSchema).default([]),
  version: z.number().default(0),  // Added for optimistic concurrency
});

// Alias para compatibilidad con backend
export const OrderItemSchema = ItemOrderSchema;

export const PaymentTicketSchema = z.object({
  ticket_id: z.string().optional(),
  ticket_part: z.number().int().min(1),
  ticket_total_parts: z.number().int().min(1),
  ticket_amount: priceValidation,
  ticket_customer_name: z.string().optional(),
  paid: z.boolean().default(false),  // Added - tracks if ticket is paid
});

export const PaymentSchema = z.object({
  session_id: z.string(),
  payment_type: z.enum(['ALL', 'BY_USER', 'SHARED']),
  payment_total: priceValidation,
  payment_date: z.string().datetime().optional(),
  tickets: z.array(PaymentTicketSchema).default([]),
});

// Schemas para validación de API (movidos desde backend)
export const CreateOrderSchema = OrderSchema.omit({ order_date: true });
export const UpdateOrderSchema = CreateOrderSchema.partial();

export const CreateItemOrderSchema = ItemOrderSchema.omit({ item_state: true });
export const UpdateItemStateSchema = z.object({
  item_id: z.string().min(1),
  new_state: z.enum(['ORDERED', 'ON_PREPARE', 'SERVED', 'CANCELED']),
});

export const CreatePaymentSchema = PaymentSchema.omit({ payment_date: true });

// Schema para agregar item a orden (API backend)
export const AddItemToOrderSchema = z.object({
  order_id: z.string().min(1),
  session_id: z.string().min(1),
  dish_id: z.string().min(1),
  customer_id: z.string().optional(),
  variant_id: z.string().optional(),
  extras: z.array(z.string()).default([]),
});

// Type exports
export type OrderItemInput = z.infer<typeof ItemOrderSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type AddItemToOrderInput = z.infer<typeof AddItemToOrderSchema>;
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
export type UpdateItemStateInput = z.infer<typeof UpdateItemStateSchema>;
