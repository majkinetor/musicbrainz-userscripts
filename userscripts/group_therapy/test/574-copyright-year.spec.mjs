// #574 (majkinetor): "GT Text parser is currently filling only the start date;
// it looks like it should also add the same year as the end date." His
// screenshot has the two side by side on one release: "(in 2021)" for the ©,
// "(from 2021 to present)" for the ℗ the parser staged.
//
// A notice year is a point in time. MB only renders "in 2021" when begin_date,
// end_date and ended are all set; begin alone reads as an open-ended range.
//
// MB documents this on the relationship types themselves (chaban-mb on #574) —
// "When a year is specified …, use that year as both the begin and end date" —
// including on the Label-Release Copyright type this parser writes:
//   musicbrainz.org/relationship/2ed5a497-4f85-4b3f-831e-d341ad28c544   (©)
//   musicbrainz.org/relationship/7fd5fbc0-fbf4-4d04-be23-417d50a4dc30   (℗)
// It is also the call kellnerd's parse-copyright-notice makes (setYear).
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
import { test, check, requireLogin, SANDBOX, settled, idle, frames, until } from '../../../dev/test/harness.mjs';
import { blockEdits } from './gt.mjs';

test.use({ gm: { name: 'Group Therapy' } });

test('a copyright notice year is both the start and the end date', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const RELEASE_GID = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
  const YEAR = 2021;
  const log = (...a) => console.log('[verify-574]', ...a);

  await page.goto(`${SANDBOX}/release/${RELEASE_GID}/edit-relationships`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await settled(page);

  const posts = await blockEdits(page);

  await inject('group_therapy', { waitFor: '__groupTherapy' });
  await idle(page);

  // ── 1. the date period itself ────────────────────────────────────────────────
  const shapes = await page.evaluate(y => {
    const f = window.__groupTherapy.txpNoticeDatePeriod;
    if (typeof f !== 'function') return { missing: true };
    return { year: f(y), str: f(String(y)), none: f(null), blank: f(''), junk: f('n/a') };
  }, YEAR);
  log('shapes:', JSON.stringify(shapes));
  check(!shapes.missing, 'txpNoticeDatePeriod is exported');
  const d = shapes.year || {};
  check(!!d.begin_date && d.begin_date.year === YEAR, `begin_date is the notice year (got ${JSON.stringify(d.begin_date)})`);
  check(!!d.end_date && d.end_date.year === YEAR, `end_date is the SAME year — this is the whole of #574 (got ${JSON.stringify(d.end_date)})`);
  check(d.ended === true, `ended is set, or MB still renders an open range (got ${d.ended})`);
  check(!!d.begin_date && d.begin_date !== d.end_date, 'begin and end are separate objects, so MB mutating one cannot move the other');
  check(!!d.begin_date && d.begin_date.month === null && d.begin_date.day === null, 'a bare year stays a bare year — no invented month/day');
  check(JSON.stringify(shapes.str) === JSON.stringify(shapes.year), 'a year parsed out of text ("2021") behaves the same as a number');
  check(shapes.none === null && shapes.blank === null && shapes.junk === null,
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
    await frames(page);
    check(await page.isVisible('.gt-cons.gt-tp'), 'the Text parser modal opens');

    await page.fill('.gt-tp-ta', `\u2117 ${YEAR} ${label.name}`);
    await frames(page);
    const parsed = await page.evaluate(() => [...document.querySelectorAll('.gt-tp-row')]
      .map(tr => [...tr.querySelectorAll('.gt-tp-c')].map(td => td.textContent.trim())));
    log('parsed rows:', JSON.stringify(parsed));
    check(parsed.length === 1 && /phonographic/i.test(parsed[0][0] || ''), `the ℗ line parses as one phonographic-copyright row (got ${JSON.stringify(parsed)})`);

    await page.click('.gt-tp-resolve');
    await page.waitForFunction(() => { const b = document.querySelector('.gt-tp-resolve'); return b && !b.disabled; }, null, { timeout: 60000 }).catch(() => {});   // resolved
    await frames(page);
    // resolve the holder through the picker's paste-MBID path — deterministic,
    // unlike clicking whichever search result happens to rank first today.
    const needsPick = await page.isVisible('.gt-tp-search:not(.gt-tp-resolved)');
    if (needsPick) {
      await page.click('.gt-tp-search:not(.gt-tp-resolved)');
      await frames(page);
      await page.fill('.gt-tp-q', label.gid);
      await page.waitForFunction(() => !document.querySelector('.gt-tp-apop'), null, { timeout: 15000 });
      await frames(page);
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
    await until(() => page.isVisible('.gt-cons.gt-tp'), v => !v);   // applied: the window closes
    await frames(page);

    const staged = await page.evaluate(() => window.__574dispatches || []);
    log('dispatched relationship states:', JSON.stringify(staged));
    check(staged.length > 0, `Apply dispatched a relationship at all (got ${staged.length})`);
    check(staged.every(s => s.begin && s.begin.year === YEAR), `begin_date is the notice year (got ${JSON.stringify(staged.map(s => s.begin))})`);
    check(staged.every(s => s.end && s.end.year === YEAR), `end_date is the SAME year, not null — this is the fix (got ${JSON.stringify(staged.map(s => s.end))})`);
    check(staged.every(s => s.ended), `and ended is set (got ${JSON.stringify(staged.map(s => s.ended))})`);

    // The user-visible outcome from the issue's screenshot.
    const rendered = await page.evaluate(() => [...document.querySelectorAll('.relationship-item')]
      .map(li => li.textContent.replace(/\s+/g, ' ').trim())
      .filter(t => /\b(in|from) \d{4}\b/.test(t)));
    log('rendered date phrases:', JSON.stringify(rendered.slice(0, 8)));
    const after = await page.evaluate(() => document.querySelectorAll('.relationship-item').length);
    check(after > before, `a new relationship-item appeared (before ${before}, after ${after})`);
    check(rendered.some(t => t.includes(`in ${YEAR}`)), `MB renders it as "in ${YEAR}" — the left-hand side of majkinetor's screenshot`);
    check(!rendered.some(t => t.includes(`from ${YEAR} to present`)), `and NOT as "from ${YEAR} to present" — the bug`);
  }

  check(posts.length === 0, `nothing was submitted (${posts.length} edit POST(s) intercepted)`);
});
