import { NextFunction, Request, Response } from 'express';
import { ErrorCode } from '@disherio/shared';
import { createError } from '../utils/async-handler';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function hasRequestBody(req: Request): boolean {
  if (req.get('transfer-encoding')) return true;

  const contentLength = req.get('content-length');
  if (!contentLength) return false;

  const parsedLength = Number(contentLength);
  return Number.isFinite(parsedLength) && parsedLength > 0;
}

/** Require the declared media type only when an API mutation carries a body. */
export function requireSupportedContentType(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!MUTATION_METHODS.has(req.method) || !req.path.startsWith('/api/') || !hasRequestBody(req)) {
    next();
    return;
  }

  const isJson = Boolean(req.is('application/json'));
  const isUpload = req.path.startsWith('/api/uploads/') && Boolean(req.is('multipart/form-data'));
  if (!isJson && !isUpload) {
    next(createError.badRequest(ErrorCode.VALIDATION_ERROR));
    return;
  }

  next();
}
