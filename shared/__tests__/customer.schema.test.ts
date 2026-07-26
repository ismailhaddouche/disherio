import { describe, it, expect } from 'vitest';
import { CreateCustomerBodySchema } from '../schemas/customer.schema';

describe('CreateCustomerBodySchema', () => {
  it('accepts a valid payload', () => {
    expect(
      CreateCustomerBodySchema.safeParse({
        session_id: '507f1f77bcf86cd799439011',
        customer_name: 'Ana',
      }).success
    ).toBe(true);
  });

  it('requires session_id as a 24-char hex ObjectId', () => {
    expect(
      CreateCustomerBodySchema.safeParse({ session_id: 'session-1', customer_name: 'Ana' }).success
    ).toBe(false);
    expect(
      CreateCustomerBodySchema.safeParse({
        session_id: '507F1F77BCF86CD799439011',
        customer_name: 'Ana',
      }).success
    ).toBe(true); // regex is case-insensitive
  });

  it('trims customer_name and bounds it to 2..100 chars', () => {
    const ok = CreateCustomerBodySchema.safeParse({
      session_id: '507f1f77bcf86cd799439011',
      customer_name: '  Bo  ',
    });
    expect(ok.success).toBe(true);
    expect(ok.data?.customer_name).toBe('Bo');
    expect(
      CreateCustomerBodySchema.safeParse({
        session_id: '507f1f77bcf86cd799439011',
        customer_name: 'A',
      }).success
    ).toBe(false);
  });
});
