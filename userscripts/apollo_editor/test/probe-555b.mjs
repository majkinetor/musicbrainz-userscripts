// Probe #555b — regression cover for the OTHER /ws/2 callers moved onto wsJson.
// Read-only: loads a release edit page, injects the script and calls the exposed
// lookups directly. Nothing is submitted.
//
// Two things are checked per lookup:
//   1) it still returns the right answer on a healthy connection, and
//   2) a throttled (503) lookup is retried rather than being cached as a miss —
//      the latent half of #555, where a transient 503 froze a name into a
//      permanent "no match" for the rest of the session.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || 'f9df1b8e-5228-4096-bafa-d4d89ff1e668';
const HEADED = process.argv.includes('--headed');
const log = (...a) => console.log('[probe-555b]', ...a);

const ctx = await chromium.launchPersistentContext(PROFILE, { headless: !HEADED, viewport: { width: 1400, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => log('[pageerror]', e.message));

// throttle the artist endpoint on demand (GET only, never an edit endpoint)
let armFor = 0, injected = 0;
await page.route(u => /\/ws\/2\/artist\?/.test(u.toString()), async route => {
  if (route.request().method() !== 'GET') return route.continue();
  if (armFor > 0) { armFor--; injected++; return route.fulfill({ status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': '0' }, body: '{"error":"busy"}' }); }
  return route.continue();
});

await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().some(m => m.tracks().length); } catch { return false; } }, null, { timeout: 120000 });
await page.addScriptTag({ content: await readFile(SCRIPT, 'utf8') });
await page.waitForFunction(() => !!window.__apolloEditor, null, { timeout: 20000 });

// 1) healthy: an alias-only credit still resolves ("Don Abi" → Abiodun, the #442 case)
const healthy = await page.evaluate(async () => {
  const r = await window.__apolloEditor.resolveByExactAlias('Don Abi');
  return r ? { name: r.entity && r.entity.name, gid: r.entity && r.entity.gid, via: r.via } : null;
});
log('healthy resolveByExactAlias("Don Abi") →', JSON.stringify(healthy));

// 2) throttled: 3 x 503 then success — must still resolve, and must NOT have been
//    cached as a miss (a second call for the same name returns the same answer)
armFor = 3;
const throttledRes = await page.evaluate(async () => {
  const a = await window.__apolloEditor.resolveByExactAlias('Kasane Teto');
  const b = await window.__apolloEditor.resolveByExactAlias('Kasane Teto');   // cache hit
  const pick = r => r ? { name: r.entity && r.entity.name, via: r.via } : null;
  return { first: pick(a), second: pick(b) };
});
log('503-then-success resolveByExactAlias("Kasane Teto") →', JSON.stringify(throttledRes));

// 3) a lookup throttled past every retry returns null and is NOT cached, so the
//    next (healthy) call still succeeds
armFor = 99;
const exhausted = await page.evaluate(async () => await window.__apolloEditor.resolveByExactAlias('Chumbawamba'));
armFor = 0;
const afterExhausted = await page.evaluate(async () => {
  const r = await window.__apolloEditor.resolveByExactAlias('Chumbawamba');
  return r ? { name: r.entity && r.entity.name, via: r.via } : null;
});
log('exhausted →', JSON.stringify(exhausted), '| retried afterwards →', JSON.stringify(afterExhausted));

const logText = await page.evaluate(() => window.__apolloEditor.logMarkdown());
log('--- alias log lines ---');
console.log(logText.split('\n').filter(l => /alias search|throttl/i.test(l)).join('\n'));

const checks = {
  'healthy alias lookup resolves':        !!(healthy && healthy.gid),
  'throttled alias lookup still resolves': !!(throttledRes.first && throttledRes.first.name),
  'cached result is stable':               JSON.stringify(throttledRes.first) === JSON.stringify(throttledRes.second),
  'exhausted lookup returns null':         exhausted === null,
  'exhausted miss was NOT cached':         !!(afterExhausted && afterExhausted.name),
  'throttle appears in the log':           /throttled by MusicBrainz/.test(logText),
};
Object.entries(checks).forEach(([k, v]) => log(v ? 'PASS' : 'FAIL', '-', k));
log('503s injected:', injected);
const pass = Object.values(checks).every(Boolean);
log(pass ? 'PASS' : 'FAIL');
if (!HEADED) await ctx.close();
process.exit(pass ? 0 : 1);
