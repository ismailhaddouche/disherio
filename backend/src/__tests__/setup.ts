process.env.MONGODB_URI = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/disherio_test';
process.env.JWT_SECRET = 'test_secret';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Mock logger before any imports
jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }
}));

// Mock socket.io
jest.mock('../config/socket', () => ({
  getIO: jest.fn(() => ({
    to: jest.fn(() => ({
      emit: jest.fn()
    }))
  }))
}));

// Mock socket handlers
jest.mock('../sockets/tas.handler', () => ({
  notifyTASNewOrder: jest.fn()
}));

jest.mock('../sockets/pos.handler', () => ({
  emitSessionFullyPaid: jest.fn(),
  emitTicketPaid: jest.fn()
}));

jest.mock('../sockets/totem.handler', () => ({
  notifyCustomerItemUpdate: jest.fn()
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

// Mock transactions
jest.mock('../utils/transactions', () => ({
  withTransaction: jest.fn(async (fn: any) => fn(null))
}));

// Mock pin-security service
jest.mock('../services/pin-security.service', () => ({
  createIdentifier: jest.fn((username: string) => username),
  recordFailedAttempt: jest.fn(),
  isLocked: jest.fn().mockReturnValue(false),
  getRemainingLockTime: jest.fn().mockReturnValue(0),
  clearAttempts: jest.fn()
}));
