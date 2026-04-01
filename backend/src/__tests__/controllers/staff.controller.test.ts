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

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_value')
}));

// Mock models
const mockStaffFind = jest.fn();
const mockStaffFindOne = jest.fn();
const mockStaffFindById = jest.fn();
const mockStaffCreate = jest.fn();
const mockStaffCountDocuments = jest.fn();
const mockStaffFindOneAndDelete = jest.fn();

const mockRoleFind = jest.fn();
const mockRoleFindOne = jest.fn();
const mockRoleCreate = jest.fn();

jest.mock('../../models/staff.model', () => ({
  Staff: {
    find: mockStaffFind,
    findOne: mockStaffFindOne,
    findById: mockStaffFindById,
    create: mockStaffCreate,
    countDocuments: mockStaffCountDocuments,
    findOneAndDelete: mockStaffFindOneAndDelete,
  },
  Role: {
    find: mockRoleFind,
    findOne: mockRoleFindOne,
    create: mockRoleCreate,
  }
}));

describe('StaffController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let endMock: jest.Mock;

  const mockUser = {
    staffId: 'staff123',
    restaurantId: 'rest123',
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
      // Arrange
      const mockStaff = [
        { _id: 'staff1', staff_name: 'John Doe', username: 'john' },
        { _id: 'staff2', staff_name: 'Jane Smith', username: 'jane' }
      ];
      
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockStaff)
      };
      
      mockStaffFind.mockReturnValue(mockQuery);
      mockStaffCountDocuments.mockResolvedValue(2);

      // Act
      await listStaff(req as Request, res as Response, next);

      // Assert
      expect(mockStaffFind).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        data: mockStaff,
        pagination: expect.objectContaining({
          total: 2,
          page: 1
        })
      }));
    });

    it('should use correct pagination params', async () => {
      // Arrange
      req.query = { page: '2', limit: '5' };
      
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([])
      };
      
      mockStaffFind.mockReturnValue(mockQuery);
      mockStaffCountDocuments.mockResolvedValue(10);

      // Act
      await listStaff(req as Request, res as Response, next);

      // Assert
      expect(mockQuery.skip).toHaveBeenCalledWith(5);
      expect(mockQuery.limit).toHaveBeenCalledWith(5);
    });

    it('should exclude password fields from response', async () => {
      // Arrange
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([])
      };
      
      mockStaffFind.mockReturnValue(mockQuery);
      mockStaffCountDocuments.mockResolvedValue(0);

      // Act
      await listStaff(req as Request, res as Response, next);

      // Assert
      expect(mockQuery.select).toHaveBeenCalledWith('-password_hash -pin_code_hash');
    });
  });

  describe('GET /staff/:id', () => {
    it('should return single staff member', async () => {
      // Arrange
      const mockStaffMember = {
        _id: 'staff1',
        staff_name: 'John Doe',
        username: 'john'
      };
      
      req.params = { id: 'staff1' };
      
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockStaffMember)
      };
      
      mockStaffFindOne.mockReturnValue(mockQuery);

      // Act
      await getStaff(req as Request, res as Response, next);

      // Assert
      expect(mockStaffFindOne).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(mockStaffMember);
    });

    it('should throw 404 when staff not found', async () => {
      // Arrange
      req.params = { id: 'nonexistent' };
      
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null)
      };
      
      mockStaffFindOne.mockReturnValue(mockQuery);

      // Act
      await getStaff(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      const errorArg = (next as jest.Mock).mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(AppError);
      expect(errorArg.message).toBe('STAFF_NOT_FOUND');
    });
  });

  describe('POST /staff', () => {
    it('should create staff member and return 201', async () => {
      // Arrange
      const mockRole = { _id: 'role123', role_name: 'Waiter' };
      const mockCreatedStaff = {
        _id: 'newstaff',
        staff_name: 'New Staff',
        username: 'newstaff',
        restaurant_id: 'rest123',
        role_id: 'role123'
      };
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
        role_id: 'role123'
      };
      
      mockRoleFindOne.mockResolvedValue(mockRole);
      mockStaffFindOne.mockResolvedValue(null);
      mockStaffCreate.mockResolvedValue(mockCreatedStaff);
      
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockPopulatedStaff)
      };
      mockStaffFindById.mockReturnValue(mockQuery);

      // Act
      await createStaff(req as Request, res as Response, next);

      // Assert
      expect(mockRoleFindOne).toHaveBeenCalled();
      expect(mockStaffCreate).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(mockPopulatedStaff);
    });

    it('should normalize username to lowercase', async () => {
      // Arrange
      req.body = {
        staff_name: 'Test',
        username: 'UPPERCASE_USER',
        password: 'pass',
        pin_code: '1234',
        role_id: 'role123'
      };
      
      mockRoleFindOne.mockResolvedValue({ _id: 'role123' });
      mockStaffFindOne.mockResolvedValue(null);
      
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({})
      };
      mockStaffFindById.mockReturnValue(mockQuery);

      // Act
      await createStaff(req as Request, res as Response, next);

      // Assert
      expect(mockStaffCreate).toHaveBeenCalledWith(expect.objectContaining({
        username: 'uppercase_user'
      }));
    });

    it('should throw 404 when role not found', async () => {
      // Arrange
      req.body = { staff_name: 'Test', username: 'test', password: 'pass', pin_code: '1234', role_id: 'invalid' };
      
      mockRoleFindOne.mockResolvedValue(null);

      // Act
      await createStaff(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      const errorArg = (next as jest.Mock).mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(AppError);
    });

    it('should throw 409 when username already exists', async () => {
      // Arrange
      req.body = { staff_name: 'Test', username: 'existing', password: 'pass', pin_code: '1234', role_id: 'role123' };
      
      mockRoleFindOne.mockResolvedValue({ _id: 'role123' });
      mockStaffFindOne.mockResolvedValue({ _id: 'existing' });

      // Act
      await createStaff(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      const errorArg = (next as jest.Mock).mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(AppError);
      expect(errorArg.message).toBe('USER_ALREADY_EXISTS');
    });
  });

  describe('PATCH /staff/:id', () => {
    it('should update staff member and return updated data', async () => {
      // Arrange
      const mockStaff = {
        _id: 'staff1',
        staff_name: 'Old Name',
        username: 'olduser',
        save: jest.fn().mockResolvedValue(true)
      };
      const mockPopulatedStaff = {
        _id: 'staff1',
        staff_name: 'Updated Name',
        username: 'olduser',
        role_id: { role_name: 'Admin' }
      };
      
      req.params = { id: 'staff1' };
      req.body = { staff_name: 'Updated Name' };
      
      mockStaffFindOne.mockResolvedValue(mockStaff);
      
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockPopulatedStaff)
      };
      mockStaffFindById.mockReturnValue(mockQuery);

      // Act
      await updateStaff(req as Request, res as Response, next);

      // Assert
      expect(mockStaff.save).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(mockPopulatedStaff);
    });

    it('should throw 404 when staff not found', async () => {
      // Arrange
      req.params = { id: 'nonexistent' };
      req.body = { staff_name: 'Updated' };
      
      mockStaffFindOne.mockResolvedValue(null);

      // Act
      await updateStaff(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      const errorArg = (next as jest.Mock).mock.calls[0][0];
      expect(errorArg.message).toBe('STAFF_NOT_FOUND');
    });

    it('should check username uniqueness when changing', async () => {
      // Arrange
      const mockStaff = {
        _id: 'staff1',
        staff_name: 'Test',
        username: 'olduser',
        save: jest.fn()
      };
      
      req.params = { id: 'staff1' };
      req.body = { username: 'newuser' };
      
      mockStaffFindOne
        .mockResolvedValueOnce(mockStaff)
        .mockResolvedValueOnce({ _id: 'other' });

      // Act
      await updateStaff(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      const errorArg = (next as jest.Mock).mock.calls[0][0];
      expect(errorArg.message).toBe('USER_ALREADY_EXISTS');
    });

    it('should update password when provided', async () => {
      // Arrange
      const mockStaff = {
        _id: 'staff1',
        staff_name: 'Test',
        username: 'testuser',
        password_hash: 'oldhash',
        save: jest.fn().mockResolvedValue(true)
      };
      const mockPopulatedStaff = { _id: 'staff1', staff_name: 'Test' };
      
      req.params = { id: 'staff1' };
      req.body = { password: 'newpassword' };
      
      mockStaffFindOne.mockResolvedValue(mockStaff);
      
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockPopulatedStaff)
      };
      mockStaffFindById.mockReturnValue(mockQuery);

      // Act
      await updateStaff(req as Request, res as Response, next);

      // Assert
      expect(mockStaff.password_hash).toBe('hashed_value');
    });

    it('should update pin_code when provided', async () => {
      // Arrange
      const mockStaff = {
        _id: 'staff1',
        staff_name: 'Test',
        username: 'testuser',
        pin_code_hash: 'oldhash',
        save: jest.fn().mockResolvedValue(true)
      };
      const mockPopulatedStaff = { _id: 'staff1', staff_name: 'Test' };
      
      req.params = { id: 'staff1' };
      req.body = { pin_code: '4321' };
      
      mockStaffFindOne.mockResolvedValue(mockStaff);
      
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockPopulatedStaff)
      };
      mockStaffFindById.mockReturnValue(mockQuery);

      // Act
      await updateStaff(req as Request, res as Response, next);

      // Assert
      expect(mockStaff.pin_code_hash).toBe('hashed_value');
    });
  });

  describe('DELETE /staff/:id', () => {
    it('should delete staff and return 204', async () => {
      // Arrange
      req.params = { id: 'staff1' };
      
      mockStaffFindOneAndDelete.mockResolvedValue({ _id: 'staff1' });

      // Act
      await deleteStaff(req as Request, res as Response, next);

      // Assert
      expect(mockStaffFindOneAndDelete).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(204);
      expect(endMock).toHaveBeenCalled();
    });

    it('should throw 404 when staff not found', async () => {
      // Arrange
      req.params = { id: 'nonexistent' };
      
      mockStaffFindOneAndDelete.mockResolvedValue(null);

      // Act
      await deleteStaff(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      const errorArg = (next as jest.Mock).mock.calls[0][0];
      expect(errorArg.message).toBe('STAFF_NOT_FOUND');
    });
  });

  describe('GET /staff/roles', () => {
    it('should return list of roles for restaurant', async () => {
      // Arrange
      const mockRoles = [
        { _id: 'role1', role_name: 'Admin', permissions: ['ADMIN'] },
        { _id: 'role2', role_name: 'Waiter', permissions: ['POS'] }
      ];
      
      mockRoleFind.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockRoles)
      });

      // Act
      await listRoles(req as Request, res as Response, next);

      // Assert
      expect(mockRoleFind).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(mockRoles);
    });
  });

  describe('POST /staff/roles', () => {
    it('should create role and return 201', async () => {
      // Arrange
      const mockRole = {
        _id: 'newrole',
        restaurant_id: 'rest123',
        role_name: 'Manager',
        permissions: ['POS', 'KDS']
      };
      
      req.body = { role_name: 'Manager', permissions: ['POS', 'KDS'] };
      
      mockRoleCreate.mockResolvedValue(mockRole);

      // Act
      await createRole(req as Request, res as Response, next);

      // Assert
      expect(mockRoleCreate).toHaveBeenCalledWith(expect.objectContaining({
        role_name: 'Manager',
        permissions: ['POS', 'KDS']
      }));
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(mockRole);
    });

    it('should handle empty permissions array', async () => {
      // Arrange
      req.body = { role_name: 'Basic', permissions: [] };
      
      mockRoleCreate.mockResolvedValue({
        _id: 'role1',
        role_name: 'Basic',
        permissions: []
      });

      // Act
      await createRole(req as Request, res as Response, next);

      // Assert
      expect(mockRoleCreate).toHaveBeenCalledWith(expect.objectContaining({
        permissions: []
      }));
    });
  });

  describe('PATCH /staff/me/preferences', () => {
    it('should update user preferences', async () => {
      // Arrange
      const mockStaff = {
        _id: 'staff123',
        language: 'es',
        theme: 'light',
        save: jest.fn().mockResolvedValue(true)
      };
      
      req.body = { language: 'en', theme: 'dark' };
      
      mockStaffFindById.mockResolvedValue(mockStaff);

      // Act
      await updateMyPreferences(req as Request, res as Response, next);

      // Assert
      expect(mockStaff.language).toBe('en');
      expect(mockStaff.theme).toBe('dark');
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        message: 'PREFERENCES_UPDATED',
        preferences: { language: 'en', theme: 'dark' }
      }));
    });

    it('should reject invalid language values', async () => {
      // Arrange
      const mockStaff = {
        _id: 'staff123',
        language: 'es',
        theme: 'light',
        save: jest.fn().mockResolvedValue(true)
      };
      
      req.body = { language: 'fr', theme: 'invalid_theme' };
      
      mockStaffFindById.mockResolvedValue(mockStaff);

      // Act
      await updateMyPreferences(req as Request, res as Response, next);

      // Assert - invalid values should be ignored
      expect(mockStaff.language).toBe('es');
      expect(mockStaff.theme).toBe('light');
    });

    it('should throw 404 when user not found', async () => {
      // Arrange
      req.body = { language: 'en' };
      
      mockStaffFindById.mockResolvedValue(null);

      // Act
      await updateMyPreferences(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      const errorArg = (next as jest.Mock).mock.calls[0][0];
      expect(errorArg.message).toBe('USER_NOT_FOUND');
    });

    it('should handle partial updates', async () => {
      // Arrange
      const mockStaff = {
        _id: 'staff123',
        language: 'es',
        theme: 'light',
        save: jest.fn().mockResolvedValue(true)
      };
      
      req.body = { theme: 'dark' };
      
      mockStaffFindById.mockResolvedValue(mockStaff);

      // Act
      await updateMyPreferences(req as Request, res as Response, next);

      // Assert
      expect(mockStaff.language).toBe('es'); // unchanged
      expect(mockStaff.theme).toBe('dark');
    });
  });

  describe('GET /staff/me', () => {
    it('should return current user profile', async () => {
      // Arrange
      const mockProfile = {
        _id: 'staff123',
        staff_name: 'Test User',
        username: 'testuser',
        role_id: { role_name: 'Admin', permissions: ['ADMIN'] },
        language: 'es',
        theme: 'light'
      };
      
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockProfile)
      };
      
      mockStaffFindById.mockReturnValue(mockQuery);

      // Act
      await getMyProfile(req as Request, res as Response, next);

      // Assert
      expect(mockStaffFindById).toHaveBeenCalledWith('staff123');
      expect(jsonMock).toHaveBeenCalledWith(mockProfile);
    });

    it('should exclude password fields from profile', async () => {
      // Arrange
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({})
      };
      
      mockStaffFindById.mockReturnValue(mockQuery);

      // Act
      await getMyProfile(req as Request, res as Response, next);

      // Assert
      expect(mockQuery.select).toHaveBeenCalledWith('-password_hash -pin_code_hash');
    });

    it('should throw 404 when profile not found', async () => {
      // Arrange
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null)
      };
      
      mockStaffFindById.mockReturnValue(mockQuery);

      // Act
      await getMyProfile(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      const errorArg = (next as jest.Mock).mock.calls[0][0];
      expect(errorArg.message).toBe('USER_NOT_FOUND');
    });
  });
});
