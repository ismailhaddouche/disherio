import { defineAbilityFor } from '../abilities/abilities';

const makeUser = (permissions: string[]) => ({
  staffId: 'staff1',
  restaurantId: 'rest1',
  role: 'test',
  permissions,
  name: 'Test User',
});

describe('CASL Abilities', () => {
  it('ADMIN should manage all', () => {
    const ability = defineAbilityFor(makeUser(['ADMIN']));
    expect(ability.can('manage', 'all')).toBe(true);
    expect(ability.can('delete', 'Staff')).toBe(true);
  });

  it('KTS should update dish availability but not full dishes or images', () => {
    const ability = defineAbilityFor(makeUser(['KTS']));
    expect(ability.can('read', 'Order')).toBe(true);
    expect(ability.can('update', 'ItemOrder')).toBe(true);
    expect(ability.can('read', 'Dish')).toBe(true);
    expect(ability.can('updateAvailability', 'Dish')).toBe(true);
    expect(ability.cannot('update', 'Dish')).toBe(true);
    expect(ability.cannot('create', 'Staff')).toBe(true);
    expect(ability.cannot('delete', 'Totem')).toBe(true);
  });

  it('TAS should not access Staff or Restaurant management', () => {
    const ability = defineAbilityFor(makeUser(['TAS']));
    expect(ability.cannot('create', 'Staff')).toBe(true);
    expect(ability.cannot('delete', 'Restaurant')).toBe(true);
    expect(ability.can('create', 'Order')).toBe(true);
    // TAS reads service items and payment history for its table-service routes
    // (/orders/service-items and /orders/payments/history).
    expect(ability.can('read', 'ItemOrder')).toBe(true);
    expect(ability.can('read', 'Payment')).toBe(true);
    // TAS may pass the CASL gate for Totem mutations; the TEMPORARY-only
    // restriction is enforced by TotemService.assertCanMutateTotem in the
    // controller layer (see totem-policy.test.ts), not by a conditional CASL
    // rule that requirePermission cannot evaluate without a resource instance.
    expect(ability.can('create', 'Totem')).toBe(true);
    expect(ability.can('update', 'Totem')).toBe(true);
    expect(ability.can('delete', 'Totem')).toBe(true);
  });

  it('POS should update payments', () => {
    const ability = defineAbilityFor(makeUser(['POS']));
    expect(ability.can('update', 'Payment')).toBe(true);
    expect(ability.cannot('create', 'Staff')).toBe(true);
  });

  it('empty permissions should have no access', () => {
    const ability = defineAbilityFor(makeUser([]));
    expect(ability.cannot('read', 'Order')).toBe(true);
    expect(ability.cannot('create', 'Totem')).toBe(true);
  });
});
