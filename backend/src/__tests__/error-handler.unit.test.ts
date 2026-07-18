import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { errorHandler } from '../middlewares/error-handler';
import { AppError } from '../utils/async-handler';
import { ErrorCode } from '@disherio/shared';

describe('errorHandler', () => {
  it('preserves INVALID_PRICE status and structured details', () => {
    const error = new AppError(ErrorCode.INVALID_PRICE, 400, {
      invalidPrices: [{ field: 'item_base_price', value: -1 }],
    });
    const status = jest.fn();
    const json = jest.fn();
    const response = { status, json } as unknown as Response;
    status.mockReturnValue(response);

    errorHandler(error, { lang: 'en' } as Request, response, jest.fn());

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      errorCode: ErrorCode.INVALID_PRICE,
      status: 400,
      details: error.details,
    }));
  });

  it('maps malformed ObjectIds to INVALID_ID_FORMAT instead of a 500', () => {
    let bsonError: Error;
    try {
      new Types.ObjectId('invalid');
      throw new Error('Expected ObjectId construction to fail');
    } catch (error) {
      bsonError = error as Error;
    }

    const status = jest.fn();
    const json = jest.fn();
    const response = { status, json } as unknown as Response;
    status.mockReturnValue(response);

    errorHandler(bsonError!, { lang: 'en' } as Request, response, jest.fn());

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      errorCode: 'INVALID_ID_FORMAT',
      status: 400,
    }));
  });
});
