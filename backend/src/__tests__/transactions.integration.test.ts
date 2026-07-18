import mongoose from 'mongoose';
import { Restaurant } from '../models/restaurant.model';
import { withTransaction } from '../utils/transactions';

const describeWithIntegrationDb = process.env.CI === 'true' || !!process.env.MONGODB_URI_TEST
  ? describe
  : describe.skip;

describeWithIntegrationDb('MongoDB transaction integration', () => {
  const rollbackName = `transaction-rollback-${Date.now()}`;
  const commitName = `transaction-commit-${Date.now()}`;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!);
  });

  afterAll(async () => {
    await Restaurant.deleteMany({ restaurant_name: { $in: [rollbackName, commitName] } });
    await mongoose.disconnect();
  });

  it('rolls back writes when an operation fails', async () => {
    await expect(withTransaction(async (session) => {
      await Restaurant.create([{ restaurant_name: rollbackName, tax_rate: 10 }], { session });
      throw new Error('EXPECTED_TRANSACTION_FAILURE');
    })).rejects.toThrow('EXPECTED_TRANSACTION_FAILURE');

    await expect(Restaurant.exists({ restaurant_name: rollbackName })).resolves.toBeNull();
  });

  it('commits writes after a successful operation', async () => {
    await withTransaction(async (session) => {
      await Restaurant.create([{ restaurant_name: commitName, tax_rate: 10 }], { session });
    });

    await expect(Restaurant.exists({ restaurant_name: commitName })).resolves.not.toBeNull();
  });
});
