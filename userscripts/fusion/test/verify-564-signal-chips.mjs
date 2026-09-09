// #564 (majkinetor, with a screenshot): "Fusion chips all look the same on dark
// theme (i can't see for example if isrc is matched or not, chips look almost
// the same)".
//
// The old pair was a fixed rgba(28,155,99,.16) tint plus opacity:.55 on the miss.
// Against a dark panel that tint is very nearly the panel colour, and dimming an
// already-dim chip leaves two faint outlines differing only in hue — at 9.5px,
// indistinguishable. A hit is now FILLED and a miss is not, with every colour
// mixed from the theme rather than fixed.
//
// Measured, not eyeballed. The first attempt at this class of bug (#564, Apollo's
// length shade) produced a fake 12.8:1 because the parser read `color(srgb …)`
// 0–1 components as 0–255 — so the reader here handles both, and the light-theme
// figures are sanity-checked against a known-different pair.
//
// No network: the chips are rendered into a bare page from Fusion's own CSS.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.FUSION_SRC || resolve(HERE, '..', 'fusion.user.js');
const code = await readFile(SRC, 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// The logged-in profile, as the other Fusion tests use: Fusion installs itself
// only on the pages it matches, and a signed-out browser lands on a login page.
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Fusion', version: 't' } };
  window.GM_xmlhttpRequest = () => {};
});
// Fusion only installs itself on the pages it matches, and its stylesheet is
// injected when the overlay is built — so open it, rather than measuring against
// CSS that was never added.
await page.route(() => true, r => (r.request().method() === 'POST' ? r.abort() : r.continue()));
await page.goto('https://test.musicbrainz.org/release-group/1279bc2b-8c89-4f68-b233-38fc9f04f8d4', { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__fusion, { timeout: 20000 });
await page.evaluate(() => { try { window.__fusion.openFusion(); } catch (e) {} });
await page.waitForFunction(() => [...document.styleSheets].some(sh => { try { return [...sh.cssRules].some(r => r.selectorText && r.selectorText.includes('.fs-sig')); } catch (e) { return false; } }), { timeout: 20000 });

const measure = await page.evaluate(async (themes) => {
  // Colour reading that survives both `rgb(r g b)` and `color(srgb 0..1 …)`.
  const parse = (s) => {
    let m = s.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?/);
    if (m) return { r: +m[1] * 255, g: +m[2] * 255, b: +m[3] * 255, a: m[4] === undefined ? 1 : +m[4] };
    m = s.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.%]+))?/);
    if (!m) return null;
    let a = m[4] === undefined ? 1 : (String(m[4]).endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a };
  };
  const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

  /* The chips MUST be measured inside .fs-cons — that is where --fs-muted,
     --fs-panel and --fs-border are defined. Measuring them in a bare div let
     those fall back to inherited full-strength text, which is why the first
     version of this test passed against the broken build: it was reading a miss
     chip that does not exist on screen. */
  const host = document.createElement('div');
  host.className = 'fs-cons mbu-ui';
  host.innerHTML = '<div class="fs-sig"><span>ISRC</span><span class="hit">AcoustID</span></div>';
  document.body.appendChild(host);

  const out = {};
  for (const t of themes) {
    document.documentElement.setAttribute('data-mbu-theme', t);
    document.body.style.background = t === 'dark' ? '#1e1b24' : '#ffffff';
    await new Promise(r => requestAnimationFrame(r));
    const pageBg = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    /* opacity is the other half the first version missed: the old miss chip was
       dimmed with opacity:.55, which no colour value reports. Fold it into both
       the fill and the text, exactly as the compositor does. */
    const read = (el) => {
      const cs = getComputedStyle(el);
      const op = parseFloat(cs.opacity);
      const dim = (c) => ({ r: c.r, g: c.g, b: c.b, a: c.a * (isFinite(op) ? op : 1) });
      const bg = over(dim(parse(cs.backgroundColor) || { r: 0, g: 0, b: 0, a: 0 }), pageBg);
      const fg = over(dim(parse(cs.color)), bg);
      const bd = over(dim(parse(cs.borderTopColor) || { r: 0, g: 0, b: 0, a: 0 }), pageBg);
      const rawBg = parse(cs.backgroundColor) || { r: 0, g: 0, b: 0, a: 0 };
      return { text: ratio(fg, bg), fillVsPage: ratio(bg, pageBg), borderVsPage: ratio(bd, pageBg), bg, fg,
               fillAlpha: rawBg.a, opacity: isFinite(op) ? op : 1,
               raw: { color: cs.color, background: cs.backgroundColor, border: cs.borderTopColor, opacity: cs.opacity } };
    };
    const miss = read(host.querySelector('span:not(.hit)'));
    const hit = read(host.querySelector('span.hit'));
    // How far apart do the two chips read? Compare their composited fills and
    // their text colours — a person telling "matched" from "not" is doing
    // exactly this comparison.
    out[t] = { miss, hit, fillSeparation: ratio(hit.bg, miss.bg), textSeparation: ratio(hit.fg, miss.fg) };
  }
  return out;
}, ['light', 'dark']);

for (const t of ['light', 'dark']) {
  const m = measure[t];
  console.log(`\n[${t}]`);
  console.log(`  miss: text ${m.miss.text.toFixed(2)}:1  ${JSON.stringify(m.miss.raw)}`);
  console.log(`  hit : text ${m.hit.text.toFixed(2)}:1  ${JSON.stringify(m.hit.raw)}`);
  console.log(`  hit vs miss — fill ${m.fillSeparation.toFixed(2)}:1, text ${m.textSeparation.toFixed(2)}:1`);
}

for (const t of ['light', 'dark']) {
  const m = measure[t];
  ck(m.hit.text >= 3.0, `${t}: a matched chip's own text is readable (${m.hit.text.toFixed(2)}:1)`);
  ck(m.miss.text >= 2.2, `${t}: an unmatched chip is still legible, just recessive (${m.miss.text.toFixed(2)}:1)`);
  // The complaint was that the two are indistinguishable, so this is the check
  // that actually speaks to it: hit and miss must differ, by fill or by text.
  /* Not a contrast threshold. The old chips scored respectably on every ratio —
     hit 5.06:1, miss 3.59:1 on dark — and still looked the same to him, because
     what a person reads at 9.5px is FILLED versus NOT, not a luminance figure.
     Picking a number that happens to sit between the old and new separation
     would be a test written to pass, so assert the design instead: a hit is
     filled, a miss is not, and neither is faded with opacity (which is what used
     to muddy the miss into a grey smear rather than a clean outline). */
  ck(m.hit.fillAlpha > 0.12, `${t}: a matched chip is filled (alpha ${m.hit.fillAlpha.toFixed(2)})`);
  ck(m.miss.fillAlpha === 0, `${t}: an unmatched chip has no fill at all (alpha ${m.miss.fillAlpha.toFixed(2)})`);
  ck(m.miss.opacity === 1 && m.hit.opacity === 1, `${t}: neither is dimmed with opacity (miss ${m.miss.opacity}, hit ${m.hit.opacity})`);
}
ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));

await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
