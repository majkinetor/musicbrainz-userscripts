// Preload for baseline.mjs (#625): the old standalone test scripts carry no
// production write guard of their own, so this puts guard.mjs on every browser
// context they open — whichever of the repo's Playwright copies they load.
//
//   node --import ./dev/test/baseline-guard.mjs userscripts/<name>/test/<file>.mjs
//
// Every refused or leaked production write is appended to $BASELINE_GUARD_LOG.
import { createRequire } from 'node:module';
import { appendFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installProdGuard } from './guard.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOG = process.env.BASELINE_GUARD_LOG;
const note = rec => { if (LOG) appendFileSync(LOG, JSON.stringify(rec) + '\n'); };
const guards = [];
const reported = new Set();
const flush = () => guards.forEach(g => g.leaked().forEach(w => { if (!reported.has(w)) { reported.add(w); note({ kind: 'leaked', write: w }); } }));
process.on('exit', flush);

async function guarded(ctx) {
  const g = await installProdGuard(ctx, { onRefused: w => note({ kind: 'refused', ...w }) });
  guards.push(g); ctx.on('close', flush);
  return ctx;
}
function patch(bt) {
  if (!bt || bt.__baselineGuard) return;
  bt.__baselineGuard = true;
  const lpc = bt.launchPersistentContext.bind(bt);
  bt.launchPersistentContext = async (...a) => guarded(await lpc(...a));
  const launch = bt.launch.bind(bt);
  bt.launch = async (...a) => {
    const b = await launch(...a);
    const nc = b.newContext.bind(b);
    b.newContext = async (...x) => guarded(await nc(...x));
    b.newPage = async (...x) => (await b.newContext(...x)).newPage();
    return b;
  };
}
// the copies the scripts resolve: each userscript's own node_modules, and the root's
const hosts = readdirSync(resolve(REPO, 'userscripts')).map(d => resolve(REPO, 'userscripts', d)).concat(REPO);
for (const h of hosts) {
  if (!existsSync(resolve(h, 'node_modules', 'playwright')) && !existsSync(resolve(h, 'node_modules', '@playwright', 'test'))) continue;
  const req = createRequire(resolve(h, 'package.json'));
  for (const mod of ['playwright', '@playwright/test']) {
    try { const pw = req(mod); [pw.chromium, pw.firefox, pw.webkit].forEach(patch); } catch (e) { /* not installed here */ }
  }
}
