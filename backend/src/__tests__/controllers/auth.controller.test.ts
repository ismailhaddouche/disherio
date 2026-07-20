import { Request, Response, NextFunction } from 'express';
import { loginUsername, loginPin, logout, refresh } from '../../controllers/auth.controller';
import * as authService from '../../services/auth.service';

// Mock auth service
jest.mock('../../services/auth.service');
jest.mock('../../services/refresh-token.service', () => ({
  rotateRefreshToken: jest.fn(),
  blocklistAccessToken: jest.fn(),
  revokeRefreshFamily: jest.fn(),
  verifyRefreshToken: jest.fn(),
  isAccessTokenRevoked: jest.fn(),
  generateAccessToken: jest.fn(),
}));
jest.mock('../../services/socket-session.service', () => ({
  disconnectStaffSockets: jest.fn().mockResolvedValue(undefined),
}));

import {
  revokeRefreshFamily,
  verifyRefreshToken,
} from '../../services/refresh-token.service';
import { disconnectStaffSockets } from '../../services/socket-session.service';

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
    it('should return user data and token lifetime on valid credentials', async () => {
      // Arrange
      const mockUser = {
        staffId: 'staff123',
        restaurantId: 'rest123',
        role: 'ADMIN',
        permissions: ['ADMIN'],
        name: 'Test User',
        preferences: { language: 'es', theme: 'light' }
      };
      const mockAccessToken = 'jwt_token_123';
      const mockRefreshToken = 'refresh_token_123';

      req = {
        body: { username: 'testuser', password: 'password123' },
        secure: false,
        headers: {}
      };

      (authService.loginWithUsername as jest.Mock).mockResolvedValue({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        user: mockUser
      });

      // Act
      await loginUsername(req as Request, res as Response, next);

      // Assert
      expect(authService.loginWithUsername).toHaveBeenCalledWith('testuser', 'password123', undefined);
      expect(cookieMock).toHaveBeenNthCalledWith(
        1,
        'auth_token',
        mockAccessToken,
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          path: '/'
        })
      );
      expect(cookieMock).toHaveBeenNthCalledWith(
        2,
        'refresh_token',
        mockRefreshToken,
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          path: '/'
        })
      );
      expect(jsonMock).toHaveBeenCalledWith({
        user: mockUser,
        expires_in_ms: expect.any(Number)
      });
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
      await loginUsername(req as Request, res as Response, next);

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
        accessToken: 'jwt_token',
        refreshToken: 'refresh_token',
        user: mockUser
      });

      // Act
      await loginUsername(req as Request, res as Response, next);

      // Assert
      expect(cookieMock).toHaveBeenNthCalledWith(
        1,
        'auth_token',
        'jwt_token',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'lax'
        })
      );
    });

    it('should trust x-forwarded-proto: https from a proxy', async () => {
      // Arrange
      req = {
        body: { username: 'testuser', password: 'password123' },
        secure: false,
        headers: { 'x-forwarded-proto': 'https' },
        app: { get: jest.fn().mockReturnValue(1) } as any,
      };

      (authService.loginWithUsername as jest.Mock).mockResolvedValue({
        accessToken: 'jwt_token',
        refreshToken: 'refresh_token',
        user: { name: 'Test' }
      });

      // Act
      await loginUsername(req as Request, res as Response, next);

      // Assert
      expect(cookieMock).toHaveBeenNthCalledWith(
        1,
        'auth_token',
        'jwt_token',
        expect.objectContaining({
          secure: true,
          sameSite: 'lax'
        })
      );
    });
  });

  describe('POST /login/pin', () => {
    it('should return user data and token lifetime on valid PIN', async () => {
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
        accessToken: 'pin_jwt_token',
        refreshToken: 'pin_refresh_token',
        user: mockUser
      });

      // Act
      await loginPin(req as Request, res as Response, next);

      // Assert
      expect(authService.loginWithPin).toHaveBeenCalledWith('1234', 'rest123', undefined);
      expect(cookieMock).toHaveBeenNthCalledWith(
        1,
        'auth_token',
        'pin_jwt_token',
        expect.any(Object)
      );
      expect(cookieMock).toHaveBeenNthCalledWith(
        2,
        'refresh_token',
        'pin_refresh_token',
        expect.any(Object)
      );
      expect(jsonMock).toHaveBeenCalledWith({
        user: mockUser,
        expires_in_ms: expect.any(Number)
      });
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
      await loginPin(req as Request, res as Response, next);

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
      await loginPin(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
    });
  });

  describe('POST /logout', () => {
    it('should clear auth cookie and return success message', async () => {
      // Arrange
      req = {
        secure: false,
        headers: {},
        user: {
          staffId: 'staff123', restaurantId: 'rest123', role: 'ADMIN',
          permissions: ['ADMIN'], name: 'Test User'
        }
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
      expect(disconnectStaffSockets).toHaveBeenCalledWith('staff123');
    });

    it('should clear secure cookie when request is HTTPS', async () => {
      // Arrange
      req = {
        secure: true,
        headers: {},
        user: {
          staffId: 'staff123', restaurantId: 'rest123', role: 'ADMIN',
          permissions: ['ADMIN'], name: 'Test User'
        }
      };

      // Act
      await logout(req as Request, res as Response, next);

      // Assert
      expect(clearCookieMock).toHaveBeenCalledWith(
        'auth_token',
        expect.objectContaining({
          secure: true,
          sameSite: 'lax'
        })
      );
    });

    it('revokes the refresh family without a valid access-token user', async () => {
      req = {
        secure: false,
        headers: {},
        cookies: { refresh_token: 'opaque-refresh-token' },
      };
      (verifyRefreshToken as jest.Mock).mockResolvedValue({
        valid: true,
        family: 'family-1',
        payload: { staffId: 'staff123' },
      });

      await logout(req as Request, res as Response, next);

      expect(revokeRefreshFamily).toHaveBeenCalledWith('family-1');
      expect(disconnectStaffSockets).toHaveBeenCalledWith('staff123');
      expect(clearCookieMock).toHaveBeenCalledWith('refresh_token', expect.any(Object));
      expect(jsonMock).toHaveBeenCalledWith({ message: 'LOGOUT_SUCCESS' });
    });
  });

  describe('POST /refresh', () => {
    it('rejects a refresh token supplied only in the request body', async () => {
      req = {
        body: { refresh_token: 'body-token' },
        secure: false,
        headers: {},
      };

      await refresh(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        message: 'INVALID_TOKEN',
        statusCode: 401,
      }));
      expect(jsonMock).not.toHaveBeenCalled();
    });
  });
});
