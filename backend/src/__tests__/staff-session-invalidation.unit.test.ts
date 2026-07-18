const staffDocument = {
  _id: { toString: () => '507f1f77bcf86cd799439011' },
  username: 'old-name',
  staff_name: 'Old Name',
  role_id: '507f1f77bcf86cd799439014',
  password_hash: 'old-password',
  pin_code_hash: 'old-pin',
  auth_version: 0,
  save: jest.fn(),
};
const userRepo = {
  findByIdAndRestaurant: jest.fn(),
  findProfileById: jest.fn(),
  findByIdAndRestaurantAndDelete: jest.fn(),
  exists: jest.fn(),
};
const roleRepo = { findByIdAndRestaurant: jest.fn() };
const revokeAllUserRefreshTokens = jest.fn();
const disconnectStaffSockets = jest.fn();

jest.mock('../repositories/user.repository', () => ({
  UserRepository: jest.fn(() => userRepo),
  RoleRepository: jest.fn(() => roleRepo),
}));
jest.mock('../services/auth.service', () => ({
  hashPassword: jest.fn(async () => 'new-password'),
  hashPin: jest.fn(async () => 'new-pin'),
  computePinLookup: jest.fn(() => 'new-pin-lookup'),
}));
jest.mock('../services/refresh-token.service', () => ({ revokeAllUserRefreshTokens }));
jest.mock('../services/socket-session.service', () => ({ disconnectStaffSockets }));

import { deleteStaff, updateStaff } from '../services/staff.service';

const STAFF_ID = '507f1f77bcf86cd799439011';
const RESTAURANT_ID = '507f1f77bcf86cd799439012';
const ROLE_ID = '507f1f77bcf86cd799439013';

describe('staff socket session invalidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    staffDocument.auth_version = 0;
    userRepo.findByIdAndRestaurant.mockResolvedValue(staffDocument);
    userRepo.findProfileById.mockResolvedValue({ _id: STAFF_ID });
    roleRepo.findByIdAndRestaurant.mockResolvedValue({ permissions: ['POS'] });
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

  it('revokes refresh sessions and disconnects sockets after deletion', async () => {
    userRepo.findByIdAndRestaurantAndDelete.mockResolvedValue({ _id: STAFF_ID });

    await deleteStaff(STAFF_ID, RESTAURANT_ID);

    expect(revokeAllUserRefreshTokens).toHaveBeenCalledWith(STAFF_ID);
    expect(disconnectStaffSockets).toHaveBeenCalledWith(STAFF_ID);
  });
});
