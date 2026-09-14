import { test, expect } from '@playwright/test';
import { mockRestaurant, id } from './fixtures';

const routes = [
  '/admin/dashboard', '/admin/dishes', '/admin/dishes/new', `/admin/dishes/${id(10)}`,
  '/admin/categories', '/admin/categories/new', `/admin/categories/${id(2)}`,
  '/admin/totems', '/admin/totems/new', `/admin/totems/${id(20)}`,
  '/admin/staff', '/admin/staff/new', `/admin/staff/${id(80)}`, '/admin/logs', '/admin/settings',
];

for (const route of [...routes, '/pos', '/tas', '/kds', '/login', '/unauthorized', '/menu/review-table-0']) {
  for (const theme of ['light', 'dark']) {
    test(`${route} · ${theme}`, async ({ page }, testInfo) => {
      const profile = route.startsWith('/admin') ? 'ADMIN' : route === '/kds' ? 'KTS' : route === '/pos' ? 'POS' : route === '/tas' ? 'TAS' : 'PUBLIC';
      const api = await mockRestaurant(page, profile, theme);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(route);
      await expect(page.locator('app-root')).not.toBeEmpty();
      await expect(page.locator('h1,h2').first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState('networkidle');
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(await page.evaluate(() => innerWidth)).toBeLessThanOrEqual(testInfo.project.use.viewport!.width);
      await expect(page.locator('mat-snack-bar-container')).toHaveCount(0);
      if (route.startsWith('/admin')) await expect(page.locator('.admin-container')).toBeVisible();
      const loadedContent: Record<string, string> = {
        '/admin/dashboard': '$875.50', '/admin/dishes': 'Roasted vegetable bowl',
        '/admin/categories': 'Seasonal dishes', '/admin/totems': 'Terrace 01', '/admin/staff': 'Alex Martin',
      };
      if (loadedContent[route]) await expect(page.locator('.admin-container')).toContainText(loadedContent[route]);
      if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/);
      else await expect(page.locator('html')).not.toHaveClass(/dark/);
      if (route === '/pos') await expect(page.locator('app-pos-sessions-sidebar')).toBeAttached();
      expect(errors).toEqual([]);
      expect(api.unhandled).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath('view.png'), fullPage: true });
    });
  }
}
