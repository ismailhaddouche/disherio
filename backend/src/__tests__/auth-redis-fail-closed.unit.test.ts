import jwt from 'jsonwebtoken';
import { authenticate } from '../middlewares/auth';
import { isAccessTokenRevoked } from '../services/refresh-token.service';

jest.mock('../services/refresh-token.service', () => ({
  isAccessTokenRevoked: jest.fn(),
}));

describe('HTTP authentication Redis failure behavior', () => {
  it('does not authorize the request when revocation lookup fails', async () => {
    process.env.JWT_SECRET = 'http-test-secret-that-is-at-least-32-characters';
    const token = jwt.sign({
      staffId: 'staff1',
      restaurantId: 'restaurant1',
      role: 'ADMIN',
      permissions: ['ADMIN'],
      name: 'Admin',
    }, process.env.JWT_SECRET);
    const req = {
      cookies: { auth_token: token },
      headers: {},
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();
    (isAccessTokenRevoked as jest.Mock).mockRejectedValueOnce(new Error('redis unavailable'));

    await expect(authenticate(req as never, res as never, next)).rejects.toThrow('redis unavailable');

    expect(next).not.toHaveBeenCalled();
    expect((req as { user?: unknown }).user).toBeUndefined();
  });
});
