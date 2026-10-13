import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  timeout: 45000,
  expect: { timeout: 10000 },
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5177', channel: process.env.CI || process.platform !== 'win32' ? undefined : 'chrome', locale: 'es-ES', timezoneId: 'Europe/Madrid', viewport: { width: 1440, height: 960 }, trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --port 5177', url: 'http://127.0.0.1:5177', reuseExistingServer: !process.env.CI },
})
