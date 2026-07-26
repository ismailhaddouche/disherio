import { describe, it, expect } from 'vitest';
import {
  OrderSchema,
  ItemOrderSchema,
  PaymentTicketSchema,
  PaymentSchema,
  CreateOrderSchema,
  CreateItemOrderSchema,
  AddItemToOrderSchema,
  IdempotentOrderRequestSchema,
  RequestIdSchema,
} from '../schemas/order.schema';

const VALID_UUID = '123e4567-e89b-42d3-a456-426614174000';

const validItemOrder = {
  order_id: 'order-1',
  session_id: 'session-1',
  item_dish_id: 'dish-1',
  item_disher_type: 'KITCHEN' as const,
  item_name_snapshot: [{ lang: 'es', value: 'Plato' }],
  item_base_price: 12.5,
};

describe('RequestIdSchema', () => {
  it('accepts a valid UUID and rejects invalid ones', () => {
    expect(RequestIdSchema.safeParse(VALID_UUID).success).toBe(true);
    expect(RequestIdSchema.safeParse('not-a-uuid').success).toBe(false);
    expect(RequestIdSchema.safeParse('').success).toBe(false);
  });
});

describe('OrderSchema', () => {
  it('accepts a minimal payload with only session_id', () => {
    expect(OrderSchema.safeParse({ session_id: 's1' }).success).toBe(true);
  });

  it('rejects a missing session_id', () => {
    expect(OrderSchema.safeParse({}).success).toBe(false);
  });

  it('validates order_number as a positive integer', () => {
    expect(OrderSchema.safeParse({ session_id: 's1', order_number: 1 }).success).toBe(true);
    expect(OrderSchema.safeParse({ session_id: 's1', order_number: 0 }).success).toBe(false);
    expect(OrderSchema.safeParse({ session_id: 's1', order_number: 1.5 }).success).toBe(false);
  });

  it('validates order_date as an ISO datetime string', () => {
    expect(
      OrderSchema.safeParse({ session_id: 's1', order_date: '2026-07-19T10:00:00.000Z' }).success
    ).toBe(true);
    expect(OrderSchema.safeParse({ session_id: 's1', order_date: '19/07/2026' }).success).toBe(
      false
    );
  });

  // Current behavior: OrderSchema is NOT .strict() (unlike CreateDishSchema
  // or CreateTotemSchema), so unknown keys are silently stripped, not
  // rejected. Pinned as-is.
  it('currently strips unknown keys instead of rejecting them (not .strict())', () => {
    const result = OrderSchema.safeParse({ session_id: 's1', unexpected: 'field' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ session_id: 's1' });
  });
});

describe('ItemOrderSchema', () => {
  it('applies defaults: item_state, variant, extras and version', () => {
    const result = ItemOrderSchema.safeParse(validItemOrder);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      item_state: 'ORDERED',
      item_disher_variant: null,
      item_disher_extras: [],
      // Current behavior: `version` exists in the schema with default 0 but
      // is absent from the ItemOrder interface in types/models.type.ts
      // (documented schema↔type drift).
      version: 0,
    });
  });

  it('accepts a zero base price but rejects negatives', () => {
    expect(ItemOrderSchema.safeParse({ ...validItemOrder, item_base_price: 0 }).success).toBe(true);
    expect(ItemOrderSchema.safeParse({ ...validItemOrder, item_base_price: -1 }).success).toBe(
      false
    );
    expect(
      ItemOrderSchema.safeParse({ ...validItemOrder, item_base_price: 1000000 }).success
    ).toBe(false);
  });

  it('rejects invalid item_state and item_disher_type', () => {
    expect(ItemOrderSchema.safeParse({ ...validItemOrder, item_state: 'DONE' }).success).toBe(
      false
    );
    expect(
      ItemOrderSchema.safeParse({ ...validItemOrder, item_disher_type: 'BAR' }).success
    ).toBe(false);
  });

  it('accepts an explicit variant snapshot or null', () => {
    const variant = {
      variant_id: 'v1',
      name: [{ lang: 'es', value: 'Grande' }],
      price: 2,
    };
    expect(
      ItemOrderSchema.safeParse({ ...validItemOrder, item_disher_variant: variant }).success
    ).toBe(true);
    expect(
      ItemOrderSchema.safeParse({ ...validItemOrder, item_disher_variant: null }).success
    ).toBe(true);
  });
});

describe('PaymentTicketSchema', () => {
  const validTicket = { ticket_part: 1, ticket_total_parts: 2, ticket_amount: 10 };

  it('accepts a valid ticket and defaults paid to false', () => {
    const result = PaymentTicketSchema.safeParse(validTicket);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ paid: false });
  });

  // Current behavior: ticket_amount uses `positive()` (strictly > 0) while
  // item prices use `min(0)`; a zero-amount ticket is rejected even though a
  // zero-price item is accepted. Pinned as-is.
  it('rejects a zero ticket_amount (positive, unlike item prices)', () => {
    expect(PaymentTicketSchema.safeParse({ ...validTicket, ticket_amount: 0 }).success).toBe(
      false
    );
    expect(PaymentTicketSchema.safeParse({ ...validTicket, ticket_amount: -5 }).success).toBe(
      false
    );
  });
});

describe('PaymentSchema', () => {
  it('accepts a valid payment and defaults tickets to []', () => {
    const result = PaymentSchema.safeParse({
      session_id: 's1',
      payment_type: 'ALL',
      payment_total: 25,
    });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ tickets: [] });
  });

  it('rejects unknown payment_type', () => {
    expect(
      PaymentSchema.safeParse({ session_id: 's1', payment_type: 'HALF', payment_total: 25 })
        .success
    ).toBe(false);
  });
});

describe('derived create schemas', () => {
  it('CreateOrderSchema omits order_date', () => {
    expect(CreateOrderSchema.safeParse({ session_id: 's1' }).success).toBe(true);
    // order_date is stripped (unknown key), not validated as datetime
    const result = CreateOrderSchema.safeParse({ session_id: 's1', order_date: 'garbage' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ session_id: 's1' });
  });

  it('CreateItemOrderSchema omits item_state', () => {
    const result = CreateItemOrderSchema.safeParse({ ...validItemOrder, item_state: 'SERVED' });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('item_state');
  });
});

describe('AddItemToOrderSchema', () => {
  it('requires non-empty ids and defaults extras to []', () => {
    const result = AddItemToOrderSchema.safeParse({
      order_id: 'o1',
      session_id: 's1',
      dish_id: 'd1',
    });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ extras: [] });
  });

  it('rejects empty ids', () => {
    expect(
      AddItemToOrderSchema.safeParse({ order_id: '', session_id: 's1', dish_id: 'd1' }).success
    ).toBe(false);
  });
});

describe('IdempotentOrderRequestSchema', () => {
  it('requires a UUID request_id', () => {
    expect(IdempotentOrderRequestSchema.safeParse({ request_id: VALID_UUID }).success).toBe(true);
    expect(IdempotentOrderRequestSchema.safeParse({ request_id: 'nope' }).success).toBe(false);
  });
});
