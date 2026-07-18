import { Request, Response, NextFunction } from 'express';
import {
  listStaff,
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  listRoles,
  createRole,
  updateMyPreferences,
  getMyProfile
} from '../../controllers/staff.controller';
import { AppError } from '../../utils/async-handler';

// Mock the staff service module
jest.mock('../../services/staff.service', () => ({
  listStaff: jest.fn(),
  getStaff: jest.fn(),
  createStaff: jest.fn(),
  updateStaff: jest.fn(),
  deleteStaff: jest.fn(),
  listRoles: jest.fn(),
  createRole: jest.fn(),
  updateMyPreferences: jest.fn(),
  getMyProfile: jest.fn(),
}));

import * as StaffService from '../../services/staff.service';

const STAFF_ID = '507f1f77bcf86cd799439021';
const OTHER_STAFF_ID = '507f1f77bcf86cd799439022';
const RESTAURANT_ID = '507f1f77bcf86cd799439023';
const ROLE_ID = '507f1f77bcf86cd799439024';
const OTHER_ROLE_ID = '507f1f77bcf86cd799439025';

describe('StaffController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let endMock: jest.Mock;

  const mockUser = {
    staffId: STAFF_ID,
    restaurantId: RESTAURANT_ID,
    role: 'ADMIN',
    permissions: ['ADMIN'],
    name: 'Test User'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();
    endMock = jest.fn().mockReturnThis();
    next = jest.fn();

    res = {
      json: jsonMock,
      status: statusMock,
      end: endMock,
    };

    req = {
      user: mockUser,
      body: {},
      params: {},
      query: {}
    };
  });

  describe('GET /staff', () => {
    it('should return paginated list of staff members', async () => {
      const mockStaff = [
        { _id: 'staff1', staff_name: 'John Doe', username: 'john' },
        { _id: 'staff2', staff_name: 'Jane Smith', username: 'jane' }
      ];
      const mockResult = { data: mockStaff, pagination: { total: 2, page: 1, limit: 50, totalPages: 1, hasNext: false, hasPrev: false } };
      (StaffService.listStaff as jest.Mock).mockResolvedValue(mockResult);

      await listStaff(req as Request, res as Response, next);

      expect(StaffService.listStaff).toHaveBeenCalledWith(RESTAURANT_ID, req);
      expect(jsonMock).toHaveBeenCalledWith(mockResult);
    });

    it('should forward pagination params via request', async () => {
      req.query = { page: '2', limit: '5' };
      (StaffService.listStaff as jest.Mock).mockResolvedValue({ data: [], pagination: { total: 10, page: 2, limit: 5, totalPages: 2, hasNext: false, hasPrev: true } });

      await listStaff(req as Request, res as Response, next);

      expect(StaffService.listStaff).toHaveBeenCalledWith(RESTAURANT_ID, expect.objectContaining({ query: { page: '2', limit: '5' } }));
    });
  });

  describe('GET /staff/:id', () => {
    it('should return single staff member', async () => {
      const mockStaffMember = { _id: 'staff1', staff_name: 'John Doe', username: 'john' };
      req.params = { id: STAFF_ID };
      (StaffService.getStaff as jest.Mock).mockResolvedValue(mockStaffMember);

      await getStaff(req as Request, res as Response, next);

      expect(StaffService.getStaff).toHaveBeenCalledWith(STAFF_ID, RESTAURANT_ID);
      expect(jsonMock).toHaveBeenCalledWith(mockStaffMember);
    });

    it('should delegate error handling when staff not found', async () => {
      req.params = { id: OTHER_STAFF_ID };
      (StaffService.getStaff as jest.Mock).mockRejectedValue(new AppError('STAFF_NOT_FOUND', 404));

      await getStaff(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      const errorArg = (next as jest.Mock).mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(AppError);
      expect(errorArg.message).toBe('STAFF_NOT_FOUND');
    });
  });

  describe('POST /staff', () => {
    it('should create staff member and return 201', async () => {
      const mockPopulatedStaff = {
        _id: 'newstaff',
        staff_name: 'New Staff',
        username: 'newstaff',
        role_id: { role_name: 'Waiter', permissions: ['POS'] }
      };
      req.body = {
        staff_name: 'New Staff',
        username: 'NewStaff',
        password: 'password123',
        pin_code: '1234',
        role_id: ROLE_ID
      };
      (StaffService.createStaff as jest.Mock).mockResolvedValue(mockPopulatedStaff);

      await createStaff(req as Request, res as Response, next);

      expect(StaffService.createStaff).toHaveBeenCalledWith(RESTAURANT_ID, req.body, req.user!.permissions);
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(mockPopulatedStaff);
    });

    it('should delegate role-not-found error to handler', async () => {
      req.body = { staff_name: 'Test', username: 'test', password: 'pass', pin_code: '1234', role_id: OTHER_ROLE_ID };
      (StaffService.createStaff as jest.Mock).mockRejectedValue(new AppError('ROLE_NOT_FOUND', 404));

      await createStaff(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      const errorArg = (next as jest.Mock).mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(AppError);
    });

    it('should delegate username-conflict error to handler', async () => {
      req.body = { staff_name: 'Test', username: 'existing', password: 'pass', pin_code: '1234', role_id: ROLE_ID };
      (StaffService.createStaff as jest.Mock).mockRejectedValue(new AppError('USER_ALREADY_EXISTS', 409));

      await createStaff(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      const errorArg = (next as jest.Mock).mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(AppError);
      expect(errorArg.message).toBe('USER_ALREADY_EXISTS');
    });
  });

  describe('PATCH /staff/:id', () => {
    it('should update staff member and return updated data', async () => {
      const mockPopulatedStaff = {
        _id: 'staff1',
        staff_name: 'Updated Name',
        username: 'olduser',
        role_id: { role_name: 'Admin' }
      };
      req.params = { id: STAFF_ID };
      req.body = { staff_name: 'Updated Name' };
      (StaffService.updateStaff as jest.Mock).mockResolvedValue(mockPopulatedStaff);

      await updateStaff(req as Request, res as Response, next);

      expect(StaffService.updateStaff).toHaveBeenCalledWith(STAFF_ID, RESTAURANT_ID, req.body, req.user!.permissions);
      expect(jsonMock).toHaveBeenCalledWith(mockPopulatedStaff);
    });

    it('should delegate not-found error to handler', async () => {
      req.params = { id: OTHER_STAFF_ID };
      req.body = { staff_name: 'Updated' };
      (StaffService.updateStaff as jest.Mock).mockRejectedValue(new AppError('STAFF_NOT_FOUND', 404));

      await updateStaff(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      const errorArg = (next as jest.Mock).mock.calls[0][0];
      expect(errorArg.message).toBe('STAFF_NOT_FOUND');
    });

    it('should delegate username-conflict error to handler', async () => {
      req.params = { id: STAFF_ID };
      req.body = { username: 'newuser' };
      (StaffService.updateStaff as jest.Mock).mockRejectedValue(new AppError('USER_ALREADY_EXISTS', 409));

      await updateStaff(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      const errorArg = (next as jest.Mock).mock.calls[0][0];
      expect(errorArg.message).toBe('USER_ALREADY_EXISTS');
    });
  });

  describe('DELETE /staff/:id', () => {
    it('should delete staff and return 204', async () => {
      req.params = { id: STAFF_ID };
      (StaffService.deleteStaff as jest.Mock).mockResolvedValue(undefined);

      await deleteStaff(req as Request, res as Response, next);

      expect(StaffService.deleteStaff).toHaveBeenCalledWith(STAFF_ID, RESTAURANT_ID);
      expect(statusMock).toHaveBeenCalledWith(204);
      expect(endMock).toHaveBeenCalled();
    });

    it('should delegate not-found error to handler', async () => {
      req.params = { id: OTHER_STAFF_ID };
      (StaffService.deleteStaff as jest.Mock).mockRejectedValue(new AppError('STAFF_NOT_FOUND', 404));

      await deleteStaff(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      const errorArg = (next as jest.Mock).mock.calls[0][0];
      expect(errorArg.message).toBe('STAFF_NOT_FOUND');
    });
  });

  describe('GET /staff/roles', () => {
    it('should return list of roles for restaurant', async () => {
      const mockRoles = [
        { _id: 'role1', role_name: 'Admin', permissions: ['ADMIN'] },
        { _id: 'role2', role_name: 'Waiter', permissions: ['POS'] }
      ];
      (StaffService.listRoles as jest.Mock).mockResolvedValue(mockRoles);

      await listRoles(req as Request, res as Response, next);

      expect(StaffService.listRoles).toHaveBeenCalledWith(RESTAURANT_ID);
      expect(jsonMock).toHaveBeenCalledWith(mockRoles);
    });
  });

  describe('POST /staff/roles', () => {
    it('should create role and return 201', async () => {
      const mockRole = {
        _id: 'newrole',
        restaurant_id: 'rest123',
        role_name: 'Manager',
        permissions: ['POS', 'KDS']
      };
      req.body = { role_name: 'Manager', permissions: ['POS', 'KDS'] };
      (StaffService.createRole as jest.Mock).mockResolvedValue(mockRole);

      await createRole(req as Request, res as Response, next);

      expect(StaffService.createRole).toHaveBeenCalledWith(RESTAURANT_ID, req.body, mockUser.permissions);
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(mockRole);
    });

    it('should handle empty permissions array', async () => {
      req.body = { role_name: 'Basic', permissions: [] };
      (StaffService.createRole as jest.Mock).mockResolvedValue({
        _id: 'role1',
        role_name: 'Basic',
        permissions: []
      });

      await createRole(req as Request, res as Response, next);

      expect(StaffService.createRole).toHaveBeenCalledWith(RESTAURANT_ID, expect.objectContaining({
        permissions: []
      }), mockUser.permissions);
    });
  });

  describe('PATCH /staff/me/preferences', () => {
    it('should update user preferences', async () => {
      req.body = { language: 'en', theme: 'dark' };
      (StaffService.updateMyPreferences as jest.Mock).mockResolvedValue({ language: 'en', theme: 'dark' });

      await updateMyPreferences(req as Request, res as Response, next);

      expect(StaffService.updateMyPreferences).toHaveBeenCalledWith(STAFF_ID, req.body);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        message: 'PREFERENCES_UPDATED',
        preferences: { language: 'en', theme: 'dark' }
      }));
    });

    it('should delegate user-not-found error to handler', async () => {
      req.body = { language: 'en' };
      (StaffService.updateMyPreferences as jest.Mock).mockRejectedValue(new AppError('USER_NOT_FOUND', 404));

      await updateMyPreferences(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      const errorArg = (next as jest.Mock).mock.calls[0][0];
      expect(errorArg.message).toBe('USER_NOT_FOUND');
    });

    it('should handle partial updates', async () => {
      req.body = { theme: 'dark' };
      (StaffService.updateMyPreferences as jest.Mock).mockResolvedValue({ language: 'es', theme: 'dark' });

      await updateMyPreferences(req as Request, res as Response, next);

      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        preferences: { language: 'es', theme: 'dark' }
      }));
    });
  });

  describe('GET /staff/me', () => {
    it('should return current user profile', async () => {
      const mockProfile = {
        _id: 'staff123',
        staff_name: 'Test User',
        username: 'testuser',
        role_id: { role_name: 'Admin', permissions: ['ADMIN'] },
        language: 'es',
        theme: 'light'
      };
      (StaffService.getMyProfile as jest.Mock).mockResolvedValue(mockProfile);

      await getMyProfile(req as Request, res as Response, next);

      expect(StaffService.getMyProfile).toHaveBeenCalledWith(STAFF_ID);
      expect(jsonMock).toHaveBeenCalledWith(mockProfile);
    });

    it('should delegate not-found error to handler', async () => {
      (StaffService.getMyProfile as jest.Mock).mockRejectedValue(new AppError('USER_NOT_FOUND', 404));

      await getMyProfile(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      const errorArg = (next as jest.Mock).mock.calls[0][0];
      expect(errorArg.message).toBe('USER_NOT_FOUND');
    });
  });
});