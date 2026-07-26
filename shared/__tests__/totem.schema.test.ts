import { describe, it, expect } from 'vitest';
import {
  TotemSchema,
  CreateTotemSchema,
  UpdateTotemSchema,
  TotemSessionSchema,
  TotemJoinSessionPayloadSchema,
  TotemRequestBillPayloadSchema,
  TotemCallWaiterPayloadSchema,
  SessionCustomerSchema,
  CreateSessionCustomerBodySchema,
  CreateTotemBodySchema,
  UpdateTotemBodySchema,
  PublicOrderBodySchema,
  SessionTokenFieldSchema,
} from '../schemas/totem.schema';

const HEX_24 = '507f1f77bcf86cd799439011';
const VALID_UUID = '123e4567-e89b-42d3-a456-426614174000';

describe('TotemSchema / CreateTotemSchema / UpdateTotemSchema', () => {
  const validTotem = { restaurant_id: 'r1', totem_name: 'Mesa 1', totem_type: 'STANDARD' };

  it('accepts a valid totem', () => {
    expect(TotemSchema.safeParse(validTotem).success).toBe(true);
  });

  it('rejects an empty totem_name and unknown totem_type', () => {
    expect(TotemSchema.safeParse({ ...validTotem, totem_name: '' }).success).toBe(false);
    expect(TotemSchema.safeParse({ ...validTotem, totem_type: 'VIP' }).success).toBe(false);
  });

  it('CreateTotemSchema is .strict(): rejects unknown keys', () => {
    expect(CreateTotemSchema.safeParse(validTotem).success).toBe(true);
    expect(CreateTotemSchema.safeParse({ ...validTotem, extra: 'x' }).success).toBe(false);
  });

  it('UpdateTotemSchema is partial and .strict()', () => {
    expect(UpdateTotemSchema.safeParse({}).success).toBe(true);
    expect(UpdateTotemSchema.safeParse({ totem_name: 'Mesa 2' }).success).toBe(true);
    expect(UpdateTotemSchema.safeParse({ extra: 'x' }).success).toBe(false);
  });
});

describe('TotemSessionSchema', () => {
  it('defaults totem_state to STARTED and version to 0', () => {
    const result = TotemSessionSchema.safeParse({ totem_id: 't1' });
    expect(result.success).toBe(true);
    // Current behavior: `version` exists in the schema with default 0 but is
    // absent from the TotemSession interface in types/models.type.ts
    // (documented schema↔type drift).
    expect(result.data).toMatchObject({ totem_state: 'STARTED', version: 0 });
  });

  it('rejects unknown totem_state', () => {
    expect(TotemSessionSchema.safeParse({ totem_id: 't1', totem_state: 'OPEN' }).success).toBe(
      false
    );
  });
});

describe('totem socket payload schemas', () => {
  // Current behavior: the socket payloads use objectIdString = min(1), which
  // accepts any non-empty string, while the HTTP bodies use objectIdHex (24
  // hex chars). The two "ObjectId" validators are inconsistent; pinned as-is.
  it('TotemJoinSessionPayloadSchema accepts any non-empty sessionId (min(1), not hex)', () => {
    const result = TotemJoinSessionPayloadSchema.safeParse({
      sessionId: 'not-a-real-objectid',
      qr: 'qr-token',
    });
    expect(result.success).toBe(true);
  });

  it('TotemJoinSessionPayloadSchema trims and bounds customerName', () => {
    const ok = TotemJoinSessionPayloadSchema.safeParse({
      sessionId: 's1',
      qr: 'q',
      customerName: '  Ana  ',
    });
    expect(ok.success).toBe(true);
    expect(ok.data?.customerName).toBe('Ana');
    expect(
      TotemJoinSessionPayloadSchema.safeParse({ sessionId: 's1', qr: 'q', customerName: 'A' })
        .success
    ).toBe(false);
  });

  it('TotemRequestBillPayloadSchema is .strict()', () => {
    expect(TotemRequestBillPayloadSchema.safeParse({ sessionId: 's1' }).success).toBe(true);
    expect(
      TotemRequestBillPayloadSchema.safeParse({ sessionId: 's1', splitType: 'SHARED' }).success
    ).toBe(true);
    expect(
      TotemRequestBillPayloadSchema.safeParse({ sessionId: 's1', hacker: true }).success
    ).toBe(false);
  });

  it('TotemCallWaiterPayloadSchema bounds message length', () => {
    expect(
      TotemCallWaiterPayloadSchema.safeParse({ sessionId: 's1', message: 'x'.repeat(500) })
        .success
    ).toBe(true);
    expect(
      TotemCallWaiterPayloadSchema.safeParse({ sessionId: 's1', message: 'x'.repeat(501) })
        .success
    ).toBe(false);
  });
});

