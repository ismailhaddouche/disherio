import { buildByUserTickets } from '../utils/calculation.utils';

describe('buildByUserTickets', () => {
  it('allocates the final payment total by customer amount and reconciles cents', () => {
    const tickets = buildByUserTickets([
      {
        customer_id: { toString: () => 'customer-a' },
        customer_name: 'Alice',
        item_base_price: 10,
      },
      {
        customer_id: { toString: () => 'customer-b' },
        customer_name: 'Bob',
        item_base_price: 10,
      },
      {
        customer_id: { toString: () => 'customer-c' },
        customer_name: 'Carol',
        item_base_price: 10,
      },
    ], 33.01);

    expect(tickets.map((ticket) => ticket.ticket_amount)).toEqual([11.01, 11, 11]);
    expect(tickets.reduce((sum, ticket) => sum + Math.round(ticket.ticket_amount * 100), 0)).toBe(3301);
    expect(tickets.map((ticket) => ticket.ticket_customer_name)).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('distributes implicit tax and tip proportionally to item totals', () => {
    const tickets = buildByUserTickets([
      { customer_id: { toString: () => 'customer-a' }, item_base_price: 10 },
      { customer_id: { toString: () => 'customer-b' }, item_base_price: 20 },
    ], 36);

    expect(tickets.map((ticket) => ticket.ticket_amount)).toEqual([12, 24]);
  });
});
