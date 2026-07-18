import { Request } from 'express';
import { getHttpMethodLabel, getHttpRouteLabel } from '../utils/http-route-label';

describe('bounded HTTP route labels', () => {
  it('uses the Express template instead of a sensitive concrete path', () => {
    const req = {
      baseUrl: '/api/totems',
      route: { path: '/qr/:qr' },
      path: '/qr/secret-token',
      originalUrl: '/api/totems/qr/secret-token',
    } as unknown as Request;

    expect(getHttpRouteLabel(req)).toBe('/api/totems/qr/:qr');
    expect(getHttpRouteLabel(req)).not.toContain('secret-token');
  });

  it('uses one bounded label for unmatched and static requests', () => {
    expect(getHttpRouteLabel({ baseUrl: '', route: undefined } as unknown as Request))
      .toBe('unmatched');
  });

  it('bounds unexpected HTTP method labels', () => {
    expect(getHttpMethodLabel('post')).toBe('POST');
    expect(getHttpMethodLabel('ATTACKER-CONTROLLED')).toBe('OTHER');
  });
});
