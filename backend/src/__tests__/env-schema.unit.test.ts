import { envSchema } from '../config/env';

const validEnv = {
  JWT_SECRET: 'a-secret-that-is-at-least-32-characters-long',
  JWT_REFRESH_SECRET: 'a-refresh-secret-at-least-32-chars-long',
  MONGODB_URI: 'mongodb://localhost:27017/disherio_test',
};

describe('env schema validation', () => {
  describe('integer variables', () => {
    it('parses a valid PORT and applies defaults', () => {
      const config = envSchema.parse({ ...validEnv, PORT: '8080' });

      expect(config.PORT).toBe(8080);
      expect(config.MONGODB_MAX_POOL_SIZE).toBe(50);
      expect(config.BCRYPT_ROUNDS).toBe(12);
    });

    it.each([
      ['PORT', 'abc'],
      ['PORT', '3000x'],
      ['PORT', '0'],
      ['PORT', '65536'],
      ['BCRYPT_ROUNDS', 'abc'],
      ['BCRYPT_ROUNDS', '9'],
      ['BCRYPT_ROUNDS', '16'],
      ['MONGODB_MAX_POOL_SIZE', 'abc'],
      ['MONGODB_MAX_POOL_SIZE', '0'],
      ['MONGODB_MAX_POOL_SIZE', '1001'],
      ['MONGODB_SERVER_SELECTION_TIMEOUT', 'abc'],
      ['MONGODB_SERVER_SELECTION_TIMEOUT', '999'],
      ['MONGODB_SERVER_SELECTION_TIMEOUT', '120001'],
      ['MONGODB_SOCKET_TIMEOUT', 'abc'],
      ['MONGODB_SOCKET_TIMEOUT', '999'],
      ['MONGODB_SOCKET_TIMEOUT', '300001'],
    ])('rejects %s=%s', (name, value) => {
      const result = envSchema.safeParse({ ...validEnv, [name]: value });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.includes(name))).toBe(true);
      }
    });
  });

  describe('JWT durations', () => {
    it.each(['60s', '15m', '8h', '1d'])('accepts JWT_EXPIRES=%s', (value) => {
      const config = envSchema.parse({ ...validEnv, JWT_EXPIRES: value });

      expect(config.JWT_EXPIRES).toBe(value);
    });

    it.each(['abc', '15', '15minutes', 'm15', '-15m', '1.5h', '0s', '59s', '25h'])(
      'rejects JWT_EXPIRES=%s',
      (value) => {
        const result = envSchema.safeParse({ ...validEnv, JWT_EXPIRES: value });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((issue) => issue.path.includes('JWT_EXPIRES'))).toBe(
            true
          );
        }
      }
    );

    it('rejects an invalid JWT_REFRESH_EXPIRES', () => {
      const result = envSchema.safeParse({ ...validEnv, JWT_REFRESH_EXPIRES: 'one week' });

      expect(result.success).toBe(false);
    });

    it('requires refresh tokens to outlive access tokens', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        JWT_EXPIRES: '2h',
        JWT_REFRESH_EXPIRES: '1h',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.includes('JWT_REFRESH_EXPIRES')))
          .toBe(true);
      }
    });
  });

  it('rejects long example placeholders in production', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      NODE_ENV: 'production',
      JWT_SECRET: 'cambiar_esto_por_un_secreto_largo_de_64_caracteres',
    });

    expect(result.success).toBe(false);
  });

  it('requires different access and refresh signing secrets', () => {
    const repeated = 'one-secret-that-is-at-least-32-characters-long';
    const result = envSchema.safeParse({
      ...validEnv,
      JWT_SECRET: repeated,
      JWT_REFRESH_SECRET: repeated,
    });

    expect(result.success).toBe(false);
  });
});
