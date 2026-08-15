// #518 (majkinetor): "When there is 1 link, its shown instead of `1 link,
// isrc`, lets change that." The row summary only ever folded
// disambiguation/ISRC/cover into the visible text on the zero-links
// branch — an item with exactly one link silently hid whichever of those
// it also carried. Same bug existed for >1 links too, fixed alongside it.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

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
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 5000 });

await page.evaluate(() => window.__falconTest.setQueue([
  // 1 link + an ISRC — the exact reported bug.
  { id: '1', entityType: 'recording', mbid: 'aaaaaaaa-5180-0000-0000-000000000001', urls: [{ url: 'https://tidal.com/track/1' }], isrcs: ['USRC17607839'], disambiguation: '', cover: [], status: 'queued', error: '' },
  // 1 link + disambiguation, no ISRC.
  { id: '2', entityType: 'recording', mbid: 'aaaaaaaa-5180-0000-0000-000000000002', urls: [{ url: 'https://tidal.com/track/2' }], isrcs: [], disambiguation: 'live version', cover: [], status: 'queued', error: '' },
  // 1 link, nothing extra — no dangling " + " suffix.
  { id: '3', entityType: 'artist', mbid: 'aaaaaaaa-5180-0000-0000-000000000003', urls: [{ url: 'https://tidal.com/artist/3' }], isrcs: [], disambiguation: '', cover: [], status: 'queued', error: '' },
  // >1 links + ISRC — same fix applies there too.
  { id: '4', entityType: 'recording', mbid: 'aaaaaaaa-5180-0000-0000-000000000004', urls: [{ url: 'https://a.com/4' }, { url: 'https://b.com/4' }], isrcs: ['GBUM71505078'], disambiguation: '', cover: [], status: 'queued', error: '' },
]));
await page.waitForTimeout(150);

const rows = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.falcon-row')].map(r => [r.dataset.id, r.querySelector('div').textContent])));
console.log('row text:', JSON.stringify(rows, null, 2));

ck(rows['1'].includes('tidal.com/track/1') && rows['1'].includes('ISRC'), `1 link + ISRC shows both (got "${rows['1']}")`);
ck(rows['2'].includes('tidal.com/track/2') && rows['2'].includes('disambiguation'), `1 link + disambiguation shows both (got "${rows['2']}")`);
ck(rows['3'].includes('tidal.com/artist/3') && !rows['3'].includes(' + '), `1 link with nothing extra has no dangling suffix (got "${rows['3']}")`);
ck(rows['4'].includes('2 links') && rows['4'].includes('ISRC'), `>1 links + ISRC shows both (got "${rows['4']}")`);

// the link itself must still be clickable, not swallowed by the new wrapper span.
const href1 = await page.evaluate(() => document.querySelector('.falcon-row[data-id="1"] a[href*="tidal.com"]')?.getAttribute('href'));
ck(href1 === 'https://tidal.com/track/1', `single link stays a real, clickable <a> (got "${href1}")`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
