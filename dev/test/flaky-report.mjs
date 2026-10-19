#!/usr/bin/env node
// Which specs keep failing (#647): reads the suite history (dev/test/suite-history.mjs) and
// lists every spec that failed in the last N runs, most often first.
//
//   node dev/test/flaky-report.mjs [history.json] [--runs 30]
//
// Without a file it reads history.json from the `test-history` branch (git fetch github test-history
// first, or origin in a plain clone). A spec red in every run is broken, not flaky; one red
// now and then is flaky, and "last" says whether it still happens. The runs are the nightly's and
// the suite skill's local ones (only those run the @web specs); "where" counts each one's failures:
// 3n+1l is three nightly, one local.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const i = process.argv.indexOf('--runs'), N = i > 0 ? +process.argv[i + 1] : 30;
const file = process.argv.slice(2).find((a, k, all) => !a.startsWith('--') && all[k - 1] !== '--runs');
const load = () => {
  if (file) return readFileSync(file, 'utf8');
  for (const remote of ['github', 'origin']) { try { return execFileSync('git', ['show', `${remote}/test-history:history.json`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { /* next */ } }
  throw new Error('no history: pass a file, or git fetch the test-history branch');
};
const runs = Object.entries(JSON.parse(load())).slice(0, N);   // newest first
const specs = new Map();
for (const [at, r] of runs) {
  for (const f of r.failures || []) {
    const s = specs.get(f.name) || { name: f.name, failed: 0, last: at, error: f.error || '', nightly: 0, local: 0 };
    s.failed++; s[r.source === 'local' ? 'local' : 'nightly']++; specs.set(f.name, s);
  }
}
const locals = runs.filter(([, r]) => r.source === 'local').length;
console.log(`${runs.length} run(s) (${runs.length - locals} nightly, ${locals} local), ${runs.length ? runs[runs.length - 1][0] + ' … ' + runs[0][0] : ''}\n`);
const rows = [...specs.values()].sort((a, b) => b.failed - a.failed || b.last.localeCompare(a.last));
if (!rows.length) console.log('Nothing failed.');
for (const s of rows) {
  const verdict = runs.length > 2 && s.failed === runs.length ? 'BROKEN' : s.failed > 1 ? 'flaky' : 'once';
  const where = [s.nightly && `${s.nightly}n`, s.local && `${s.local}l`].filter(Boolean).join('+');
  console.log(`${String(s.failed).padStart(3)} failed  ${verdict.padEnd(6)}  ${where.padEnd(5)}  last ${s.last}  ${s.name}`);
  if (s.error) console.log(`${' '.repeat(26)}${s.error.slice(0, 160)}`);
}
