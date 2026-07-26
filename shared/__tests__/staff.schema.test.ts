import { describe, it, expect } from 'vitest';
import {
  RoleSchema,
  CreateStaffSchema,
  StaffSchema,
  UpdateStaffSchema,
  UpdatePreferencesSchema,
  StaffLoginSchema,
  StaffPinSchema,
} from '../schemas/staff.schema';

const validCreate = {
  restaurant_id: 'r1',
  role_id: 'role1',
  staff_name: 'Ana',
  username: 'ana_01',
  password: 'super-secret',
  pin_code: '1234',
};

describe('RoleSchema', () => {
  it('requires role_name of at least 2 chars and a permissions array', () => {
    expect(
      RoleSchema.safeParse({ restaurant_id: 'r1', role_name: 'Admin', permissions: [] }).success
    ).toBe(true);
    expect(
      RoleSchema.safeParse({ restaurant_id: 'r1', role_name: 'A', permissions: [] }).success
    ).toBe(false);
  });
});

describe('CreateStaffSchema', () => {
  it('accepts a valid payload', () => {
    expect(CreateStaffSchema.safeParse(validCreate).success).toBe(true);
  });

  it('enforces the username regex (alphanumeric plus _ . -)', () => {
    expect(CreateStaffSchema.safeParse({ ...validCreate, username: 'ana.lopez-1' }).success).toBe(
      true
    );
    expect(CreateStaffSchema.safeParse({ ...validCreate, username: 'ana lopez' }).success).toBe(
      false
    );
    expect(CreateStaffSchema.safeParse({ ...validCreate, username: 'ab' }).success).toBe(false);
    expect(CreateStaffSchema.safeParse({ ...validCreate, username: 'x'.repeat(51) }).success).toBe(
      false
    );
  });

  it('bounds password to 8..128 chars', () => {
    expect(CreateStaffSchema.safeParse({ ...validCreate, password: 'short' }).success).toBe(false);
    expect(CreateStaffSchema.safeParse({ ...validCreate, password: 'x'.repeat(129) }).success).toBe(
      false
    );
  });

  it('requires a 4-digit numeric pin_code', () => {
    expect(CreateStaffSchema.safeParse({ ...validCreate, pin_code: '123' }).success).toBe(false);
    expect(CreateStaffSchema.safeParse({ ...validCreate, pin_code: '12345' }).success).toBe(false);
    expect(CreateStaffSchema.safeParse({ ...validCreate, pin_code: '12a4' }).success).toBe(false);
  });

  it('restricts language/theme to known values', () => {
    expect(CreateStaffSchema.safeParse({ ...validCreate, language: 'de' }).success).toBe(false);
    expect(CreateStaffSchema.safeParse({ ...validCreate, language: 'fr' }).success).toBe(true);
    expect(CreateStaffSchema.safeParse({ ...validCreate, theme: 'blue' }).success).toBe(false);
  });
});

describe('StaffSchema (stored representation)', () => {
  const validStored = {
    restaurant_id: 'r1',
    role_id: 'role1',
    staff_name: 'Ana',
    username: 'ana_01',
    password_hash: 'hash',
    pin_code_hash: 'hash',
  };

  it('accepts a stored staff member with hashes', () => {
    expect(StaffSchema.safeParse(validStored).success).toBe(true);
  });

  // Current behavior: the stored schema only enforces username min(3) — no
  // max(50) and no charset regex — while CreateStaffSchema enforces all
  // three. Pinned as-is.
  it('currently applies looser username rules than CreateStaffSchema', () => {
    expect(
      StaffSchema.safeParse({ ...validStored, username: 'user name with spaces' }).success
    ).toBe(true);
  });

  it('allows nullable language/theme', () => {
    expect(
      StaffSchema.safeParse({ ...validStored, language: null, theme: null }).success
    ).toBe(true);
  });
});

describe('UpdateStaffSchema / UpdatePreferencesSchema', () => {
  it('UpdateStaffSchema is fully optional but validates present fields', () => {
    expect(UpdateStaffSchema.safeParse({}).success).toBe(true);
    expect(UpdateStaffSchema.safeParse({ pin_code: '0000' }).success).toBe(true);
    expect(UpdateStaffSchema.safeParse({ pin_code: '00x0' }).success).toBe(false);
    expect(UpdateStaffSchema.safeParse({ username: 'bad user' }).success).toBe(false);
  });

  it('UpdatePreferencesSchema only accepts known language/theme', () => {
    expect(UpdatePreferencesSchema.safeParse({}).success).toBe(true);
    expect(UpdatePreferencesSchema.safeParse({ language: 'es', theme: 'dark' }).success).toBe(true);
    expect(UpdatePreferencesSchema.safeParse({ language: 'it' }).success).toBe(false);
  });
});

describe('login schemas', () => {
  it('StaffLoginSchema requires non-empty username and password', () => {
    expect(StaffLoginSchema.safeParse({ username: 'u', password: 'p' }).success).toBe(true);
    expect(StaffLoginSchema.safeParse({ username: '', password: 'p' }).success).toBe(false);
  });

  it('StaffPinSchema requires a 4-digit pin and a restaurant', () => {
    expect(StaffPinSchema.safeParse({ pin_code: '1234', restaurant_id: 'r1' }).success).toBe(true);
    expect(StaffPinSchema.safeParse({ pin_code: '1234' }).success).toBe(false);
    expect(StaffPinSchema.safeParse({ pin_code: 'abcd', restaurant_id: 'r1' }).success).toBe(false);
  });
});
