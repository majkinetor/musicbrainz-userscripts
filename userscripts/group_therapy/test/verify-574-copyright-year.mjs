// #574 (majkinetor): "GT Text parser is currently filling only the start date;
// it looks like it should also add the same year as the end date." His
// screenshot has the two side by side on one release: "(in 2021)" for the ©,
// "(from 2021 to present)" for the ℗ the parser staged.
//
// A notice year is a point in time. MB only renders "in 2021" when begin_date,
// end_date and ended are all set; begin alone reads as an open-ended range. Same
// call kellnerd's parse-copyright-notice makes (setYear), and the reading
// IvanDobsky gives on the forum:
//   community.metabrainz.org/t/how-to-add-ranges-of-years-for-copyrights-or-publishers/588455/4
//
// Two layers, because either alone would be weak:
//   1. txpNoticeDatePeriod() — the shape, deterministically, including the
//      no-year case that must stay undated.
//   2. live on test.musicbrainz.org — paste a ℗ line, resolve the holder, Apply,
//      and read what MB itself renders next to the staged relationship. That is
//      the actual thing the issue is about; the shape is only a means to it.
//
// Never submits: every POST to /edit is aborted, so this exercises the staged
// editor state, which is what the user reviews before saving.
//
// Run: node test/verify-574-copyright-year.mjs
//      GT_SRC=<path> node test/verify-574-copyright-year.mjs   (against another build)
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');

