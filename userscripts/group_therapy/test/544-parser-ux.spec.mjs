// #544 (majkinetor), seven text-parser UX items:
//
//   1. right-click (+) creates the entity in the background
//   2. a pasted MBID resolves at once instead of showing one clickable result
//   3. the Pattern cell clipped its own caret once the column was narrower than
//      the input's fixed 110px
//   4. a [freeze pattern] option, as Apollo has
//   5. left click applies to every matching row (it was right click)
//   6. creating an entity seeds no edit note (CH/Apollo both do)
//   7. Up/Down do not work in the role picker
//
// #798: the parser is in the page, a row per name, with the search in the row;
// what each item asked for is checked in that layout.
//
// Runs against test.musicbrainz.org and never submits: every POST to /edit is
// aborted and asserted zero.
import { test, check, requireLogin, SANDBOX, settled, idle, frames } from '../../../dev/test/harness.mjs';
import { blockEdits, tpPaste, tpRow, tpCredits, tpSettle } from './gt.mjs';

test.use({ gm: { name: 'Group Therapy' } });

test('the text parser: seven UX fixes (background create, MBID paste, freeze, click-to-apply, keys)', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }) => {

  const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
  const NL = String.fromCharCode(10);
  const GID = '82ca9599-5a15-4ff5-90d5-59ac8afaf5c7';   // もちこまめ

  await context.addInitScript(() => {
    // the background create goes through GM_openInTab — record the call instead
    window.GM_openInTab = (u, o) => { window.__gtOpened = { u, o }; return { close() {}, closed: false }; };
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

  // ── 1/2/5. the row's entity side ────────────────────────────────────────────
  const U = 'Someone Unresolvable Xyzzy';
  await tpPaste(page, `Producer: もちこまめ${NL}Guitar: ${U}${NL}Mixer: ${U}`, 'R: E');
  const urow = tpRow(page, U);
  const plusTip = await urow.locator('.gt-tp-plus').getAttribute('data-tip');
  console.log('plus tip: ' + JSON.stringify(plusTip));
  check(/Right-click: in the background/i.test(plusTip || ''), '#1: + advertises background creation');
  const pickTip = await page.locator('.gt-tp-cand-pick').first().getAttribute('data-tip').catch(() => '');
  console.log('✓ tip: ' + JSON.stringify(pickTip));
  check(/every credit with this name/i.test(pickTip || '') && /Right-click: for one credit only/i.test(pickTip || ''), '#5: a click picks for every credit with the name, right-click for one');

  // #2: an MBID pasted into the row's search is taken at once, for every credit with the name
  await urow.locator('.gt-tp-esrch-q').fill(GID);
  await urow.locator('.gt-tp-esrch-q').press('Enter');
  await page.waitForFunction(([n, g]) => window.__groupTherapy.txpCredits().filter(c => c.entity === n).every(c => c.gid === g), [U, GID], { timeout: 30000 }).catch(() => {});
  const pasted = (await tpCredits(page)).filter(c => c.entity === U);
  console.log('after pasting an MBID: ' + JSON.stringify(pasted.map(c => c.name)));
  check(pasted.length === 2 && pasted.every(c => c.gid === GID), '#2: pasting an MBID picks it at once, for both credits with the name');
  check(await urow.locator('.gt-tp-cand-on').count() === 1, 'and the row shows it as the pick');

  // ── 7. role picker: Up/Down ─────────────────────────────────────────────────
  await tpRow(page, 'もちこまめ').locator('.gt-tp-role-pick').first().click();
  await page.waitForSelector('.gt-role-pick', { timeout: 8000 }).catch(() => {});
  check(await page.locator('.gt-role-pick').count() > 0, 'the role picker opens');
  const keyNav = await page.evaluate(async () => {
    const search = document.querySelector('.gt-role-search');
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => requestAnimationFrame(r));
    const idx = () => [...document.querySelectorAll('.gt-role-row')].findIndex(r => r.classList.contains('gt-role-active'));
    const press = k => { search.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); return new Promise(r => requestAnimationFrame(r)); };
    const start = idx();
    await press('ArrowDown'); const d1 = idx();
    await press('ArrowDown'); const d2 = idx();
    await press('ArrowUp'); const u1 = idx();
    await press('End'); const end = idx();
    await press('ArrowDown'); const wrapped = idx();
    return { start, d1, d2, u1, end, wrapped, total: document.querySelectorAll('.gt-role-row').length };
  });
  console.log('role picker keys: ' + JSON.stringify(keyNav));
  check(keyNav.total > 5, `the unfiltered list is long enough to navigate (${keyNav.total} roles)`);
  check(keyNav.start === 0, 'the first role starts highlighted');
  check(keyNav.d1 === 1 && keyNav.d2 === 2, '#7: ArrowDown walks the list');
  check(keyNav.u1 === 1, 'ArrowUp walks back');
  check(keyNav.end === keyNav.total - 1, 'End jumps to the last role');
  check(keyNav.wrapped === 0, 'and it wraps rather than sticking at the end');

  // ── #544 follow-up 3: the role picker was 920px wide and cut descriptions ───
  const pickGeo = await page.evaluate(() => {
    const p = document.querySelector('.gt-role-pick'), b = p.getBoundingClientRect();
    const d = [...document.querySelectorAll(".gt-role-desc")].find(x => x.textContent.length > 60 && x.textContent.length < 140);
    const cs = d ? getComputedStyle(d) : null;
    return {
      w: Math.round(b.width), vw: window.innerWidth, sampleLen: d ? d.textContent.length : 0,
      truncatedWithEllipsis: cs ? cs.textOverflow === 'ellipsis' && cs.whiteSpace === 'nowrap' : null,
      fullyVisible: d ? d.scrollHeight <= d.clientHeight + 2 : null,
    };
  });
  console.log('role picker: ' + JSON.stringify(pickGeo));
  check(pickGeo.w <= 560, `the picker is its own size, not .gt-cons's 920px (${pickGeo.w}px)`);
  check(pickGeo.w < pickGeo.vw * 0.6, 'and nowhere near full width on a wide screen');
  check(pickGeo.sampleLen > 60, 'a long description is present to check (otherwise the next check is vacuous)');
  check(!pickGeo.truncatedWithEllipsis, 'descriptions are not one nowrap ellipsised line');
  check(pickGeo.fullyVisible, 'and the sampled description fits within its two clamped lines');
  await page.evaluate(() => { const b = document.querySelector('.gt-role-pick .gt-cons-x'); if (b) b.click(); });
  await frames(page);

  // ── 4. Freeze matched ───────────────────────────────────────────────────────
  await tpPaste(page, `Producer: もちこまめ${NL}Mixer: もちこまめ${NL}nonsense line with no pattern at all`, 'R: E');
  const lineOv = () => page.evaluate(() => [...new Map([...document.querySelectorAll('.gt-tp-line')].map(l => [+l.querySelector('.gt-tp-line-no').textContent, l.querySelector('.gt-tp-ov').value])).entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]));
  check(await page.locator('.gt-tp-freeze').count() === 1, '#4: the parser offers Freeze');
  await page.click('.gt-tp-freeze');
  await frames(page);
  const froze = await lineOv();
  console.log('after freeze: ' + JSON.stringify(froze));
  check(froze.filter(v => v === 'R: E').length === 2, 'the two matching lines are pinned to the current pattern');
  check(froze.some(v => !v), 'and the line that did not match is left alone');

  // ── #544 follow-up 1: Freeze beside the pattern box ─────────────────────────
  const freezeGeo = await page.evaluate(() => {
    const f = document.querySelector('.gt-tp-freeze'), pat = document.querySelector('.gt-tp-pat');
    const r = e => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), left: Math.round(b.left) }; };
    return { inCtrl: !!f.closest('.gt-tp-ctrl'), sameRow: Math.abs(r(f).top - r(pat).top) < 12, after: r(f).left > r(pat).left };
  });
  console.log('freeze button: ' + JSON.stringify(freezeGeo));
  check(freezeGeo.inCtrl && freezeGeo.sameRow && freezeGeo.after, 'Freeze sits right after the pattern box, on its row');

  // ── 6. the created entity's edit note ───────────────────────────────────────
  const note = await page.evaluate(() => window.__groupTherapy.txpCreateNote('artist'));
  console.log('create note: ' + JSON.stringify(note));
  check(/Group Therapy/.test(note), '#6: a created entity carries the script signature');
  check(/Created this artist/.test(note), 'says what it was doing');
  check(/musicbrainz\.org\/release\//.test(note) && !/edit-relationships/.test(note),
    'and names the release being edited, without the /edit-relationships suffix');

  // ── 3. a line's pattern box keeps its caret inside a narrow column ──────────
  await tpPaste(page, `Producer: もちこまめ${NL}Guitar: ${U}`, 'R: E');
  await page.evaluate(() => { const c = document.querySelector('.gt-tp-etbl col, .gt-tp-etbl th'); if (c) c.style.width = '300px'; });
  await frames(page);
  const ov = page.locator('.gt-tp-line .gt-tp-ov').first();
  await ov.fill('R[,] - E[,] a very long pattern');
  await frames(page);
  const cellGeo = await page.evaluate(() => {
    const ov = document.querySelector('.gt-tp-line .gt-tp-ov');
    const line = ov.closest('.gt-tp-line'), td = ov.closest('td');
    ov.focus();
    const o = ov.getBoundingClientRect(), l = line.getBoundingClientRect(), t = td.getBoundingClientRect();
    return { inputRight: Math.round(o.right), lineRight: Math.round(l.right), cellRight: Math.round(t.right), cellW: Math.round(t.width), inputW: Math.round(o.width), value: ov.value, scrolls: ov.scrollWidth > ov.clientWidth };
  });
  console.log('pattern box: ' + JSON.stringify(cellGeo));
  check(cellGeo.cellW > 0 && cellGeo.inputW > 0, 'the pattern box is laid out');
  check(cellGeo.value === 'R[,] - E[,] a very long pattern', 'and the long pattern really is in it');
  check(cellGeo.inputRight <= cellGeo.cellRight + 1, '#3: the box stays inside its column');
  check(cellGeo.scrolls, 'and scrolls its own text, so the caret stays visible while typing');
  await ov.fill('');
  await tpSettle(page);

  // ── #544 follow-up 2: + creates what the search box says; right-click backgrounds
  await tpPaste(page, `Producer: Karlis Spade (Greenprint)${NL}Mixer: Someone Else Xyzzy`, 'R: E');
  const krow = tpRow(page, 'Karlis Spade (Greenprint)');
  const prefill = await krow.locator('.gt-tp-esrch-q').inputValue();
  console.log('search box prefill: ' + JSON.stringify(prefill));
  check(/Greenprint/.test(prefill), 'the row\'s search starts with the parsed text');
  await krow.locator('.gt-tp-esrch-q').fill('Karlis Spade');   // the user trims the suffix
  await krow.locator('.gt-tp-esrch-q').press('Enter');
  await tpSettle(page);
  await krow.locator('.gt-tp-plus').dispatchEvent('contextmenu');
  const bg = await page.evaluate(() => { const o = window.__gtOpened; return o ? { active: o.o && o.o.active, url: decodeURIComponent(o.u) } : null; });
  console.log('right-click + → ' + JSON.stringify(bg && { active: bg.active, url: bg.url.slice(0, 90) }));
  check(!!bg, 'right-clicking + goes through GM_openInTab');
  check(bg && bg.active === false, 'with active:false — a real background tab, not a focused one');
  check(bg && /edit-artist\.name=Karlis[+ ]Spade(&|$)/.test(bg.url), 'seeded with the EDITED search text, not the raw parsed name — ' + JSON.stringify(bg && (bg.url.match(/edit-artist\.name=[^&]*/) || [])[0]));
  check(bg && !/Greenprint/.test(bg.url), 'so the discarded "(Greenprint)" suffix is gone');
  check(bg && /edit-artist\.edit_note=/.test(bg.url), 'and it still carries the edit note');

  check(posts.length === 0, `nothing was submitted (${posts.length} POSTs to /edit)`);
});
