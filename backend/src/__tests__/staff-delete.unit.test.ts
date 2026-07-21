import { Types } from 'mongoose';
import { ErrorCode } from '@disherio/shared';
import { AppError } from '../utils/async-handler';

const userRepo = {
  findByIdAndRestaurant: jest.fn(),
  countByRoleIds: jest.fn(),
  findByIdAndRestaurantAndDelete: jest.fn(),
};
const roleRepo = {
  findById: jest.fn(),
  findByRestaurantId: jest.fn(),
};
const revokeAllUserRefreshTokens = jest.fn();
const disconnectStaffSockets = jest.fn();
const withLockMock = jest.fn((_key: string, fn: () => Promise<unknown>) => fn());

jest.mock('../repositories/user.repository', () => ({
  UserRepository: jest.fn(() => userRepo),
  RoleRepository: jest.fn(() => roleRepo),
}));
jest.mock('../services/refresh-token.service', () => ({ revokeAllUserRefreshTokens }));
jest.mock('../services/socket-session.service', () => ({ disconnectStaffSockets }));
// Unit tests run without Redis: execute the locked section directly, but keep
// a spy so tests can assert the lock key scoping.
jest.mock('../utils/locks', () => ({
  withLock: (key: string, fn: () => Promise<unknown>) => withLockMock(key, fn),
}));

import { deleteStaff } from '../services/staff.service';

const STAFF_ID = '507f1f77bcf86cd799439011';
const RESTAURANT_ID = '507f1f77bcf86cd799439012';
const ROLE_ID = '507f1f77bcf86cd799439013';
const CALLER_ID = '507f1f77bcf86cd799439099';

const staffDocument = {
  _id: { toString: () => STAFF_ID },
  role_id: { toString: () => ROLE_ID },
};

function mockAdminRole(): void {
  roleRepo.findById.mockResolvedValue({ _id: new Types.ObjectId(ROLE_ID), permissions: ['ADMIN'] });
  roleRepo.findByRestaurantId.mockResolvedValue([
    { _id: new Types.ObjectId(ROLE_ID), permissions: ['ADMIN'] },
  ]);
}

describe('deleteStaff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userRepo.findByIdAndRestaurant.mockResolvedValue(staffDocument);
    userRepo.findByIdAndRestaurantAndDelete.mockResolvedValue(staffDocument);
    withLockMock.mockImplementation((_key: string, fn: () => Promise<unknown>) => fn());
  });

  it('rejects self-deletion with FORBIDDEN before touching the repositories', async () => {
    await expect(deleteStaff(STAFF_ID, RESTAURANT_ID, STAFF_ID)).rejects.toMatchObject({
      message: ErrorCode.FORBIDDEN,
      statusCode: 403,
    });

    expect(userRepo.findByIdAndRestaurant).not.toHaveBeenCalled();
    expect(userRepo.findByIdAndRestaurantAndDelete).not.toHaveBeenCalled();
  });

  it('throws STAFF_NOT_FOUND when the target does not exist in the restaurant', async () => {
    userRepo.findByIdAndRestaurant.mockResolvedValue(null);

    await expect(deleteStaff(STAFF_ID, RESTAURANT_ID, CALLER_ID)).rejects.toMatchObject({
      message: 'STAFF_NOT_FOUND',
      statusCode: 404,
    });

    expect(userRepo.findByIdAndRestaurantAndDelete).not.toHaveBeenCalled();
  });

  it('rejects deleting the last ADMIN with LAST_ADMIN and does not delete', async () => {
    mockAdminRole();
    userRepo.countByRoleIds.mockResolvedValue(0);

    await expect(deleteStaff(STAFF_ID, RESTAURANT_ID, CALLER_ID)).rejects.toMatchObject({
      message: ErrorCode.LAST_ADMIN,
      statusCode: 409,
    });

    expect(userRepo.countByRoleIds).toHaveBeenCalledWith(
      RESTAURANT_ID,
      [expect.any(Types.ObjectId)],
      STAFF_ID
    );
    expect(userRepo.findByIdAndRestaurantAndDelete).not.toHaveBeenCalled();
    expect(revokeAllUserRefreshTokens).not.toHaveBeenCalled();
    expect(disconnectStaffSockets).not.toHaveBeenCalled();
  });

  it('deletes an ADMIN when another admin remains in the restaurant', async () => {
    mockAdminRole();
    userRepo.countByRoleIds.mockResolvedValue(1);

    await expect(deleteStaff(STAFF_ID, RESTAURANT_ID, CALLER_ID)).resolves.toBeUndefined();

    expect(userRepo.findByIdAndRestaurantAndDelete).toHaveBeenCalledWith(STAFF_ID, RESTAURANT_ID);
    expect(revokeAllUserRefreshTokens).toHaveBeenCalledWith(STAFF_ID);
    expect(disconnectStaffSockets).toHaveBeenCalledWith(STAFF_ID);
  });

  it('deletes non-admin staff without counting admins', async () => {
    roleRepo.findById.mockResolvedValue({ _id: new Types.ObjectId(ROLE_ID), permissions: ['POS'] });

    await expect(deleteStaff(STAFF_ID, RESTAURANT_ID, CALLER_ID)).resolves.toBeUndefined();

    expect(roleRepo.findByRestaurantId).not.toHaveBeenCalled();
    expect(userRepo.countByRoleIds).not.toHaveBeenCalled();
    expect(userRepo.findByIdAndRestaurantAndDelete).toHaveBeenCalledWith(STAFF_ID, RESTAURANT_ID);
  });

  it('serializes the last-admin check and the delete under a per-restaurant lock', async () => {
    mockAdminRole();
    userRepo.countByRoleIds.mockResolvedValue(1);

    await deleteStaff(STAFF_ID, RESTAURANT_ID, CALLER_ID);

    expect(withLockMock).toHaveBeenCalledWith(`staff-delete:${RESTAURANT_ID}`, expect.any(Function));
  });

  it('propagates an AppError thrown inside the lock without deleting', async () => {
    mockAdminRole();
    userRepo.countByRoleIds.mockResolvedValue(0);

    const error = await deleteStaff(STAFF_ID, RESTAURANT_ID, CALLER_ID).catch((err) => err);

    expect(error).toBeInstanceOf(AppError);
    expect(error.isOperational).toBe(true);
  });
});
