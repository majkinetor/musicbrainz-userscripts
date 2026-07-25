// #467 (majkinetor): "Show in table entity type too as a column. Right click on
// cell selects all entities of that type" + "make external links clickable" +
// "Put link type next to it, not on the other side of the screen".
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
  { id: 'a1', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://myspace.com/a1', linkTypeId: null }], name: 'Der Zirkel', urlResults: null, status: 'queued', error: '' },
  { id: 'a2', entityType: 'artist', mbid: '5441c29d-3602-4898-b1a1-b77fa23b8e50', urls: [{ url: 'https://myspace.com/a2', linkTypeId: null }, { url: 'https://myspace.com/a2b', linkTypeId: '268' }], name: 'David Bowie', urlResults: null, status: 'queued', error: '' },
  { id: 'r1', entityType: 'recording', mbid: 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7', urls: [{ url: 'https://tidal.com/track/1', linkTypeId: null }], name: 'Dusk', urlResults: null, status: 'queued', error: '' },
]));

// 1. entity-type column shows a 3-letter abbreviation for each row.
const typeCells = await page.evaluate(() => [...document.querySelectorAll('.falcon-row-type')].map(el => ({ id: el.dataset.id, type: el.dataset.type, text: el.textContent })));
console.log('type cells:', JSON.stringify(typeCells));
ck(typeCells.find(c => c.id === 'a1')?.text === 'art', `artist row shows an "art" type cell (got "${typeCells.find(c => c.id === 'a1')?.text}")`);
ck(typeCells.find(c => c.id === 'r1')?.text === 'rec', `recording row shows a "rec" type cell (got "${typeCells.find(c => c.id === 'r1')?.text}")`);

// 2. right-clicking an artist's type cell selects BOTH artist rows, not the recording.
await page.evaluate(() => {
  const cell = document.querySelector('.falcon-row-type[data-id="a1"]');
  cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
});
const selectedAfterRightClick = await page.evaluate(() => [...window.__falconTest.getSelectedIds()]);
console.log('selected after right-click on an artist type cell:', JSON.stringify(selectedAfterRightClick));
ck(selectedAfterRightClick.includes('a1') && selectedAfterRightClick.includes('a2') && !selectedAfterRightClick.includes('r1'), `right-clicking selects every artist, and only artists (got ${JSON.stringify(selectedAfterRightClick)})`);
const checkboxStates = await page.evaluate(() => ({
  a1: document.querySelector('.falcon-row-check[data-id="a1"]').checked,
  a2: document.querySelector('.falcon-row-check[data-id="a2"]').checked,
  r1: document.querySelector('.falcon-row-check[data-id="r1"]').checked,
}));
ck(checkboxStates.a1 && checkboxStates.a2 && !checkboxStates.r1, `the actual checkboxes reflect the selection too (${JSON.stringify(checkboxStates)})`);

// 3. single-url rows render a real clickable <a href>, not plain text.
const singleUrlLink = await page.evaluate(() => {
  const row = document.querySelector('.falcon-row[data-id="a1"]');
  const a = [...row.querySelectorAll('a')].find(x => x.href.includes('myspace.com/a1'));
  return a ? { href: a.href, target: a.target } : null;
});
console.log('single-url link:', JSON.stringify(singleUrlLink));
ck(singleUrlLink && singleUrlLink.href.includes('myspace.com/a1') && singleUrlLink.target === '_blank', `a single-url row's summary shows a real clickable link (${JSON.stringify(singleUrlLink)})`);

// 4. expanded detail: each url is a clickable link, and its "type N" badge sits
// immediately next to it (not pushed to the far edge via flex:1).
await page.click('.falcon-row-expand[data-id="a2"]');
const detailInfo = await page.evaluate(() => {
  const row = document.querySelector('.falcon-row[data-id="a2"]');
  const detailLines = [...row.children].slice(1); // skip the summary row
  return detailLines.map(line => {
    const a = line.querySelector('a');
    const typeSpans = [...line.querySelectorAll('span')].map(s => s.textContent);
    return { href: a?.href, isFlexGrow: getComputedStyle(a).flexGrow, typeSpans };
  });
});
console.log('detail lines:', JSON.stringify(detailInfo));
ck(detailInfo.every(l => l.href && l.href.includes('myspace.com')), 'every expanded detail url is a real clickable link');
ck(detailInfo.some(l => l.typeSpans.some(t => /type 268/.test(t))), `the linkTypeId badge is present (${JSON.stringify(detailInfo.map(l => l.typeSpans))})`);
ck(detailInfo.every(l => l.isFlexGrow === '0'), `the url link no longer flex-grows to push the type badge away (flex-grow values: ${JSON.stringify(detailInfo.map(l => l.isFlexGrow))})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
