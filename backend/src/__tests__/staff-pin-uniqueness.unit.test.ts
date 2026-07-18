const userRepo = {
  exists: jest.fn(),
  existsByPinLookup: jest.fn(),
  findLegacyPinCandidates: jest.fn(),
  createUser: jest.fn(),
};
const roleRepo = { findByIdAndRestaurant: jest.fn() };

jest.mock('../repositories/user.repository', () => ({
  UserRepository: jest.fn(() => userRepo),
  RoleRepository: jest.fn(() => roleRepo),
}));
jest.mock('../services/auth.service', () => ({
  hashPassword: jest.fn(),
  hashPin: jest.fn(),
  computePinLookup: jest.fn(() => 'pin-lookup'),
}));
jest.mock('../services/refresh-token.service', () => ({ revokeAllUserRefreshTokens: jest.fn() }));
jest.mock('../services/socket-session.service', () => ({ disconnectStaffSockets: jest.fn() }));

import { ErrorCode } from '@disherio/shared';
import bcrypt from 'bcryptjs';
import { createStaff } from '../services/staff.service';

describe('staff PIN uniqueness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    roleRepo.findByIdAndRestaurant.mockResolvedValue({ permissions: ['POS'] });
    userRepo.exists.mockResolvedValue(false);
    userRepo.findLegacyPinCandidates.mockResolvedValue([]);
  });

  it('rejects a PIN already assigned in the restaurant', async () => {
    userRepo.existsByPinLookup.mockResolvedValue(true);

    await expect(createStaff('507f1f77bcf86cd799439012', {
      staff_name: 'Second Staff',
      username: 'second',
      password: 'strong-password',
      pin_code: '1234',
      role_id: '507f1f77bcf86cd799439013',
    }, ['ADMIN'])).rejects.toMatchObject({
      message: ErrorCode.DUPLICATE_RESOURCE,
      statusCode: 409,
      details: { field: 'pin_code' },
    });
    expect(userRepo.createUser).not.toHaveBeenCalled();
  });

  it('also checks staff records that predate the lookup index', async () => {
    userRepo.existsByPinLookup.mockResolvedValue(false);
    userRepo.findLegacyPinCandidates.mockResolvedValue([{
      _id: { toString: () => '507f1f77bcf86cd799439099' },
      pin_code_hash: await bcrypt.hash('1234', 4),
    }]);

    await expect(createStaff('507f1f77bcf86cd799439012', {
      staff_name: 'Second Staff',
      username: 'second',
      password: 'strong-password',
      pin_code: '1234',
      role_id: '507f1f77bcf86cd799439013',
    }, ['ADMIN'])).rejects.toMatchObject({ message: ErrorCode.DUPLICATE_RESOURCE });
  });
});
