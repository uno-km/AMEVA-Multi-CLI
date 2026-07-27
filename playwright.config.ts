import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 1,
  use: {
    trace: 'on-first-retry'
  },
  // E2E 전에 빌드가 필요하다면:
  // webServer: { command: 'npm run build', reuseExistingServer: true }
})
