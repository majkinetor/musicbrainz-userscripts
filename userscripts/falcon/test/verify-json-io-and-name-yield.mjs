// Two changes majkinetor asked for after the #467 work settled.
//
// 1. "lets remove + and add json import/export instead" — the (+) paste box only
//    understood Falcon's own `mbid,url` line format, which nothing else emits. A
//    queue is more useful as a file: it outlives the tab, it can be prepared
//    elsewhere, and since the export carries each item's STATUS and per-url
//    outcome, a partly-finished run can be handed over or re-imported to retry
//    only what failed.
//
// 2. "any ongoing scanning for names should probably be stopped on starting the
//    queue so not to slow it down or induce rate limit that would influence
//    workers" — exactly right, and it was a real hazard: a big import queues one
//    /ws/2 lookup per entity, MusicBrainz rate-limits per IP, and a backlog still
//    draining when Start is pressed competes with the workers' own edit-page
//    loads. A 503 there is not cosmetic; it fails the item.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(400);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 10000 });
await page.click('#falcon-launcher');

// ── the (+) paste box is gone, Import/Export are there instead ──────────────
const ui = await page.evaluate(() => ({
  plus: !!document.getElementById('falcon-paste-toggle'),
  box: !!document.getElementById('falcon-paste-box'),
  imp: !!document.getElementById('falcon-import'),
  exp: !!document.getElementById('falcon-export'),
  file: (document.getElementById('falcon-import-file') || {}).accept,
  impTitle: (document.getElementById('falcon-import') || {}).title,
  expTitle: (document.getElementById('falcon-export') || {}).title,
}));
console.log('toolbar:', JSON.stringify(ui));
ck(!ui.plus && !ui.box, 'the (+) paste box is gone');
ck(ui.imp && ui.exp, 'Import and Export buttons are in the queue toolbar');
ck(/json/i.test(ui.file || ''), `the file picker is scoped to JSON (accept="${ui.file}")`);
ck(!!ui.impTitle && !!ui.expTitle, 'both carry tooltips, so they survive the toolbar collapsing to icon-only');

// ── import: the wrapper shape, round-tripped from an export ────────────────
const imported = await page.evaluate(() => window.__falconTest.importQueueJson(JSON.stringify({
  falcon: 'x', exported: '2026-01-01T00:00:00Z',
  items: [
    { entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', name: 'Der Zirkel', urls: [{ url: 'https://myspace.com/io-1', linkTypeId: null }], status: 'queued' },
    { entityType: 'recording', mbid: '297fc936-e8da-455f-b3cf-64e56a38a7d2', urls: [{ url: 'https://music.apple.com/x/1', linkTypeId: '254' }, { url: 'https://music.apple.com/x/1', linkTypeId: '979' }], status: 'done' },
    { mbid: 'not-a-real-mbid', urls: [{ url: 'https://example.com' }] },
  ],
}), 'test.json'));
console.log('import result:', JSON.stringify(imported));
ck(imported.added === 2, `two well-formed items imported (${imported.added})`);
ck(imported.skipped === 1, `the malformed row is skipped rather than poisoning the queue (${imported.skipped})`);

const q = await page.evaluate(() => window.__falconTest.getQueue().map(i => ({ t: i.entityType, s: i.status, n: i.urls.length, name: i.name })));
console.log('queue after import:', JSON.stringify(q));
ck(q.length === 2 && q[0].t === 'artist' && q[1].t === 'recording', 'entity types survive the round trip');
ck(q[1].n === 2, 'a dual-type url keeps BOTH of its entries (that pair is what MB seeds natively)');
ck(q[1].s === 'done', "an item's finished STATUS is preserved, so re-importing a run doesn't silently redo committed edits");
ck(q[0].name === 'Der Zirkel', 'a name already in the file is kept rather than re-fetched');

// ── import also accepts a bare array of flat rows (?falcon= / Harmony shape) ──
const flat = await page.evaluate(() => window.__falconTest.importQueueJson(JSON.stringify([
  { entityType: 'artist', mbid: '5441c29d-3602-4898-b1a1-b77fa23b8e50', url: 'https://myspace.com/io-flat' },
]), 'flat.json'));
ck(flat.added === 1, `a bare array of flat {mbid,url} rows imports too (${flat.added}) — hand-written queues shouldn't have to guess the shape`);

// garbage must be reported, not thrown
const bad = await page.evaluate(() => window.__falconTest.importQueueJson('{ not json', 'broken.json'));
ck(bad.added === 0, 'invalid JSON is reported and adds nothing');
const logText = await page.evaluate(() => window.__falconTest.getLog().join('\n'));
ck(/not valid JSON/.test(logText), 'and the log says so plainly');

// ── name lookups yield to a run ────────────────────────────────────────────
const yielded = await page.evaluate(async () => {
  // queue a pile of lookups, then start a run before they can drain
  const before = window.__falconTest.mbThrottle.pendingCount();
  for (let i = 0; i < 40; i++) window.__falconTest.mbThrottle.fetchJson(`https://musicbrainz.org/ws/2/artist/d31f76d2-1d8e-4271-8027-148f375979d7?fmt=json&x=${i}`);
  const queued = window.__falconTest.mbThrottle.pendingCount();
  window.__falconTest.suspendNameLookups();
  const after = window.__falconTest.mbThrottle.pendingCount();
  const duringRun = await window.__falconTest.fetchEntityName('artist', 'd31f76d2-1d8e-4271-8027-148f375979d7');
  window.__falconTest.resumeNameLookups();
  return { before, queued, after, duringRun };
});
console.log('name throttle:', JSON.stringify(yielded));
ck(yielded.queued > 0, `the throttle really had a backlog to drop (${yielded.queued} pending)`);
ck(yielded.after === 0, `starting a run clears the pending name lookups instead of deferring them (${yielded.after} left)`);
ck(yielded.duringRun === null, 'and a new lookup during a run returns immediately without hitting the network');

// after the run they work again — this must be a pause, not a permanent kill
const resumed = await page.evaluate(() => window.__falconTest.fetchEntityName('artist', 'd31f76d2-1d8e-4271-8027-148f375979d7'));
ck(!!resumed, `once the run is over, name resolution works again (got "${resumed}")`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
