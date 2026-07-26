import { describe, it, expect } from 'vitest';
import { RestaurantSchema, SocialLinksSchema, PrinterSchema } from '../schemas/restaurant.schema';

const validRestaurant = {
  restaurant_name: 'Mi Restaurante',
  tax_rate: 10,
};

describe('RestaurantSchema', () => {
  it('applies defaults on a minimal valid payload', () => {
    const result = RestaurantSchema.safeParse(validRestaurant);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      tips_state: false,
      default_language: 'es',
      default_theme: 'light',
      currency: 'EUR',
      order_interval_minutes: 0,
      max_orders_per_session: 0,
    });
  });

  it('requires restaurant_name of at least 2 chars and tax_rate within 0..100', () => {
    expect(RestaurantSchema.safeParse({ ...validRestaurant, restaurant_name: 'A' }).success).toBe(
      false
    );
    expect(RestaurantSchema.safeParse({ ...validRestaurant, tax_rate: -1 }).success).toBe(false);
    expect(RestaurantSchema.safeParse({ ...validRestaurant, tax_rate: 101 }).success).toBe(false);
  });

  it('validates tips_type/tips_rate when provided', () => {
    expect(
      RestaurantSchema.safeParse({ ...validRestaurant, tips_type: 'MANDATORY', tips_rate: 5 })
        .success
    ).toBe(true);
    expect(RestaurantSchema.safeParse({ ...validRestaurant, tips_type: 'FORCED' }).success).toBe(
      false
    );
    expect(RestaurantSchema.safeParse({ ...validRestaurant, tips_rate: 150 }).success).toBe(false);
  });

  it('restricts default_language and enabled_languages to es/en/fr', () => {
    expect(RestaurantSchema.safeParse({ ...validRestaurant, default_language: 'de' }).success).toBe(
      false
    );
    expect(
      RestaurantSchema.safeParse({ ...validRestaurant, enabled_languages: ['es', 'en', 'fr'] })
        .success
    ).toBe(true);
    expect(
      RestaurantSchema.safeParse({ ...validRestaurant, enabled_languages: ['es', 'de'] }).success
    ).toBe(false);
  });

  // Current behavior: RestaurantSchema itself is NOT .strict() — the
  // .strict() is applied by the backend on PATCH routes. Unknown keys are
  // stripped here, not rejected. Pinned as-is.
  it('currently strips unknown keys (schema itself is not .strict())', () => {
    const result = RestaurantSchema.safeParse({ ...validRestaurant, unknown_field: 1 });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('unknown_field');
  });
});

describe('SocialLinksSchema', () => {
  it('validates URLs when present', () => {
    expect(
      SocialLinksSchema.safeParse({ facebook_url: 'https://facebook.com/x' }).success
    ).toBe(true);
    expect(SocialLinksSchema.safeParse({ facebook_url: 'fb.com/x' }).success).toBe(false);
  });
});

describe('PrinterSchema', () => {
  it('restricts printer_connection to TCP/BLUETOOTH/USB', () => {
    const base = { restaurant_id: 'r1', printer_name: 'Caja', printer_ip: '192.168.1.50' };
    expect(PrinterSchema.safeParse({ ...base, printer_connection: 'TCP' }).success).toBe(true);
    expect(PrinterSchema.safeParse({ ...base, printer_connection: 'WIFI' }).success).toBe(false);
  });
});
