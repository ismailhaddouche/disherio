import { ErrorCode } from '@disherio/shared';

type ItemType = 'KITCHEN' | 'SERVICE';

/**
 * POS and administrators may operate every item. KDS is limited to kitchen
 * items, while TAS may operate service items and request cancellation of an
 * item before the existing cancellation state policy requires POS approval.
 */
export function assertItemTransitionPermission(
  itemType: ItemType,
  newState: string,
  permissions: string[]
): void {
  if (permissions.includes('ADMIN') || permissions.includes('POS')) return;
  if (permissions.includes('KTS') && itemType === 'KITCHEN') return;
  if (permissions.includes('TAS') && (itemType === 'SERVICE' || newState === 'CANCELED')) return;

  throw new Error(ErrorCode.REQUIRES_AUTHORIZATION);
}
