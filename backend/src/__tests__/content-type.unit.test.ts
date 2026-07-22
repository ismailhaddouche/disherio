import { NextFunction, Request, Response } from 'express';
import { requireSupportedContentType } from '../middlewares/content-type';

function request(overrides: Record<string, unknown>): Request {
  return {
    method: 'POST',
    path: '/api/resource',
    get: jest.fn(() => undefined),
    is: jest.fn(() => false),
    ...overrides,
  } as unknown as Request;
}

describe('requireSupportedContentType', () => {
  const response = {} as Response;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    next = jest.fn();
  });

  it('allows DELETE requests without a body or Content-Type', () => {
    requireSupportedContentType(request({ method: 'DELETE' }), response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects API mutations with a body and an unsupported media type', () => {
    const req = request({
      get: jest.fn((name: string) => name === 'content-length' ? '12' : undefined),
    });

    requireSupportedContentType(req, response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'VALIDATION_ERROR',
      statusCode: 400,
    }));
  });

  it('allows JSON request bodies', () => {
    const req = request({
      get: jest.fn((name: string) => name === 'content-length' ? '12' : undefined),
      is: jest.fn((type: string) => type === 'application/json' ? 'application/json' : false),
    });

    requireSupportedContentType(req, response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows multipart bodies only for upload endpoints', () => {
    const req = request({
      path: '/api/uploads/dishes/123',
      get: jest.fn((name: string) => name === 'content-length' ? '128' : undefined),
      is: jest.fn((type: string) => type === 'multipart/form-data' ? 'multipart/form-data' : false),
    });

    requireSupportedContentType(req, response, next);

    expect(next).toHaveBeenCalledWith();
  });
});
