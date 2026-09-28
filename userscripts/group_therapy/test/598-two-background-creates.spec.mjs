// #598 (majkinetor): "When 2 background tabs are open creating artist, one of
// them doesn't close and consequently return MBID to Text Pattern."
//
// The cause was a single-slot store. Every background create wrote
//
//     GM_setValue('gt:pendingCreate', { kind, token, ts })
//
// so starting a second one OVERWROTE the first. Tab A's seeded /artist/create
// page then read back tokenB, concluded "this create page is not the one we
// opened", and never pressed Enter — leaving a tab parked on a filled-in form
// and a row spinning on "creating…" until the ten-minute timeout. Tab B, whose
// token happened to be the surviving one, worked perfectly, which is why this
// only ever showed up as "ONE of them doesn't finish".
//
// This is the test that has to fail on the old build, so it drives the real UI
// end to end: two rows, two right-clicks on +, two real tabs, two real artists
// on the sandbox, two MBIDs really posted back. GM_openInTab is mocked with
// window.open — the single API a userscript manager provides that a browser
// does not — and nothing else in the chain is faked.
//
//   pre-fix : 1 tab left open, 1 row unresolved   -> FAILS
//   post-fix: 0 tabs left open, 2 rows resolved   -> passes
//
// Sandbox only. It deliberately creates TWO artists on test.musicbrainz.org.
import { test, check, expect, requireLogin, SANDBOX, settled, frames, until, idle } from '../../../dev/test/harness.mjs';
import { RELEASE } from './gt.mjs';

// The pending-create store is shared by the opener and both create tabs. A create tab
// sometimes logs MusicBrainz's React hydration error #418: the script runs at
// DOMContentLoaded, as a manager's document-end does, and React recovers by rendering
// on the client. Not what this spec is about.
test.use({ gm: { name: 'Group Therapy', persist: 'tabs' }, pageErrors: ['Minified React error #418'] });

