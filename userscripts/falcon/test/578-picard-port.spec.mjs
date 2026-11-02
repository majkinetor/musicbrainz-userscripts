// #578 — Jormangeud: "It would be nice if falcon had config for adding the
// tagger port into the url. E.g. when opening with send to falcon from harmony,
// you'd get the [&?]tport=xxxx appended to the release url, so it could brought
// into Picard right away." majkinetor, specifying it: "Default port is 8000.
// Option inside Harmony category should be: [x] Send to Picard using port [8000]"
//
// ?tport= is what makes MusicBrainz render its green tagger button, which hands
// the release to Picard listening on that port — so the feature is one query
// parameter on the URL "Send to Falcon" already opens.
//
// The parameter and the options UI are separable, so they are asserted apart.
//
// Not covered here: the concatenation inside sendToFalcon, which needs a real
// Harmony actions page. That is one line, it uses the same helper asserted
// below, and standing up a fake Harmony DOM would test the fake.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, frames, mbNoise } from '../../../dev/test/harness.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));

// the script brings its own GM stand-ins, as it did before the harness
test.use({ gm: false });

test("#578: picard port", { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  const SRC = process.env.FALCON_SRC || resolve(HERE, '..', 'falcon.user.js');
  const code = await readFile(SRC, 'utf8');
  const log = (...a) => console.log('[verify-578]', ...a);
  const ck = check;

  await context.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  const errs = []; page.on('pageerror', e => { if (!mbNoise(e.message)) errs.push(e.message); });
  await page.route(() => true, r => (r.request().method() === 'POST' ? r.abort() : r.fallback()));
  await page.goto('https://test.musicbrainz.org/', { waitUntil: 'load' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 15000 });

  if (!await page.evaluate(() => typeof (window.__falconTest || {}).picardParam === 'function')) {
    ck(false, 'picardParam is exported — this build does not have the feature');
    console.log('\n1 FAIL'); throw new Error('stopped: see the log above');
  }

  // 1. the parameter. majkinetor, round 3: "Add `tport` regardless of option
  // (possible since we have default value for port)" — so the tagger button is
  // always available and the checkbox governs only the automatic hand-over.
  const params = await page.evaluate(() => {
    const { cfg, picardParam } = window.__falconTest;
    const out = {};
    cfg.sendToPicard = false; out.autoOff = picardParam();
    cfg.sendToPicard = true; out.autoOn = picardParam();
    return out;
  });
  log('parameter:', JSON.stringify(params));
  ck(params.autoOff === '&tport=8000', `tport is added even with auto-send OFF, so the button is always there to click (got ${JSON.stringify(params.autoOff)})`);
  ck(params.autoOn === '&tport=8000', `and with it on (got ${JSON.stringify(params.autoOn)})`);
  // it is appended to a url that ALREADY has ?falcon=, so it must lead with & and
  // never with ? — the whole thing is inert if the query string is malformed
  ck(/^&/.test(params.autoOn), 'it joins an existing query string with & rather than starting a new one');

  // 3. the options UI, in the words majkinetor asked for and in the section he
  // asked for. The panel is built lazily on first use, so it has to be opened —
  // querying for the controls before that finds nothing and says the feature is
  // missing when it is only unbuilt.
  await page.evaluate(() => { const l = document.getElementById('falcon-launcher'); if (l) l.click(); });
  await page.waitForSelector('#falcon-panel', { timeout: 15000, state: 'attached' });
  await frames(page);
  const ui = await page.evaluate(() => {
    const cb = document.getElementById('falcon-opt-picard');
    if (!cb) return { missing: 'checkbox' };
    const label = cb.closest('label');
    const fieldset = cb.closest('fieldset');
    return {
      label: label ? label.textContent.replace(/\s+/g, ' ').trim() : null,
      legend: fieldset ? fieldset.querySelector('legend').textContent.trim() : null,
      port: !!document.getElementById('falcon-opt-picard-port'),
    };
  });
  log('options UI:', JSON.stringify(ui));
  ck(!ui.missing, `the checkbox exists (${ui.missing || 'ok'})`);
  ck(ui.legend === 'Harmony', `it sits in the Harmony section, as asked (got ${JSON.stringify(ui.legend)})`);
  ck(ui.label === 'Automatically send to Picard', `labelled "Automatically send to Picard" (got ${JSON.stringify(ui.label)})`);
  ck(ui.port === false, 'there is no port to set');

  // 4. the UI actually drives the setting
  const wiring = await page.evaluate(async () => {
    const { cfg } = window.__falconTest;
    const cb = document.getElementById('falcon-opt-picard');
    cb.checked = false; cb.onchange();
    const off = cfg.sendToPicard;
    cb.checked = true; cb.onchange();
    return { off, on: cfg.sendToPicard };
  });
  log('wiring:', JSON.stringify(wiring));
  ck(wiring.off === false && wiring.on === true, 'ticking the box turns the setting on and off');

  // 5. off by default — it is only useful when Picard is running
  const fresh = await context.newPage();
  await fresh.route(() => true, r => (r.request().method() === 'POST' ? r.abort() : r.fallback()));
  await fresh.goto('https://test.musicbrainz.org/', { waitUntil: 'load' });
  await fresh.addScriptTag({ content: code });
  await fresh.waitForFunction(() => !!window.__falconTest, { timeout: 15000 });
  const defaults = await fresh.evaluate(() => ({ on: window.__falconTest.cfg.sendToPicard, param: window.__falconTest.picardParam() }));
  log('defaults:', JSON.stringify(defaults));
  ck(defaults.on === false, 'the automatic hand-over is off by default');
  ck(defaults.param === '&tport=8000', `but a default install still gets the tagger button (got ${JSON.stringify(defaults.param)})`);

  // ── 6. the actual hand-over ────────────────────────────────────────────────
  // #578 follow-up: MusicBrainz's tport button did not appear in majkinetor's
  // browser even though the URL carried the parameter, and waiting for a button to
  // be clicked was never the ask. Falcon now calls Picard's own endpoint when a run
  // finishes. GM_xmlhttpRequest is stubbed, so what is asserted is the request
  // Falcon makes — not whether a Picard happens to be running on this machine.
  const REL = '81fe067b-d8b7-45d2-ae9d-cff74e7bc68d';   // majkinetor's release from the issue
  const handover = await page.evaluate(async (rel) => {
    const { cfg, sendReleaseToPicard, setHarmonySeeded } = window.__falconTest;
    const calls = [];
    window.GM_xmlhttpRequest = (o) => { calls.push(o.url); if (o.onload) o.onload({ status: 200 }); };
    history.replaceState(null, '', '/release/' + rel + '?falcon=tok&tport=8000');

    // #671: Picard is a Harmony option — a queue from anywhere else sends nothing
    cfg.sendToPicard = true; setHarmonySeeded(false);
    sendReleaseToPicard(); const notHarmony = calls.length;
    setHarmonySeeded(true);

    cfg.sendToPicard = false;
    sendReleaseToPicard(); const whenOff = calls.length;

    cfg.sendToPicard = true;
    sendReleaseToPicard(); const first = calls.slice();
    sendReleaseToPicard(); const afterRepeat = calls.length;   // must not poke twice

    history.replaceState(null, '', '/');
    sendReleaseToPicard(); const offRelease = calls.length;
    return { notHarmony, whenOff, first, afterRepeat, offRelease };
  }, REL);
  log('hand-over:', JSON.stringify(handover));
  ck(handover.notHarmony === 0, `a queue that didn't come from Harmony sends nothing to Picard (got ${handover.notHarmony} call(s))`);
  ck(handover.whenOff === 0, `with the option off nothing is sent to Picard (got ${handover.whenOff} call(s))`);
  ck(handover.first.length === 1 && handover.first[0] === `http://127.0.0.1:8000/openalbum?id=${REL}`,
    `with it on Falcon calls Picard's endpoint for this release (got ${JSON.stringify(handover.first)})`);
  ck(handover.afterRepeat === 1, `a second finished run does not poke Picard again for the same release (got ${handover.afterRepeat} call(s))`);
  ck(handover.offRelease === 1, 'a tab that is not a release page hands over nothing');

  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
});
