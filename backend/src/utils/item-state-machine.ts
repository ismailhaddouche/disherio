import { ErrorCode } from '@disherio/shared';

export type ItemState = 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED';
export type ItemDisherType = 'KITCHEN' | 'SERVICE';

const KITCHEN_STATE_TRANSITIONS: Record<ItemState, readonly ItemState[]> = {
  ORDERED: ['ON_PREPARE', 'CANCELED'],
  ON_PREPARE: ['SERVED', 'CANCELED'],
  SERVED: [],
  CANCELED: [],
};

const SERVICE_STATE_TRANSITIONS: Record<ItemState, readonly ItemState[]> = {
  ORDERED: ['SERVED', 'CANCELED'],
  ON_PREPARE: [],
  SERVED: [],
  CANCELED: [],
};

export function isValidItemStateTransition(
  currentState: ItemState,
  newState: ItemState,
  itemType: ItemDisherType
): boolean {
  const transitions = itemType === 'SERVICE'
    ? SERVICE_STATE_TRANSITIONS
    : KITCHEN_STATE_TRANSITIONS;
  return transitions[currentState].includes(newState);
}

export function assertValidItemStateTransition(
  currentState: ItemState,
  newState: ItemState,
  itemType: ItemDisherType
): void {
  if (!isValidItemStateTransition(currentState, newState, itemType)) {
    throw new Error(ErrorCode.INVALID_STATE_TRANSITION);
  }
}
