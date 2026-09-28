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
// Order matters here: each step is checked against a freshly rendered table.
// An earlier draft measured the Pattern cell after opening and closing the role
// picker and read 0x0 — a detached element, which would have passed every
// "is it inside its column" check while proving nothing.
//
// Runs against test.musicbrainz.org and never submits: every POST to /edit is
// aborted and asserted zero.
import { test, check, requireLogin, SANDBOX, settled, idle, frames } from '../../../dev/test/harness.mjs';
import { blockEdits } from './gt.mjs';

test.use({ gm: { name: 'Group Therapy' } });

test('the text parser: seven UX fixes (background create, MBID paste, freeze, click-to-apply, keys)', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }) => {

  const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
  const NL = String.fromCharCode(10);

  await context.addInitScript(() => {
    // #544 follow-up: the background create goes through GM_openInTab — record
    // the call instead of really opening a tab.
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

  const openParser = async () => {
    if (await page.locator('.gt-tp').count()) return;   // already open
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /text parser/i.test(x.textContent || ''));
      if (b) b.click();
    });
    await page.waitForSelector('.gt-tp', { timeout: 15000 });
    await frames(page);
  };
  const setText = async (text, pat) => {
    await page.evaluate(({ text, pat }) => {
      const ta = document.querySelector('.gt-tp textarea');
      if (ta) { ta.value = text; ta.dispatchEvent(new Event('input', { bubbles: true })); }
      const p = document.querySelector('.gt-tp-pat');
      if (p) { p.value = pat; p.dispatchEvent(new Event('input', { bubbles: true })); }
    }, { text, pat });
    await frames(page);
  };
  // The row's two "search" buttons are, in column order, the RESOLVED ROLE cell
  // and then the RESOLVED ENTITY cell.
  const clickSearch = async (which) => page.evaluate((which) => {
    const row = document.querySelector('.gt-tp-tbl tbody tr');
    const btns = [...row.querySelectorAll('button.gt-tp-search')];
    const b = which === 'role' ? btns[0] : btns[btns.length - 1];
    if (!b) return false;
    b.click();
    return true;
  }, which);

  await openParser();
  await setText(`Producer: もちこまめ${NL}Guitar: Someone Unresolvable Xyzzy`, 'R: E');

  // ── 2/5/6. the entity picker ────────────────────────────────────────────────
  await setText(`Producer: もちこまめ${NL}Guitar: Someone Unresolvable Xyzzy`, 'R: E');
  check(await clickSearch('entity'), 'an unresolved row offers an entity search button');
  await page.waitForSelector('.gt-tp-apop', { timeout: 8000 }).catch(() => {});
  const pickerOpen = await page.locator('.gt-tp-apop').count() > 0;
  check(pickerOpen, 'the entity picker opens (otherwise the checks below prove nothing)');
  if (pickerOpen) {
    const hint = ((await page.locator('.gt-tp-hint').textContent()) || '').trim();
    console.log('picker hint: ' + JSON.stringify(hint));
    check(/^click: every row/i.test(hint), '#5: a plain click now applies to every row with this text');
    check(/right-click: this row only/i.test(hint), 'and right-click is the single-row case');

    const plusTitle = await page.evaluate(() => (document.querySelector('.gt-tp-plus') || {}).title || '');
    console.log('plus title: ' + JSON.stringify(plusTitle));
    check(/right-click to create in the background/i.test(plusTitle), '#1: the + button advertises background creation');

    // #2: paste an MBID → resolved and applied, no result row to click
    const pasted = await page.evaluate(async (gid) => {
      const q = document.querySelector('.gt-tp-q');
      q.value = gid;
      q.dispatchEvent(new Event('input', { bubbles: true }));
      for (let i = 0; i < 60 && document.querySelector('.gt-tp-apop'); i++) await new Promise(r => setTimeout(r, 100));
      const row = document.querySelector('.gt-tp-tbl tbody tr');   // the row the picker was opened from
      return { stillOpen: !!document.querySelector('.gt-tp-apop'), rowText: (row ? row.innerText : '').replace(/\s+/g, ' ').trim() };
    }, '82ca9599-5a15-4ff5-90d5-59ac8afaf5c7');
    console.log('after pasting an MBID: ' + JSON.stringify(pasted));
    check(!pasted.stillOpen, '#2: pasting an MBID resolves it immediately — the picker closes itself');
    check(/もちこまめ/.test(pasted.rowText), 'and the row now carries that entity — ' + JSON.stringify(pasted.rowText.slice(0, 60)));
  }

  // ── 7. role picker: Up/Down ─────────────────────────────────────────────────
  // (No Escape here: it closes the parser window itself, not just the popover.)
  await frames(page);
  await openParser();
  await setText(`Producer: もちこまめ${NL}Guitar: Someone Unresolvable Xyzzy`, 'R: E');
  check(await clickSearch('role'), 'an unresolved row offers a role search button');
  await page.waitForSelector('.gt-role-pick', { timeout: 8000 }).catch(() => {});
  check(await page.locator('.gt-role-pick').count() > 0, 'the role picker opens');
  const keyNav = await page.evaluate(async () => {
    const search = document.querySelector('.gt-role-search');
    // it opens prefilled with the row's role text, which filters to one match —
    // with a single row the arrows legitimately do nothing, so clear it first.
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));   // re-filtered as it is handled
    await new Promise(r => requestAnimationFrame(r));
    const idx = () => [...document.querySelectorAll('.gt-role-row')].findIndex(r => r.classList.contains('gt-role-active'));
    const press = k => { search.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); return new Promise(r => requestAnimationFrame(r)); };
    const start = idx();
    await press('ArrowDown'); const d1 = idx();
    await press('ArrowDown'); const d2 = idx();
    await press('ArrowUp'); const u1 = idx();
    await press('End'); const end = idx();
    await press('ArrowDown'); const wrapped = idx();   // past the end → back to the top
    return { start, d1, d2, u1, end, wrapped, total: document.querySelectorAll('.gt-role-row').length,
             activeName: (document.querySelector('.gt-role-row.gt-role-active .gt-role-name') || {}).textContent };
  });
  console.log('role picker keys: ' + JSON.stringify(keyNav));
  check(keyNav.total > 5, `the unfiltered list is long enough to navigate (${keyNav.total} roles)`);
  check(keyNav.start === 0, 'the first role starts highlighted');
  check(keyNav.d1 === 1 && keyNav.d2 === 2, '#7: ArrowDown walks the list');
  check(keyNav.u1 === 1, 'ArrowUp walks back');
  check(keyNav.end === keyNav.total - 1, 'End jumps to the last role');
  check(keyNav.wrapped === 0, 'and it wraps rather than sticking at the end');
  await page.evaluate(() => { const b = document.querySelector('.gt-role-pick .gt-cons-x'); if (b) b.click(); });
  await frames(page);

  // ── 4. Freeze matched ───────────────────────────────────────────────────────
  await setText(`Producer: もちこまめ${NL}Mixer: もちこまめ${NL}nonsense line with no pattern at all`, 'R: E');
  const froze = await page.evaluate(async () => {
    // it is icon-only now (#544 follow-up: "next to the pattern input … like
    // Apollo"), so match the class, not the label text.
    const btn = document.querySelector('.gt-tp-freeze');
    if (!btn) return { missing: true };
    const eventually = async f => { for (let i = 0; i < 400 && !f(); i++) await new Promise(r => setTimeout(r, 25)); return f(); };
    btn.click();
    await eventually(() => [...document.querySelectorAll('.gt-tp-ov')].some(i => i.value));
    return { missing: false, overrides: [...document.querySelectorAll('.gt-tp-ov')].map(i => i.value) };
  });
  console.log('after freeze: ' + JSON.stringify(froze));
  check(!froze.missing, '#4: the parser offers a Freeze matched button');
  check(!froze.missing && froze.overrides.filter(v => v === 'R: E').length === 2, 'the two matching lines are pinned to the current pattern');
  check(!froze.missing && froze.overrides.some(v => !v), 'and the line that did not match is left alone');

  // ── 6. the created entity's edit note ───────────────────────────────────────
  const note = await page.evaluate(() => window.__groupTherapy.txpCreateNote('artist'));
  console.log('create note: ' + JSON.stringify(note));
  check(/Group Therapy/.test(note), '#6: a created entity carries the script signature');
  check(/Created this artist/.test(note), 'says what it was doing');
  check(/musicbrainz\.org\/release\//.test(note) && !/edit-relationships/.test(note),
    'and names the release being edited, without the /edit-relationships suffix');

  // ── 3. the Pattern cell keeps its caret inside a narrow column ──────────────
  // Last, because typing into an override re-renders the table and that override
  // then survives into whatever runs next.
  // ⚠ Dispatching 'input' rebuilds the table, so the element measured must be
  // re-queried afterwards — measuring the one captured before the rebuild gives
  // 0x0 (a detached node), which silently satisfies "is it inside its column".
  await setText(`Producer: もちこまめ${NL}Guitar: Someone Unresolvable Xyzzy`, 'R: E');
  const cellGeo = await page.evaluate(async () => {
    let ov = document.querySelector('.gt-tp-ov');
    if (!ov) return { missing: true };
    ov.value = 'R[,] - E[,] a very long pattern';
    ov.dispatchEvent(new Event('input', { bubbles: true }));      // rebuilds the table, as it is handled
    await new Promise(r => requestAnimationFrame(r));
    ov = document.querySelector('.gt-tp-ov');                      // the NEW input
    if (!ov) return { missing: true, why: 'gone after re-render' };
    const td = ov.closest('td');
    // Narrow the PATTERN column the way dragging its header does — the table is
    // table-layout:fixed with a <colgroup>, so a td's own style.width is ignored
    // (an earlier version set it and measured a 120px cell, never exercising the
    // narrow case at all). Column 1 is "pattern".
    const col = document.querySelector('.gt-tp-tbl colgroup').children[1];
    col.style.width = '60px';
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));   // laid out
    ov.focus();
    const o = ov.getBoundingClientRect(), t = td.getBoundingClientRect();
    return {
      inputRight: Math.round(o.right), cellRight: Math.round(t.right),
      inputW: Math.round(o.width), cellW: Math.round(t.width),
      value: ov.value, scrolls: ov.scrollWidth > ov.clientWidth,
    };
  });
  console.log('pattern cell: ' + JSON.stringify(cellGeo));
  check(!cellGeo.missing && cellGeo.cellW > 0 && cellGeo.inputW > 0,
    'the pattern cell is laid out (a detached 0x0 element would satisfy every geometry check below)');
  check(!cellGeo.missing && cellGeo.cellW < 110,
    `the column really is narrower than the old fixed 110px input (${cellGeo.cellW}px) — otherwise this proves nothing`);
  check(!cellGeo.missing && cellGeo.value === 'R[,] - E[,] a very long pattern', 'and the long pattern really is in it');
  check(!cellGeo.missing && cellGeo.inputRight <= cellGeo.cellRight + 1, '#3: the input stays inside its column, however narrow');
  check(!cellGeo.missing && cellGeo.scrolls, 'and scrolls its own text, so the caret stays visible while typing');


  // ── #544 follow-up 1: Freeze belongs beside the pattern box, in the header ──
  await openParser();
  await setText(`Producer: Karlis Spade (Greenprint)${NL}Mixer: Someone Else Xyzzy`, 'R: E');
  // the pattern-cell step above left a per-line override behind, and a line
  // pinned to a non-matching pattern has no resolved cells to click below.
  await page.evaluate(() => {
    document.querySelectorAll('.gt-tp-ov').forEach(i => { if (i.value) { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); } });
  });
  await frames(page);
  const freezeGeo = await page.evaluate(() => {
    const f = document.querySelector('.gt-tp-freeze'), pat = document.querySelector('.gt-tp-pat'), res = document.querySelector('.gt-tp-resolve');
    if (!f || !pat) return { missing: true };
    const r = e => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), left: Math.round(b.left) }; };
    return {
      inHeader: !!f.closest('.gt-tp-ctrl'),
      sameRowAsPattern: Math.abs(r(f).top - r(pat).top) < 12,
      afterPattern: r(f).left > r(pat).left,
      matchStillSameRow: res ? Math.abs(r(f).top - r(res).top) < 12 : null,
      ctrlHeight: Math.round(document.querySelector('.gt-tp-ctrl').getBoundingClientRect().height),
      inFooter: !!document.querySelector('.gt-cons-foot .gt-tp-freeze'),
    };
  });
  console.log('freeze button: ' + JSON.stringify(freezeGeo));
  check(!freezeGeo.missing && freezeGeo.inHeader && !freezeGeo.inFooter, 'Freeze sits in the header, not the footer');
  check(freezeGeo.sameRowAsPattern && freezeGeo.afterPattern, 'right next to the pattern box');
  check(freezeGeo.matchStillSameRow, 'and Match is still on that same row — the bar did not gain a second one');

  // ── #544 follow-up 3: the role picker was 920px wide and cut descriptions ───
  await page.evaluate(() => document.querySelector('.gt-tp-tbl tbody tr').querySelectorAll('button.gt-tp-search')[0].click());
  await page.waitForSelector('.gt-role-pick', { timeout: 8000 });
  await page.evaluate(() => { const q = document.querySelector('.gt-role-search'); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); });
  await frames(page);
  const pickGeo = await page.evaluate(() => {
    const p = document.querySelector('.gt-role-pick'), b = p.getBoundingClientRect();
    const d = [...document.querySelectorAll('.gt-role-desc')].find(x => x.textContent.length > 60);
    const cs = d ? getComputedStyle(d) : null;
    return {
      w: Math.round(b.width), h: Math.round(b.height), vw: window.innerWidth,
      sampleLen: d ? d.textContent.length : 0,
      truncatedWithEllipsis: cs ? cs.textOverflow === 'ellipsis' && cs.whiteSpace === 'nowrap' : null,
      fullyVisible: d ? d.scrollHeight <= d.clientHeight + 2 : null,
    };
  });
  console.log('role picker: ' + JSON.stringify(pickGeo));
  check(pickGeo.w <= 560, `the picker is its own size again, not .gt-cons's 920px (${pickGeo.w}px)`);
  check(pickGeo.w < pickGeo.vw * 0.6, 'and nowhere near full width on a wide screen');
  check(pickGeo.sampleLen > 60, 'a long description is present to check (otherwise the next check is vacuous)');
  check(!pickGeo.truncatedWithEllipsis, 'descriptions are no longer one nowrap ellipsised line');
  check(pickGeo.fullyVisible, 'and the sampled description fits within its two clamped lines');
  await page.evaluate(() => { const x = document.querySelector('.gt-role-pick .gt-cons-x'); if (x) x.click(); });
  await frames(page);

  // ── #544 follow-up 2: (+) seeds the SEARCH TEXT, and right-click backgrounds ─
  await page.evaluate(() => {
    const row = document.querySelector('.gt-tp-tbl tbody tr');
    const btns = row.querySelectorAll('button.gt-tp-search');
    btns[btns.length - 1].click();
  });
  await page.waitForSelector('.gt-tp-apop', { timeout: 8000 });
  const prefill = await page.evaluate(() => document.querySelector('.gt-tp-q').value);
  console.log('search box prefill: ' + JSON.stringify(prefill));
  check(/Greenprint/.test(prefill), 'the picker opens prefilled with the parsed text');
  const bg = await page.evaluate(() => {
    const q = document.querySelector('.gt-tp-q');
    q.value = 'Karlis Spade';                                   // the user trims the suffix
    document.querySelector('.gt-tp-plus').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    const o = window.__gtOpened;
    return o ? { active: o.o && o.o.active, url: decodeURIComponent(o.u) } : null;
  });
  console.log('right-click + → ' + JSON.stringify(bg && { active: bg.active, url: bg.url.slice(0, 90) }));
  check(!!bg, 'right-clicking + goes through GM_openInTab');
  check(bg && bg.active === false, 'with active:false — a real background tab, not a focused one');
  // decodeURIComponent leaves the form-encoded '+' alone, so match either form
  check(bg && /edit-artist\.name=Karlis[+ ]Spade(&|$)/.test(bg.url), 'seeded with the EDITED search text, not the raw parsed name — ' + JSON.stringify((bg.url.match(/edit-artist\.name=[^&]*/) || [])[0]));
  check(bg && !/Greenprint/.test(bg.url), 'so the discarded "(Greenprint)" suffix is gone');
  check(bg && /edit-artist\.edit_note=/.test(bg.url), 'and it still carries the edit note');

  check(posts.length === 0, `nothing was submitted (${posts.length} POSTs to /edit)`);
});
