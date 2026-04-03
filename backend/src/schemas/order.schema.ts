// backend/src/schemas/order.schema.ts
// Re-exportar desde shared para mantener compatibilidad
export {
  OrderSchema,
  ItemOrderSchema,
  OrderItemSchema,
  PaymentSchema,
  PaymentTicketSchema,
  CreateOrderSchema,
  UpdateOrderSchema,
  CreateItemOrderSchema,
  UpdateItemStateSchema,
  CreatePaymentSchema,
  AddItemToOrderSchema,
  OrderItemInput,
  CreateOrderInput,
  AddItemToOrderInput,
  CreatePaymentInput,
  UpdateItemStateInput,
} from '@disherio/shared';
