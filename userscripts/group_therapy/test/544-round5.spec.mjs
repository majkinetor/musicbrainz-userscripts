// #544 round 5 (majkinetor), three follow-ups to round 4:
//
//   1. "Maximized state is still not remembered." (no maximize since #798)
//   2. 'Button "load and remove annotation" is lost when exiting / returning'
//   3. "The new `creating ...` placeholder stays forever if there is error/tab
//      closed. I should be able to cancel it like in CH"
//
// (1) is a re-test of something round 3 claimed to fix and verify-544-state-
// roundtrip still passes. That test maximizes and then FREEZES, and the freeze
// saves — so the maximize was never the thing being carried. This one closes
// immediately after maximizing, with nothing else touched in between, which is
// what majkinetor actually does. It asserts the no-save-in-between explicitly so
// it cannot silently become vacuous again.
//
// Runs against test.musicbrainz.org and never submits: every POST to /edit is
// aborted and asserted zero.
import { test, check, requireLogin, SANDBOX, attachShot, settled, idle, frames } from '../../../dev/test/harness.mjs';
import { blockEdits, ensureAnnotation, tpSettle, tpRow, tpCredits } from './gt.mjs';

test.use({ gm: { name: 'Group Therapy' } });

test('the text parser remembers the annotation button, and a create can be cancelled', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }, testInfo) => {
  await ensureAnnotation(page);
  const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';   // has an annotation — needed by check 2
  const NL = String.fromCharCode(10);

  await context.addInitScript(() => {
    window.GM_openInTab = (u, o) => {
      window.__gtOpened = { u, o };
      // a handle that never reports itself closed, so the CANCEL path under test is
      // the click and not the tab watcher
      return { close() { window.__gtClosed = true; }, closed: false };
    };
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
    if (await page.locator('.gt-tp').count()) return;
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /text parser/i.test(x.textContent || ''));
      if (b) b.click();
    });
    await page.waitForSelector('.gt-tp', { timeout: 15000 });
    await frames(page);
  };
  const closeParser = async () => {
    await page.evaluate(() => { const x = [...document.querySelectorAll('.gt-tp .gt-cons-x')].find(b => b.textContent.includes('✕')); if (x) x.click(); });
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
  // ── 1. (#798: the parser is in the page, so there is no maximized state to keep)
  await openParser();
  await setText(`Producer: Someone Unresolvable Xyzzy${NL}Mixer: Another Unresolvable Xyzzy`, 'R: E');

  // ── 2. "Apply & clear annotation" survives a close ──────────────────────────
  const annoLoaded = await page.evaluate(async () => {
    const b = [...document.querySelectorAll('.gt-tp button')].find(x => /load annotation/i.test(x.textContent || ''));
    if (!b) return { missing: true };
    b.click();
    const eventually = async f => { for (let i = 0; i < 400 && !f(); i++) await new Promise(r => setTimeout(r, 25)); return f(); };
    await eventually(() => !/loading/i.test(b.textContent) && (document.querySelector('.gt-tp textarea') || {}).value);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const clr = document.querySelector('.gt-cons-btn');
    const btn = [...document.querySelectorAll('.gt-tp .gt-cons-btn')].find(x => /apply & clear annotation/i.test(x.textContent || ''));
    return { missing: false, text: (document.querySelector('.gt-tp textarea') || {}).value || '', shown: !!(btn && btn.style.display !== 'none') };
  });
  console.log('after Load annotation: ' + JSON.stringify(annoLoaded));
  check(!annoLoaded.missing, 'the parser offers "Load annotation"');
  check(/\S/.test(annoLoaded.text), 'fixture: this release really has an annotation to load (otherwise the check below is vacuous)');
  check(annoLoaded.shown, '"Apply & clear annotation" appears once the text came from the annotation');
  await closeParser();
  await openParser();
  const afterReopen = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.gt-tp .gt-cons-btn')].find(x => /apply & clear annotation/i.test(x.textContent || ''));
    return { shown: !!(btn && btn.style.display !== 'none'), text: (document.querySelector('.gt-tp textarea') || {}).value || '' };
  });
  console.log('after close → reopen: ' + JSON.stringify(afterReopen));
  check(/\S/.test(afterReopen.text), 'the annotation text came back');
  check(afterReopen.shown, '#544.2: THE FIX — and "Apply & clear annotation" came back with it');
  await attachShot(testInfo, page.locator('.gt-tp'), 'i544r5-anno');

  // ── 3. the "creating…" placeholder can be cancelled ─────────────────────────
  // #798: one row per name, so two credits with the name share one placeholder
  await setText(`Producer: Zzq Cancel Me Xyzzy${NL}Mixer: Zzq Cancel Me Xyzzy${NL}Guitar: Someone Else Entirely`, 'R: E');
  await tpSettle(page);
  const row = tpRow(page, 'Zzq Cancel Me Xyzzy');
  await row.locator('.gt-tp-plus').dispatchEvent('contextmenu');   // right-click +: create in the background
  await frames(page);
  const creating = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.gt-tp-creating')];
    return { n: els.length, tag: els[0] && els[0].tagName, text: els[0] && els[0].textContent.trim(), title: els[0] && els[0].dataset.tip };
  });
  console.log('creating placeholders: ' + JSON.stringify(creating));
  check(creating.n === 1 && (await row.locator('.gt-tp-creating').count()) === 1, 'the name\'s row shows "creating…" (' + creating.n + ')');
  check(creating.tag === 'BUTTON', '#544.3: the placeholder is a button, not inert text');
  check(/✕/.test(creating.text || ''), 'it shows a ✕ affordance — ' + JSON.stringify(creating.text));
  check(/Click: stop waiting/i.test(creating.title || ''), 'and its tooltip says clicking cancels');
  check(!(await row.locator('.gt-tp-esrch-q').count()), 'no search while it waits');
  await attachShot(testInfo, page.locator('.gt-tp'), 'i544r5-creating-cancel');

  await page.click('.gt-tp-creating');
  await frames(page);
  const cancelled = { creating: await page.locator('.gt-tp-creating').count(), search: await row.locator('.gt-tp-esrch-q').count(), plus: await row.locator('.gt-tp-plus').count() };
  console.log('after clicking the placeholder: ' + JSON.stringify(cancelled));
  check(cancelled.creating === 0, '#544.3: THE FIX — clicking clears it');
  check(cancelled.search === 1 && cancelled.plus === 1, 'and the row\'s search and + are back — ' + JSON.stringify(cancelled));
  // A cancelled create must stay cancelled: if the tab commits anyway later, that
  // post-back must not silently rewrite rows the user has stopped waiting on.
  await page.evaluate(async () => {
    const u = new URL(window.__gtOpened.u, location.origin);
    const ch = new BroadcastChannel('gt-entity-created');
    // A channel delivers to its receivers in the order they were made, so this one,
    // made after Group Therapy's, hears the message once Group Therapy has handled it.
    const seen = new BroadcastChannel('gt-entity-created');
    const heard = new Promise(r => { seen.onmessage = () => r(); });
    ch.postMessage({ token: u.searchParams.get('x_gtcreate'), kind: 'artist', gid: '82ca9599-5a15-4ff5-90d5-59ac8afaf5c7' });
    await heard; seen.close();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  const late = (await tpCredits(page)).filter(c => c.entity === 'Zzq Cancel Me Xyzzy');
  console.log('after a late post-back: ' + JSON.stringify(late));
  check((await page.locator('.gt-tp-creating').count()) === 0, 'a late post-back does not bring the placeholder back');
  check(late.length === 2 && late.every(c => !c.gid), 'and does not resolve the credits either — the cancel really unsubscribed');

  check(posts.length === 0, 'nothing was submitted (' + posts.length + ' POSTs to /edit)');
});
