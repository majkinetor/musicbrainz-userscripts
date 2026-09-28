// #578 live proof. verify-578-picard-port.mjs asserts the parameter, the stored
// port and the options UI, but deliberately stopped short of the one line that
// concatenates them inside sendToFalcon, because that needs a real Harmony
// actions page. majkinetor then reported the feature "not working", so that gap
// is exactly where the doubt lived and guessing at it was not good enough.
//
// This drives the REAL Harmony release-actions page, with GM_openInTab stubbed,
// and reads the URL Falcon would have opened. It is a `live-` test because it
// depends on a third party being up; treat a network failure as inconclusive,
// not as a regression.
//
// Read-only on both sites: every POST is aborted.
//
// Run: node test/live-578-picard-harmony-proof.mjs
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { harmonyReplay } from './fc.mjs';
import { test, check, requireLogin, sourceOf, idle, until, settled } from '../../../dev/test/harness.mjs';

// the script brings its own GM stand-ins, as it did before the harness
test.use({ gm: false });

test("live 578 picard harmony proof", { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');
  // majkinetor's own release from the issue, so the proof is about the case he reported
  const R = '79e909b1-9320-4483-806b-33a899c01193';
  const log = (...a) => console.log('[live-578]', ...a);
  const ck = check;

  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
    window.__opened = [];
    window.GM_openInTab = (u) => { window.__opened.push(String(u)); return { close() {} }; };
  });
  await page.route(() => true, r => (r.request().method() === 'POST' ? r.abort() : r.fallback()));

  const hw = await harmonyReplay(page, '578');
  try {
    await page.goto(`https://harmony.pulsewidth.org.uk/release/actions?release_mbid=${R}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    console.log('INCONCLUSIVE: Harmony did not load —', e.message.split('\n')[0]);
    throw new Error('stopped: see the log above');
  }
  await settled(page);   // live Harmony has rendered
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 20000 });

  const mbid = await until(() => page.evaluate(() => window.__falconTest.harmonyReleaseMbid()));
  log('release mbid Falcon reads off the page:', mbid);
  ck(mbid === R, `Falcon finds the release mbid on the actions page (got ${mbid})`);

  // a port this session has not seen: a logged-in session remembers the last tport it was given
  const PORT = 8001 + (Date.now() % 900);
  const send = enable => page.evaluate(async ([on, port]) => {
    const { cfg, sendToFalcon } = window.__falconTest;
    cfg.sendToPicard = on; cfg.picardPort = port;
    window.__opened.length = 0;
    await sendToFalcon(false);
    return window.__opened[0] || null;
  }, [enable, PORT]);

  const off = await send(false);
  const on = await send(true);
  log('option off →', off);
  log('option on  →', on);
  ck(off && new RegExp('[?&]tport=' + PORT + '(&|$)').test(off), `tport is on the URL even with auto-send off — the button is always available (got ${off})`);
  ck(on === `https://musicbrainz.org/release/${R}?${on.split('?')[1]}` && new RegExp('[?&]tport=' + PORT + '(&|$)').test(on),
    `with it on the opened URL carries &tport=${PORT} (got ${on})`);
  ck(on && on.startsWith(`https://musicbrainz.org/release/${R}?falcon=`), 'it is still the release page with the queue token, not a different URL');

  // …and that URL really does make MusicBrainz render the tagger button. Checked in
  // a CLEAN context: a logged-in session remembers a tport from earlier, so testing
  // this on a profile that has ever used Picard proves nothing.
  // The sandbox serves only logged-in visitors: a fresh context with the session's cookies.
  // (Should the session remember a tport, the "without" check below says so.)
  const clean = await chromium.launch();
  const cp = await (await clean.newContext({ storageState: await context.storageState() })).newPage();
  const seen = {};
  // on the sandbox: the same query on one of its releases (R is production's, where Harmony points)
  const SB = 'e3e7446a-71fd-43b9-8cbb-b48066a8b566';
  for (const [k, u] of [['without', `https://test.musicbrainz.org/release/${SB}`], ['with', `https://test.musicbrainz.org/release/${SB}?${(on || '?').split('?')[1]}`]]) {
    await cp.goto(u, { waitUntil: 'domcontentloaded' });
    await idle(cp);
    seen[k] = await cp.evaluate(() => { const a = document.querySelector('a[href*="openalbum"]'); return a ? a.getAttribute('href') : null; });
  }
  await clean.close();
  log('tagger link seen:', JSON.stringify(seen));
  ck(!(seen.without || '').includes(':' + PORT + '/'), 'the fixture reproduces: no button for this port without the parameter');
  ck(seen.with === `http://127.0.0.1:${PORT}/openalbum?id=${SB}`,
    `and the exact button majkinetor showed appears with it (got ${seen.with})`);

  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await hw.done();
});
