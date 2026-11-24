#!/usr/bin/env node
// Copies the signed-in browser profiles once per worker, for a run with PW_WORKERS=<n>.
//
//   node dev/test/worker-profiles.mjs <n>
//
// Chromium (and Firefox) lock a profile to one browser, so parallel workers cannot share
// .pw-profile. Worker i uses .pw-profile-w<i>, and .pw-profile-ff-w<i> for Falcon's Firefox
// specs (dev/test/harness.mjs). Sign in first (dev/test/login.mjs), then copy. The copies are
// gitignored; delete them when the run is over on a machine that keeps them.
import { cpSync, existsSync, rmSync } from 'node:fs';

const n = Number(process.argv[2]);
if (!(n >= 1)) { console.error('usage: worker-profiles.mjs <n>'); process.exit(2); }
for (const base of ['.pw-profile', '.pw-profile-ff']) {
  if (!existsSync(base)) { console.log(`${base}: none, skipped`); continue; }
  for (let i = 0; i < n; i++) {
    const to = `${base}-w${i}`;
    rmSync(to, { recursive: true, force: true });
    // the lock files say which browser holds the profile; a copy must not carry them
    cpSync(base, to, { recursive: true, filter: src => !/Singleton(Lock|Socket|Cookie)$|\bparent\.lock$|\block$/.test(src) });
  }
  console.log(`${base}: ${n} copies`);
}
