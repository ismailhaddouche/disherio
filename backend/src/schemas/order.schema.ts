// backend/src/schemas/order.schema.ts
// Re-export from shared for compatibility
import { z } from 'zod';
import { RequestIdSchema } from '@disherio/shared';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
export const CreateOrderRequestSchema = z.object({ session_id: objectId });
export const AddItemRequestSchema = z.object({
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
});
export const ItemStateRequestSchema = z.object({ state: z.enum(['ORDERED', 'ON_PREPARE', 'SERVED', 'CANCELED']) });
export const AssignItemRequestSchema = z.object({ customer_id: objectId.nullable() });
export const PaymentRequestSchema = z.object({
  session_id: objectId,
  payment_type: z.enum(['ALL', 'BY_USER', 'SHARED']),
  parts: z.number().int().min(1).max(100).optional(),
  tips: z.number().min(0).max(999999).optional(),
});
export const TicketRequestSchema = z.object({ ticket_part: z.number().int().min(1) });

export {
  OrderSchema,
  ItemOrderSchema,
  PaymentSchema,
  PaymentTicketSchema,
  CreateOrderSchema,
  UpdateOrderSchema,
  CreateItemOrderSchema,
  CreatePaymentSchema,
  AddItemToOrderSchema,
  OrderItemInput,
  CreateOrderInput,
  AddItemToOrderInput,
  CreatePaymentInput,
  RequestIdSchema,
  IdempotentOrderRequestSchema,
  IdempotentOrderRequest,
} from '@disherio/shared';
