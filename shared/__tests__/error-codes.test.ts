import { describe, it, expect } from 'vitest';
import { ErrorCode, ERROR_HTTP_STATUS_MAP, isErrorCode } from '../errors/error-codes';

describe('ErrorCode / ERROR_HTTP_STATUS_MAP', () => {
  it('maps every ErrorCode to an HTTP status', () => {
    const codes = Object.values(ErrorCode);
    for (const code of codes) {
      expect(
        ERROR_HTTP_STATUS_MAP[code],
        `missing HTTP status mapping for ${code}`
      ).toBeTypeOf('number');
    }
    expect(Object.keys(ERROR_HTTP_STATUS_MAP)).toHaveLength(codes.length);
  });

  it('maps representative codes to their documented statuses', () => {
    expect(ERROR_HTTP_STATUS_MAP[ErrorCode.UNAUTHORIZED]).toBe(401);
    expect(ERROR_HTTP_STATUS_MAP[ErrorCode.FORBIDDEN]).toBe(403);
    expect(ERROR_HTTP_STATUS_MAP[ErrorCode.DISH_NOT_FOUND]).toBe(404);
    expect(ERROR_HTTP_STATUS_MAP[ErrorCode.USER_ALREADY_EXISTS]).toBe(409);
    expect(ERROR_HTTP_STATUS_MAP[ErrorCode.RATE_LIMIT_EXCEEDED]).toBe(429);
    expect(ERROR_HTTP_STATUS_MAP[ErrorCode.SERVICE_UNAVAILABLE]).toBe(503);
  });
});

describe('isErrorCode', () => {
  it('recognizes valid codes and rejects anything else', () => {
    expect(isErrorCode('UNAUTHORIZED')).toBe(true);
    expect(isErrorCode('SESSION_NOT_FOUND')).toBe(true);
    expect(isErrorCode('unauthorized')).toBe(false);
    expect(isErrorCode('DOES_NOT_EXIST')).toBe(false);
    expect(isErrorCode('')).toBe(false);
  });
});
