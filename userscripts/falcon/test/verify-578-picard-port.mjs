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
// Three things are worth asserting and they are separable, so they are separate:
// the parameter itself, the stored setting (a port is user input and ends up in
// a URL, so garbage must not survive the round trip), and the options UI that
// majkinetor spelled out.
//
// Not covered here: the concatenation inside sendToFalcon, which needs a real
// Harmony actions page. That is one line, it uses the same helper asserted
// below, and standing up a fake Harmony DOM would test the fake.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.FALCON_SRC || resolve(HERE, '..', 'falcon.user.js');
const code = await readFile(SRC, 'utf8');
const log = (...a) => console.log('[verify-578]', ...a);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1500, height: 1000 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route(() => true, r => (r.request().method() === 'POST' ? r.abort() : r.fallback()));
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 15000 });

if (!await page.evaluate(() => typeof (window.__falconTest || {}).picardParam === 'function')) {
  ck(false, 'picardParam is exported — this build does not have the feature');
  console.log('\n1 FAIL'); await ctx.close(); process.exit(1);
}

// 1. the parameter
const params = await page.evaluate(() => {
  const { cfg, picardParam } = window.__falconTest;
  const out = {};
  cfg.sendToPicard = false; out.off = picardParam();
  cfg.sendToPicard = true; out.onDefault = picardParam();
  cfg.picardPort = 8123; out.onCustom = picardParam();
  return out;
});
log('parameter:', JSON.stringify(params));
ck(params.off === '', `off adds nothing to the URL (got ${JSON.stringify(params.off)})`);
ck(params.onDefault === '&tport=8000', `on, it is &tport= with the 8000 default majkinetor specified (got ${JSON.stringify(params.onDefault)})`);
ck(params.onCustom === '&tport=8123', `a custom port is what ends up in the URL (got ${JSON.stringify(params.onCustom)})`);
// it is appended to a url that ALREADY has ?falcon=, so it must lead with & and
// never with ? — the whole thing is inert if the query string is malformed
ck(/^&/.test(params.onCustom), 'it joins an existing query string with & rather than starting a new one');

// 2. the stored port. It is user input that ends up in a URL, so nonsense must
// not survive being stored — checked through the getter, which is what callers
// see, rather than through whatever landed in storage.
const clamp = await page.evaluate(() => {
  const { cfg } = window.__falconTest;
  const out = {};
  for (const v of [8000, 1, 65535, 0, -5, 70000, 8000.7, 'abc', '', null]) {
    cfg.picardPort = v;
    out[JSON.stringify(v)] = cfg.picardPort;
  }
  return out;
});
log('port round-trip:', JSON.stringify(clamp));
ck(clamp['8000'] === 8000 && clamp['1'] === 1 && clamp['65535'] === 65535, 'a legal port is stored as given');
ck(clamp['0'] === 8000 && clamp['-5'] === 8000 && clamp['70000'] === 8000, `out-of-range values fall back to 8000 rather than reaching a URL (got ${JSON.stringify([clamp['0'], clamp['-5'], clamp['70000']])})`);
ck(clamp['"abc"'] === 8000 && clamp['""'] === 8000 && clamp['null'] === 8000, `non-numbers fall back to 8000 (got ${JSON.stringify([clamp['"abc"'], clamp['""'], clamp['null']])})`);
ck(clamp['8000.7'] === 8000, `a fractional port is floored, not put in the URL with a decimal point (got ${clamp['8000.7']})`);

// 3. the options UI, in the words majkinetor asked for and in the section he
// asked for. The panel is built lazily on first use, so it has to be opened —
// querying for the controls before that finds nothing and says the feature is
// missing when it is only unbuilt.
await page.evaluate(() => { const l = document.getElementById('falcon-launcher'); if (l) l.click(); });
await page.waitForSelector('#falcon-panel', { timeout: 15000, state: 'attached' });
await page.waitForTimeout(500);
const ui = await page.evaluate(() => {
  const cb = document.getElementById('falcon-opt-picard');
  const port = document.getElementById('falcon-opt-picard-port');
  if (!cb || !port) return { missing: !cb ? 'checkbox' : 'port input' };
  const label = cb.closest('label');
  const fieldset = cb.closest('fieldset');
  return {
    label: label ? label.textContent.replace(/\s+/g, ' ').trim() : null,
    legend: fieldset ? fieldset.querySelector('legend').textContent.trim() : null,
    type: port.type, min: port.min, max: port.max,
  };
});
log('options UI:', JSON.stringify(ui));
ck(!ui.missing, `both controls exist (${ui.missing || 'ok'})`);
ck(ui.legend === 'Harmony', `they sit in the Harmony section, as asked (got ${JSON.stringify(ui.legend)})`);
ck(/Send to Picard using port/i.test(ui.label || ''), `labelled "Send to Picard using port" (got ${JSON.stringify(ui.label)})`);
ck(ui.type === 'number' && ui.min === '1' && ui.max === '65535', `the port is a bounded number input (${ui.type} ${ui.min}-${ui.max})`);

// 4. the UI actually drives the setting, and the port greys out when the box is
// off — a live control that does nothing is worse than a disabled one
const wiring = await page.evaluate(async () => {
  const { cfg } = window.__falconTest;
  const cb = document.getElementById('falcon-opt-picard');
  const port = document.getElementById('falcon-opt-picard-port');
  cfg.sendToPicard = false; cfg.picardPort = 8000;
  cb.checked = false; cb.onchange();
  const offState = { disabled: port.disabled, cfg: cfg.sendToPicard };
  cb.checked = true; cb.onchange();
  const onState = { disabled: port.disabled, cfg: cfg.sendToPicard };
  port.value = '9000'; port.onchange();
  const after = { cfgPort: cfg.picardPort, shown: port.value };
  port.value = '99999'; port.onchange();
  const clamped = { cfgPort: cfg.picardPort, shown: port.value };
  return { offState, onState, after, clamped };
});
log('wiring:', JSON.stringify(wiring));
ck(wiring.offState.cfg === false && wiring.onState.cfg === true, 'ticking the box turns the setting on and off');
ck(wiring.offState.disabled === true && wiring.onState.disabled === false, 'the port input is disabled while the box is unticked');
ck(wiring.after.cfgPort === 9000 && wiring.after.shown === '9000', `typing a port stores it (got ${JSON.stringify(wiring.after)})`);
ck(wiring.clamped.cfgPort === 8000 && wiring.clamped.shown === '8000', `an impossible port is corrected in the box too, not silently ignored (got ${JSON.stringify(wiring.clamped)})`);

// 5. off by default — it is only useful when Picard is running
const fresh = await ctx.newPage();
await fresh.route(() => true, r => (r.request().method() === 'POST' ? r.abort() : r.fallback()));
await fresh.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
await fresh.addScriptTag({ content: code });
await fresh.waitForFunction(() => !!window.__falconTest, { timeout: 15000 });
const defaults = await fresh.evaluate(() => ({ on: window.__falconTest.cfg.sendToPicard, port: window.__falconTest.cfg.picardPort, param: window.__falconTest.picardParam() }));
log('defaults:', JSON.stringify(defaults));
ck(defaults.on === false, 'off by default');
ck(defaults.port === 8000, 'default port is 8000');
ck(defaults.param === '', 'so a default install adds nothing to the URL');

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
