import { ItemOrder } from '../models/order.model';

/** Ensure single-item POS/TAS retries cannot create duplicate billable rows. */
export const migration0005 = {
  name: '0005-item-request-id-index',
  async up(): Promise<void> {
    await ItemOrder.collection.createIndex(
      { session_id: 1, request_id: 1 },
      {
        name: 'session_id_1_request_id_1',
        unique: true,
        partialFilterExpression: { request_id: { $type: 'string' } },
      }
    );
  },
};
