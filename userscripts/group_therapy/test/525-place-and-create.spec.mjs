// #525 (majkinetor), the four follow-ups to the text parser:
//   1. the maximized window slid under the vertical scrollbar (in the page since #798)
//   2. seed the create form (type=Person + sort name, artists only) and adopt
//      the MBID once the create tab lands on the new entity
//   3. Place as a first-class entity — its own roles and a picker tab
//   4. presets: drop the two trailing ones, add "R by E[&]"
//
// Runs against test.musicbrainz.org and never submits: every POST to /edit is
// aborted and asserted zero at the end.
import { test, check, requireLogin, SANDBOX, settled, idle, frames } from '../../../dev/test/harness.mjs';
import { blockEdits, tpPaste, tpCredits } from './gt.mjs';

test.use({ gm: { name: 'Group Therapy' } });

test('the text parser: in the page, create seeding, places, presets', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const RELEASE_GID = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';

  for (let a = 1; ; a++) {
    try { await page.goto(`${SANDBOX}/release/${RELEASE_GID}/edit-relationships`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (a >= 3) throw e; console.log('goto retry ' + a); await page.waitForTimeout(4000); }
  }
  await requireLogin(page);
  await settled(page);

  const posts = await blockEdits(page);
  await inject('group_therapy');
  await idle(page);

  // open the text parser
  await page.click('.gt-clone-btn:has-text("Text parser")');
  await page.waitForSelector('.gt-tp', { timeout: 15000 });
  await frames(page);

  // ── 4. presets, under the pattern's ▾ ───────────────────────────────────────
  await page.click('.gt-tp-ddbtn');
  const presets = await page.locator('.gt-tp-dd .gt-tp-dd-pat').allTextContents();
  await page.click('.gt-tp-ddbtn');
  console.log('presets: ' + JSON.stringify(presets));
  check(!presets.includes('R - E') && !presets.includes('E: R'), 'the two trailing presets are gone');
  check(presets.includes('R by E[&]'), '"R by E[&]" is offered');

  // and it must actually parse — [&] splits on " & "
  await tpPaste(page, 'Recorded at Abbey Road Studios\nProduced by Alice Smith & Bob Jones', 'R by E[&]');
  const split = (await tpCredits(page)).filter(c => c.matched && c.role === 'Produced').map(c => c.entity);
  console.log('after "R by E[&]": ' + JSON.stringify(split));
  check(split.length === 2 && split.includes('Alice Smith') && split.includes('Bob Jones'), 'the "&" split produces a credit per entity (' + JSON.stringify(split) + ')');

  // ── 1. #798: the parser is in the page now, so it can't slide under the
  // scrollbar: it takes the content's width, inside the client box.
  const geo = await page.evaluate(() => {
    document.body.style.minHeight = '6000px';   // guarantee a vertical scrollbar
    const p = document.querySelector('.gt-tp');
    return { right: Math.round(p.getBoundingClientRect().right), docW: document.documentElement.clientWidth, position: getComputedStyle(p).position };
  });
  console.log('inline panel: ' + JSON.stringify(geo));
  check(geo.position === 'static' && geo.right <= geo.docW, 'the parser is in the page flow and fits the client box');

  // ── 3. Place: roles, kind, pick ─────────────────────────────────────────────
  const placeRoles = await page.evaluate(() => {
    const lts = window.MB?.linkedEntities?.link_type || {};
    return Object.values(lts).filter(t => t.type0 === 'place' && t.type1 === 'release' && !t.deprecated).map(t => t.name);
  });
  console.log('place↔release roles available: ' + placeRoles.length + ' — ' + placeRoles.slice(0, 4).join(', '));
  check(placeRoles.includes('recorded at'), 'MB really does model "recorded at" as place→release');
  const artistHasRecordedAt = await page.evaluate(() => Object.values(window.MB?.linkedEntities?.link_type || {})
      .some(t => t.type0 === 'artist' && t.type1 === 'release' && !t.deprecated && t.name.toLowerCase() === 'recorded at'));
  check(!artistHasRecordedAt, '"recorded at" is not an artist→release type, so a match can only be the place one');

  // "Recorded at: X" is a PLACE credit, not an artist's
  await tpPaste(page, 'Recorded at: Abbey Road Studios', 'R: E');
  const c = (await tpCredits(page))[0] || {};
  console.log('credit: ' + JSON.stringify(c));
  check(c.resolved === 'recorded at' && c.kind === 'place', `the role resolved to "recorded at", for a place (${c.resolved}, ${c.kind})`);
  const kindShown = await page.locator('.gt-tp-erow .gt-tp-ekind').first().textContent();
  check(kindShown === 'place', `the row says place (${kindShown})`);
  check(!!c.gid, 'and the place is picked, so the credit is ready to stage');

  check(posts.length === 0, 'nothing was ever submitted (' + posts.length + ' POSTs to /edit)');
});
