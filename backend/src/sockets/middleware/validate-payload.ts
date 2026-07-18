import { z } from 'zod';
import { isErrorCode } from '@disherio/shared';
import { AuthenticatedSocket } from '../../middlewares/socketAuth';
import { AppError } from '../../utils/async-handler';

/**
 * Validate an inbound socket payload against a Zod schema. When validation
 * fails, emits a namespaced error event with VALIDATION_ERROR and returns
 * false so the caller can early-return. Returns true when the payload is valid.
 */
export function validateSocketPayload(
  socket: AuthenticatedSocket,
  namespace: 'totem' | 'kds' | 'tas' | 'pos',
  _event: string,
  schema: z.ZodType,
  data: unknown
): boolean {
  const result = schema.safeParse(data);
  if (!result.success) {
    socket.emit(`${namespace}:error`, {
      message: 'VALIDATION_ERROR',
      details: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return false;
  }
  return true;
}

/**
 * Convert a caught error into a safe socket-facing message. Operational
 * AppErrors whose message is a known ErrorCode are forwarded as-is so the
 * client can translate them; everything else becomes INTERNAL_ERROR to
 * avoid leaking internal exception text (DB errors, stack traces, etc.).
 */
export function sanitizeSocketError(err: unknown): string {
  if (err instanceof AppError && typeof err.message === 'string' && isErrorCode(err.message)) {
    return err.message;
  }
  return 'INTERNAL_ERROR';
}