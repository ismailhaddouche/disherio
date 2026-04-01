import { z } from 'zod';

// Price validation helper - positive number with max limit
const priceValidation = z.number().positive().max(999999);

// Schema for localized snapshot entries
const LocalizedSnapshotSchema = z.object({
  lang: z.string(),
  value: z.string().default(''),
});

// Schema for variant in order item
const ItemVariantSchema = z.object({
  variant_id: z.string(),
  name: z.array(LocalizedSnapshotSchema),
  price: priceValidation,
});

// Schema for extra in order item
const ItemExtraSchema = z.object({
  extra_id: z.string(),
  name: z.array(LocalizedSnapshotSchema),
  price: priceValidation,
});

// Schema for order item
export const OrderItemSchema = z.object({
  order_id: z.string().min(1),
  session_id: z.string().min(1),
  item_dish_id: z.string().min(1),
  customer_id: z.string().optional(),
  customer_name: z.string().optional(),
  item_state: z.enum(['ORDERED', 'ON_PREPARE', 'SERVED', 'CANCELED']).default('ORDERED'),
  item_disher_type: z.enum(['KITCHEN', 'SERVICE']),
  item_name_snapshot: z.array(LocalizedSnapshotSchema),
  item_base_price: priceValidation,
  item_disher_variant: ItemVariantSchema.nullable().optional(),
  item_disher_extras: z.array(ItemExtraSchema).default([]),
});

// Schema for creating an order
export const CreateOrderSchema = z.object({
  session_id: z.string().min(1),
  staff_id: z.string().optional(),
  customer_id: z.string().optional(),
});

// Schema for adding item to order
export const AddItemToOrderSchema = z.object({
  order_id: z.string().min(1),
  session_id: z.string().min(1),
  dish_id: z.string().min(1),
  customer_id: z.string().optional(),
  variant_id: z.string().optional(),
  extras: z.array(z.string()).default([]),
});

// Schema for payment ticket
const TicketSchema = z.object({
  ticket_part: z.number().int().positive(),
  ticket_total_parts: z.number().int().positive(),
  ticket_amount: priceValidation,
  ticket_customer_name: z.string().optional(),
  paid: z.boolean().default(false),
});

// Schema for creating a payment
export const CreatePaymentSchema = z.object({
  session_id: z.string().min(1),
  payment_type: z.enum(['ALL', 'BY_USER', 'SHARED']),
  payment_total: priceValidation,
  tickets: z.array(TicketSchema),
});

// Schema for updating item state
export const UpdateItemStateSchema = z.object({
  item_id: z.string().min(1),
  new_state: z.enum(['ORDERED', 'ON_PREPARE', 'SERVED', 'CANCELED']),
});

// Type exports
export type OrderItemInput = z.infer<typeof OrderItemSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type AddItemToOrderInput = z.infer<typeof AddItemToOrderSchema>;
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
export type UpdateItemStateInput = z.infer<typeof UpdateItemStateSchema>;
