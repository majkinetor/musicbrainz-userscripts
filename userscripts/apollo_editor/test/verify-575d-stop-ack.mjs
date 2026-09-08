// #575 round 4 (majkinetor): "both Matches can be 100% unresponsive to clicks,
// especially Recordings one - it often shows 'scanning duplicates', although
// there either aren't any or all are 0% similar."
//
// Measured first, on the very release he attached: the main thread was never
// blocked — a requestAnimationFrame round trip stayed at 0ms across a whole 81
// second pass. So nothing was frozen. What was missing was any ANSWER to the
// press. The loops notice the stop flag only between items, and one item can be
// a multi-second search or a shared throttle hold, so the button went on reading
// "Stop" and the click read as ignored.
//
// Asserted, for each button: the label answers the press almost immediately, the
// pass really ends, and what it had already matched survives. Plus, the pane no
// longer sits there claiming to be "scanning duplicates" after that scan came
// back empty.
//
// TWO SESSIONS, one per button. The stop flag is shared, so stopping either pass
// stops both — a single session can only ever prove one of them, and restarting
// the other is not reliable (by then everything left is ambiguous and a fresh
// pass has nothing to do, which is exactly how an earlier version of this test
// went green for the wrong reason).
//
// Every /ws/2 read is delayed by three seconds, which is the only way to make
// this deterministic: against a healthy MusicBrainz a pass can finish before the
// click lands, and the result would depend on how busy someone else's server is.
// It is also the condition under which a person actually reaches for Stop.
//
// Read-only: every POST is aborted, and none of them is an edit.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const SRC = process.env.APOLLO_SRC || 'C:/Work/mb-userscripts/userscripts/apollo_editor/apollo_editor.user.js';
// The seed fields of the Discogs import he attached. Extracted rather than
// committing his saved page: MusicBrainz embeds its Mapbox token in every
// rendered page, and GitHub push protection refuses it, rightly.
const SEED = process.env.SEED_JSON || 'C:/Work/mb-userscripts/userscripts/apollo_editor/test/seed-575-discogs-import.json';
const code = await readFile(SRC, 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const fields = JSON.parse(await readFile(SEED, 'utf8')).fields;
ck(fields.filter(([k]) => /track\.\d+\.name$/.test(k)).length >= 10, `fixture: his import seeds ${fields.length} fields`);

const TL = '#tc-bar [data-act="match"], #tc-hdr [data-act="match"]';
const REC = '#tc-recwrap .tc-rec-am';

async function session(body) {
  const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
    { headless: !process.argv.includes('--headed'), viewport: { width: 1700, height: 1100 } });
  await ctx.addInitScript(() => {
    const store = new Map([['apolloEditor.settings.v1', JSON.stringify({
      apolloEnabled: true, autoMatch: true, autoMatchRec: true, autoMatchLabel: true, autoMatchArtist: true,
      replaceReleaseInfo: true, replaceTracklist: true, replaceRecordings: true, discogsUrlMatch: true,
    })]]);
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_info = { script: { name: 'apollo', version: 't' } };
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('https://musicbrainz.org/release/add', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.evaluate(f => {
    const form = document.createElement('form');
    form.method = 'POST'; form.action = '/release/add';
    f.forEach(([k, v]) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; form.appendChild(i); });
    document.body.appendChild(form); form.submit();
  }, fields);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('#release-editor', { timeout: 60000 }).catch(() => {});
  const posted = [];
  await page.route(() => true, async r => {
    const q = r.request();
    if (q.method() === 'POST') { posted.push(q.url()); return r.abort(); }
    if (/musicbrainz\.org\/ws\/2\//.test(q.url())) await new Promise(res => setTimeout(res, 3000));
    return r.fallback();
  });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => window.__apolloEditor, null, { timeout: 60000 });
  await page.locator('a, button', { hasText: /^Tracklist$/ }).first().click().catch(() => {});
  await page.waitForSelector('.tc-search input.nm', { state: 'visible', timeout: 60000 });

  const label = sel => page.evaluate(s => {
    const b = document.querySelector(s); if (!b) return null;
    return ((b.querySelector('.tc-rec-am-lbl') || b).textContent || '').trim().replace(/\s+/g, ' ');
  }, sel);
  const waitLabel = (sel, re, ms = 90000) => page.waitForFunction(
    ([s, src]) => { const b = document.querySelector(s); return b && new RegExp(src).test(b.textContent) ? b.textContent.trim() : null; },
    [sel, re.source], { timeout: ms }).then(h => h.jsonValue()).catch(() => null);
  // The press is answered synchronously in the click handler, but a re-render can
  // land between the click and the read, so poll for the first label that has
  // stopped saying "Stop" rather than sampling once. Two seconds is still well
  // inside one delayed request, so this cannot pass just because the pass ended.
  const ackAfterClick = async sel => {
    const t0 = Date.now();
    for (;;) {
      const l = await label(sel);
      if (l && !/Stop$/.test(l)) return { label: l, ms: Date.now() - t0 };
      if (Date.now() - t0 >= 2000) return { label: l, ms: Date.now() - t0 };
      await page.waitForTimeout(50);
    }
  };

  await body({ page, label, waitLabel, ackAfterClick, errs, posted });
  ck(!posted.some(u => /\/ws\/js\/edit\/create/.test(u)), `no edit was submitted (${posted.length} POST(s), all aborted)`);
  ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await ctx.close();
}

// ── session 1: the tracklist button ────────────────────────────────────────
console.log('--- tracklist Match/Stop ---');
await session(async ({ page, waitLabel, ackAfterClick }) => {
  // The word "unresponsive" most obviously suggests a frozen thread. It is not
  // one — assert that, because it is what decides where the fix belongs.
  const raf = await page.evaluate(() => new Promise(r => { const s = performance.now(); requestAnimationFrame(() => r(Math.round(performance.now() - s))); }));
  ck(raf < 250, `the main thread is answering during the pass (rAF round trip ${raf}ms)`);

  const running = await waitLabel(TL, /Stop/);
  ck(!!running, `fixture: the tracklist pass is running and offering Stop (${JSON.stringify(running)})`);
  if (!running) return;
  const before = await page.evaluate(() => window.__apolloEditor.model.tracks.filter(t => t.slots.some(s => s.committed)).length);
  await page.click(TL);
  const ack = await ackAfterClick(TL);
  ck(/Stopping/.test(ack.label || ''), `the tracklist button answers the press in ${ack.ms}ms (${JSON.stringify(ack.label)})`);
  ck(!!await waitLabel(TL, /Match/), 'and the pass really ends');
  const after = await page.evaluate(() => window.__apolloEditor.model.tracks.filter(t => t.slots.some(s => s.committed)).length);
  ck(after >= before, `stopping is not undoing — ${before} matched before, ${after} after`);
});

// ── session 2: the recordings button, the one he singled out ───────────────
console.log('--- recordings Match/Stop ---');
await session(async ({ page, waitLabel, ackAfterClick }) => {
  // Its pane lives on the Recordings tab; on the Tracklist tab the button exists
  // but is not something a user could click. Caught on the pass that starts by
  // itself, before anything has had a chance to stop it.
  await page.locator('a, button', { hasText: /^Recordings$/ }).first().click().catch(() => {});
  await page.waitForSelector(REC, { state: 'visible', timeout: 30000 }).catch(() => {});
  const running = await waitLabel(REC, /Stop/);
  ck(!!running, `fixture: the recordings pass is running and offering Stop (${JSON.stringify(running)})`);
  if (!running) return;
  const before = await page.evaluate(() => document.querySelectorAll('#tc-recwrap .tc-rec-row').length);
  await page.click(REC);
  const ack = await ackAfterClick(REC);
  ck(/Stopping/.test(ack.label || ''), `the recordings button answers the press in ${ack.ms}ms (${JSON.stringify(ack.label)})`);
  ck(!!await waitLabel(REC, /Match/), 'and its pass really ends');
  const after = await page.evaluate(() => document.querySelectorAll('#tc-recwrap .tc-rec-row').length);
  ck(after >= before, `stopping is not undoing — ${before} rows before, ${after} after`);

  const stale = await page.evaluate(() => {
    const e = document.querySelector('#tc-recwrap .tc-rec-amstatus');
    return e ? e.textContent.trim() : null;
  });
  ck(!/scanning duplicates/.test(stale || ''),
    `the pane is not left claiming to be scanning duplicates (${JSON.stringify(stale)})`);
});

console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
