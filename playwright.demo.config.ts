import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/demo',
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5179',
    browserName: 'chromium',
    viewport: { width: 1080, height: 1080 },
    deviceScaleFactor: 1,
  },
  webServer: {
    command: 'npx vite --port 5179 --strictPort',
    url: 'http://localhost:5179/tests/harness/golden.html',
    reuseExistingServer: true,
  },
});
