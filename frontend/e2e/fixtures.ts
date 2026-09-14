import type { Page, WebSocketRoute } from '@playwright/test';

export const id = (value: number) => value.toString(16).padStart(24, '0');
const localized = (value: string) => ['en', 'es', 'fr'].map(lang => ({ lang, value }));
export const restaurant = {
  _id: id(1), restaurant_name: 'La Terraza · Mediterranean Kitchen', tax_rate: 10, currency: 'USD',
  default_language: 'en', default_theme: 'light', enabled_languages: ['en', 'es', 'fr'],
  tips_state: false, tips_type: 'VOLUNTARY', tips_rate: 0, order_interval_minutes: 0, max_orders_per_session: 0,
};
export const categories = [{ _id: id(2), restaurant_id: id(1), category_name: localized('Seasonal dishes'), category_order: 1 }];
export const dishes = ['Roasted vegetable bowl', 'Grilled fish with lemon', 'Sparkling water'].map((name, i) => ({
  _id: id(10 + i), restaurant_id: id(1), category_id: categories[0], disher_name: localized(name),
  disher_description: localized('Fresh ingredients, prepared to order.'), disher_price: i === 2 ? 3 : 12.5,
  disher_type: i === 2 ? 'SERVICE' : 'KITCHEN', disher_status: 'ACTIVATED', disher_alergens: [],
  disher_variant: i === 0, variants: i === 0 ? [{ _id: id(100), variant_name: localized('Large'), variant_price: 2 }] : [], extras: [],
}));
export const totems = ['Terrace 01', 'Terrace 02', 'Garden 03'].map((name, i) => ({
  _id: id(20 + i), restaurant_id: id(1), totem_name: name, totem_qr: 'review-table-' + i, totem_type: 'STANDARD',
}));
export const sessions = totems.slice(0, 2).map((totem, i) => ({
  _id: id(30 + i), totem_id: totem._id, restaurant_id: id(1), totem, totem_state: i ? 'COMPLETE' : 'STARTED',
  session_date_start: '2026-09-10T12:00:00.000Z', item_count: 3,
}));
export const customers = [{ _id: id(40), session_id: id(30), customer_name: 'Alex' }];
export const items = dishes.map((dish, i) => ({
  _id: id(50 + i), order_id: id(60), session_id: id(30), item_dish_id: dish._id, customer_id: id(40), customer_name: 'Alex',
  item_state: 'ORDERED', item_disher_type: dish.disher_type, item_name_snapshot: dish.disher_name,
  item_base_price: dish.disher_price, item_disher_extras: [], order_number: 12, totem_name: 'Terrace 01',
  createdAt: '2026-09-10T12:00:00.000Z',
}));
export const roles = ['ADMIN', 'POS', 'KTS', 'TAS'].map((permission, i) => ({ _id: id(70 + i), role_name: permission, permissions: [permission] }));

