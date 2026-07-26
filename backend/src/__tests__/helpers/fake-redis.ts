/**
 * In-memory fake of the node-redis client for unit tests.
 * Implements just the commands used by the totem session state store,
 * backed by plain Maps so tests can also inspect/seed data directly
 * (e.g. to simulate writes coming from another node).
 */
export function createFakeRedis() {
  const strings = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const expirations = new Map<string, number>();

  const client = {
    isReady: true,
    set: jest.fn(async (key: string, value: string, options?: { EX?: number }) => {
      strings.set(key, value);
      if (options?.EX) expirations.set(key, options.EX);
      return 'OK';
    }),
    del: jest.fn(async (key: string) => {
      const existed = strings.delete(key) || hashes.delete(key);
      expirations.delete(key);
      return existed ? 1 : 0;
    }),
    exists: jest.fn(async (key: string) => (strings.has(key) || hashes.has(key) ? 1 : 0)),
    expire: jest.fn(async (key: string, seconds: number) => {
      if (!strings.has(key) && !hashes.has(key)) return 0;
      expirations.set(key, seconds);
      return 1;
    }),
    hSet: jest.fn(async (key: string, field: string, value: string) => {
      let hash = hashes.get(key);
      if (!hash) {
        hash = new Map();
        hashes.set(key, hash);
      }
      hash.set(field, value);
      return 1;
    }),
    hDel: jest.fn(async (key: string, field: string) => {
      const hash = hashes.get(key);
      if (!hash) return 0;
      const deleted = hash.delete(field) ? 1 : 0;
      if (hash.size === 0) hashes.delete(key);
      return deleted;
    }),
    hLen: jest.fn(async (key: string) => hashes.get(key)?.size ?? 0),
    hVals: jest.fn(async (key: string) => Array.from(hashes.get(key)?.values() ?? [])),
  };

  function reset(): void {
    strings.clear();
    hashes.clear();
    expirations.clear();
    jest.clearAllMocks();
  }

  return { client, strings, hashes, expirations, reset };
}
