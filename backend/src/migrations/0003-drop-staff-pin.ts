import { Staff } from '../models/staff.model';

/**
 * Removes the staff PIN feature from existing databases: drops the unique
 * partial pin_lookup index (created by 0001) and unsets the pin_code_hash /
 * pin_lookup fields from every staff document. The drop is tolerant to the
 * index not existing (fresh installs where 0001 was never applied, or
 * databases where it was already removed manually).
 */
export const migration0003 = {
  name: '0003-drop-staff-pin',
  async up(): Promise<void> {
    let existingIndexes: Awaited<ReturnType<typeof Staff.collection.indexes>> = [];
    try {
      existingIndexes = await Staff.collection.indexes();
    } catch (error) {
      if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 26)) {
        throw error;
      }
    }

    const pinIndex = existingIndexes.find((index) =>
      JSON.stringify(index.key) === JSON.stringify({ restaurant_id: 1, pin_lookup: 1 })
    );
    if (pinIndex?.name) {
      await Staff.collection.dropIndex(pinIndex.name);
    }

    await Staff.collection.updateMany(
      {},
      { $unset: { pin_code_hash: '', pin_lookup: '' } }
    );
  },
};
