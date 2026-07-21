import { assertCanMutateTotem, deleteTotem } from '../services/totem.service';
import { ErrorCode } from '@disherio/shared';
import { AppError } from '../utils/async-handler';
import { TotemRepository, TotemSessionRepository } from '../repositories/totem.repository';

// Unit tests run without a Mongo connection: execute the transactional
// callback directly with a stand-in (undefined) session instead of opening a
// real transaction.
jest.mock('../utils/transactions', () => ({
  withTransaction: (operations: (session: unknown) => Promise<unknown>) => operations(undefined),
}));

describe('TotemService.assertCanMutateTotem', () => {
  // A policy violation throws an operational AppError whose message is the
  // FORBIDDEN error code and whose statusCode is 403. The global error handler
  // maps that message to the JSON errorCode in HTTP responses.
  function expectForbidden(act: () => void): void {
    expect(act).toThrow(AppError);
    try {
      act();
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(403);
      expect(appErr.message).toBe(ErrorCode.FORBIDDEN);
    }
  }

  it('allows TAS to mutate a TEMPORARY totem', () => {
    expect(() => assertCanMutateTotem('TEMPORARY', ['TAS'])).not.toThrow();
  });

  it('forbids TAS from mutating a STANDARD totem', () => {
    expectForbidden(() => assertCanMutateTotem('STANDARD', ['TAS']));
  });

  it('allows ADMIN to mutate a STANDARD totem', () => {
    expect(() => assertCanMutateTotem('STANDARD', ['ADMIN'])).not.toThrow();
  });

  it('allows POS to mutate a STANDARD totem', () => {
    expect(() => assertCanMutateTotem('STANDARD', ['POS'])).not.toThrow();
  });

  it('allows a caller with both POS and TAS to mutate a STANDARD totem', () => {
    expect(() => assertCanMutateTotem('STANDARD', ['POS', 'TAS'])).not.toThrow();
  });

  it('forbids a caller with no managing permission from mutating a STANDARD totem', () => {
    expectForbidden(() => assertCanMutateTotem('STANDARD', ['KTS']));
  });

  it('allows a caller with no permissions to mutate a TEMPORARY totem', () => {
    expect(() => assertCanMutateTotem('TEMPORARY', [])).not.toThrow();
  });
});

describe('TotemService.deleteTotem', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(['STARTED', 'COMPLETE'] as const)(
    'preserves a totem while it has a %s session',
    async (totemState) => {
      jest.spyOn(TotemSessionRepository.prototype, 'findOperationalByTotemId')
        .mockResolvedValue({ totem_state: totemState } as never);
      const deleteSpy = jest.spyOn(TotemRepository.prototype, 'deleteTotem');

      await expect(deleteTotem('507f1f77bcf86cd799439011'))
        .rejects.toMatchObject({ message: ErrorCode.ACTIVE_SESSION_EXISTS, statusCode: 409 });
      expect(deleteSpy).not.toHaveBeenCalled();
    }
  );

  it('deletes a totem when only terminal history can remain', async () => {
    jest.spyOn(TotemSessionRepository.prototype, 'findOperationalByTotemId')
      .mockResolvedValue(null);
    const deleteSpy = jest.spyOn(TotemRepository.prototype, 'deleteTotem')
      .mockResolvedValue(null);

    await expect(deleteTotem('507f1f77bcf86cd799439011')).resolves.toBeNull();
    expect(deleteSpy).toHaveBeenCalledWith('507f1f77bcf86cd799439011', undefined);
  });
});
