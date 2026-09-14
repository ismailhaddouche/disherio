import { test, expect, type Page, type Locator, type TestInfo } from '@playwright/test';
import { mockRestaurant, id, items } from './fixtures';

async function fitsViewport(page: Page, target: Locator) {
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  const width = page.viewportSize()!.width;
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
  const layout = await page.evaluate(viewportWidth => ({
    width: document.documentElement.scrollWidth,
    outside: [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > viewportWidth + 1)
      .map(element => ({ tag: element.tagName, class: element.className, right: element.getBoundingClientRect().right })).slice(-12),
  }), width);
  expect(layout.width, JSON.stringify(layout.outside)).toBeLessThanOrEqual(width);
}

async function posPanel(page: Page, name: 'Tables' | 'Orders' | 'Ticket') {
  if (page.viewportSize()!.width < 1280) await page.locator('.pos-navigation').getByRole('button', { name, exact: false }).click();
  else if (name === 'Ticket' && await page.locator('app-pos-menu-panel').isVisible()) {
    await page.locator('app-pos-menu-panel').getByRole('button', { name: 'Close', exact: true }).click();
  }
}

async function screenshot(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
}

test('POS: usable panels, per-table drafts, kitchen updates and payment preview', async ({ page }, info) => {
  const api = await mockRestaurant(page, 'POS');
  await page.goto('/pos');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await page.locator('app-pos-sessions-sidebar').getByRole('button', { name: /Terrace 01/ }).click();
  const sessionPanel = page.locator('app-pos-session-panel');
  await expect(sessionPanel.getByText('Roasted vegetable bowl', { exact: true })).toBeVisible();
  await fitsViewport(page, sessionPanel.locator('header'));
  if (page.viewportSize()!.width < 1280) expect((await sessionPanel.locator('header').boundingBox())!.width).toBeGreaterThan(300);
  await screenshot(page, info, 'pos-order');
  await sessionPanel.getByRole('button', { name: /Add to Order/ }).click();
  await page.locator('app-pos-menu-panel').getByRole('button', { name: /Roasted vegetable bowl/ }).click();
  await fitsViewport(page, page.getByRole('dialog'));
  await page.getByRole('dialog').getByRole('button', { name: /Add/ }).last().click();
  await posPanel(page, 'Ticket');
  await expect(page.locator('app-pos-ticket-panel').getByText('Roasted vegetable bowl', { exact: true }).first()).toBeVisible();
  await screenshot(page, info, 'pos-ticket');
  await posPanel(page, 'Tables');
  await page.locator('app-pos-sessions-sidebar').getByRole('button', { name: /Terrace 02.*Closed/ }).click();
  await posPanel(page, 'Ticket');
  await expect(page.locator('app-pos-ticket-panel').getByRole('heading', { name: 'Pending', exact: true })).toHaveCount(0);
  await page.locator('app-pos-ticket-panel').getByRole('button', { name: /Charge/ }).click();
  await fitsViewport(page, page.getByRole('dialog'));
  await screenshot(page, info, 'pos-payment');
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await posPanel(page, 'Tables');
  await page.locator('app-pos-sessions-sidebar').getByRole('button', { name: /Terrace 01/ }).click();
  api.emit('item:state_changed', { itemId: id(50), newState: 'SERVED' });
  await expect(sessionPanel.getByText('Served', { exact: true })).toBeVisible();
  await posPanel(page, 'Ticket');
  await expect(page.locator('app-pos-ticket-panel').getByRole('heading', { name: 'Pending', exact: true })).toBeVisible();
  expect(api.unhandled).toEqual([]);
});

