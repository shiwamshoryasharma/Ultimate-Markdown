import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.ts', workers: 1, timeout: 90000,
  use: { baseURL: 'http://127.0.0.1:5173', channel: 'chrome', headless: true, viewport: { width: 1440, height: 1000 } },
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
})