const SRC = process.env.GT_SRC || 'C:/Work/mb-userscripts/userscripts/group_therapy/group_therapy.user.js';
const RELEASE_GID = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
const YEAR = 2021;
const code = await readFile(SRC, 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const log = (...a) => console.log('[verify-574]', ...a);

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1600, height: 1100 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Group Therapy', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));

await page.goto(`https://test.musicbrainz.org/release/${RELEASE_GID}/edit-relationships`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN — see reference_test_musicbrainz_instance'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(4000);

let posts = 0;
await page.route('**/*', route => {
  const r = route.request();
  if (r.method() === 'POST' && /\/edit/.test(r.url())) { posts++; return route.abort(); }
  return route.continue();
});

await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__groupTherapy, { timeout: 15000 });
await page.waitForTimeout(1200);

// ── 1. the date period itself ────────────────────────────────────────────────
const shapes = await page.evaluate(y => {
  const f = window.__groupTherapy.txpNoticeDatePeriod;
  if (typeof f !== 'function') return { missing: true };
  return { year: f(y), str: f(String(y)), none: f(null), blank: f(''), junk: f('n/a') };
}, YEAR);
log('shapes:', JSON.stringify(shapes));
ck(!shapes.missing, 'txpNoticeDatePeriod is exported');
const d = shapes.year || {};
ck(!!d.begin_date && d.begin_date.year === YEAR, `begin_date is the notice year (got ${JSON.stringify(d.begin_date)})`);
ck(!!d.end_date && d.end_date.year === YEAR, `end_date is the SAME year — this is the whole of #574 (got ${JSON.stringify(d.end_date)})`);
ck(d.ended === true, `ended is set, or MB still renders an open range (got ${d.ended})`);
ck(!!d.begin_date && d.begin_date !== d.end_date, 'begin and end are separate objects, so MB mutating one cannot move the other');
ck(!!d.begin_date && d.begin_date.month === null && d.begin_date.day === null, 'a bare year stays a bare year — no invented month/day');
ck(JSON.stringify(shapes.str) === JSON.stringify(shapes.year), 'a year parsed out of text ("2021") behaves the same as a number');
ck(shapes.none === null && shapes.blank === null && shapes.junk === null,
  `no year → no date period at all, so ordinary credits stay undated (got ${JSON.stringify([shapes.none, shapes.blank, shapes.junk])})`);

// ── 2. what MB renders, end to end ───────────────────────────────────────────
// A ℗ holder resolves as a label; take a real one off this server rather than
// hard-coding a gid that a test-data reset could invalidate.
const label = await page.evaluate(async () => {
  try {
    const r = await fetch('/ws/2/label?query=label:Records&fmt=json&limit=1', { headers: { Accept: 'application/json' } }).then(x => x.json());
    const l = r.labels && r.labels[0];
    return l ? { gid: l.id, name: l.name } : null;
  } catch (e) { return null; }
});
log('holder label:', JSON.stringify(label));

if (!label) {
  console.log('SKIP: no label found on the test server to use as a ℗ holder');
} else {
  await page.evaluate(() => window.__groupTherapy.openTextParser());
  await page.waitForTimeout(300);
  ck(await page.isVisible('.gt-cons.gt-tp'), 'the Text parser modal opens');

  await page.fill('.gt-tp-ta', `\u2117 ${YEAR} ${label.name}`);
  await page.waitForTimeout(300);
  const parsed = await page.evaluate(() => [...document.querySelectorAll('.gt-tp-row')]
    .map(tr => [...tr.querySelectorAll('.gt-tp-c')].map(td => td.textContent.trim())));
  log('parsed rows:', JSON.stringify(parsed));
  ck(parsed.length === 1 && /phonographic/i.test(parsed[0][0] || ''), `the ℗ line parses as one phonographic-copyright row (got ${JSON.stringify(parsed)})`);

  await page.click('.gt-tp-resolve');
  await page.waitForTimeout(900);
  // resolve the holder through the picker's paste-MBID path — deterministic,
  // unlike clicking whichever search result happens to rank first today.
  const needsPick = await page.isVisible('.gt-tp-search:not(.gt-tp-resolved)');
  if (needsPick) {
    await page.click('.gt-tp-search:not(.gt-tp-resolved)');
    await page.waitForTimeout(200);
    await page.fill('.gt-tp-q', label.gid);
    await page.waitForFunction(() => !document.querySelector('.gt-tp-apop'), null, { timeout: 15000 });
    await page.waitForTimeout(400);
  }

  // Record what the tool actually hands MB. MB's own state keeps relationships
  // in its immutable trees, which are awkward and version-fragile to walk; the
  // dispatch payload is the thing under test and is stable by definition.
  await page.evaluate(() => {
    const re = window.MB.relationshipEditor;
    window.__574dispatches = [];
    const orig = re.dispatch.bind(re);
    re.dispatch = a => {
      try {
        const s = a && a.newRelationshipState;
        if (s) window.__574dispatches.push({ begin: s.begin_date, end: s.end_date, ended: !!s.ended, linkTypeID: s.linkTypeID });
      } catch (e) {}
      return orig(a);
    };
  });

  const before = await page.evaluate(() => document.querySelectorAll('.relationship-item').length);
  await page.click('.gt-cons-apply');
  await page.waitForTimeout(1200);

  const staged = await page.evaluate(() => window.__574dispatches || []);
  log('dispatched relationship states:', JSON.stringify(staged));
  ck(staged.length > 0, `Apply dispatched a relationship at all (got ${staged.length})`);
  ck(staged.every(s => s.begin && s.begin.year === YEAR), `begin_date is the notice year (got ${JSON.stringify(staged.map(s => s.begin))})`);
  ck(staged.every(s => s.end && s.end.year === YEAR), `end_date is the SAME year, not null — this is the fix (got ${JSON.stringify(staged.map(s => s.end))})`);
  ck(staged.every(s => s.ended), `and ended is set (got ${JSON.stringify(staged.map(s => s.ended))})`);

  // The user-visible outcome from the issue's screenshot.
  const rendered = await page.evaluate(() => [...document.querySelectorAll('.relationship-item')]
    .map(li => li.textContent.replace(/\s+/g, ' ').trim())
    .filter(t => /\b(in|from) \d{4}\b/.test(t)));
  log('rendered date phrases:', JSON.stringify(rendered.slice(0, 8)));
  const after = await page.evaluate(() => document.querySelectorAll('.relationship-item').length);
  ck(after > before, `a new relationship-item appeared (before ${before}, after ${after})`);
  ck(rendered.some(t => t.includes(`in ${YEAR}`)), `MB renders it as "in ${YEAR}" — the left-hand side of majkinetor's screenshot`);
  ck(!rendered.some(t => t.includes(`from ${YEAR} to present`)), `and NOT as "from ${YEAR} to present" — the bug`);
}

ck(posts === 0, `nothing was submitted (${posts} edit POST(s) intercepted)`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
