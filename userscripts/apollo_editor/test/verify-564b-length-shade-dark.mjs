// #564 (majkinetor, follow-up): "Apollo len on dark theme is hardly or not
// visible" — screenshot of the Recordings tab where the shaded length cells
// read as EMPTY, the digits only appearing once you drag-select them.
//
// The graded length-gap shade (#186/#480) is a TRANSLUCENT red laid over
// whatever the page's surface is. Under 0.55 alpha the old code always paired
// it with a dark red text colour, which is right over pale pink (light page)
// and invisible over dark maroon (dark page). It's an inline style, so no
// userstyle and no CSS sweep of ours reaches it — lenShade()/dupLenShade() have
// to pick the foreground from the theme themselves.
//
// This checks the actual composite: tint over a real surface colour, against
// the returned foreground, as a WCAG contrast ratio.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = process.env.APOLLO_SRC || resolve(HERE, '..', 'apollo_editor.user.js');
const log = (...a) => console.log('[verify-564b]', ...a);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// ---- colour maths (WCAG 2.x relative luminance / contrast) -------------------
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => { const l1 = lum(a), l2 = lum(b), hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };
function parse(s) {
  if (Array.isArray(s)) return s.length === 3 ? [...s, 1] : s;
  s = String(s).trim();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (m) { const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1]; const v = parseInt(h, 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 1]; }
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) { const p = m[1].split(',').map(x => parseFloat(x)); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  throw new Error('cannot parse colour: ' + s);
}
// composite a (possibly translucent) colour over an opaque surface -> [r,g,b]
const over = (c, surface) => { const f = parse(c), s = parse(surface); return [0, 1, 2].map(i => Math.round(f[i] * f[3] + s[i] * (1 - f[3]))); };

const LIGHT_SURFACES = ['#ffffff', '#f5f5f5'];          // MB's own page, and its slightly grey panels
const DARK_SURFACES  = ['#2b2b2b', '#1e1b24', '#121212']; // kellnerd's dark userstyle, our own dark token, a very dark one
const GAPS = [1000, 2000, 3000, 8000, 15000, 20000, 25000, 29999, 30000, 60000];
// #564 is about the TRANSLUCENT branch (alpha < 0.55, the tinted foreground).
// The white branch above it is a separate, pre-existing choice this fix does not
// touch, so it is measured and printed rather than asserted — see the note at
// the bottom of this file.
const MIN_SOFT = 4.5;
const isSoft = sh => sh.fg !== '#fff';
function worstOf(rows, surface, pick) {
  let worst = { c: Infinity };
  for (const row of rows) for (const which of ['len', 'dup']) {
    const sh = row[which]; if (!pick(sh)) continue;
    const bg = over(sh.bg, surface);
    const c = contrast(over(sh.fg, bg), bg);
    if (c < worst.c) worst = { c, gap: row.gap, which, bg: sh.bg, fg: sh.fg };
  }
  return worst;
}

const code = await readFile(SCRIPT, 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } }; });
await page.setContent('<!DOCTYPE html><html><body></body></html>');
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, { timeout: 10000 });

const sample = theme => page.evaluate(([t, gaps]) => {
  document.documentElement.setAttribute('data-mbu-theme', t);
  const A = window.__apolloEditor;
  return gaps.map(g => ({ gap: g, alpha: A.lenShadeAlpha(g), len: A.lenShade(g), dup: A.dupLenShade(g) }));
}, [theme, GAPS]);

const light = await sample('light');
const dark  = await sample('dark');
log('light:', JSON.stringify(light.map(r => [r.gap, r.len.bg, r.len.fg])));
log('dark :', JSON.stringify(dark.map(r => [r.gap, r.len.bg, r.len.fg])));

// 1. the actual bug: on a dark page every tinted cell must be legible
for (const surface of DARK_SURFACES) {
  const w = worstOf(dark, surface, isSoft);
  ck(w.c >= MIN_SOFT, `dark theme over ${surface}: worst tinted cell is ${w.c.toFixed(2)}:1 (need ${MIN_SOFT}) — ${w.which} at ${w.gap}ms, ${w.fg} on ${w.bg}`);
}

// 2. the shape of the fix: on dark the soft foreground is LIGHT, not dark red
const softDark = dark.filter(r => r.alpha < 0.55);
ck(softDark.length > 0, `there are translucent-branch samples to check (${softDark.length})`);
ck(softDark.every(r => lum(parse(r.len.fg).slice(0, 3)) > 0.4), 'dark theme: every translucent-shade foreground is a LIGHT tint');
ck(softDark.every(r => lum(parse(r.dup.fg).slice(0, 3)) > 0.4), 'dark theme: the duplicates-panel mirror does the same');

// 3. no regression on light — this is exactly what shipped before #564
const softLight = light.filter(r => r.alpha < 0.55);
ck(softLight.every(r => lum(parse(r.len.fg).slice(0, 3)) < 0.1), 'light theme: the translucent-shade foreground is still a DARK red');
ck(light.find(r => r.gap === 1000).dup.fg === '#7a0000', 'light theme: the duplicates panel keeps its hand-picked #7a0000 exactly');
ck(light.find(r => r.gap === 1000).dup.bg === 'rgba(211,47,47,0.12)', 'light theme: the alpha curve itself is untouched');
for (const surface of LIGHT_SURFACES) {
  const w = worstOf(light, surface, isSoft);
  ck(w.c >= MIN_SOFT, `light theme over ${surface}: worst tinted cell is ${w.c.toFixed(2)}:1 (need ${MIN_SOFT}) — ${w.which} at ${w.gap}ms, ${w.fg} on ${w.bg}`);
}

// 4. the two shades stay mirrors of each other (#186) — same branch point
ck(dark.every(r => (r.len.fg === '#fff') === (r.dup.fg === '#fff')), 'lenShade and dupLenShade flip to white at the same alpha');

// 5. NOT asserted — the white branch (alpha >= 0.55), printed so the numbers are
// on record. On dark it is comfortable; on LIGHT it is weak in the middle of its
// range, because white over a half-strength red laid on a white page is still a
// pale cell. That predates #564 and changing it would change the light theme's
// appearance, so it is reported rather than silently redesigned here.
for (const [name, rows, surfaces] of [['dark', dark, DARK_SURFACES], ['light', light, LIGHT_SURFACES]])
  for (const surface of surfaces) {
    const w = worstOf(rows, surface, sh => !isSoft(sh));
    log(`(not asserted) ${name} white branch over ${surface}: worst ${w.c.toFixed(2)}:1 — ${w.which} at ${w.gap}ms on ${w.bg}`);
  }

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await browser.close();
process.exit(fail ? 1 : 0);
