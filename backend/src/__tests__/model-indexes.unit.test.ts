import { Payment } from '../models/order.model';
import { Totem } from '../models/totem.model';
import { Staff } from '../models/staff.model';

type SchemaIndex = [Record<string, unknown>, Record<string, unknown>];

function singleFieldIndexes(
  indexes: SchemaIndex[],
  field: string
) {
  return indexes.filter(([keys]) => (
    Object.keys(keys).length === 1 && keys[field] === 1
  ));
}

describe('model indexes', () => {
  it('defines one sparse unique QR index so legacy totems may omit a QR', () => {
    const qrIndexes = singleFieldIndexes(Totem.schema.indexes() as SchemaIndex[], 'totem_qr');

    expect(qrIndexes).toHaveLength(1);
    expect(qrIndexes[0][1]).toEqual(expect.objectContaining({
      unique: true,
      sparse: true,
    }));
  });

  it('defines one unique payment index per session', () => {
    const sessionIndexes = singleFieldIndexes(Payment.schema.indexes() as SchemaIndex[], 'session_id');

    expect(sessionIndexes).toHaveLength(1);
    expect(sessionIndexes[0][1]).toEqual(expect.objectContaining({ unique: true }));
  });

  it('indexes payment history by restaurant and date', () => {
    expect(Payment.schema.indexes()).toContainEqual([
      { restaurant_id: 1, payment_date: -1 },
      expect.any(Object),
    ]);
  });

  it('defines a unique partial PIN lookup index per restaurant', () => {
    expect(Staff.schema.indexes()).toContainEqual([
      { restaurant_id: 1, pin_lookup: 1 },
      expect.objectContaining({
        unique: true,
        partialFilterExpression: { pin_lookup: { $type: 'string' } },
      }),
    ]);
  });
});
