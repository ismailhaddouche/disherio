import { ErrorCode } from '@disherio/shared';
import {
  assertValidItemStateTransition,
  isValidItemStateTransition,
} from '../utils/item-state-machine';

describe('item state machine', () => {
  it.each([
    ['ORDERED', 'ON_PREPARE'],
    ['ORDERED', 'CANCELED'],
    ['ON_PREPARE', 'SERVED'],
    ['ON_PREPARE', 'CANCELED'],
  ] as const)('allows KITCHEN %s -> %s', (from, to) => {
    expect(isValidItemStateTransition(from, to, 'KITCHEN')).toBe(true);
  });

  it('allows SERVICE items to skip preparation', () => {
    expect(isValidItemStateTransition('ORDERED', 'SERVED', 'SERVICE')).toBe(true);
  });

  it('does not allow KITCHEN items to skip preparation', () => {
    expect(isValidItemStateTransition('ORDERED', 'SERVED', 'KITCHEN')).toBe(false);
  });

  it.each([
    ['SERVED', 'ORDERED', 'KITCHEN'],
    ['CANCELED', 'ON_PREPARE', 'KITCHEN'],
    ['SERVED', 'CANCELED', 'SERVICE'],
    ['ON_PREPARE', 'SERVED', 'SERVICE'],
  ] as const)('rejects %s -> %s for %s items', (from, to, type) => {
    expect(() => assertValidItemStateTransition(from, to, type))
      .toThrow(ErrorCode.INVALID_STATE_TRANSITION);
  });
});
