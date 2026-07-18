import { ErrorCode } from '@disherio/shared';
import { assertItemTransitionPermission } from '../services/item-transition-policy';

describe('item transition interface policy', () => {
  it('limits KDS staff to kitchen items', () => {
    expect(() => assertItemTransitionPermission('KITCHEN', 'ON_PREPARE', ['KTS'])).not.toThrow();
    expect(() => assertItemTransitionPermission('SERVICE', 'SERVED', ['KTS']))
      .toThrow(ErrorCode.REQUIRES_AUTHORIZATION);
  });

  it('limits TAS operational transitions to service items', () => {
    expect(() => assertItemTransitionPermission('SERVICE', 'SERVED', ['TAS'])).not.toThrow();
    expect(() => assertItemTransitionPermission('KITCHEN', 'ON_PREPARE', ['TAS']))
      .toThrow(ErrorCode.REQUIRES_AUTHORIZATION);
  });

  it('allows TAS to request cancellation under the separate cancellation-state policy', () => {
    expect(() => assertItemTransitionPermission('KITCHEN', 'CANCELED', ['TAS'])).not.toThrow();
  });

  it('allows POS and administrators to operate either item type', () => {
    expect(() => assertItemTransitionPermission('KITCHEN', 'SERVED', ['POS'])).not.toThrow();
    expect(() => assertItemTransitionPermission('SERVICE', 'SERVED', ['ADMIN'])).not.toThrow();
  });
});
