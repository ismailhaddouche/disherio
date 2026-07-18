const compare = jest.fn();
jest.mock('bcryptjs', () => ({
  compare,
  hash: jest.fn(async () => 'hashed'),
}));

const userRepo = {
  findByPinLookup: jest.fn(),
  findLegacyPinCandidates: jest.fn(),
  setPinLookup: jest.fn(),
  findByUsername: jest.fn(),
  findByUsernameAndRestaurant: jest.fn(),
  countByUsername: jest.fn(),
  findByIdWithRole: jest.fn(),
};
const roleRepo = { findById: jest.fn() };

jest.mock('../repositories/user.repository', () => ({
  UserRepository: jest.fn(() => userRepo),
  RoleRepository: jest.fn(() => roleRepo),
}));

const findRestaurantById = jest.fn();
jest.mock('../models/restaurant.model', () => ({
  Restaurant: { findById: findRestaurantById },
}));

const isLocked = jest.fn();
const recordFailedAttempt = jest.fn();
const clearAttempts = jest.fn();
jest.mock('../services/pin-security.service', () => ({
  createIdentifier: (name: string, ip?: string) => (ip ? `${name}:${ip}` : name),
  isLocked,
  getRemainingLockTime: jest.fn(async () => 0),
  recordFailedAttempt,
  clearAttempts,
}));

jest.mock('../services/refresh-token.service', () => ({
  generateAccessToken: jest.fn(() => 'test-access-token'),
  issueRefreshToken: jest.fn(async () => 'test-refresh-token'),
}));

import { loginWithPin, computePinLookup } from '../services/auth.service';

const RESTAURANT_ID = '507f1f77bcf86cd799439012';

function staffDoc(name: string) {
  return {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    restaurant_id: { toString: () => RESTAURANT_ID },
    role_id: { toString: () => '507f1f77bcf86cd799439013', role_name: 'POS', permissions: ['POS'] },
    staff_name: name,
    pin_code_hash: '$2a$12$realhash',
  };
}

describe('loginWithPin indexed lookup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isLocked.mockResolvedValue(false);
    findRestaurantById.mockResolvedValue({ default_language: 'es', enabled_languages: ['es'] });
    userRepo.setPinLookup.mockResolvedValue(undefined);
  });

  it('authenticates with exactly one bcrypt compare on the fast path', async () => {
    userRepo.findByPinLookup.mockResolvedValue(staffDoc('Fast Staff'));
    compare.mockResolvedValue(true);

    const result = await loginWithPin('1234', RESTAURANT_ID);

    expect(result.accessToken).toBe('test-access-token');
    expect(result.user.name).toBe('Fast Staff');
    expect(userRepo.findByPinLookup).toHaveBeenCalledWith(RESTAURANT_ID, computePinLookup('1234'));
    expect(compare).toHaveBeenCalledTimes(1);
    expect(userRepo.findLegacyPinCandidates).not.toHaveBeenCalled();
    expect(userRepo.setPinLookup).not.toHaveBeenCalled();
    expect(clearAttempts).toHaveBeenCalled();
  });

  it('migrates a legacy staff document after a successful scan login', async () => {
    userRepo.findByPinLookup.mockResolvedValue(null);
    userRepo.findLegacyPinCandidates.mockResolvedValue([staffDoc('Legacy Staff')]);
    compare.mockResolvedValue(true);

    const result = await loginWithPin('1234', RESTAURANT_ID);

    expect(result.user.name).toBe('Legacy Staff');
    expect(userRepo.setPinLookup).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      computePinLookup('1234')
    );
    expect(clearAttempts).toHaveBeenCalled();
  });

  it('runs exactly one dummy compare when no candidate can match', async () => {
    userRepo.findByPinLookup.mockResolvedValue(null);
    userRepo.findLegacyPinCandidates.mockResolvedValue([]);
    compare.mockResolvedValue(false);

    await expect(loginWithPin('9999', RESTAURANT_ID)).rejects.toThrow('INVALID_PIN');

    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare.mock.calls[0][1]).toMatch(/^\$2[aby]\$/);
    expect(recordFailedAttempt).toHaveBeenCalled();
  });

  it('scans every legacy candidate before failing', async () => {
    userRepo.findByPinLookup.mockResolvedValue(null);
    userRepo.findLegacyPinCandidates.mockResolvedValue([staffDoc('A'), staffDoc('B')]);
    compare.mockResolvedValue(false);

    await expect(loginWithPin('9999', RESTAURANT_ID)).rejects.toThrow('INVALID_PIN');

    expect(compare).toHaveBeenCalledTimes(2);
    expect(userRepo.setPinLookup).not.toHaveBeenCalled();
    expect(recordFailedAttempt).toHaveBeenCalled();
  });

  it('rejects when the lookup key matches but the bcrypt hash does not', async () => {
    userRepo.findByPinLookup.mockResolvedValue(staffDoc('Fast Staff'));
    compare.mockResolvedValue(false);

    await expect(loginWithPin('1234', RESTAURANT_ID)).rejects.toThrow('INVALID_PIN');

    expect(compare).toHaveBeenCalledTimes(1);
    expect(userRepo.findLegacyPinCandidates).not.toHaveBeenCalled();
    expect(recordFailedAttempt).toHaveBeenCalled();
  });

  it('does not touch the database while the identifier is locked', async () => {
    isLocked.mockResolvedValue(true);

    await expect(loginWithPin('1234', RESTAURANT_ID)).rejects.toThrow('AUTH_RATE_LIMIT_EXCEEDED');

    expect(userRepo.findByPinLookup).not.toHaveBeenCalled();
    expect(compare).not.toHaveBeenCalled();
  });

  it('produces a stable HMAC key independent of bcrypt salting', () => {
    expect(computePinLookup('1234')).toBe(computePinLookup('1234'));
    expect(computePinLookup('1234')).not.toBe(computePinLookup('1235'));
    expect(computePinLookup('1234')).toMatch(/^[0-9a-f]{64}$/);
  });
});
