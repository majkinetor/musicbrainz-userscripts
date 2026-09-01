// #557 (majkinetor): "Current auto start works on MB side. Let's have another
// option 'Auto send' in Harmony category. Having both enabled would
// automatically finish everything after successful Harmony import."
//
// Runs against a REAL Harmony release-actions page. Nothing is ever submitted:
// the send's only outward effect is opening MusicBrainz with a token, and both
// GM_openInTab and window.open are stubbed so no tab is opened either.
//
// The checks that matter are the ones about when it must NOT fire — an
// unattended send that guesses wrong is worse than no send at all.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

const ACTIONS = 'https://harmony.pulsewidth.org.uk/release/actions?release_mbid=https%3A%2F%2Fmusicbrainz.org%2Frelease%2F20b03c7d-9e8a-42b9-8a96-bcc9564de034';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
// A fresh in-page GM store per document, pre-seeded from what the test asks for,
// plus stubs that RECORD an outbound tab instead of opening one.
const initScript = (opts) => {
  const store = new Map(Object.entries(opts));
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = (k) => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
  window.__opened = [];
  window.GM_openInTab = (u, o) => { window.__opened.push({ via: 'GM_openInTab', u, o }); return { close() {}, closed: false }; };
  window.open = (u) => { window.__opened.push({ via: 'window.open', u }); return { closed: false }; };
  window.__falconConsole = [];
  const ci = console.info.bind(console);
  console.info = (...a) => { window.__falconConsole.push(a.join(' ')); ci(...a); };
};
// expectActions: wait for Harmony to have actually rendered its action list
// before injecting. Without this the script can boot onto a page that has not
// finished rendering, see zero actions, and correctly stand down — which then
// reads as "auto send is broken" when it is the fixture that wasn't ready.
const openHarmony = async (url, opts, expectActions) => {
  const page = await ctx.newPage();
  page.on('pageerror', e => { console.log('PAGEERROR ' + e.message); fail++; });
  await page.addInitScript(initScript, opts || {});
  for (let a = 1; ; a++) {
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 }); break; }
    catch (e) { if (a >= 3) throw e; await page.waitForTimeout(4000); }
  }
  if (expectActions) {
    const rendered = await page.waitForFunction(
      () => [...document.querySelectorAll('a')].filter(a => /link external ids/i.test(a.textContent || '')).length > 5,
      null, { timeout: 45000 }).then(() => true).catch(() => false);
    ck(rendered, 'fixture: Harmony rendered its action list (otherwise the checks below prove nothing)');
    await page.waitForTimeout(1500);          // let the count settle before Falcon starts polling
  } else {
    await page.waitForTimeout(3000);
  }
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 8000 });
  return page;
};
const label = p => p.evaluate(() => (document.getElementById('falcon-harmony-lbl') || {}).textContent || '');

// ── A. option OFF (the default): nothing is sent, ever ──────────────────────
{
  const page = await openHarmony(ACTIONS, {}, true);
  const off = await page.evaluate(() => window.__falconTest.cfg.autoSendFromHarmony);
  ck(off === false, '#557: "Auto send" is OFF by default');
  await page.waitForTimeout(9000);            // past the settle poll AND any countdown
  const st = await page.evaluate(() => ({ opened: window.__opened.length, pending: window.__falconTest.autoSendPending(), lbl: (document.getElementById('falcon-harmony-lbl') || {}).textContent }));
  console.log('with the option off: ' + JSON.stringify(st));
  ck(st.opened === 0, 'with it off nothing is sent (' + st.opened + ' tabs opened)');
  ck(!st.pending, 'and no countdown is armed');
  ck(/^Send \d+ to Falcon$/.test(st.lbl || ''), 'the button reads normally — ' + JSON.stringify(st.lbl));
  await page.close();
}

// ── B. option ON: it counts down, then sends, via GM_openInTab ──────────────
{
  const page = await openHarmony(ACTIONS, { 'falcon:autoSendFromHarmony': true, 'falcon:autoSendDelayMs': 4000 }, true);
  ck(await page.evaluate(() => window.__falconTest.cfg.autoSendFromHarmony) === true, 'the option reads back on');
  // catch the countdown while it is still running
  const armed = await page.waitForFunction(() => window.__falconTest.autoSendPending(), null, { timeout: 20000 }).then(() => true).catch(() => false);
  ck(armed, '#557: with it on, an auto send arms itself after the actions settle');
  const countdownLbl = await label(page);
  console.log('countdown label: ' + JSON.stringify(countdownLbl));
  ck(/Auto-sending \d+ in \d+…/.test(countdownLbl), 'the button shows a countdown with the item count');
  ck(/click to cancel/i.test(countdownLbl), 'and says it can be cancelled');
  const midOpened = await page.evaluate(() => window.__opened.length);
  ck(midOpened === 0, 'nothing has been sent yet while the countdown runs');

  const sent = await page.waitForFunction(() => window.__opened.length > 0, null, { timeout: 20000 }).then(() => true).catch(() => false);
  ck(sent, '#557: the countdown ends in a real send');
  const out = await page.evaluate(() => ({ opened: window.__opened, log: window.__falconConsole.filter(l => /falcon/i.test(l)) }));
  console.log('outbound: ' + JSON.stringify(out.opened));
  if (!out.opened.length) console.log('log: ' + JSON.stringify(out.log));
  const one = out.opened[0] || {};
  ck(out.opened.length === 1, 'exactly one tab is opened, not one per poll tick (' + out.opened.length + ')');
  ck(one.via === 'GM_openInTab', 'it goes through GM_openInTab — window.open is popup-blocked outside a user gesture');
  const token = one.u ? new URL(one.u).searchParams.get('falcon') : null;
  ck(!!token, 'the opened URL carries a falcon token — ' + JSON.stringify((one.u || '').slice(0, 90)));
  ck(/\/release\/20b03c7d-9e8a-42b9-8a96-bcc9564de034\?/.test(one.u || ''), 'and targets the imported release');
  const payload = await page.evaluate(t => JSON.parse(window.GM_getValue('falcon:pending:' + t)), token);
  ck(Array.isArray(payload) && payload.length > 10, 'the full batch was written to GM storage (' + (payload || []).length + ' items)');
  ck(payload.some(p => p.entityType === 'recording'), 'recordings included — the same payload a manual click builds');
  const logged = await page.evaluate(() => window.__falconConsole.filter(l => /auto send/i.test(l)));
  console.log('log: ' + JSON.stringify(logged));
  ck(logged.some(l => /auto send:/.test(l)), 'the decision is logged where it can be seen on Harmony (console)');
  await page.close();
}

