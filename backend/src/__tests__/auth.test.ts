import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { loginWithUsername } from '../services/auth.service';
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

    await Staff.create({
      restaurant_id: restaurantId,
      role_id: role._id,
      staff_name: 'Test Admin',
      username: 'testadmin',
      password_hash: hash,
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
});
