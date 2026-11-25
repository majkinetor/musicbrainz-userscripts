// Was a failed run blocked by the environment rather than failed by the tests?
//
//   node dev/test/blocked.mjs [test-results/causes]
//
// The harness leaves one file per failed test in that folder, holding its cause (failure-cause.mjs).
// Exits 0 ("blocked") when there are failures and every one is a rate limit or the network:
// MusicBrainz shedding load says nothing about the scripts, so such a run is not marked failed.
// Exits 1 when a test failed for itself, or when no cause was left (the run broke some other way).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || 'test-results/causes';
let causes = [];
try { causes = readdirSync(dir).map(f => readFileSync(join(dir, f), 'utf8').trim()); } catch { /* none left */ }
const count = causes.reduce((a, c) => ({ ...a, [c]: (a[c] || 0) + 1 }), {});
const list = Object.entries(count).map(([c, n]) => `${n} ${c}`).join(', ');
if (!causes.length) { console.log('blocked.mjs: no failure causes recorded; the run failed'); process.exit(1); }
if (count.test) { console.log(`blocked.mjs: failed (${list})`); process.exit(1); }
console.log(`blocked.mjs: blocked, not failed: every failure came from the environment (${list})`);
