/**
 * PaymentRequestSchema tests (discriminated union by payment_type)
 * - ALL always settles in a single ticket: `parts` must be absent or 1.
 * - BY_USER splits by customer and ignores `parts`: absent or 1.
 * - SHARED requires `parts` >= 2 (a real split).
 */

import { PaymentRequestSchema } from '../schemas/order.schema';

const SESSION_ID = '507f1f77bcf86cd799439011';

describe('PaymentRequestSchema discriminated union', () => {
  describe('ALL', () => {
    it('should accept ALL without parts', () => {
      const result = PaymentRequestSchema.safeParse({
        session_id: SESSION_ID,
        payment_type: 'ALL',
      });
      expect(result.success).toBe(true);
    });

    it('should accept ALL with parts = 1 (frontend default payload)', () => {
      const result = PaymentRequestSchema.safeParse({
        session_id: SESSION_ID,
        payment_type: 'ALL',
        parts: 1,
        tips: 10,
      });
      expect(result.success).toBe(true);
    });

    it('should reject ALL with parts > 1', () => {
      const result = PaymentRequestSchema.safeParse({
        session_id: SESSION_ID,
        payment_type: 'ALL',
        parts: 3,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('BY_USER', () => {
    it('should accept BY_USER without parts', () => {
      const result = PaymentRequestSchema.safeParse({
        session_id: SESSION_ID,
        payment_type: 'BY_USER',
      });
      expect(result.success).toBe(true);
    });

    it('should accept BY_USER with parts = 1', () => {
      const result = PaymentRequestSchema.safeParse({
        session_id: SESSION_ID,
        payment_type: 'BY_USER',
        parts: 1,
      });
      expect(result.success).toBe(true);
    });

    it('should reject BY_USER with parts > 1 (it is ignored)', () => {
      const result = PaymentRequestSchema.safeParse({
        session_id: SESSION_ID,
        payment_type: 'BY_USER',
        parts: 4,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('SHARED', () => {
    it('should reject SHARED without parts', () => {
      const result = PaymentRequestSchema.safeParse({
        session_id: SESSION_ID,
        payment_type: 'SHARED',
      });
      expect(result.success).toBe(false);
    });

    it('should reject SHARED with parts = 1', () => {
      const result = PaymentRequestSchema.safeParse({
        session_id: SESSION_ID,
        payment_type: 'SHARED',
        parts: 1,
      });
      expect(result.success).toBe(false);
    });

    it('should accept SHARED with parts >= 2', () => {
      const result = PaymentRequestSchema.safeParse({
        session_id: SESSION_ID,
        payment_type: 'SHARED',
        parts: 3,
      });
      expect(result.success).toBe(true);
    });

    it('should reject SHARED with parts above the limit', () => {
      const result = PaymentRequestSchema.safeParse({
        session_id: SESSION_ID,
        payment_type: 'SHARED',
        parts: 101,
      });
      expect(result.success).toBe(false);
    });
  });

  it('should reject an unknown payment_type', () => {
    const result = PaymentRequestSchema.safeParse({
      session_id: SESSION_ID,
      payment_type: 'SPLIT',
      parts: 2,
    });
    expect(result.success).toBe(false);
  });
});
