import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { loginWithUsername, loginWithPin, computePinLookup } from '../services/auth.service';
import { Restaurant } from '../models/restaurant.model';
import { Role, Staff } from '../models/staff.model';

jest.mock('../services/refresh-token.service', () => ({
  generateAccessToken: jest.fn(() => 'test-access-token'),
  issueRefreshToken: jest.fn(async () => 'test-refresh-token'),
}));

const describeWithIntegrationDb = process.env.CI === 'true' || !!process.env.MONGODB_URI_TEST
  ? describe
  : describe.skip;

describeWithIntegrationDb('Auth Service', () => {
  let restaurantId: string;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!);

    const restaurant = await Restaurant.create({ restaurant_name: 'Test', tax_rate: 10 });
    restaurantId = restaurant._id.toString();

    const role = await Role.create({ restaurant_id: restaurantId, role_name: 'Admin', permissions: ['ADMIN'] });
    const hash = await bcrypt.hash('pass1234', 12);
    const pinHash = await bcrypt.hash('1234', 12);
    const fastPinHash = await bcrypt.hash('5678', 12);

    // Legacy staff document without pin_lookup, as produced before the
    // indexed lookup existed. First PIN login must migrate it.
    await Staff.create({
      restaurant_id: restaurantId,
      role_id: role._id,
      staff_name: 'Test Admin',
      username: 'testadmin',
      password_hash: hash,
      pin_code_hash: pinHash,
    });

    // Migrated staff document using the deterministic lookup key.
    await Staff.create({
      restaurant_id: restaurantId,
      role_id: role._id,
      staff_name: 'Fast Staff',
      username: 'faststaff',
      password_hash: hash,
      pin_code_hash: fastPinHash,
      pin_lookup: computePinLookup('5678'),
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('should login with username and return tokens', async () => {
    const result = await loginWithUsername('testadmin', 'pass1234');
    expect(result.accessToken).toBe('test-access-token');
    expect(result.refreshToken).toBe('test-refresh-token');
    expect(result.user.name).toBe('Test Admin');
  });

  it('should reject invalid password', async () => {
    await expect(loginWithUsername('testadmin', 'wrong')).rejects.toThrow('INVALID_CREDENTIALS');
  });

  it('should login with PIN through the legacy path and migrate the lookup key', async () => {
    const result = await loginWithPin('1234', restaurantId);
    expect(result.accessToken).toBe('test-access-token');
    expect(result.user.name).toBe('Test Admin');

    const migrated = await Staff.findOne({ username: 'testadmin' }).select('+pin_lookup').lean();
    expect(migrated?.pin_lookup).toBe(computePinLookup('1234'));

    // Second login now resolves through the indexed fast path.
    const second = await loginWithPin('1234', restaurantId);
    expect(second.user.name).toBe('Test Admin');
  });

  it('should login with PIN through the indexed lookup', async () => {
    const result = await loginWithPin('5678', restaurantId);
    expect(result.accessToken).toBe('test-access-token');
    expect(result.user.name).toBe('Fast Staff');
  });

  it('should reject invalid PIN', async () => {
    await expect(loginWithPin('9999', restaurantId)).rejects.toThrow('INVALID_PIN');
  });
});
