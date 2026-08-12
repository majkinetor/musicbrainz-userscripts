// #497 (majkinetor) — per-entity-type processing chips: "(artist 5) (release 7)
// ...", all ON by default, click one off to exclude that type's still-queued
// items from the next run without removing them from the queue (dimmed +
// marked "excluded" instead).
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
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 5000 });

await page.evaluate(() => window.__falconTest.setQueue([
  { id: 'a1', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://myspace.com/x1', linkTypeId: null }], name: null, urlResults: null, status: 'queued', error: '' },
  { id: 'a2', entityType: 'artist', mbid: '5441c29d-3602-4898-b1a1-b77fa23b8e50', urls: [{ url: 'https://myspace.com/x2', linkTypeId: null }], name: null, urlResults: null, status: 'queued', error: '' },
  { id: 'r1', entityType: 'release', mbid: '3b60d941-e4c7-4dca-9b4d-7a11d0268383', urls: [{ url: 'https://discogs.com/release/1', linkTypeId: null }], name: null, urlResults: null, status: 'queued', error: '' },
  { id: 'r2', entityType: 'release', mbid: 'cccccccc-1111-0000-0000-000000000000', urls: [{ url: 'https://discogs.com/release/2', linkTypeId: null }], name: null, urlResults: null, status: 'done', error: '' },
]));

// 1. Chips render one per distinct type, with correct counts, all ON.
{
  const chips = await page.evaluate(() => [...document.querySelectorAll('.falcon-type-chip')].map(c => ({ type: c.dataset.type, text: c.textContent.trim(), bg: getComputedStyle(c).backgroundColor })));
  console.log('chips:', JSON.stringify(chips));
  ck(chips.length === 2, `one chip per distinct type (got ${chips.length})`);
  // text-transform:uppercase is CSS-only — textContent stays lowercase.
  ck(chips.find(c => c.type === 'artist')?.text === 'art 2', `artist chip shows its count (got "${chips.find(c => c.type === 'artist')?.text}")`);
  ck(chips.find(c => c.type === 'release')?.text === 'rel 2', `release chip counts BOTH queued and done items of that type (got "${chips.find(c => c.type === 'release')?.text}")`);
}

// 2. Toggling the release chip off excludes only still-QUEUED release items —
//    marks r1 excluded, leaves the already-done r2 alone — and nextQueued()
//    skips r1 entirely.
{
  await page.click('.falcon-type-chip[data-type="release"]');
  const rowInfo = await page.evaluate(() => {
    const row = id => document.querySelector(`.falcon-row[data-id="${id}"]`);
    const statusOf = id => row(id)?.querySelector('.falcon-row-status')?.textContent.trim();
    const opacityOf = id => row(id)?.style.opacity;
    return { r1status: statusOf('r1'), r1opacity: opacityOf('r1'), r2status: statusOf('r2'), a1status: statusOf('a1') };
  });
  console.log('after toggling release off:', JSON.stringify(rowInfo));
  ck(rowInfo.r1status === 'excluded', `still-queued release row shows "excluded" (got "${rowInfo.r1status}")`);
  ck(rowInfo.r1opacity === '0.45', `excluded row is visibly dimmed (got opacity="${rowInfo.r1opacity}")`);
  ck(rowInfo.r2status === 'done', `an already-done item of the toggled-off type keeps its real status, untouched (got "${rowInfo.r2status}")`);
  ck(rowInfo.a1status === 'queued', `a different (still-on) type is unaffected (got "${rowInfo.a1status}")`);

  // majkinetor, live: "progress bar max items remains old" — with release
  // toggled off, the excluded (still-queued) r1 must drop out of the
  // denominator, or the bar can never reach 100%. Queue here: a1/a2 queued
  // (eligible), r1 queued (excluded), r2 done -> total should be 3 (not 4),
  // settled 1.
  const progress = await page.evaluate(() => document.getElementById('falcon-progress-text')?.textContent);
  console.log('progress text with release excluded:', progress);
  ck(progress === '1/3', `excluded still-queued items drop out of the denominator (got "${progress}")`);

  const next = await page.evaluate(() => {
    const picked = [];
    let n;
    // drain every eligible queued item nextQueued() will hand out
    while ((n = window.__falconTest.nextQueued())) { picked.push(n.id); n.status = 'active'; }
    // put them back so later assertions aren't affected
    picked.forEach(id => { const it = window.__falconTest.getQueue().find(i => i.id === id); if (it) it.status = 'queued'; });
    return picked;
  });
  console.log('nextQueued() picks while release is off:', JSON.stringify(next));
  ck(next.includes('a1') && next.includes('a2'), 'both queued artists are still eligible');
  ck(!next.includes('r1'), 'the excluded release is never handed out by nextQueued()');
}

// 3. Toggling it back on restores normal eligibility and the plain "queued" label.
{
  await page.click('.falcon-type-chip[data-type="release"]');
  const info = await page.evaluate(() => ({
    r1status: document.querySelector('.falcon-row[data-id="r1"] .falcon-row-status')?.textContent.trim(),
    eligible: (() => { const n = window.__falconTest.nextQueued(); return n && n.id; })(),
    progress: document.getElementById('falcon-progress-text')?.textContent,
  }));
  console.log('after toggling back on:', JSON.stringify(info));
  ck(info.progress === '1/4', `re-enabling the type restores it to the denominator too (got "${info.progress}")`);
  ck(info.r1status === 'queued', `re-enabled type's row goes back to plain "queued" (got "${info.r1status}")`);
}

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
