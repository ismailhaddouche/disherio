import { Staff } from '../models/staff.model';

const PIN_INDEX_KEYS = { restaurant_id: 1 as const, pin_lookup: 1 as const };
const PIN_PARTIAL_FILTER = { pin_lookup: { $type: 'string' as const } };

/**
 * Creates the unique partial pin_lookup index (previously ensured on every
 * boot by staff-security-index.service). Historical duplicate lookup keys
 * require operator reconciliation because choosing an account automatically
 * would preserve the authentication flaw.
 */
export const migration0001 = {
  name: '0001-staff-pin-lookup-index',
  async up(): Promise<void> {
    const duplicatePins = await Staff.collection.aggregate<{ _id: unknown; count: number }>([
      { $match: { pin_lookup: { $type: 'string' } } },
      { $group: { _id: { restaurant_id: '$restaurant_id', pin_lookup: '$pin_lookup' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 1 },
    ]).toArray();
    if (duplicatePins.length > 0) {
      throw new Error('DUPLICATE_STAFF_PINS_REQUIRE_RECONCILIATION');
    }

    let existingIndexes: Awaited<ReturnType<typeof Staff.collection.indexes>> = [];
    try {
      existingIndexes = await Staff.collection.indexes();
    } catch (error) {
      if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 26)) {
        throw error;
      }
    }

    const existing = existingIndexes.find((index) =>
      JSON.stringify(index.key) === JSON.stringify(PIN_INDEX_KEYS)
    );
    const isExpected = existing?.unique === true
      && JSON.stringify(existing.partialFilterExpression) === JSON.stringify(PIN_PARTIAL_FILTER);
    if (existing && !isExpected && existing.name) {
      await Staff.collection.dropIndex(existing.name);
    }
    if (!isExpected) {
      await Staff.collection.createIndex(PIN_INDEX_KEYS, {
        unique: true,
        partialFilterExpression: PIN_PARTIAL_FILTER,
      });
    }
  },
};
