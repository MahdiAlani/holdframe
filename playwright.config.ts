import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  snapshotPathTemplate: 'tests/golden/{arg}-{platform}{ext}',
  fullyParallel: true,
  reporter: 'list',
  expect: {
    toHaveScreenshot: { threshold: 0.1, maxDiffPixels: 40 },
  },
  use: {
    baseURL: 'http://localhost:5179',
    browserName: 'chromium',
    deviceScaleFactor: 1,
  },
  webServer: {
    command: 'npx vite --port 5179 --strictPort',
    url: 'http://localhost:5179/tests/harness/golden.html',
    reuseExistingServer: true,
  },
});
