// #467 (majkinetor: "Still fails if not shown") — the item that kept failing
// turned out to have nothing to do with visibility. Every url in it was ALREADY
// on the entity with the right type, so nothing changed and MusicBrainz had no
// edit to create. MB leaves "Enter edit" enabled anyway, so clicking submitted
// into the void: the page never navigated and Falcon burned the full 50s before
// reporting "never redirected off /edit" — on a batch that was already correct.
//
// Verified live on his exact failing recording (297fc936, all 5 distinct urls
// already present): seeding them produces ZERO .rel-add/.rel-edit/.rel-remove
// markers while the submit button stays enabled.
//
// So: ask MB whether anything is actually staged before submitting, and report
// "already up to date" instead of a bogus timeout+failure.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 950 } });
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
// hard guard: nothing may actually submit during this test
let posts = 0;
await page.route('**/*', route => {
  const r = route.request();
  if (r.method() === 'POST' && /\/(recording|artist|label)\/[0-9a-f-]{36}\/edit/.test(r.url())) { posts++; return route.abort(); }
  return route.continue();
});

const REC = '297fc936-e8da-455f-b3cf-64e56a38a7d2';   // his exact failing item
await page.goto(`https://musicbrainz.org/recording/${REC}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(600);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 10000 });
await page.evaluate(() => document.getElementById('falcon-launcher').click());
await page.waitForTimeout(1200);

await page.evaluate((rec) => {
  window.__falconTest.setQueue([{
    id: 'noop', entityType: 'recording', mbid: rec,
    urls: [
      { url: 'https://open.spotify.com/track/6bwfybp0HxiV5fNGU8uFyi', linkTypeId: '268' },
      { url: 'https://www.deezer.com/track/131741870', linkTypeId: '268' },
      { url: 'https://music.apple.com/de/song/1148102776', linkTypeId: '254' },
      { url: 'https://open.qobuz.com/track/34517479', linkTypeId: '979' },
      { url: 'https://tidal.com/track/64370601', linkTypeId: '979' },
    ],
    note: '', urlResults: null, status: 'queued', error: '',
  }]);
  window.__falconTest.cfg.workers = 1;
}, REC);
const t0 = Date.now();
await page.evaluate(() => window.__falconTest.start());
await page.waitForFunction(() => window.__falconTest.getQueue()[0]?.status !== 'queued' && window.__falconTest.getQueue()[0]?.status !== 'active', null, { timeout: 60000 }).catch(() => {});
const elapsed = Date.now() - t0;
const item = await page.evaluate(() => window.__falconTest.getQueue()[0]);
console.log('elapsed', elapsed, 'ms; status:', item?.status, '; error:', item?.error);
ck(item?.status === 'skipped', `an entity that already has every link is reported 'skipped', not 'failed' (got '${item?.status}')`);
ck(!item?.error, `and carries no error text (got "${item?.error}")`);
ck(elapsed < 20000, `it resolves promptly instead of burning the ~50s submit timeout (${elapsed}ms)`);
ck(posts === 0, `nothing was submitted into the void (POST attempts: ${posts})`);

const logText = await page.evaluate(() => { document.getElementById('falcon-tab-log').click(); return document.getElementById('falcon-log-text').textContent; });
ck(/no pending change/i.test(logText), 'the log explains why it skipped (MB shows no pending change)');
ck(/already up to date/i.test(logText), 'and says the entity is already up to date');

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
