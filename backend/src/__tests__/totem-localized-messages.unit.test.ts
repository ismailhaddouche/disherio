/**
 * Localized socket notifications.
 *
 * emitToCustomersLocalized builds the payload per recipient using the
 * language each customer announced in the socket handshake, and
 * closeSessionForCustomers translates reasonKey per customer instead of
 * broadcasting a message pre-translated in the staff member's language.
 */

import i18next from 'i18next';

let sessionUpdateStateIf: jest.Mock;
let roomEmit: jest.Mock;
let fetchSockets: jest.Mock;

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
    in: jest.fn(() => ({ fetchSockets })),
    sockets: { sockets: new Map() },
  })),
}));

jest.mock('../services/totem.service', () => ({}));
jest.mock('../sockets/tas.handler', () => ({
  emitToTASLocalized: jest.fn(),
  notifyTASHelpRequest: jest.fn(),
  notifyTASBillRequest: jest.fn(),
}));

type HandlerModule = typeof import('../sockets/totem.handler');

let handler: HandlerModule;

function fakeSocket(lang: string | undefined): { data: { lang?: string }; emit: jest.Mock } {
  return { data: lang === undefined ? {} : { lang }, emit: jest.fn() };
}

beforeAll(async () => {
  await i18next.init({
    lng: 'es',
    fallbackLng: 'es',
    resources: {
      es: {
        translation: {
          sockets: {
            BILL_REQUESTED: 'ES_CUENTA',
            SESSION_CLOSED_BY_STAFF: 'ES_CERRADA_POR_PERSONAL',
            SESSION_CLOSED_NO_MORE_ORDERS: 'ES_NO_MAS_PEDIDOS',
          },
        },
      },
      en: {
        translation: {
          sockets: {
            BILL_REQUESTED: 'EN_BILL',
            SESSION_CLOSED_BY_STAFF: 'EN_CLOSED_BY_STAFF',
            SESSION_CLOSED_NO_MORE_ORDERS: 'EN_NO_MORE_ORDERS',
          },
        },
      },
      fr: {
        translation: {
          sockets: {
            BILL_REQUESTED: 'FR_ADDITION',
            SESSION_CLOSED_BY_STAFF: 'FR_FERMEE_PAR_PERSONNEL',
            SESSION_CLOSED_NO_MORE_ORDERS: 'FR_PLUS_DE_COMMANDES',
          },
        },
      },
    },
  });
  handler = await import('../sockets/totem.handler');
});

beforeEach(() => {
  roomEmit = jest.fn();
  fetchSockets = jest.fn();
  jest.spyOn(global, 'setTimeout').mockImplementation(() => ({}) as NodeJS.Timeout);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('emitToCustomersLocalized', () => {
  it('builds the payload per recipient in each customer language', async () => {
    const esSocket = fakeSocket('es');
    const frSocket = fakeSocket('fr');
    const unknownSocket = fakeSocket(undefined);
    fetchSockets.mockResolvedValue([esSocket, frSocket, unknownSocket]);

    await handler.emitToCustomersLocalized('s1', 'test:event', (lng) => ({
      message: i18next.t('sockets.BILL_REQUESTED', { lng }),
    }));

    expect(esSocket.emit).toHaveBeenCalledWith('test:event', { message: 'ES_CUENTA' });
    expect(frSocket.emit).toHaveBeenCalledWith('test:event', { message: 'FR_ADDITION' });
    // Sockets without an announced language fall back to the default
    expect(unknownSocket.emit).toHaveBeenCalledWith('test:event', { message: 'ES_CUENTA' });
    expect(roomEmit).not.toHaveBeenCalled();
  });

  it('falls back to a room broadcast in the default language when fetchSockets fails', async () => {
    fetchSockets.mockRejectedValue(new Error('adapter down'));

    await handler.emitToCustomersLocalized('s1', 'test:event', (lng) => ({
      message: i18next.t('sockets.BILL_REQUESTED', { lng }),
    }));

    expect(roomEmit).toHaveBeenCalledWith('test:event', { message: 'ES_CUENTA' });
  });

  it('falls back to a room broadcast when the room has no sockets', async () => {
    fetchSockets.mockResolvedValue([]);

    await handler.emitToCustomersLocalized('s1', 'test:event', (lng) => ({
      message: i18next.t('sockets.BILL_REQUESTED', { lng }),
    }));

    expect(roomEmit).toHaveBeenCalledWith('test:event', { message: 'ES_CUENTA' });
  });
});

describe('closeSessionForCustomers — per-customer reason translation', () => {
  it('translates reasonKey into each customer language', async () => {
    const esSocket = fakeSocket('es');
    const enSocket = fakeSocket('en');
    const frSocket = fakeSocket('fr');
    fetchSockets.mockResolvedValue([esSocket, enSocket, frSocket]);

    await handler.closeSessionForCustomers('s1', {
      closedBy: 'waiter',
      stateAlreadyTransitioned: true,
      reasonKey: 'sockets.SESSION_CLOSED_BY_STAFF',
    });

    expect(sessionUpdateStateIf).not.toHaveBeenCalled();
    expect(esSocket.emit).toHaveBeenCalledWith(
      'totem:session_closed',
      expect.objectContaining({ reason: 'ES_CERRADA_POR_PERSONAL', message: 'ES_NO_MAS_PEDIDOS' })
    );
    expect(enSocket.emit).toHaveBeenCalledWith(
      'totem:session_closed',
      expect.objectContaining({ reason: 'EN_CLOSED_BY_STAFF', message: 'EN_NO_MORE_ORDERS' })
    );
    expect(frSocket.emit).toHaveBeenCalledWith(
      'totem:session_closed',
      expect.objectContaining({ reason: 'FR_FERMEE_PAR_PERSONNEL', message: 'FR_PLUS_DE_COMMANDES' })
    );
    expect(roomEmit).not.toHaveBeenCalledWith('totem:session_closed', expect.anything());
  });

  it('uses the default bill-requested reason per customer when no reason is given', async () => {
    const frSocket = fakeSocket('fr');
    fetchSockets.mockResolvedValue([frSocket]);

    await handler.closeSessionForCustomers('s1', {
      closedBy: 'customer',
      stateAlreadyTransitioned: true,
    });

    expect(frSocket.emit).toHaveBeenCalledWith(
      'totem:session_closed',
      expect.objectContaining({ reason: 'FR_ADDITION' })
    );
  });
});
