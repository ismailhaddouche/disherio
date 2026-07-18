import { generateRateLimitKey } from '../middlewares/rateLimit.config';

describe('HTTP rate-limit keys', () => {
  it('does not reset the bucket when a route parameter changes', () => {
    const request = (path: string) => ({
      path,
      user: { staffId: 'staff-1' },
    }) as never;

    expect(generateRateLimitKey(request('/menu/qr-a')))
      .toBe(generateRateLimitKey(request('/menu/qr-b')));
  });
});
