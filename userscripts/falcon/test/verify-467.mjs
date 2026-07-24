// #467 — Falcon MVP: queue parsing, minimal launcher, URL-param seeding, and the
// worker mechanism end-to-end (real artist edit page loaded in an iframe, filled and
// submitted directly from the parent frame). The final POST is intercepted and
// fulfilled with a fake success redirect so this test never creates a real MB edit —
// the LIVE proof (a real artist, a real missing Bandcamp link, confirmed via the MB
// API afterward) was already done manually for #467/#459 and doesn't need repeating
// on every test run.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');
const ARTIST_A = 'd31f76d2-1d8e-4271-8027-148f375979d7';   // Der Zirkel — real, already has a Bandcamp rel (harmless GET)
const ARTIST_B = '5441c29d-3602-4898-b1a1-b77fa23b8e50';   // David Bowie — just used as a 2nd real edit page to load

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.__store = store;
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));

let posts = [];
await page.route('**/artist/*/edit', async (route, request) => {
  if (request.method() === 'POST') {
    posts.push(request.url());
    // Simulate MB's real success response: redirect to the clean entity page.
    const mbid = (request.url().match(/\/artist\/([0-9a-f-]{36})\/edit/) || [])[1];
    return route.fulfill({ status: 302, headers: { Location: `https://musicbrainz.org/artist/${mbid}` } });
  }
  return route.continue();
});

await page.goto('https://musicbrainz.org/artist/' + ARTIST_A, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(500);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// 1. Parsing
const parsed = await page.evaluate(() => {
  const { parsePaste } = window.__falconTest;
  return parsePaste([
    'd31f76d2-1d8e-4271-8027-148f375979d7,https://example.com/a',
    'label:5441c29d-3602-4898-b1a1-b77fa23b8e50 https://example.com/b',
    '# a comment line, ignored',
    'not-an-mbid,https://example.com/c',
    'https://musicbrainz.org/artist/5441c29d-3602-4898-b1a1-b77fa23b8e50,https://example.com/d',
    '',
  ].join('\n'));
});
console.log(JSON.stringify(parsed, null, 1));
ck(parsed.length === 3, `parses 3 valid lines out of 6, skips comment/garbage (got ${parsed.length})`);
ck(parsed[0].entityType === 'artist' && parsed[0].url === 'https://example.com/a', 'bare mbid+url defaults to artist');
ck(parsed[1].entityType === 'label' && parsed[1].mbid === '5441c29d-3602-4898-b1a1-b77fa23b8e50', 'label: prefix respected');
ck(parsed[2].entityType === 'artist' && parsed[2].mbid === '5441c29d-3602-4898-b1a1-b77fa23b8e50', 'a full MB URL in place of the bare mbid is recognized');

// 2. URL-param seeding (base64 JSON)
const seedPayload = Buffer.from(JSON.stringify([{ entityType: 'artist', mbid: ARTIST_A, url: 'https://example.com/seed' }])).toString('base64');
await page.goto(`https://musicbrainz.org/artist/${ARTIST_A}?falcon=${encodeURIComponent(seedPayload)}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
const seededQueue = await page.evaluate(() => window.__falconTest.getQueue());
ck(seededQueue.length === 1 && seededQueue[0].url === 'https://example.com/seed', `falcon= param auto-seeds the queue (${JSON.stringify(seededQueue)})`);
const panelVisible = await page.evaluate(() => document.getElementById('falcon-panel')?.style.display);
ck(panelVisible === 'flex', `panel auto-opens when seeded (display=${panelVisible})`);

// 2b. A FRESH page (panel never shown before) — clicking the launcher must OPEN it on the
// very first click. Regression check: the panel's initial cssText once had a duplicate
// `display` declaration (accidental `display:flex` after `display:none`) that made it
// start already-visible, so the first togglePanel() call closed it instead of opening it.
const freshPage = await ctx.newPage();
await freshPage.goto(`https://musicbrainz.org/artist/${ARTIST_A}`, { waitUntil: 'domcontentloaded' });
await freshPage.waitForTimeout(500);
await freshPage.addScriptTag({ content: code });
await freshPage.waitForSelector('#falcon-launcher', { timeout: 10000 });
const initialDisplay = await freshPage.evaluate(() => document.getElementById('falcon-panel')?.style.display ?? 'NO_PANEL_YET');
await freshPage.click('#falcon-launcher');
await freshPage.waitForTimeout(300);
const afterFirstClick = await freshPage.evaluate(() => document.getElementById('falcon-panel')?.style.display);
ck(initialDisplay !== 'flex', `panel isn't pre-rendered visible before any interaction (was: ${initialDisplay})`);
ck(afterFirstClick === 'flex', `first-ever launcher click OPENS the panel (display=${afterFirstClick})`);
await freshPage.close();

// 3. Minimal launcher — always present, small, unobtrusive
const launcherStyle = await page.evaluate(() => {
  const l = document.getElementById('falcon-launcher');
  if (!l) return null;
  const cs = getComputedStyle(l);
  return { width: cs.width, height: cs.height, position: cs.position, opacity: cs.opacity, borderRadius: cs.borderRadius };
});
console.log('launcher style:', JSON.stringify(launcherStyle));
ck(launcherStyle && launcherStyle.position === 'fixed', 'launcher is a fixed-position floating button');
ck(launcherStyle && parseFloat(launcherStyle.width) <= 44 && parseFloat(launcherStyle.height) <= 44, 'launcher is small (<=44px), Scribe-style');
ck(launcherStyle && parseFloat(launcherStyle.opacity) < 1, 'launcher is dimmed when idle (not visually intrusive)');

// 4. Hotkey toggles the panel
await page.evaluate(() => { document.getElementById('falcon-panel').style.display = 'none'; });
await page.keyboard.press('Control+Alt+F');
await page.waitForTimeout(200);
const afterHotkey = await page.evaluate(() => document.getElementById('falcon-panel')?.style.display);
ck(afterHotkey === 'flex', `Ctrl+Alt+F opens the panel (display=${afterHotkey})`);

// 5. Worker mechanism end-to-end (2 real edit-page loads, POST intercepted+faked)
await page.evaluate((artistB) => {
  window.__falconTest.setQueue([
    // NOT example.com/example.org — MB's client-side validation specifically rejects
    // those as placeholder URLs ("is just an example. Please enter the actual ...").
    { id: 'a', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', url: 'https://myspace.com/falcontest1', status: 'queued', error: '' },
    { id: 'b', entityType: 'artist', mbid: artistB, url: 'https://myspace.com/falcontest2', status: 'queued', error: '' },
  ]);
  window.__falconTest.cfg.workers = 1;   // single worker — proves it advances to the 2nd item in the SAME iframe
}, ARTIST_B);
await page.evaluate(() => window.__falconTest.start());
await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status === 'done' || i.status === 'failed'), null, { timeout: 30000 }).catch(() => {});
const finalQueue = await page.evaluate(() => window.__falconTest.getQueue());
console.log('final queue:', JSON.stringify(finalQueue, null, 1));
ck(finalQueue.every(i => i.status === 'done'), `both queue items committed (statuses: ${finalQueue.map(i => i.status).join(', ')})`);
ck(posts.length === 2, `exactly 2 real form POSTs intercepted, one per artist (got ${posts.length})`);
const workerCount = await page.evaluate(() => document.querySelectorAll('.falcon-worker').length);
ck(workerCount === 1, `only 1 worker iframe was used for 2 queue items (got ${workerCount}) — proves same-tab reuse, no per-item open/close`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
