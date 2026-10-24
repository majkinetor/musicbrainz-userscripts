// #829 (majkinetor): "add the rclick to open settings as usual" — on Harmony,
// where Falcon has only its Send button, a right-click on it opens the settings,
// as a right-click on every corner launcher does (#695). It also stops a running
// auto-send countdown, and once an auto send has gone the button no longer reads
// "Auto-sending N in 1…" (the issue's last point).
//
// Replays a recorded Harmony release-actions page (#557's); nothing is sent:
// GM_openInTab and window.open only record the tab they were asked for.
import { readFile } from 'node:fs/promises';
import { harmonyReplay } from './fc.mjs';
import { test, check, sourceOf, settled, until } from '../../../dev/test/harness.mjs';

test.use({ gm: false });

const ACTIONS = 'https://harmony.pulsewidth.org.uk/release/actions?release_mbid=https%3A%2F%2Fmusicbrainz.org%2Frelease%2F20b03c7d-9e8a-42b9-8a96-bcc9564de034';

test('#829: right-click on the Harmony button opens the settings', { tag: ['@sandbox'] }, async ({ context }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');
  const open = async (fixture, opts = {}) => {
    const page = await context.newPage();
    const ws = await harmonyReplay(page, fixture);
    await page.addInitScript((opts) => {
      const store = new Map(Object.entries(opts));
      window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
      window.GM_setValue = (k, v) => store.set(k, v);
      window.GM_deleteValue = (k) => store.delete(k);
      window.GM_info = { script: { name: 'Falcon', version: 't' } };
      window.__opened = [];
      window.GM_openInTab = (u) => { window.__opened.push(u); return { close() {}, closed: false }; };
      window.open = (u) => { window.__opened.push(u); return { closed: false }; };
    }, opts);
    await page.clock.install();
    await page.goto(ACTIONS, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForFunction(() => [...document.querySelectorAll('a')].filter(a => /link external ids/i.test(a.textContent || '')).length > 5, null, { timeout: 45000 });
    await settled(page);
    await page.addScriptTag({ content: code });
    await page.waitForFunction(() => !!window.__falconTest, { timeout: 8000 });
    return { page, ws };
  };
  const state = p => p.evaluate(() => ({
    lbl: (document.getElementById('falcon-harmony-lbl') || {}).textContent || '',
    panel: (document.getElementById('falcon-panel') || { style: {} }).style.display || null,
    options: (document.getElementById('falcon-body-options') || { style: {} }).style.display || null,
    opened: window.__opened.length,
    pending: window.__falconTest.autoSendPending(),
  }));

  // ── a countdown running: the right-click stops it and opens the settings ──
  {
    const { page } = await open('557-1', { 'falcon:autoSendDelayMs': 20000 });   // long enough to be caught running
    await page.waitForFunction(() => window.__falconTest.autoSendPending(), null, { timeout: 20000 }).catch(() => {});
    const before = await state(page);
    check(before.pending && /^Auto-sending/.test(before.lbl), 'fixture: the countdown is running — ' + JSON.stringify(before));
    await page.click('#falcon-harmony-btn', { button: 'right' });
    const after = await state(page);
    check(after.panel === 'flex', 'the right-click opens the panel on Harmony — ' + JSON.stringify(after));
    check(after.options === 'flex', 'on its Settings tab');
    check(!after.pending && /^Send \d+ to Falcon/.test(after.lbl), 'and stops the countdown — ' + JSON.stringify(after.lbl));
    await page.clock.runFor(25000);
    check((await state(page)).opened === 0, 'nothing is sent afterwards');
    await page.close();
  }

  // ── left to run: the button reads normally once the batch has gone ────────
  {
    const { page } = await open('557-2');
    await page.clock.runFor(12000);
    const st = await until(() => state(page), s => s.opened === 1 && !/^Auto-sending/.test(s.lbl));
    check(st.opened === 1, 'fixture: the auto send went — ' + JSON.stringify(st));
    check(/^Send \d+ to Falcon/.test(st.lbl), 'the label no longer counts down after the send — ' + JSON.stringify(st.lbl));
    await page.close();
  }
});
