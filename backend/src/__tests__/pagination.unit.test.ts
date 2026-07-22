import type { Request } from 'express';
import { getPaginationParams } from '../utils/pagination';

function requestWithQuery(query: Record<string, unknown>): Request {
  return { query } as unknown as Request;
}

describe('pagination parameters', () => {
  it('uses bounded positive integers', () => {
    expect(getPaginationParams(requestWithQuery({ page: '3', limit: '25' })))
      .toEqual({ page: 3, limit: 25, skip: 50 });
    expect(getPaginationParams(requestWithQuery({ page: '999999', limit: '999' })))
      .toEqual({ page: 10_000, limit: 100, skip: 999_900 });
  });

  it.each([
    { page: '-1', limit: '0' },
    { page: '2junk', limit: '5.5' },
    { page: '9'.repeat(400), limit: ['10'] },
  ])('falls back safely for malformed or unsafe values: %p', (query) => {
    expect(getPaginationParams(requestWithQuery(query)))
      .toEqual({ page: 1, limit: 50, skip: 0 });
  });
});
