import os from 'os';
import path from 'path';

process.env.MONGODB_URI = process.env.MONGODB_URI_TEST
  || process.env.MONGODB_URI
  || 'mongodb://localhost:27017/disherio_test';
process.env.JWT_SECRET = 'test_secret_at_least_32_characters_long_for_jwt_validation';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_at_least_32_characters_long_for_jwt_validation';
process.env.JWT_EXPIRES = '15m';
process.env.JWT_REFRESH_EXPIRES = '7d';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(os.tmpdir(), 'disherio-test-uploads');

// Mock logger before any imports (the module supports both default and named imports).
jest.mock('../config/logger', () => {
  const logger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
  return { __esModule: true, default: logger, logger };
});

// Mock socket.io
jest.mock('../config/socket', () => ({
  getIO: jest.fn(() => {
    const target = { emit: jest.fn(), to: jest.fn() };
    target.to.mockReturnValue(target);
    return { to: jest.fn(() => target) };
  })
}));

// Mock socket handlers
jest.mock('../sockets/tas.handler', () => ({
  notifyTASNewOrder: jest.fn()
}));

jest.mock('../sockets/pos.handler', () => ({
  emitSessionClosed: jest.fn(),
  emitSessionReopened: jest.fn(),
  emitSessionArchived: jest.fn(),
  emitTicketPaid: jest.fn(),
  notifyPOSNewOrder: jest.fn()
}));

jest.mock('../sockets/totem.handler', () => ({
  notifyCustomerItemUpdate: jest.fn(),
  closeSessionForCustomers: jest.fn(async () => true),
  cancelPendingSessionClose: jest.fn()
}));

// Mock cache service
jest.mock('../services/cache.service', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn()
  },
  CacheKeys: {
    dishById: (id: string) => `dish:${id}`,
    dishByRestaurant: (id: string) => `dishes:${id}`,
    categoryById: (id: string) => `category:${id}`,
    categoriesByRestaurant: (id: string) => `categories:${id}`
  }
}));
