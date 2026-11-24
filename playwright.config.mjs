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
  // One worker by default: every browser test shares the one logged-in profile, and
  // MusicBrainz rate-limits per IP. PW_WORKERS=<n> runs n, each on its own copy of the
  // profile (dev/test/worker-profiles.mjs); a file's tests still run in order, in one worker.
  workers: Number(process.env.PW_WORKERS) || 1,
  fullyParallel: false,
  // PW_FAST=1 (CI): a test gets 3 minutes, not 5, and a page load 45 s, not 90, so that a
  // sandbox that hangs costs less. The slowest spec CI runs takes about 2 minutes.
  timeout: (process.env.PW_FAST ? 3 : 5) * 60_000,
  expect: { timeout: 20_000 },
  // PW_JSON=<file> adds a JSON report: the nightly suite keeps every run's results from it (#647)
  // PW_BLOB=<name> adds a blob report, blob-report/<name>.zip: CI's runners each write one, and
  // a last job merges them into one report (playwright merge-reports)
  reporter: [['list'], ['html', { outputFolder: 'test-results/html', open: 'never' }], ...(process.env.PW_JSON ? [['json', { outputFile: process.env.PW_JSON }]] : []),
    ...(process.env.PW_BLOB ? [['blob', { outputDir: 'blob-report', fileName: `${process.env.PW_BLOB}.zip` }]] : [])],
  outputDir: 'test-results/artifacts',
  // A missing element fails in 30 s, not at the 5-minute test timeout.
  use: { headless: true, viewport: { width: 1600, height: 1000 }, actionTimeout: 30_000, navigationTimeout: process.env.PW_FAST ? 45_000 : 90_000 },
  projects: [
    { name: 'harness', testDir: 'dev/test' },   // the harness's own guard tests
    { name: 'ui', testDir: 'dev/ui' },          // the shared UI components (ST-UI)
    { name: 'net', testDir: 'dev/net' },        // the shared MusicBrainz request gate (ST-NET)
    { name: 'imgmax', testDir: 'dev/imgmax' },  // the shared image maximizer (ST-IMGMAX)
    { name: 'mbpage', testDir: 'dev/mbpage' },  // the shared MusicBrainz page helpers (ST-MBPAGE)
    { name: 'guesscase', testDir: 'dev/guesscase' },  // the shared guess case (ST-GUESSCASE)
    ...scripts.map(name => ({ name, testDir: `userscripts/${name}/test` })),
  ],
});
