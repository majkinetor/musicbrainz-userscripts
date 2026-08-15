// #509 follow-up (majkinetor): "I don't think its working, although not
// sure. Lets add debug log for track fetching - list entity mbid and if name
// is fetched or passed." Verifies the Log tab actually shows, per entity,
// whether its name came straight from the source (Harmony-scraped) or had to
// be fetched from MB — so this is checkable from the log instead of assumed.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const NAMED_MBID = 'aaaaaaaa-5090-0000-0000-0000000000a1';
const FETCH_MBID = 'aaaaaaaa-5090-0000-0000-0000000000a2';

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
const errs = []; const page = await ctx.newPage();
page.on('pageerror', e => errs.push(e.message));
await page.route('**/ws/2/recording/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ title: 'Fetched From MB' }) }));
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });

await page.evaluate(({ NAMED_MBID, FETCH_MBID }) => {
  const t = window.__falconTest;
  t.addToQueue([
    { entityType: 'recording', mbid: NAMED_MBID, url: 'https://example.com/named', name: 'Passed Straight Through' },
    { entityType: 'recording', mbid: FETCH_MBID, url: 'https://example.com/fetch' },
  ]);
}, { NAMED_MBID, FETCH_MBID });
await page.waitForTimeout(600);

const log = await page.evaluate(() => window.__falconTest.getLog().join('\n'));
console.log('--- log tail ---');
console.log(log.split('\n').filter(l => /\[names\]/.test(l)).join('\n'));

ck(new RegExp(`\\[names\\].*recording:${NAMED_MBID}.*passed from source.*Passed Straight Through`).test(log), 'log shows the Harmony-scraped name as "passed from source"');
ck(new RegExp(`\\[names\\].*recording:${FETCH_MBID}.*fetching from MB`).test(log), 'log shows the nameless item triggering an MB fetch');
ck(new RegExp(`\\[names\\].*recording:${FETCH_MBID}.*fetched:.*Fetched From MB`).test(log), 'log shows the fetch actually resolving to a name');

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