test('TAS: select tables, scroll orders, queue a draft and close drawers with Escape', async ({ page }, info) => {
  const api = await mockRestaurant(page, 'TAS');
  await page.goto('/tas');
  await page.getByRole('button', { name: /Terrace 01.*Standard/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Open$/, exact: false }).click();
  await expect(page.locator('app-tas-tables-sidebar')).toHaveCount(0);
  await fitsViewport(page, page.locator('app-tas-session-header header'));
  await page.locator('app-tas-dish-grid').getByRole('button', { name: /Roasted vegetable bowl/ }).click();
  await screenshot(page, info, 'tas-workspace');
  await page.getByRole('button', { name: 'Pending', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Roasted vegetable bowl', { exact: true })).toBeVisible();
  await fitsViewport(page, page.getByRole('dialog'));
  await screenshot(page, info, 'tas-cart');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await page.getByRole('button', { name: /Garden 03.*Standard/ }).click();
  await expect(page.getByRole('button', { name: 'Open Session', exact: true })).toBeEnabled();
  await page.keyboard.press('Escape');
  expect(api.unhandled).toEqual([]);
});

test('KDS: synchronized state events, tabs and stock controls', async ({ page }, info) => {
  const api = await mockRestaurant(page, 'KTS');
  await page.goto('/kds');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Stock Control/ }).click();
  await expect(page.getByText('Roasted vegetable bowl', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Sold out special', { exact: true })).toBeVisible();
  await screenshot(page, info, 'kds-stock');
  api.emit('item:state_changed', { itemId: id(50), newState: 'ON_PREPARE' });
  await page.getByRole('button', { name: /In preparation/ }).click();
  await expect(page.getByRole('button', { name: /Serve/, exact: false }).last()).toBeEnabled();
  await fitsViewport(page, page.locator('app-kds header'));
  await screenshot(page, info, 'kds-preparing');
  expect(api.unhandled).toEqual([]);
});

test('KDS: repeated brief network losses reconcile missed server updates', async ({ page }) => {
  const api = await mockRestaurant(page, 'KTS');
  await page.goto('/kds');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();

  const firstConnectionCount = api.socketConnectionCount();
  api.setItemState(id(50), 'ON_PREPARE');
  api.dropConnections();

  await expect.poll(api.socketConnectionCount).toBeGreaterThan(firstConnectionCount);
  await page.getByRole('button', { name: /In preparation/ }).click();
  await expect(page.getByRole('button', { name: /Serve/, exact: false }).last()).toBeEnabled();

  const secondConnectionCount = api.socketConnectionCount();
  api.setItemState(id(50), 'SERVED');
  api.dropConnections();

  await expect.poll(api.socketConnectionCount).toBeGreaterThan(secondConnectionCount);
  await page.getByRole('button', { name: /^Served/ }).click();
  await expect(page.getByText('Roasted vegetable bowl', { exact: true })).toBeVisible();
  expect(api.unhandled).toEqual([]);
});

test('POS: a missed update is repaired after a brief network loss', async ({ page }) => {
  const api = await mockRestaurant(page, 'POS');
  await page.goto('/pos');
  await page.locator('app-pos-sessions-sidebar').getByRole('button', { name: /Terrace 01/ }).click();
  const sessionPanel = page.locator('app-pos-session-panel');
  await expect(sessionPanel.getByText('Roasted vegetable bowl', { exact: true })).toBeVisible();

  const connectionCount = api.socketConnectionCount();
  api.setItemState(id(50), 'SERVED');
  api.dropConnections();

  await expect.poll(api.socketConnectionCount).toBeGreaterThan(connectionCount);
  await expect(sessionPanel.getByText('Served', { exact: true })).toBeVisible();
  expect(api.unhandled).toEqual([]);
});

test('TAS: a missed update is repaired after a brief network loss', async ({ page }) => {
  const api = await mockRestaurant(page, 'TAS');
  await page.goto('/tas');
  await page.getByRole('button', { name: /Terrace 01.*Standard/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Open$/, exact: false }).click();
  const sessionItems = page.locator('app-tas-session-items');
  await expect(sessionItems.getByText('Roasted vegetable bowl', { exact: true })).toBeVisible();

  const connectionCount = api.socketConnectionCount();
  api.setItemState(id(50), 'SERVED');
  api.dropConnections();

  await expect.poll(api.socketConnectionCount).toBeGreaterThan(connectionCount);
  await expect(sessionItems.getByText('Served', { exact: true })).toBeVisible();
  expect(api.unhandled).toEqual([]);
});

test('Public totem: a missed update is repaired after a brief network loss', async ({ page }) => {
  const api = await mockRestaurant(page, 'PUBLIC');
  await page.goto('/menu/review-table-0');
  await page.getByPlaceholder('Your name', { exact: true }).fill('Alex');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: /My Orders/ }).click();
  await expect(page.getByText('Roasted vegetable bowl', { exact: true })).toBeVisible();

  const connectionCount = api.socketConnectionCount();
  api.setItemState(id(50), 'SERVED');
  api.dropConnections();

  await expect.poll(api.socketConnectionCount).toBeGreaterThan(connectionCount);
  await expect(page.getByText('Served', { exact: true })).toBeVisible();
  expect(api.unhandled).toEqual([]);
});

test('Public totem: name, non-EUR menu, cart and order views', async ({ page }, info) => {
  const api = await mockRestaurant(page, 'PUBLIC');
  await page.goto('/menu/review-table-0');
  await page.getByPlaceholder('Your name', { exact: true }).fill('Alex');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('main').getByRole('button', { name: /Roasted vegetable bowl/ }).click();
  await fitsViewport(page, page.getByRole('dialog'));
  await expect(page.getByRole('dialog')).toContainText('$12.50');
  await page.getByRole('dialog').getByRole('button', { name: /Add/ }).click();
  await page.getByRole('button', { name: 'My order', exact: true }).click();
  await fitsViewport(page, page.getByRole('dialog'));
  await screenshot(page, info, 'totem-cart');
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: /My Orders/ }).click();
  await expect(page.getByText('Roasted vegetable bowl', { exact: true })).toBeVisible();
  api.emit('item:state_changed', { itemId: items[0]._id, newState: 'SERVED' });
  await screenshot(page, info, 'totem-orders');
  expect(api.unhandled).toEqual([]);
});

test('Admin: settings refresh header and permitted workspaces share theme', async ({ page }, info) => {
  await mockRestaurant(page, 'ADMIN');
  await page.goto('/admin/settings');
  await page.getByLabel('Restaurant name', { exact: true }).fill('Updated Restaurant');
  await page.getByRole('button', { name: /Save/ }).first().click();
  if (page.viewportSize()!.width > 768) await expect(page.locator('.disher-restaurant-name')).toHaveText('Updated Restaurant');
  await page.getByRole('button', { name: 'Workspaces', exact: true }).click();
  await expect(page.getByRole('menuitem')).toHaveCount(4);
  await screenshot(page, info, 'workspace-menu');
  await page.getByRole('menuitem', { name: /Point of Sale/ }).click();
  await expect(page).toHaveURL(/\/pos$/);
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('A single-profile user cannot navigate to admin views', async ({ page }) => {
  await mockRestaurant(page, 'TAS');
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/unauthorized$/);
  await expect(page.getByRole('button', { name: 'Workspaces', exact: true })).toHaveCount(0);
});