describe('SessionCustomerSchema', () => {
  it('requires name, session and restaurant', () => {
    expect(
      SessionCustomerSchema.safeParse({
        customer_name: 'Ana',
        session_id: 's1',
        restaurant_id: 'r1',
      }).success
    ).toBe(true);
    expect(SessionCustomerSchema.safeParse({ customer_name: 'Ana', session_id: 's1' }).success).toBe(
      false
    );
  });
});

describe('HTTP body schemas', () => {
  it('SessionTokenFieldSchema trims and caps at 200 chars, optional', () => {
    expect(SessionTokenFieldSchema.safeParse(undefined).success).toBe(true);
    expect(SessionTokenFieldSchema.parse('  tok  ')).toBe('tok');
    expect(SessionTokenFieldSchema.safeParse('x'.repeat(201)).success).toBe(false);
  });

  it('CreateSessionCustomerBodySchema trims customer_name (2..100)', () => {
    const ok = CreateSessionCustomerBodySchema.safeParse({ customer_name: '  Ana  ' });
    expect(ok.success).toBe(true);
    expect(ok.data?.customer_name).toBe('Ana');
    expect(CreateSessionCustomerBodySchema.safeParse({ customer_name: 'A' }).success).toBe(false);
  });

  it('CreateTotemBodySchema coerces totem_start_date to a Date', () => {
    const result = CreateTotemBodySchema.safeParse({
      totem_name: 'Mesa 1',
      totem_type: 'TEMPORARY',
      totem_start_date: '2026-07-19T10:00:00.000Z',
    });
    expect(result.success).toBe(true);
    expect(result.data?.totem_start_date).toBeInstanceOf(Date);
  });

  // Current behavior: UpdateTotemBodySchema omits totem_type but is NOT
  // .strict(), so a totem_type key is silently stripped instead of rejected,
  // even though the schema comment stresses type immutability. Pinned as-is.
  it('UpdateTotemBodySchema strips totem_type instead of rejecting it', () => {
    const result = UpdateTotemBodySchema.safeParse({ totem_type: 'STANDARD', totem_name: 'M' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ totem_name: 'M' });
  });
});

describe('PublicOrderBodySchema', () => {
  const validBody = {
    request_id: VALID_UUID,
    session_id: HEX_24,
    items: [{ dishId: HEX_24, quantity: 2 }],
  };

  it('accepts a valid public order', () => {
    expect(PublicOrderBodySchema.safeParse(validBody).success).toBe(true);
  });

  it('requires 24-hex ObjectId strings for session_id and dishId', () => {
    expect(PublicOrderBodySchema.safeParse({ ...validBody, session_id: 'abc' }).success).toBe(
      false
    );
    expect(
      PublicOrderBodySchema.safeParse({ ...validBody, items: [{ dishId: 'abc', quantity: 1 }] })
        .success
    ).toBe(false);
  });

  it('bounds quantity (1..50) and items length (1..100)', () => {
    expect(
      PublicOrderBodySchema.safeParse({ ...validBody, items: [{ dishId: HEX_24, quantity: 0 }] })
        .success
    ).toBe(false);
    expect(
      PublicOrderBodySchema.safeParse({ ...validBody, items: [{ dishId: HEX_24, quantity: 51 }] })
        .success
    ).toBe(false);
    expect(PublicOrderBodySchema.safeParse({ ...validBody, items: [] }).success).toBe(false);
  });
});
