import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  expect: { timeout: 10_000 },
  globalTimeout: 300_000,
  outputDir: '.playwright/results',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  reporter: [['list']],
  retries: 0,
  testDir: './tests/integration',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  use: {
    actionTimeout: 10_000,
    baseURL: 'http://127.0.0.1:4187',
    navigationTimeout: 15_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    // VitePress preview lacks --host; Vite previews the same built HTML/assets
    // while binding strictly to loopback. Playwright owns both child processes.
    command:
      'node node_modules/vitepress/bin/vitepress.js build && node node_modules/vite/bin/vite.js preview --outDir .vitepress/dist --host 127.0.0.1 --port 4187 --strictPort',
    env: {
      VITE_POSTHOG_HOST: 'http://127.0.0.1:4188',
      VITE_POSTHOG_KEY: 'phc_integration_test_only',
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: 'http://127.0.0.1:4187',
  },
  workers: 1,
});
