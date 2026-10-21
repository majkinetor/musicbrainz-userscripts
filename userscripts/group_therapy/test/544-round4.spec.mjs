// #544 round 4 (majkinetor), four text-parser UX items:
//
//   1. right-clicking (+) marks the row "creating …", which resolves to the entity
//      when the background tab commits — so a run of names can be fired off
//      without babysitting tabs
//   2. a disambiguation in the candidates must not read as part of the name
//   3. the entity popup sat on the viewport edge, under the scrollbar (#798: no
//      popup any more; the search is in the row)
//   4. the role picker's ✕ was glued to the title instead of the top right
//
// Runs against test.musicbrainz.org and never submits: every POST to /edit is
// aborted and asserted zero. GM_openInTab is mocked, so item 1's "background
// tab" is simulated by posting the create's own token back over the same
// BroadcastChannel the real created page uses — no entity is created here.
// (598-two-background-creates proves the real round trip.)
import { test, check, requireLogin, SANDBOX, attachShot, settled, idle, frames } from '../../../dev/test/harness.mjs';
import { blockEdits, tpPaste, tpRow, tpCredits, tpSettle } from './gt.mjs';

test.use({ gm: { name: 'Group Therapy' } });

test('the text parser: background create marks the row, disambiguations, the picker close button', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }, testInfo) => {
  const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
  const NL = String.fromCharCode(10);

  await context.addInitScript(() => {
    window.GM_openInTab = (u, o) => { window.__gtOpened = { u, o }; window.__gtClosed = false; return { close() { window.__gtClosed = true; }, closed: false }; };
  });
  for (let a = 1; ; a++) {
    try { await page.goto(`${SANDBOX}/release/${RELEASE}/edit-relationships`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (a >= 4) throw e; console.log('goto retry ' + a); await page.waitForTimeout(5000); }
  }
  await requireLogin(page);
  await settled(page);
  const posts = await blockEdits(page);
  await inject('group_therapy');
  await idle(page);

  // ── 1. background create: the row says "creating …", then resolves ──────────
  // TWO lines share the same unresolvable name, to prove the resolution is bulk:
  // both credits must flip together.
  const NAME = 'Zzq Unresolvable Person Xyzzy';
  await tpPaste(page, `Producer: ${NAME}${NL}Mixer: ${NAME}${NL}Guitar: Someone Else Entirely`, 'R: E');
  const row = tpRow(page, NAME), other = tpRow(page, 'Someone Else Entirely');
  check(await row.locator('.gt-tp-plus').count() === 1, 'an unresolved name offers + to create it');
  await row.locator('.gt-tp-plus').dispatchEvent('contextmenu');
  await page.waitForFunction(() => window.__gtOpened, null, { timeout: 10000 });
  await frames(page);
  const after = await page.evaluate(() => ({
    opened: window.__gtOpened ? window.__gtOpened.u : null,
    active: window.__gtOpened ? window.__gtOpened.o.active : null,
    creating: [...document.querySelectorAll('.gt-tp-creating')].map(e => e.textContent.trim()),
    // one line or two, by HEIGHT vs line-height
    creatingLines: (() => {
      const e = document.querySelector('.gt-tp-creating');
      if (!e) return 0;
      const lh = parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.2;
      return Math.max(1, Math.round(e.getBoundingClientRect().height / lh));
    })(),
  }));
  console.log('after right-click +: ' + JSON.stringify(after));
  check(!!after.opened && after.active === false, 'right-click + opens the create tab in the background');
  check(after.creating.length === 1 && await row.locator('.gt-tp-creating').count() === 1, 'the name\'s row says "creating…" (' + after.creating.length + ')');
  check(/^creating\s*“Zzq/i.test(after.creating[0] || ''), 'the placeholder names what is being created — ' + JSON.stringify(after.creating[0] || ''));
  check(after.creatingLines === 1, 'and fits on one line (' + after.creatingLines + ')');
  check(await other.locator('.gt-tp-creating').count() === 0, 'the unrelated row is untouched');
  await attachShot(testInfo, page.locator('.gt-tp'), 'i544r4-creating');

  // meanwhile the parser must still be usable — that is the entire point
  await other.locator('.gt-tp-esrch-q').fill('Someone Else');
  await other.locator('.gt-tp-esrch-q').press('Enter');
  await tpSettle(page);
  check(await other.locator('.gt-tp-cand, .gt-tp-enone').count() > 0, 'another row can be searched while the create is in flight');

  // now let the "background tab" report the created MBID, exactly as the real
  // created page does: same channel, the token out of the create URL it opened.
  const GID = '82ca9599-5a15-4ff5-90d5-59ac8afaf5c7';
  const resolved = await page.evaluate(async ({ gid }) => {
    const u = new URL(window.__gtOpened.u, location.origin);
    const token = u.searchParams.get('x_gtcreate');
    const ch = new BroadcastChannel('gt-entity-created');
    ch.postMessage({ token, kind: 'artist', gid });
    for (let i = 0; i < 80 && document.querySelector('.gt-tp-creating'); i++) await new Promise(r => setTimeout(r, 100));
    return { token, stillCreating: document.querySelectorAll('.gt-tp-creating').length, tabClosed: window.__gtClosed === true };
  }, { gid: GID });
  const bound = (await tpCredits(page)).filter(c => c.entity === NAME);
  console.log('after the tab reports back: ' + JSON.stringify({ ...resolved, bound }));
  check(!!resolved.token, 'the create URL carried a token to answer on');
  check(resolved.stillCreating === 0, '#1: "creating…" clears once the entity lands');
  check(resolved.tabClosed, 'and the opener closes the background tab');
  check(bound.length === 2 && bound.every(c => c.gid === GID), 'BOTH credits with the name resolved to the new entity');

  // ── 2. disambiguation is styled apart from the name ─────────────────────────
  await tpPaste(page, `Producer: Fiona${NL}Guitar: Someone Else Entirely`, 'R: E');
  const fiona = tpRow(page, 'Fiona');
  if (!(await fiona.locator('.gt-tp-disamb').count())) {
    // picked already (one Fiona stands out): ✕ brings the candidates back
    if (await fiona.locator('.gt-tp-cand-x').count()) { await fiona.locator('.gt-tp-cand-x').click(); await tpSettle(page); }
  }
  const disamb = await fiona.evaluate(tr => {
    const rows = [...tr.querySelectorAll('.gt-tp-cand')];
    const withD = rows.find(r => r.querySelector('.gt-tp-disamb'));
    if (!withD) return { none: true, rows: rows.length };
    const n = withD.querySelector('.gt-tp-cand-name'), d = withD.querySelector('.gt-tp-disamb');
    const cs = e => { const s = getComputedStyle(e); return { size: s.fontSize, style: s.fontStyle, color: s.color, weight: s.fontWeight }; };
    return { none: false, rows: rows.length, name: n.textContent, disamb: d.textContent, nameCss: cs(n), disambCss: cs(d) };
  });
  console.log('disambiguation: ' + JSON.stringify(disamb));
  check(!disamb.none, 'at least one candidate carries a disambiguation (' + disamb.rows + ' candidates)');
  if (!disamb.none) {
    check(!/\(/.test(disamb.name), '#2: the name element holds ONLY the name — ' + JSON.stringify(disamb.name));
    check(disamb.disambCss.style === 'italic', 'the disambiguation is italic and the name is not (' + disamb.nameCss.style + ')');
    check(disamb.disambCss.color !== disamb.nameCss.color, 'and a different colour');
    check(parseFloat(disamb.disambCss.size) < parseFloat(disamb.nameCss.size), 'and smaller (' + disamb.disambCss.size + ' vs ' + disamb.nameCss.size + ')');
  }
  await attachShot(testInfo, fiona, 'i544r4-disamb');

  // ── 3. (#798) no popup to place: the search is the row's own ────────────────
  check(await page.locator('.gt-tp-apop').count() === 0, 'no entity popup at all');

  // ── 4. the role picker's ✕ sits top-right ───────────────────────────────────
  await fiona.locator('.gt-tp-role-pick').first().click();
  await page.waitForSelector('.gt-role-pick', { timeout: 8000 }).catch(() => {});
  const xGeo = await page.evaluate(() => {
    const hdr = document.querySelector('.gt-role-pick .gt-cons-hdr');
    if (!hdr) return { missing: true };
    const x = hdr.querySelector('.gt-cons-x'), title = hdr.querySelector('.gt-cons-title');
    if (!x || !title) return { missing: true, why: 'no ✕ or no titled span' };
    const h = hdr.getBoundingClientRect(), xr = x.getBoundingClientRect(), t = title.getBoundingClientRect();
    const rng = document.createRange(); rng.selectNodeContents(title);
    const textW = Math.round(rng.getBoundingClientRect().width);
    return { missing: false, gapToRight: Math.round(h.right - xr.right), titleBoxW: Math.round(t.width), titleTextW: textW, hdrW: Math.round(h.width) };
  });
  console.log('role picker ✕: ' + JSON.stringify(xGeo));
  check(!xGeo.missing, 'the role picker header has a titled span and a ✕');
  if (!xGeo.missing) {
    check(xGeo.gapToRight <= 20, '#4: the ✕ is pinned to the right edge of the header (' + xGeo.gapToRight + 'px from it)');
    check(xGeo.titleBoxW > xGeo.titleTextW + 40, 'so the ✕ is well clear of the title text (' + xGeo.titleTextW + 'px of text in a ' + xGeo.titleBoxW + 'px box)');
  }
  await attachShot(testInfo, page.locator('.gt-role-pick'), 'i544r4-rolex');

  check(posts.length === 0, 'nothing was submitted (' + posts.length + ' POSTs to /edit)');
});
