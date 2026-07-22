// backend/src/schemas/order.schema.ts
// Re-export from shared for compatibility
import { z } from 'zod';
import { RequestIdSchema } from '@disherio/shared';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
export const CreateOrderRequestSchema = z.object({ session_id: objectId });
export const AddItemRequestSchema = z.object({
  request_id: RequestIdSchema,
  order_id: objectId,
  session_id: objectId,
  dish_id: objectId,
  customer_id: objectId.optional(),
  variant_id: objectId.optional(),
  extras: z.array(objectId).max(50).optional(),
});
export const BatchItemsRequestSchema = z.object({
  request_id: RequestIdSchema,
  session_id: objectId,
  as_served: z.boolean().optional(),
  items: z.array(z.object({
    dishId: objectId,
    quantity: z.number().int().min(1).max(50),
    customerId: objectId.optional(),
    variantId: objectId.optional(),
    extras: z.array(objectId).max(50).optional(),
  })).min(1).max(100),
}).refine(
  ({ items }) => items.reduce((total, item) => total + item.quantity, 0) <= 100,
  { path: ['items'], message: 'Total item quantity cannot exceed 100' }
);
export const ItemStateRequestSchema = z.object({ state: z.enum(['ORDERED', 'ON_PREPARE', 'SERVED', 'CANCELED']) });
export const AssignItemRequestSchema = z.object({ customer_id: objectId.nullable() });
// `parts` only has meaning for SHARED payments: ALL always settles in a
// single ticket and BY_USER splits by customer, ignoring `parts`. The
// frontend sends `parts: 1` for ALL/BY_USER, so a literal 1 stays valid.
const paymentBaseFields = {
  session_id: objectId,
  tips: z.number().min(0).max(999999).optional(),
};
export const PaymentRequestSchema = z.discriminatedUnion('payment_type', [
  z.object({ ...paymentBaseFields, payment_type: z.literal('ALL'), parts: z.literal(1).optional() }),
  z.object({ ...paymentBaseFields, payment_type: z.literal('BY_USER'), parts: z.literal(1).optional() }),
  z.object({
    ...paymentBaseFields,
    payment_type: z.literal('SHARED'),
    parts: z.number().int().min(2).max(100),
  }),
]);
export const TicketRequestSchema = z.object({ ticket_part: z.number().int().min(1) });

export const PaymentHistoryQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  search: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(300).optional(),
});

export {
  OrderSchema,
  ItemOrderSchema,
  PaymentSchema,
  PaymentTicketSchema,
  CreatePaymentSchema,
  RequestIdSchema,
} from '@disherio/shared';
