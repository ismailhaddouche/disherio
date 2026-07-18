const withTransactionMock = jest.fn();
const endSessionMock = jest.fn();

jest.mock('mongoose', () => ({
  startSession: jest.fn(async () => ({
    withTransaction: withTransactionMock,
    endSession: endSessionMock,
  })),
}));
jest.unmock('../utils/transactions');

import { withTransaction } from '../utils/transactions';

describe('withTransaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates transaction execution to the driver retry callback', async () => {
    withTransactionMock.mockImplementation(async (callback: () => Promise<void>) => {
      await callback();
    });
    const operation = jest.fn().mockResolvedValue('committed-attempt');

    await expect(withTransaction(operation)).resolves.toBe('committed-attempt');
    expect(withTransactionMock).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(endSessionMock).toHaveBeenCalledTimes(1);
  });

  it('supports operations that intentionally return undefined', async () => {
    withTransactionMock.mockImplementation(async (callback: () => Promise<void>) => {
      await callback();
    });
    const operation = jest.fn().mockResolvedValue(undefined);

    await expect(withTransaction(operation)).resolves.toBeUndefined();
    expect(endSessionMock).toHaveBeenCalledTimes(1);
  });
});