// ── C. clicking during the countdown cancels, and does not send ─────────────
{
  const page = await openHarmony(ACTIONS, { 'falcon:autoSendFromHarmony': true, 'falcon:autoSendDelayMs': 8000 }, true);
  const armed = await page.waitForFunction(() => window.__falconTest.autoSendPending(), null, { timeout: 20000 }).then(() => true).catch(() => false);
  ck(armed, 'a countdown is running to cancel');
  await page.evaluate(() => document.getElementById('falcon-harmony-btn').click());
  await page.waitForTimeout(300);
  const afterCancel = await page.evaluate(() => ({ pending: window.__falconTest.autoSendPending(), opened: window.__opened.length, lbl: (document.getElementById('falcon-harmony-lbl') || {}).textContent }));
  console.log('after clicking mid-countdown: ' + JSON.stringify(afterCancel));
  ck(!afterCancel.pending, 'clicking the button cancels the countdown');
  ck(afterCancel.opened === 0, 'and does NOT also send — the click is the cancel, not a second send');
  ck(/^Send \d+ to Falcon$/.test(afterCancel.lbl || ''), 'the label goes back to normal — ' + JSON.stringify(afterCancel.lbl));
  await page.waitForTimeout(10000);
  const later = await page.evaluate(() => window.__opened.length);
  ck(later === 0, 'and it does not re-arm afterwards (' + later + ' sends)');
  // a SECOND click is an ordinary manual send again
  await page.evaluate(() => document.getElementById('falcon-harmony-btn').click());
  await page.waitForTimeout(6500);            // allows for the name-resolution grace period
  const manual = await page.evaluate(() => window.__opened.length);
  ck(manual === 1, 'clicking again performs the ordinary manual send (' + manual + ')');
  await page.close();
}

// ── D. a Harmony page that is NOT a completed import must never fire ────────
{
  const page = await openHarmony('https://harmony.pulsewidth.org.uk/', { 'falcon:autoSendFromHarmony': true, 'falcon:autoSendDelayMs': 1000 });
  await page.waitForTimeout(9000);
  const st = await page.evaluate(() => ({
    mbid: window.__falconTest.harmonyReleaseMbid(),
    opened: window.__opened.length,
    pending: window.__falconTest.autoSendPending(),
    log: window.__falconConsole.filter(l => /auto send/i.test(l)),
  }));
  console.log('on the Harmony home page: ' + JSON.stringify(st));
  ck(st.mbid === null, 'the home page has no release_mbid — not a completed import');
  ck(st.opened === 0, '#557: auto send stands down there (' + st.opened + ' sends)');
  ck(!st.pending, 'and arms no countdown');
  ck(st.log.some(l => /no release_mbid|nothing/i.test(l)), 'and says why — ' + JSON.stringify(st.log));
  await page.close();
}

// ── E. the option is wired into the panel on the MusicBrainz side ───────────
{
  const page = await ctx.newPage();
  await page.addInitScript(initScript, {});
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 8000 });
  await page.waitForSelector('#falcon-launcher', { timeout: 8000 });
  await page.click('#falcon-launcher');
  await page.waitForSelector('#falcon-panel', { timeout: 8000 });
  await page.click('#falcon-tab-options');
  await page.waitForTimeout(300);
  const ui = await page.evaluate(() => {
    const cb = document.getElementById('falcon-opt-auto-send-harmony');
    if (!cb) return { missing: true };
    const fs = cb.closest('fieldset');
    const lgd = fs ? (fs.querySelector('legend') || {}).textContent : '';
    cb.checked = true; cb.dispatchEvent(new Event('change'));
    return {
      missing: false, legend: (lgd || '').trim(), label: (cb.parentElement.textContent || '').trim(),
      title: cb.parentElement.title, persisted: window.__falconTest.cfg.autoSendFromHarmony,
      order: [...fs.querySelectorAll('input[type=checkbox]')].map(i => i.id),
    };
  });
  console.log('options UI: ' + JSON.stringify(ui));
  ck(!ui.missing, 'the panel has an "Auto send" checkbox');
  ck(!ui.missing && /^harmony$/i.test(ui.legend), '#557: it is in the Harmony category (' + JSON.stringify(ui.legend) + ')');
  ck(!ui.missing && /auto send/i.test(ui.label), 'labelled "Auto send" — ' + JSON.stringify(ui.label));
  ck(!ui.missing && ui.persisted === true, 'ticking it writes through to the config');
  ck(!ui.missing && /auto start/i.test(ui.title || ''), 'and its tooltip explains the pairing with Auto start');
  await page.close();
}

console.log(fail ? `FAIL (${fail})` : 'ALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
