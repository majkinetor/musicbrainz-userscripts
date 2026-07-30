// #480 (majkinetor): the length-mismatch gradient (detailed highlighting) went
// dark far too fast for small gaps. "We don't need subsecond comparison as
// that is not a thing. Up to 3s difference should be very mild color and
// should go darker from there." — then, on the ramp's span: "change it so it
// ramps up from 3 to 30s".
//
// lenShade() (Recordings tab) and dupLenShade() (Duplicates panel) are
// documented as deliberate mirrors of each other (#186) — both now share one
// alpha curve (lenShadeAlpha): null under 1s, a flat mild 0.12 from 1-3s, a
// ramp from 3-30s, solid at 30s+.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const log = (...a) => console.log('[verify-480]', ...a);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const code = await readFile(SCRIPT, 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } }; });
await page.setContent('<!DOCTYPE html><html><body></body></html>');
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, { timeout: 10000 });

const alphas = await page.evaluate(() => {
  const A = window.__apolloEditor;
  const at = ms => A.lenShadeAlpha(ms);
  return {
    under1s: at(999), at1s: at(1000), at2s: at(2000), just_under3s: at(2999), at3s: at(3000),
    at10s: at(10000), at15s: at(15000), at20s: at(20000), just_under30s: at(29999), at30s: at(30000), at60s: at(60000),
    negativeSmall: at(-500),
  };
});
log('alpha curve:', JSON.stringify(alphas));

ck(alphas.under1s === null, `under 1s → no shade at all (got ${alphas.under1s})`);
ck(alphas.negativeSmall === null, `direction doesn't matter — abs(-500) is under 1s → no shade (got ${alphas.negativeSmall})`);
ck(alphas.at1s === 0.12 && alphas.at2s === 0.12 && alphas.just_under3s === 0.12, `1-3s is a FLAT mild tint, not scaling within the range (got ${alphas.at1s}, ${alphas.at2s}, ${alphas.just_under3s})`);
ck(alphas.at3s === 0.12, `3s is still the mild floor, the ramp starts FROM here (got ${alphas.at3s})`);
ck(alphas.at10s > alphas.at3s && alphas.at10s < alphas.at15s && alphas.at15s < alphas.at20s && alphas.at20s < alphas.just_under30s,
  `3-30s ramps up strictly (3s=${alphas.at3s} < 10s=${alphas.at10s} < 15s=${alphas.at15s} < 20s=${alphas.at20s} < ~30s=${alphas.just_under30s})`);
ck(alphas.at30s === 1 && alphas.at60s === 1, `30s+ is solid/full strength (got ${alphas.at30s}, ${alphas.at60s})`);
ck(alphas.at1s < 0.2, `1s reads as noticeably milder than the OLD curve would have (old: 0.2+0.6*(1000/5000)=0.32; new: ${alphas.at1s})`);
// the old 3-5s span would have hit solid strength by 5s — confirm the ramp is now genuinely stretched out
ck(alphas.at10s < 0.5, `even 10s is still well short of full strength now that the ramp spans to 30s (got ${alphas.at10s})`);

// lenShade()/dupLenShade() apply this curve with their own colour + text-contrast flip
const shades = await page.evaluate(() => {
  const A = window.__apolloEditor;
  return {
    len1s: A.lenShade(1000), len3s: A.lenShade(3000), len30s: A.lenShade(30000),
    dup1s: A.dupLenShade(1000), dup30s: A.dupLenShade(30000),
    under1s: A.lenShade(500),
  };
});
log('shades:', JSON.stringify(shades));
ck(shades.under1s === null, 'lenShade(500) returns null (no highlight) for a sub-1s gap');
ck(/rgba\(/.test(shades.len1s.bg) && shades.len1s.fg !== '#fff', 'a 1s gap is a translucent tint with dark text, not solid/white');
ck(/^rgb\(/.test(shades.len30s.bg) && shades.len30s.fg === '#fff', 'a 30s+ gap is solid with white text');
ck(shades.dup1s.bg === 'rgba(211,47,47,0.12)', `duplicates-panel shade uses the same mild floor (got ${shades.dup1s.bg})`);
ck(shades.dup30s.bg === '#d32f2f' && shades.dup30s.fg === '#fff', 'duplicates-panel 30s+ is solid red');

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await browser.close();
process.exit(fail ? 1 : 0);