test('two background creates at once both submit, post their MBID back, and close', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }) => {
  const HOST = SANDBOX;
  const STAMP = Date.now().toString(36);
  const NAMES = ['GT Two A ' + STAMP, 'GT Two B ' + STAMP];

  const T0 = Date.now(); const ms = () => ('+' + String(Date.now() - T0).padStart(6) + 'ms');
  await context.addInitScript(() => {
    window.__gtClosed = 0;
    window.GM_openInTab = (url, opts) => {
      const w = window.open(url, '_blank');
      (window.__gtTabsOpened || (window.__gtTabsOpened = [])).push(url);
      return { close() { window.__gtClosed++; try { w && w.close(); } catch (e) {} }, get closed() { return !w || w.closed; } };
    };
  });
  // Per-document injection, exactly as live-544 does it: Group Therapy is an
  // @run-at document-end script and does not survive evaluation at
  // document-start, and the create tab navigates once (create -> entity) so both
  // documents need it.
  const injected = new WeakMap();
  const injectInto = async (p) => {
    const u = p.url();
    if (injected.get(p) === u) return;
    injected.set(p, u);
    try { await inject('group_therapy', { target: p }); } catch (e) { /* the tab moved on */ }
  };
  const reached = [];        // every /artist/<mbid> any background tab landed on
  context.on('page', async (p) => {
    const tag = '[tab' + (context.pages().length - 1) + ']';
    p.on('console', m => { const t = m.text(); if (/Group Therapy/.test(t)) console.log('   ' + ms() + ' ' + tag + ' ' + t.slice(0, 160)); });
    p.on('pageerror', e => console.log('   ' + tag + ' pageerror: ' + e.message.slice(0, 140)));
    const note = (u) => { if (/\/artist\/[0-9a-f-]{36}/.test(u) && !reached.includes(u)) reached.push(u); };
    p.on('domcontentloaded', () => { note(p.url()); injectInto(p); });
    p.on('framenavigated', f => { if (f === p.mainFrame()) note(f.url()); });
    try { await p.waitForLoadState('domcontentloaded', { timeout: 30000 }); note(p.url()); await injectInto(p); } catch (e) { /* closed already */ }
  });

  for (let a = 1; ; a++) {
    try { await page.goto(`${HOST}/release/${RELEASE}/edit-relationships`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (a >= 4) throw e; console.log('goto retry ' + a); await page.waitForTimeout(4000); }
  }
  await requireLogin(page);
  await settled(page);
  await injectInto(page);
  await idle(page);

  // Two lines -> two rows, each with an entity nothing can resolve.
  await page.evaluate(() => window.__groupTherapy.openTextParser());
  await page.waitForSelector('.gt-tp', { timeout: 15000 });
  await page.evaluate((ns) => {
    const set = (el, v) => { Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    set(document.querySelector('.gt-tp-ta'), 'Mastering: ' + ns[0] + '\nMixer: ' + ns[1]);
  }, NAMES);
  await frames(page);
  await page.evaluate(() => {
    const p = document.querySelector('.gt-tp-pat');
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(p), 'value').set.call(p, 'R: E');
    p.dispatchEvent(new Event('input', { bubbles: true }));
  });

  const rows = await until(() => page.evaluate(() => document.querySelectorAll('.gt-tp-tbl tbody tr').length), n => n >= 2);
  console.log('parsed rows: ' + rows);
  expect(rows, 'both pasted lines produced a row').toBeGreaterThanOrEqual(2);

  // Fire the create on a given row: open ITS entity picker (the entity cell's
  // search button is the last in the row; the first one opens the role picker,
  // which has no + at all) and right-click the +.
  // ⚠ No settling pause anywhere in here. The overlap IS the test: the second
  // create has to be started while the first tab is still sitting on its
  // /artist/create page, which is the only window in which the old single-slot
  // store could be overwritten under it. A first attempt at this test waited
  // 1.5s between the two and added a 1.2s settle inside the picker — by then tab
  // A had already pressed Enter, landed, posted back and closed, the two creates
  // never overlapped at all, and the whole thing passed against the BROKEN build.
  // The popover is built synchronously, so + exists the moment it is opened;
  // waiting for the entity search to come back is not needed and is exactly the
  // delay that hid the bug.
  const fire = async (idx) => {
    const opened = await page.evaluate((i) => {
      const row = document.querySelectorAll('.gt-tp-tbl tbody tr')[i];
      const btns = row ? [...row.querySelectorAll('.gt-tp-search')] : [];
      if (!btns.length) return false;
      btns[btns.length - 1].click();
      return true;
    }, idx);
    if (!opened) return false;
    await page.waitForSelector('.gt-tp-apop .gt-tp-plus', { timeout: 15000 }).catch(() => {});
    const ok = await page.evaluate(() => {
      const plus = document.querySelector('.gt-tp-plus');
      if (!plus) return false;
      plus.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      return true;
    });
    console.log(ms() + '  fired create on row ' + (idx + 1));
    return ok;
  };

  check(await fire(0), 'right-clicking + on row 1 starts a background create');
  check(await fire(1), 'and row 2 starts a second one while the first is still in its tab');

  const opened = await page.evaluate(() => (window.__gtTabsOpened || []).length);
  console.log('tabs opened: ' + opened);
  check(opened === 2, `two background tabs really opened (${opened})`);

  // Both tabs must submit themselves, land on their artist, and be closed by the
  // opener. Poll for the END state rather than for either tab individually — a
  // tab that works closes too fast to catch reliably.
  await until(() => reached.length >= 2 && context.pages().filter(p => p !== page).length === 0, Boolean, { timeout: 100000 });
  const left = context.pages().filter(p => p !== page);
  console.log('artist pages reached: ' + JSON.stringify(reached));
  console.log('background tabs still open: ' + left.length);
  for (const p of left) {
    try {
      console.log('   stuck tab: ' + JSON.stringify(await p.evaluate(() => ({
        path: location.pathname, token: new URLSearchParams(location.search).get('x_gtcreate'),
        pending: (() => { try { return JSON.parse(window.GM_getValue('gt:pendingCreate', '') || 'null'); } catch (e) { return 'THREW'; } })(),
        tabMark: (() => { try { return sessionStorage.getItem('gt:createTab'); } catch (e) { return 'THREW'; } })(),
        name: (document.querySelector('[name="edit-artist.name"]') || {}).value,
      }))));
    } catch (e) { console.log('   stuck tab: unreadable'); }
  }

  check(reached.length === 2, `BOTH creates submitted themselves through to a new artist (${reached.length} of 2)`);
  check(left.length === 0, `THE FIX: neither background tab is left open (${left.length} still open)`);
  const closedCalls = await page.evaluate(() => window.__gtClosed || 0);
  check(closedCalls === 2, `and both were closed through the GM_openInTab handle (${closedCalls} close calls)`);

  // And both rows really resolved — read the entity cell's link, which only
  // exists once a real MBID is bound. Asserting on row TEXT would pass on the
  // pasted line alone, since it already contains the name.
  // Wait for it: the post-back closes the tab FIRST and only then fetches the
  // new entity and binds the row, so "no tabs left" comes a moment before the
  // last row resolves. Reading at once failed a full run on row 2 alone.
  const readBound = () => page.evaluate(() => [...document.querySelectorAll('.gt-tp-tbl tbody tr')].slice(0, 2).map(row => {
    const a = [...row.querySelectorAll('a[href*="/artist/"]')].pop();
    return a ? { href: a.getAttribute('href'), text: a.textContent.trim() } : null;
  }));
  const bound = await until(readBound, b => b.every(Boolean), { timeout: 30000 });
  console.log('resolved cells: ' + JSON.stringify(bound, null, 1));
  check(bound.every(b => b && /\/artist\/[0-9a-f-]{36}/.test(b.href)), 'both rows are bound to a real MBID, not just showing the pasted text');
  check(bound[0] && bound[1] && bound[0].href !== bound[1].href, 'the two rows got DIFFERENT MBIDs — neither create overwrote the other');
  check(bound[0] && bound[0].text.includes(NAMES[0]), 'row 1 holds the artist row 1 asked for — ' + JSON.stringify(bound[0] && bound[0].text));
  check(bound[1] && bound[1].text.includes(NAMES[1]), 'row 2 holds the artist row 2 asked for — ' + JSON.stringify(bound[1] && bound[1].text));

  // …and MusicBrainz has it as seeded: the name, and type Person
  const gid = bound[0] && (bound[0].href.match(/\/artist\/([0-9a-f-]{36})/) || [])[1];
  // the API can lag the new artist, or turn a read away (503): ask until it answers
  const ws = gid && await until(() => page.evaluate(async g => { const r = await fetch(`/ws/2/artist/${g}?fmt=json`, { headers: { Accept: 'application/json' }, cache: 'no-store' }); return r.ok ? r.json() : null; }, gid), Boolean, { timeout: 30000, every: 1500 });
  check(ws && ws.name === NAMES[0] && ws.type === 'Person', `MusicBrainz has row 1's artist under the seeded name and type (${JSON.stringify(ws && { name: ws.name, type: ws.type })})`);

  // Nothing may be left behind: a pending record that outlives its create makes
  // the NEXT create's entity page match the wrong token.
  const leftover = await page.evaluate(() => { try { return JSON.parse(window.GM_getValue('gt:pendingCreate', '') || 'null'); } catch (e) { return 'THREW'; } });
  console.log('pending store afterwards: ' + JSON.stringify(leftover));
  check(!leftover || (Array.isArray(leftover) && leftover.length === 0), 'the pending-create store is empty again');
});
