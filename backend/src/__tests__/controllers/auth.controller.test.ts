import { Request, Response, NextFunction } from 'express';
import { loginUsername, loginPin, logout } from '../../controllers/auth.controller';
import * as authService from '../../services/auth.service';

// Mock auth service
jest.mock('../../services/auth.service');

describe('AuthController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let cookieMock: jest.Mock;
  let clearCookieMock: jest.Mock;
  let endMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();
    cookieMock = jest.fn().mockReturnThis();
    clearCookieMock = jest.fn().mockReturnThis();
    endMock = jest.fn().mockReturnThis();
    next = jest.fn();
    
    res = {
      json: jsonMock,
      status: statusMock,
      cookie: cookieMock,
      clearCookie: clearCookieMock,
      end: endMock,
    };
  });

  describe('POST /login/username', () => {
    it('should return 200 and user data with token on valid credentials', async () => {
      // Arrange
      const mockUser = {
        staffId: 'staff123',
        restaurantId: 'rest123',
        role: 'ADMIN',
        permissions: ['ADMIN'],
        name: 'Test User',
        preferences: { language: 'es', theme: 'light' }
      };
      const mockToken = 'jwt_token_123';
      
      req = {
        body: { username: 'testuser', password: 'password123' },
        secure: false,
        headers: {}
      };
      
      (authService.loginWithUsername as jest.Mock).mockResolvedValue({
        token: mockToken,
        user: mockUser
      });

      // Act
      await loginUsername(req as Request, res as Response, next);

      // Assert
      expect(authService.loginWithUsername).toHaveBeenCalledWith('testuser', 'password123');
      expect(cookieMock).toHaveBeenCalledWith(
        'auth_token',
        mockToken,
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          path: '/'
        })
      );
      expect(jsonMock).toHaveBeenCalledWith({ user: mockUser });
    });

    it('should pass error to next on invalid credentials', async () => {
      // Arrange
      req = {
        body: { username: 'testuser', password: 'wrongpassword' },
        secure: false,
        headers: {}
      };
      
      const error = new Error('INVALID_CREDENTIALS');
      (authService.loginWithUsername as jest.Mock).mockRejectedValue(error);

      // Act
      const result = loginUsername(req as Request, res as Response, next);
      
      // Wait for the promise to resolve/reject
      try {
        await result;
      } catch {
        // Expected
      }

      // Assert - asyncHandler catches error and calls next
      expect(next).toHaveBeenCalled();
    });

    it('should set secure cookie when request is HTTPS', async () => {
      // Arrange
      const mockUser = {
        staffId: 'staff123',
        restaurantId: 'rest123',
        role: 'ADMIN',
        permissions: ['ADMIN'],
        name: 'Test User',
        preferences: { language: 'es', theme: 'light' }
      };
      
      req = {
        body: { username: 'testuser', password: 'password123' },
        secure: true,
        headers: {}
      };
      
      (authService.loginWithUsername as jest.Mock).mockResolvedValue({
        token: 'jwt_token',
        user: mockUser
      });

      // Act
      await loginUsername(req as Request, res as Response, next);

      // Assert
      expect(cookieMock).toHaveBeenCalledWith(
        'auth_token',
        'jwt_token',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict'
        })
      );
    });

    it('should detect HTTPS from x-forwarded-proto header', async () => {
      // Arrange
      req = {
        body: { username: 'testuser', password: 'password123' },
        secure: false,
        headers: { 'x-forwarded-proto': 'https' }
      };
      
      (authService.loginWithUsername as jest.Mock).mockResolvedValue({
        token: 'jwt_token',
        user: { name: 'Test' }
      });

      // Act
      await loginUsername(req as Request, res as Response, next);

      // Assert
      expect(cookieMock).toHaveBeenCalledWith(
        'auth_token',
        'jwt_token',
        expect.objectContaining({
          secure: true,
          sameSite: 'strict'
        })
      );
    });
  });

  describe('POST /login/pin', () => {
    it('should return 200 and user data with token on valid PIN', async () => {
      // Arrange
      const mockUser = {
        staffId: 'staff123',
        restaurantId: 'rest123',
        role: 'WAITER',
        permissions: ['POS'],
        name: 'Waiter User',
        preferences: { language: 'es', theme: 'dark' }
      };
      
      req = {
        body: { pin_code: '1234', restaurant_id: 'rest123' },
        secure: false,
        headers: {}
      };
      
      (authService.loginWithPin as jest.Mock).mockResolvedValue({
        token: 'pin_jwt_token',
        user: mockUser
      });

      // Act
      await loginPin(req as Request, res as Response, next);

      // Assert
      expect(authService.loginWithPin).toHaveBeenCalledWith('1234', 'rest123');
      expect(cookieMock).toHaveBeenCalledWith(
        'auth_token',
        'pin_jwt_token',
        expect.any(Object)
      );
      expect(jsonMock).toHaveBeenCalledWith({ user: mockUser });
    });

    it('should pass error to next on invalid PIN', async () => {
      // Arrange
      req = {
        body: { pin_code: '9999', restaurant_id: 'rest123' },
        secure: false,
        headers: {}
      };
      
      const error = new Error('INVALID_PIN');
      (authService.loginWithPin as jest.Mock).mockRejectedValue(error);

      // Act
      try {
        await loginPin(req as Request, res as Response, next);
      } catch {
        // Expected
      }

      // Assert
      expect(next).toHaveBeenCalled();
    });

    it('should pass rate limit error to next', async () => {
      // Arrange
      req = {
        body: { pin_code: '1234', restaurant_id: 'rest123' },
        secure: false,
        headers: {}
      };
      
      const error = new Error('AUTH_RATE_LIMIT_EXCEEDED') as Error & { retryAfter: number };
      error.retryAfter = 300;
      (authService.loginWithPin as jest.Mock).mockRejectedValue(error);

      // Act
      try {
        await loginPin(req as Request, res as Response, next);
      } catch {
        // Expected
      }

      // Assert
      expect(next).toHaveBeenCalled();
    });
  });

  describe('POST /logout', () => {
    it('should clear auth cookie and return success message', async () => {
      // Arrange
      req = {
        secure: false,
        headers: {}
      };

      // Act
      await logout(req as Request, res as Response, next);

      // Assert
      expect(clearCookieMock).toHaveBeenCalledWith(
        'auth_token',
        expect.objectContaining({
          path: '/',
          secure: false,
          sameSite: 'lax'
        })
      );
      expect(jsonMock).toHaveBeenCalledWith({ message: 'LOGOUT_SUCCESS' });
    });

    it('should clear secure cookie when request is HTTPS', async () => {
      // Arrange
      req = {
        secure: true,
        headers: {}
      };

      // Act
      await logout(req as Request, res as Response, next);

      // Assert
      expect(clearCookieMock).toHaveBeenCalledWith(
        'auth_token',
        expect.objectContaining({
          secure: true,
          sameSite: 'strict'
        })
      );
    });
  });
});
