const staffDocument = {
  _id: { toString: () => '507f1f77bcf86cd799439011' },
  username: 'old-name',
  staff_name: 'Old Name',
  role_id: '507f1f77bcf86cd799439014',
  password_hash: 'old-password',
  auth_version: 0,
  save: jest.fn(),
};
const userRepo = {
  findByIdAndRestaurant: jest.fn(),
  findProfileById: jest.fn(),
  findByIdAndRestaurantAndDelete: jest.fn(),
  exists: jest.fn(),
  countByRoleIds: jest.fn(),
};
const roleRepo = {
  findByIdAndRestaurant: jest.fn(),
  findById: jest.fn(),
  findByRestaurantId: jest.fn(),
};
const revokeAllUserRefreshTokens = jest.fn();
const disconnectStaffSockets = jest.fn();

jest.mock('../repositories/user.repository', () => ({
  UserRepository: jest.fn(() => userRepo),
  RoleRepository: jest.fn(() => roleRepo),
}));
jest.mock('../services/auth.service', () => ({
  hashPassword: jest.fn(async () => 'new-password'),
}));
jest.mock('../services/refresh-token.service', () => ({ revokeAllUserRefreshTokens }));
jest.mock('../services/socket-session.service', () => ({ disconnectStaffSockets }));
// Unit tests run without Redis: execute the locked section directly.
jest.mock('../utils/locks', () => ({
  withLock: (_key: string, fn: () => Promise<unknown>) => fn(),
}));

import { deleteStaff, updateStaff } from '../services/staff.service';

const STAFF_ID = '507f1f77bcf86cd799439011';
const RESTAURANT_ID = '507f1f77bcf86cd799439012';
const ROLE_ID = '507f1f77bcf86cd799439013';
const CURRENT_ROLE_ID = '507f1f77bcf86cd799439014';

describe('staff socket session invalidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    staffDocument.auth_version = 0;
    staffDocument.role_id = CURRENT_ROLE_ID;
    userRepo.findByIdAndRestaurant.mockResolvedValue(staffDocument);
    userRepo.findProfileById.mockResolvedValue({ _id: STAFF_ID });
    roleRepo.findByIdAndRestaurant.mockResolvedValue({ permissions: ['POS'] });
    roleRepo.findById.mockResolvedValue({ permissions: ['POS'] });
    staffDocument.save.mockResolvedValue(staffDocument);
  });

  it('revokes refresh sessions and disconnects sockets after a role change', async () => {
    await updateStaff(STAFF_ID, RESTAURANT_ID, { role_id: ROLE_ID }, ['ADMIN']);

    expect(revokeAllUserRefreshTokens).toHaveBeenCalledWith(STAFF_ID);
    expect(disconnectStaffSockets).toHaveBeenCalledWith(STAFF_ID);
    expect(staffDocument.auth_version).toBe(1);
  });

  it('does not disconnect sockets for a display-name-only change', async () => {
    await updateStaff(STAFF_ID, RESTAURANT_ID, { staff_name: 'New Name' }, ['ADMIN']);

    expect(revokeAllUserRefreshTokens).not.toHaveBeenCalled();
    expect(disconnectStaffSockets).not.toHaveBeenCalled();
    expect(staffDocument.auth_version).toBe(0);
  });

  it('rejects downgrading the last administrator role', async () => {
    roleRepo.findByIdAndRestaurant.mockImplementation(async (roleId: string) => ({
      _id: roleId,
      permissions: roleId === ROLE_ID ? ['POS'] : ['ADMIN'],
    }));
    roleRepo.findByRestaurantId.mockResolvedValue([
      { _id: staffDocument.role_id, permissions: ['ADMIN'] },
    ]);
    userRepo.countByRoleIds.mockResolvedValue(0);

    await expect(updateStaff(STAFF_ID, RESTAURANT_ID, { role_id: ROLE_ID }, ['ADMIN']))
      .rejects.toMatchObject({ message: 'LAST_ADMIN', statusCode: 409 });

    expect(staffDocument.save).not.toHaveBeenCalled();
    expect(revokeAllUserRefreshTokens).not.toHaveBeenCalled();
    expect(disconnectStaffSockets).not.toHaveBeenCalled();
  });

  it('revokes refresh sessions and disconnects sockets after deletion', async () => {
    userRepo.findByIdAndRestaurantAndDelete.mockResolvedValue({ _id: STAFF_ID });

    await deleteStaff(STAFF_ID, RESTAURANT_ID, '507f1f77bcf86cd799439099');

    expect(revokeAllUserRefreshTokens).toHaveBeenCalledWith(STAFF_ID);
    expect(disconnectStaffSockets).toHaveBeenCalledWith(STAFF_ID);
  });
});
