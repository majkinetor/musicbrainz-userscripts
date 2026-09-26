// One test runner for every userscript (#625). Specs live next to their script
// in userscripts/<name>/test/*.spec.mjs and share dev/test/harness.mjs.
//
//   pnpm test                           everything
//   pnpm test --project=fusion          one script
//   pnpm test --grep @unit              only the Node-only specs
//   pnpm test --headed                  watch the browser
//   FUSION_SRC=<old build> pnpm test --project=fusion   against another build
import { defineConfig } from '@playwright/test';
import { readdirSync, existsSync } from 'node:fs';

const scripts = readdirSync('userscripts', { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(`userscripts/${d.name}/test`)
    && readdirSync(`userscripts/${d.name}/test`).some(f => f.endsWith('.spec.mjs')))
  .map(d => d.name);

export default defineConfig({
  testMatch: '**/*.spec.mjs',
  // One worker: every browser test shares the one logged-in profile, and
  // MusicBrainz rate-limits per IP.
  workers: 1,
  fullyParallel: false,
  timeout: 5 * 60_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { outputFolder: 'test-results/html', open: 'never' }]],
  outputDir: 'test-results/artifacts',
  // A missing element fails in 30 s, not at the 5-minute test timeout.
  use: { headless: true, viewport: { width: 1600, height: 1000 }, actionTimeout: 30_000, navigationTimeout: 90_000 },
  projects: [
    { name: 'harness', testDir: 'dev/test' },   // the harness's own guard tests
    ...scripts.map(name => ({ name, testDir: `userscripts/${name}/test` })),
  ],
});
