/**
 * Socket auth middleware — public totem handshake validation.
 *
 * A public totem connection must present a valid QR token at handshake time.
 * A bare `publicTotem: true` flag without a QR, or a flag with an unknown QR,
 * must be rejected. Authenticated staff connections still require a valid JWT
 * cookie/Bearer token and are exercised here only to confirm they are not
 * affected by the public path.
 */

import { socketAuthMiddleware, AuthenticatedSocket } from '../middlewares/socketAuth';
import * as TotemService from '../services/totem.service';
import { ErrorCode } from '@disherio/shared';
import { isAccessTokenRevoked } from '../services/refresh-token.service';
import jwt from 'jsonwebtoken';

jest.mock('../services/refresh-token.service', () => ({
  isAccessTokenRevoked: jest.fn().mockResolvedValue(false),
}));

jest.mock('../services/totem.service');

const VALID_QR = '11111111-1111-4111-8111-111111111111';

function buildSocket(handshakeAuth: unknown): AuthenticatedSocket {
  return {
    handshake: {
      auth: handshakeAuth,
      headers: {},
    },
    data: {},
  } as unknown as AuthenticatedSocket;
}

function nextCapture(): { fn: jest.Mock; calls: unknown[] } {
  const calls: unknown[] = [];
  const fn = jest.fn((err?: Error) => {
    calls.push(err);
  });
  return { fn, calls };
}

describe('socketAuthMiddleware — public totem handshake', () => {
  afterEach(() => jest.resetAllMocks());

  it('accepts a public connection with a valid QR', async () => {
    (TotemService.getTotemByQR as jest.Mock).mockResolvedValue({ _id: 't1', totem_qr: VALID_QR });
    const socket = buildSocket({ publicTotem: true, qr: VALID_QR });
    const { fn, calls } = nextCapture();

    await socketAuthMiddleware(socket, fn);

    expect(TotemService.getTotemByQR).toHaveBeenCalledWith(VALID_QR);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBeUndefined(); // next() with no error
    expect(socket.user).toBeUndefined();
    expect(socket.data.publicTotem).toBe(true);
    expect(socket.data.totemQr).toBe(VALID_QR);
  });

  it('rejects a public connection when the QR is missing', async () => {
    const socket = buildSocket({ publicTotem: true });
    const { fn, calls } = nextCapture();

    await socketAuthMiddleware(socket, fn);

    expect(TotemService.getTotemByQR).not.toHaveBeenCalled();
    expect(calls[0]).toBeInstanceOf(Error);
    expect((calls[0] as Error).message).toBe(ErrorCode.AUTHENTICATION_REQUIRED);
  });

  it('rejects a public connection with an empty/whitespace QR', async () => {
    const socket = buildSocket({ publicTotem: true, qr: '   ' });
    const { fn, calls } = nextCapture();

    await socketAuthMiddleware(socket, fn);

    expect(TotemService.getTotemByQR).not.toHaveBeenCalled();
    expect((calls[0] as Error).message).toBe(ErrorCode.AUTHENTICATION_REQUIRED);
  });

  it('rejects a public connection when the QR does not match a totem', async () => {
    (TotemService.getTotemByQR as jest.Mock).mockResolvedValue(null);
    const socket = buildSocket({ publicTotem: true, qr: 'unknown-qr' });
    const { fn, calls } = nextCapture();

    await socketAuthMiddleware(socket, fn);

    expect(TotemService.getTotemByQR).toHaveBeenCalledWith('unknown-qr');
    expect((calls[0] as Error).message).toBe(ErrorCode.TOTEM_NOT_FOUND);
  });

  it('rejects a public connection when QR lookup throws', async () => {
    (TotemService.getTotemByQR as jest.Mock).mockRejectedValue(new Error('db down'));
    const socket = buildSocket({ publicTotem: true, qr: VALID_QR });
    const { fn, calls } = nextCapture();

    await socketAuthMiddleware(socket, fn);

    expect((calls[0] as Error).message).toBe(ErrorCode.AUTHENTICATION_REQUIRED);
  });

  it('rejects a non-public connection with no token', async () => {
    const socket = buildSocket(undefined);
    const { fn, calls } = nextCapture();

    await socketAuthMiddleware(socket, fn);

    expect(TotemService.getTotemByQR).not.toHaveBeenCalled();
    expect((calls[0] as Error).message).toBe(ErrorCode.AUTHENTICATION_REQUIRED);
  });

  it('fails closed when Redis revocation lookup fails', async () => {
    process.env.JWT_SECRET = 'socket-test-secret-that-is-at-least-32-chars';
    const token = jwt.sign({
      staffId: 'staff1',
      restaurantId: 'restaurant1',
      role: 'ADMIN',
      permissions: ['ADMIN'],
      name: 'Admin',
    }, process.env.JWT_SECRET);
    (isAccessTokenRevoked as jest.Mock).mockRejectedValueOnce(new Error('redis unavailable'));
    const socket = buildSocket({ token });
    const { fn } = nextCapture();

    await expect(socketAuthMiddleware(socket, fn)).rejects.toThrow('redis unavailable');
    expect(fn).not.toHaveBeenCalled();
    expect(socket.user).toBeUndefined();
  });
});
