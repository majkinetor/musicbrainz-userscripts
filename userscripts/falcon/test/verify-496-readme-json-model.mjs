// #496 (majkinetor): "Lets put model info in Falcon docs" — the README's new
// "## JSON model" section documents the actual Import/Export item shape. This
// test extracts that exact JSON example from the README and round-trips it
// through the real importQueueJson(), confirming the documented example isn't
// just syntactically valid JSON but is actually accepted and produces the
// items the docs claim (right entityType/urls/comment/isrcs/cover per row).
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');
const readme = await readFile('C:/Work/mb-userscripts/userscripts/falcon/README.md', 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const start = readme.indexOf('```json');
const end = readme.indexOf('```', start + 7);
const block = readme.slice(start + 7, end).trim();
let parsed;
try { parsed = JSON.parse(block); ck(true, 'the README JSON example is valid JSON'); }
catch (e) { ck(false, 'the README JSON example is valid JSON — ' + e.message); process.exit(1); }
ck(Array.isArray(parsed.items) && parsed.items.length === 3, `the example has 3 items (got ${parsed.items?.length})`);

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(500);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 5000 });

const result = await page.evaluate((text) => window.__falconTest.importQueueJson(text, 'readme-example'), block);
console.log('import result:', JSON.stringify(result));
ck(result.added === 3, `all 3 documented items are accepted by the real importer (added=${result.added}, skipped=${result.skipped || 0})`);

const queue = await page.evaluate(() => window.__falconTest.getQueue());
const artist = queue.find(i => i.entityType === 'artist');
const recording = queue.find(i => i.entityType === 'recording');
const release = queue.find(i => i.entityType === 'release');
ck(artist && artist.status === 'done' && artist.urls.length === 1, `artist row round-trips with its documented status/urls (got status=${artist?.status}, urls=${artist?.urls.length})`);
ck(recording && recording.comment === 'live version' && recording.isrcs.length === 1 && recording.isrcs[0] === 'NLTH62000001', `recording row round-trips comment + isrcs as documented (got comment="${recording?.comment}", isrcs=${JSON.stringify(recording?.isrcs)})`);
ck(release && release.cover && release.cover.url.includes('dzcdn'), `release row round-trips its cover.url as documented (got cover=${JSON.stringify(release?.cover)})`);
ck(release && release.urls.length === 1 && release.urls[0].linkTypeId === '75', `release row ALSO keeps its urls[] alongside cover (documented as both-at-once) (got ${JSON.stringify(release?.urls)})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
