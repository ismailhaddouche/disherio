import { Request } from 'express';

const HTTP_METHOD_LABELS = new Set([
  'DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT',
]);

export function getHttpMethodLabel(method: string): string {
  const normalized = method.toUpperCase();
  return HTTP_METHOD_LABELS.has(normalized) ? normalized : 'OTHER';
}

/**
 * Returns the Express route template without including user-controlled path
 * segments. Unmatched and static requests share a bounded fallback label.
 */
export function getHttpRouteLabel(req: Request): string {
  const routePath: unknown = req.route?.path;
  if (typeof routePath !== 'string') return 'unmatched';

  return `${req.baseUrl}${routePath}` || '/';
}
