import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration',
  testMatch: '**/*.spec.js',
  workers: 1,
  retries: 0,
  timeout: 60000,
  globalTimeout: 300000,
  expect: { timeout: 10000 },
  outputDir: '.playwright/results',
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4187',
    actionTimeout: 10000,
    navigationTimeout: 15000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // VitePress preview lacks --host; Vite previews the same built HTML/assets
    // while binding strictly to loopback. Playwright owns both child processes.
    command: 'node node_modules/vitepress/bin/vitepress.js build && node node_modules/vite/bin/vite.js preview --outDir .vitepress/dist --host 127.0.0.1 --port 4187 --strictPort',
    url: 'http://127.0.0.1:4187',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      VITE_POSTHOG_KEY: 'phc_integration_test_only',
      VITE_POSTHOG_HOST: 'http://127.0.0.1:4188',
    },
  },
});
