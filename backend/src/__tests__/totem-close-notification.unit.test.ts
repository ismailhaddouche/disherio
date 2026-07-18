let sessionUpdateStateIf: jest.Mock;
let roomEmit: jest.Mock;

jest.unmock('../sockets/totem.handler');

jest.mock('../repositories', () => ({
  TotemSessionRepository: jest.fn().mockImplementation(() => {
    sessionUpdateStateIf = jest.fn();
    return { updateStateIf: sessionUpdateStateIf };
  }),
}));

jest.mock('../config/socket', () => ({
  getIO: jest.fn(() => ({
    to: jest.fn(() => ({ emit: roomEmit })),
    sockets: { sockets: new Map() },
  })),
}));

jest.mock('../services/totem.service', () => ({}));
jest.mock('../sockets/tas.handler', () => ({
  notifyTASHelpRequest: jest.fn(),
  notifyTASBillRequest: jest.fn(),
}));

describe('customer notification after staff session close', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(global, 'setTimeout').mockImplementation(() => ({}) as NodeJS.Timeout);
    roomEmit = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('emits the close event when the controller already transitioned the state', async () => {
    const { closeSessionForCustomers } = await import('../sockets/totem.handler');

    await closeSessionForCustomers('507f1f77bcf86cd799439099', {
      closedBy: 'waiter',
      stateAlreadyTransitioned: true,
    });

    expect(sessionUpdateStateIf).not.toHaveBeenCalled();
    expect(roomEmit).toHaveBeenCalledWith(
      'totem:session_closed',
      expect.objectContaining({ closedBy: 'waiter' })
    );
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
  });
});
