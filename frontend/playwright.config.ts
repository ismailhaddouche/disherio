import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: '../.cache/ui-tests',
  fullyParallel: true,
  workers: 2,
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:4300',
    channel: process.env['E2E_BROWSER'] || (process.platform === 'win32' ? 'msedge' : undefined),
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', use: { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'node e2e/serve.mjs',
    url: 'http://127.0.0.1:4300',
    reuseExistingServer: !process.env['CI'],
  },
});
