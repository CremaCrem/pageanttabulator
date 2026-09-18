import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

// Wiped as part of the server command, not in globalSetup or the config body: Playwright
// starts webServer before globalSetup and re-imports this config in every worker, so a
// wipe anywhere else deletes the database out from under the running server.
const wipeTmp = `node -e "require('node:fs').rmSync('e2e/.tmp',{recursive:true,force:true})"`;

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    // The axum server serves the built frontend from ../dist, so the suite drives the
    // same single origin judges use at the venue, against a throwaway database.
    command: `npm run build && ${wipeTmp} && cd src-tauri && cargo run --bin pageant-server`,
    url: 'http://localhost:3000/api/health',
    env: { PAGEANT_DB_PATH: resolve('e2e/.tmp/smoke.db') },
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