/** Local HTTP/Socket.IO fixtures validate rendering and client event handling, not backend authorization. */
export async function mockRestaurant(page: Page, profile: string, theme = 'light') {
  const role = roles.find(candidate => candidate.role_name === profile) || roles[0];
  const user = {
    _id: id(80), staffId: id(80), restaurant_id: id(1), restaurantId: id(1), role_id: role._id,
    username: 'review', staff_name: 'Alex Martin', name: 'Alex Martin', role: role.role_name,
    permissions: profile === 'ADMIN' ? ['ADMIN', 'POS', 'KTS', 'TAS'] : role.permissions,
    preferences: { language: 'en', theme }, enabled_languages: ['en', 'es', 'fr'],
  };
  await page.addInitScript(({ user, theme, publicProfile }) => {
    localStorage.setItem('disherio-language', 'en');
    localStorage.setItem('disherio-theme', theme);
    if (!publicProfile) sessionStorage.setItem('disherio-auth-state', JSON.stringify(user));
  }, { user, theme, publicProfile: profile === 'PUBLIC' });
  const sockets = new Set<WebSocketRoute>();
  let socketConnectionCount = 0;
  let currentItems = items.map(item => ({ ...item }));
  await page.routeWebSocket('**/socket.io/**', socket => {
    socketConnectionCount++;
    sockets.add(socket);
    socket.send('0' + JSON.stringify({ sid: 'review', upgrades: [], pingInterval: 120000, pingTimeout: 120000, maxPayload: 1000000 }));
    socket.onMessage(message => {
      const text = message.toString();
      if (text.startsWith('40')) socket.send('40' + JSON.stringify({ sid: 'review' }));
      if (text.startsWith('42')) {
        const packet = /^42(\d*)(\[.*)$/s.exec(text);
        if (!packet) return;
        const acknowledgementId = packet[1];
        const [event, data] = JSON.parse(packet[2]);
        if (event === 'totem:join_session') socket.send('42' + JSON.stringify(['totem:session_joined', { sessionId: data.sessionId, customerName: 'Alex' }]));
        if (acknowledgementId && [
          'kds:join',
          'pos:join',
          'tas:join',
          'totem:join_session',
        ].includes(event)) {
          socket.send(`43${acknowledgementId}${JSON.stringify([{ success: true }])}`);
        }
      }
    });
    socket.onClose(() => sockets.delete(socket));
  });
  const unhandled: string[] = [];
  await page.route('**/api/**', async route => {
    const req = route.request();
    const pathname = new URL(req.url()).pathname.replace('/api', '');
    const method = req.method();
    let result: unknown;
    if (pathname.startsWith('/auth/')) result = { user, expires_in_ms: 900000 };
    else if (pathname === '/restaurant/me' || pathname === '/restaurant/settings') {
      result = method === 'PATCH' ? { message: 'Saved', settings: { ...restaurant, ...req.postDataJSON() } } : restaurant;
    } else if (pathname === '/dashboard/stats') result = {
      salesByDish: [{ dishId: id(10), dishName: 'Roasted vegetable bowl', quantity: 24, revenue: 300 }],
      salesByCategory: [{ categoryId: id(2), categoryName: 'Seasonal dishes', quantity: 24, revenue: 300 }],
      paymentStats: { totalRevenue: 875.5, totalTransactions: 32, averageTicket: 27.36 },
      orderStatus: { ordered: 3, onPrepare: 2, served: 24, canceled: 1 }, dateRange: {},
    };
    else if (pathname === '/dashboard/logs') result = { logs: [{ id: id(90), type: 'TAS', timestamp: '2026-09-10T12:00:00.000Z', userName: 'Alex', action: 'ORDER_CREATED', details: {} }], filters: { users: [], types: ['TAS'] }, total: 1 };
    else if (pathname === '/dashboard/logs/users') result = { users: [] };
    else if (pathname === '/staff/roles/all') result = roles;
    else if (pathname === '/staff') result = { data: [{ ...user, role_id: role }] };
    else if (pathname.startsWith('/staff/')) result = user;
    else if (pathname === '/dishes/categories') result = categories;
    else if (pathname.startsWith('/dishes/categories/')) result = categories[0];
    else if (pathname === '/dishes/manage/all') result = { data: [...dishes, { ...dishes[2], _id: id(13), disher_name: localized('Sold out special'), disher_status: 'DESACTIVATED' }] };
    else if (pathname === '/dishes') result = { data: dishes, pagination: { total: dishes.length, page: 1, limit: 100, totalPages: 1, hasNext: false, hasPrev: false } };
    else if (pathname.startsWith('/dishes/')) result = dishes[0];
    else if (pathname === '/totems') result = totems;
    else if (pathname === '/totems/sessions/active') result = sessions;
    else if (pathname.startsWith('/totems/menu/')) {
      if (pathname.endsWith('/dishes')) result = { categories, dishes, restaurant };
      else if (pathname.endsWith('/session')) result = { ...sessions[0], session_id: id(30), totem_name: 'Terrace 01', session_token: 'review-session' };
      else if (pathname.endsWith('/orders')) result = currentItems;
      else if (pathname.endsWith('/customers')) result = { customer_id: id(40), customer_name: req.postDataJSON()?.customer_name || 'Alex' };
      else result = totems[0];
    } else if (/^\/totems\/[^/]+\/sessions$/.test(pathname)) result = sessions.filter(session => session.totem_id === pathname.split('/')[2]);
    else if (pathname.startsWith('/totems/')) result = totems.find(totem => pathname.endsWith(totem._id)) || totems[0];
    else if (pathname === '/orders/kitchen') result = currentItems.filter(item => item.item_disher_type === 'KITCHEN');
    else if (pathname === '/orders/service-items') result = currentItems.filter(item => item.item_disher_type === 'SERVICE');
    else if (pathname.startsWith('/orders/session/')) result = currentItems.map(item => ({ ...item, session_id: pathname.split('/').at(-1) }));
    else if (pathname.startsWith('/customers/session/')) result = customers;
    else if (pathname === '/orders/payments/history') result = [];
    else if (pathname === '/orders/items/batch') result = { orderId: id(61), items: [{ ...items[0], _id: id(65), session_id: req.postDataJSON().session_id }] };
    else {
      unhandled.push(`${method} ${pathname}`);
      await route.fulfill({ status: 501, json: { message: 'Unmocked review request' } });
      return;
    }
    await route.fulfill({ json: result });
  });
  return {
    unhandled,
    emit: (event: string, payload: unknown) => sockets.forEach(socket => socket.send('42' + JSON.stringify([event, payload]))),
    dropConnections: () => [...sockets].forEach(socket => socket.close()),
    socketConnectionCount: () => socketConnectionCount,
    setItemState: (itemId: string, itemState: string) => {
      currentItems = currentItems.map(item => item._id === itemId ? { ...item, item_state: itemState } : item);
    },
  };
}
