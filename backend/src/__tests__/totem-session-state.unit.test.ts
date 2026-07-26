/**
 * Unit tests for the shared totem session state store
 * (Redis-backed with in-memory fallback for development/tests).
 */

import { getRedisClient, initRedis } from '../config/redis';
import { createFakeRedis } from './helpers/fake-redis';

const fakeRedis = createFakeRedis();

jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn(() => fakeRedis.client),
  initRedis: jest.fn(async () => fakeRedis.client),
}));

const getRedisClientMock = getRedisClient as jest.Mock;
const initRedisMock = initRedis as jest.Mock;

describe('totem session state store', () => {
  beforeEach(() => {
    jest.resetModules();
    fakeRedis.reset();
    getRedisClientMock.mockImplementation(() => fakeRedis.client);
    initRedisMock.mockImplementation(async () => fakeRedis.client);
  });

  describe('"session closing" marks', () => {
    it('marks and unmarks a session as closing with a per-entry TTL', async () => {
      const state = await import('../sockets/totem-session-state');

      await state.markSessionClosing('s1');
      expect(await state.isSessionClosing('s1')).toBe(true);
      expect(fakeRedis.client.set).toHaveBeenCalledWith('totem:closing:s1', '1', { EX: 30 });

      await state.unmarkSessionClosing('s1');
      expect(await state.isSessionClosing('s1')).toBe(false);
    });

    it('keeps every mark independent no matter how many sessions are closing', async () => {
      // Regression test: the old in-memory Set was wiped with a global
      // clear() when it grew past 500 entries, losing every pending mark.
      const state = await import('../sockets/totem-session-state');

      for (let i = 0; i < 600; i++) {
        await state.markSessionClosing(`s${i}`);
      }

      expect(await state.isSessionClosing('s0')).toBe(true);
      expect(await state.isSessionClosing('s599')).toBe(true);
      expect(await state.isSessionClosing('unknown')).toBe(false);
    });
  });

  describe('session customers (who is at the table)', () => {
    it('adds, reads, counts and removes customers with a refreshed TTL', async () => {
      const state = await import('../sockets/totem-session-state');

      await state.addSessionCustomer('s1', { customerId: 'c1', customerName: 'Ana', socketId: 'sock-1', joinedAt: 't1' });
      await state.addSessionCustomer('s1', { customerId: 'c2', customerName: 'Luis', socketId: 'sock-2', joinedAt: 't2' });

      expect(await state.getSessionCustomerCount('s1')).toBe(2);
      const customers = await state.getSessionCustomers('s1');
      expect(customers.map(c => c.customerName).sort()).toEqual(['Ana', 'Luis']);
      // Every write refreshes the 24h inactivity TTL
      expect(fakeRedis.client.expire).toHaveBeenCalledWith('totem:session_customers:s1', 24 * 60 * 60);

      expect(await state.removeSessionCustomer('s1', 'sock-1')).toBe(1);
      expect(await state.removeSessionCustomer('s1', 'sock-2')).toBe(0);
      // The hash disappears once the table is empty
      expect(await state.getSessionCustomerCount('s1')).toBe(0);
    });

    it('sees customers written straight into Redis by another node', async () => {
      const state = await import('../sockets/totem-session-state');

      // Simulate a join handled by a different backend node
      fakeRedis.hashes.set(
        'totem:session_customers:s9',
        new Map([['sock-remote', JSON.stringify({ customerName: 'Remote', socketId: 'sock-remote', joinedAt: 't' })]])
      );

      expect(await state.getSessionCustomerCount('s9')).toBe(1);
      expect(await state.getSessionCustomers('s9')).toEqual([
        { customerName: 'Remote', socketId: 'sock-remote', joinedAt: 't' },
      ]);
    });

    it('clears all customers of a session at once', async () => {
      const state = await import('../sockets/totem-session-state');

      await state.addSessionCustomer('s1', { customerName: 'Ana', socketId: 'sock-1', joinedAt: 't1' });
      await state.clearSessionCustomers('s1');

      expect(await state.getSessionCustomerCount('s1')).toBe(0);
      expect(fakeRedis.client.del).toHaveBeenCalledWith('totem:session_customers:s1');
    });
  });

  describe('in-memory fallback (Redis unavailable)', () => {
    beforeEach(() => {
      getRedisClientMock.mockImplementation(() => { throw new Error('Redis not initialized'); });
      initRedisMock.mockRejectedValue(new Error('connection refused'));
    });

    it('keeps working with the same semantics', async () => {
      const state = await import('../sockets/totem-session-state');

      await state.markSessionClosing('s1');
      expect(await state.isSessionClosing('s1')).toBe(true);
      await state.unmarkSessionClosing('s1');
      expect(await state.isSessionClosing('s1')).toBe(false);

      await state.addSessionCustomer('s1', { customerName: 'Ana', socketId: 'sock-1', joinedAt: 't1' });
      expect(await state.getSessionCustomerCount('s1')).toBe(1);
      expect(await state.removeSessionCustomer('s1', 'sock-1')).toBe(0);
    });

    it('also keeps closing marks independent in the fallback', async () => {
      const state = await import('../sockets/totem-session-state');

      for (let i = 0; i < 600; i++) {
        await state.markSessionClosing(`s${i}`);
      }

      expect(await state.isSessionClosing('s0')).toBe(true);
      expect(await state.isSessionClosing('s599')).toBe(true);
    });
  });
});
