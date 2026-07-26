import { describe, it, expect } from 'vitest';
import { LocalizedEntrySchema, LocalizedFieldSchema } from '../schemas/localized-string.schema';

describe('LocalizedEntrySchema', () => {
  it('accepts a well-formed entry', () => {
    const result = LocalizedEntrySchema.safeParse({ lang: 'es', value: 'Hola' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ lang: 'es', value: 'Hola' });
  });

  it('defaults value to an empty string', () => {
    const result = LocalizedEntrySchema.safeParse({ lang: 'en' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ lang: 'en', value: '' });
  });

  // Current behavior: lang is an unrestricted z.string() even though the
  // comment in the schema says it should be 'es' | 'en' | 'fr'. Pinned here
  // as-is; tightening it is a deliberate contract change.
  it('currently accepts any lang string (documented inconsistency)', () => {
    expect(LocalizedEntrySchema.safeParse({ lang: 'de', value: 'Hallo' }).success).toBe(true);
    expect(LocalizedEntrySchema.safeParse({ lang: '', value: 'x' }).success).toBe(true);
  });

  it('rejects non-string lang/value', () => {
    expect(LocalizedEntrySchema.safeParse({ lang: 1, value: 'x' }).success).toBe(false);
    expect(LocalizedEntrySchema.safeParse({ lang: 'es', value: 5 }).success).toBe(false);
  });
});

describe('LocalizedFieldSchema', () => {
  it('defaults to an empty array', () => {
    expect(LocalizedFieldSchema.parse(undefined)).toEqual([]);
  });

  it('validates every entry', () => {
    expect(
      LocalizedFieldSchema.safeParse([
        { lang: 'es', value: 'a' },
        { lang: 'en', value: 'b' },
      ]).success
    ).toBe(true);
    expect(LocalizedFieldSchema.safeParse([{ lang: 'es' }, { value: 'missing lang' }]).success).toBe(
      false
    );
  });
});
