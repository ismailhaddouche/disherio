jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn(() => { throw new Error('not initialized'); }),
  initRedis: jest.fn(async () => { throw new Error('unavailable'); }),
}));

jest.mock('../config/socket', () => ({
  getIO: jest.fn(() => ({ to: jest.fn(() => ({ emit: jest.fn() })) })),
}));

// NOTE: the socket handlers are loaded via jest.requireActual inside the
// describes instead of static imports. tas.handler <-> totem.handler form a
// circular import, and a static `import` here resolves through that cycle
// yielding a partially-initialized module (registerTasHandlers undefined).
import { rateLimitMiddleware } from '../sockets/middleware/rate-limiter';
import type { AuthenticatedSocket } from '../middlewares/socketAuth';

type Handler = (...args: never[]) => unknown;

function fakeSocket(permissions: string[]) {
  const handlers: Record<string, Handler> = {};
  const socket = {
    id: 'sock-malformed-1',
    user: {
      staffId: 'staff-1',
      restaurantId: 'restaurant-1',
      name: 'Tester',
      permissions,
    },
    data: {},
    handshake: { address: '127.0.0.1', headers: {} },
    conn: { remoteAddress: '127.0.0.1' },
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    removeAllListeners: jest.fn(),
    on: jest.fn((event: string, cb: Handler) => {
      handlers[event] = cb;
    }),
  };
  return {
    socket: socket as unknown as AuthenticatedSocket,
    handlers,
    emitMock: socket.emit,
  };
}

function expectNamespacedError(
  emitMock: jest.Mock,
  event: string,
  message: string
): void {
  expect(emitMock).toHaveBeenCalledWith(
    event,
    expect.objectContaining({ message })
  );
}

describe('Malformed socket payloads (null/undefined)', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('KDS handlers', () => {
    const { registerKdsHandlers } = jest.requireActual('../sockets/kds.handler') as typeof import('../sockets/kds.handler');
    const { socket, handlers, emitMock } = fakeSocket(['KTS']);
    registerKdsHandlers({} as never, socket);

    it.each(['kds:item_prepare', 'kds:item_cancel', 'kds:item_serve'])(
      '%s with undefined payload resolves and emits kds:error',
      async (event) => {
        await expect(handlers[event](undefined as never)).resolves.toBeUndefined();
        expectNamespacedError(emitMock, 'kds:error', 'INVALID_ITEM_ID');
      }
    );

    it.each(['kds:item_prepare', 'kds:item_cancel', 'kds:item_serve'])(
      '%s with null payload resolves and emits kds:error',
      async (event) => {
        await expect(handlers[event](null as never)).resolves.toBeUndefined();
        expectNamespacedError(emitMock, 'kds:error', 'INVALID_ITEM_ID');
      }
    );

    it('kds:item_prepare with empty object emits kds:error', async () => {
      await expect(handlers['kds:item_prepare']({} as never)).resolves.toBeUndefined();
      expectNamespacedError(emitMock, 'kds:error', 'INVALID_ITEM_ID');
    });
  });

  describe('TAS handlers', () => {
    const { registerTasHandlers } = jest.requireActual('../sockets/tas.handler') as typeof import('../sockets/tas.handler');
    const { socket, handlers, emitMock } = fakeSocket(['TAS']);
    registerTasHandlers({} as never, socket);

    it.each(['tas:serve_service_item', 'tas:cancel_item'])(
      '%s with undefined payload resolves and emits tas:error',
      async (event) => {
        await expect(handlers[event](undefined as never)).resolves.toBeUndefined();
        expectNamespacedError(emitMock, 'tas:error', 'INVALID_ITEM_ID');
      }
    );

    it.each(['tas:serve_service_item', 'tas:cancel_item'])(
      '%s with null payload resolves and emits tas:error',
      async (event) => {
        await expect(handlers[event](null as never)).resolves.toBeUndefined();
        expectNamespacedError(emitMock, 'tas:error', 'INVALID_ITEM_ID');
      }
    );
  });

  describe('rateLimitMiddleware wrapper', () => {
    it('contains a handler that throws while destructuring a null payload', async () => {
      const { socket, emitMock } = fakeSocket(['KTS']);
      // Handler with the old unsafe shape: parameter destructuring throws
      // synchronously when the payload is null/undefined.
      const unsafeHandler = async ({ itemId }: { itemId: string }) => {
        void itemId;
      };
      const wrapped = rateLimitMiddleware(socket, 'kds:item_prepare', unsafeHandler);

      await expect(
        (wrapped as (...args: unknown[]) => Promise<unknown>)(null)
      ).resolves.toBeUndefined();
      expectNamespacedError(emitMock, 'kds:error', 'INTERNAL_ERROR');
    });

    it('contains a handler that rejects unexpectedly', async () => {
      const { socket, emitMock } = fakeSocket(['TAS']);
      const rejectingHandler = async () => {
        throw new Error('boom');
      };
      const wrapped = rateLimitMiddleware(socket, 'tas:cancel_item', rejectingHandler);

      await expect(
        (wrapped as (...args: unknown[]) => Promise<unknown>)({ itemId: 'x' })
      ).resolves.toBeUndefined();
      expectNamespacedError(emitMock, 'tas:error', 'INTERNAL_ERROR');
    });
  });
});
