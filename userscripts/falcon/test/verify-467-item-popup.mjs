// #467 (majkinetor: "When I click the failed label, open its worker alone in a
// popup, let it keep maximize button and show error in header.") — clicking a
// FAILED/PARTIAL queue row's status label opens a dedicated popup: the error
// shown prominently right under the header (not just on hover), the full url
// detail below, a maximize toggle, and a shortcut to open it in a real tab.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

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
await page.waitForTimeout(500);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 5000 });
await page.evaluate(() => window.__falconTest.setQueue([
  {
    id: 'f1', entityType: 'recording', mbid: 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7',
    urls: [{ url: 'https://sagason.bandcamp.com/track/popuptest', linkTypeId: null }],
    name: 'Beyond the Mists', urlResults: [{ url: 'https://sagason.bandcamp.com/track/popuptest', ok: false, error: 'ambiguous relationship type — use ⇗ to add manually' }],
    status: 'failed', error: 'ambiguous relationship type — use ⇗ to add manually',
  },
  { id: 'q1', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://myspace.com/queuedone', linkTypeId: null }], name: 'Der Zirkel', urlResults: null, status: 'queued', error: '' },
]));

// 1. Clicking a QUEUED row's status label does nothing — only failed/partial are clickable.
await page.click('.falcon-row-status[data-id="q1"]');
const popupAfterQueuedClick = await page.evaluate(() => { const el = document.getElementById('falcon-item-popup'); return el ? getComputedStyle(el).display : 'none'; });
ck(popupAfterQueuedClick === 'none', `clicking a QUEUED row's status label does nothing (popup display="${popupAfterQueuedClick}")`);

// 2. Clicking the FAILED row's status label opens the popup with the error in the header area and url detail below.
await page.click('.falcon-row-status[data-id="f1"]');
const popupState = await page.evaluate(() => {
  const el = document.getElementById('falcon-item-popup');
  return {
    display: el ? getComputedStyle(el).display : 'none',
    title: document.getElementById('falcon-item-popup-title')?.textContent,
    error: document.getElementById('falcon-item-popup-error')?.textContent,
    bodyText: document.getElementById('falcon-item-popup-body')?.textContent,
  };
});
console.log('popup state:', JSON.stringify(popupState));
ck(popupState.display === 'flex', `the popup opens (display="${popupState.display}")`);
ck(/Beyond the Mists/.test(popupState.title) && /FAILED/.test(popupState.title), `the header shows the entity name + status (got "${popupState.title}")`);
ck(/ambiguous relationship type/.test(popupState.error), `the error is shown prominently, not just on hover (got "${popupState.error}")`);
ck(/popuptest/.test(popupState.bodyText), `the url detail is shown in the body (got "${popupState.bodyText}")`);

// 3. Maximize toggle works and toggles its own icon.
await page.click('#falcon-item-popup-maximize');
const maxedWidth = await page.evaluate(() => document.getElementById('falcon-item-popup').style.width);
const maxedIcon = await page.textContent('#falcon-item-popup-maximize');
ck(maxedWidth === '94vw', `maximizing grows the popup (width="${maxedWidth}")`);
ck(maxedIcon === '❐', `the maximize icon flips to the restore glyph (got "${maxedIcon}")`);
await page.click('#falcon-item-popup-maximize');
const restoredWidth = await page.evaluate(() => document.getElementById('falcon-item-popup').style.width);
ck(restoredWidth === '520px', `un-maximizing restores the original width (got "${restoredWidth}")`);

// 4. Close button hides it.
await page.click('#falcon-item-popup-close');
const closedDisplay = await page.evaluate(() => getComputedStyle(document.getElementById('falcon-item-popup')).display);
ck(closedDisplay === 'none', `closing hides the popup (display="${closedDisplay}")`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
