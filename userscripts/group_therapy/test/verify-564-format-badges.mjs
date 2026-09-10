// #564 (majkinetor): "Format icons are not visible clearly in both themes", with
// a screenshot of each.
//
// The badge background is the format's identity colour — vinyl near-black, CD
// mid-grey, digital blue — while the label was always var(--mbu-text-on-accent),
// i.e. white. A fixed foreground over a fixed palette has to fail somewhere:
// white on the CD grey is ~2.6:1 in either theme, and the near-black vinyl badge
// vanishes into a dark page.
//
// The label now picks itself from the background it sits on — whichever of black
// or white has more contrast — and the badge carries a hairline so its SHAPE is
// findable even when the fill is close to the page.
//
// Every badge is measured in both themes rather than the one he happened to
// screenshot; the point of deriving the colour is that it holds for all of them.
//
// This cannot be run against the pre-fix build — that build does not export
// fmtBadges, the export came in with the fix. What the old code produced is
// exact arithmetic on the same palette, since the label was unconditionally
// white:
//
//   badge   old (#fff)   new (derived)
//   LP       10.60:1      10.60:1  (#fff — unchanged)
//   CD        3.61:1       5.82:1  (#000)
//   D         3.34:1       6.28:1  (#000)
//   MC        4.62:1       4.62:1  (#fff — unchanged)
//
// So two of the four were below 4.5:1 in BOTH themes, which is the half of his
// report about the white theme. The other half — the near-black LP badge lost
// against a dark page — is the fill-vs-page column, and is what the hairline
// border addresses: its fill separates from a dark page by only 1.60:1.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.GT_SRC || resolve(HERE, '..', 'group_therapy.user.js');
const code = await readFile(SRC, 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 900, height: 400 }, deviceScaleFactor: 3 });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Group Therapy', version: 't' } };
  window.GM_xmlhttpRequest = () => {};
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
/* A catch-all route — `page.route(() => true, …)` — breaks navigation on
   production MusicBrainz outright: the page comes back as chrome-error and the
   script never installs. That is true with fallback() as well as continue(), so
   it is the interception itself, not the verb. Route only the write endpoints,
   which leaves navigation untouched. Nothing here clicks anything, so this is a
   belt on top of braces. */
const posted = [];
await page.route(/\/ws\/js\/edit\/|\/relationship-editor|\/edit\/create/i, r => { posted.push(r.request().url()); return r.abort(); });
// Group Therapy boots only on the relationship editor — on any other page the
// script installs nothing, and an earlier version of this test measured four
// unstyled placeholders and reported 1.00:1 for everything.
const REL = process.env.GT_RELEASE || 'c90f753a-52ce-4844-b62f-e685712b256f';
await page.goto(`https://musicbrainz.org/release/${REL}/edit-relationships`, { waitUntil: 'domcontentloaded' }).catch(() => {});
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!(window.__groupTherapy && window.__groupTherapy.fmtBadges), null, { timeout: 30000 });
await page.waitForTimeout(800);

const out = await page.evaluate(async (themes) => {
  const parse = s => {
    let m = s.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if (m) return { r: +m[1] * 255, g: +m[2] * 255, b: +m[3] * 255 };
    m = s.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
  };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

  // Build the badges through the script's own renderer, not by hand — the whole
  // point is what fmtBadges produces.
  const host = document.createElement('div');
  host.className = 'gt-cons mbu-ui';
  host.style.cssText = 'padding:14px;display:flex;gap:10px;align-items:center';
  document.body.insertBefore(host, document.body.firstChild);
  const FORMATS = ['12" Vinyl', 'CD', 'Digital Media', 'Cassette'];
  const res = {};
  for (const t of themes) {
    document.documentElement.setAttribute('data-mbu-theme', t);
    document.body.style.background = t === 'dark' ? '#1e1b24' : '#ffffff';
    host.innerHTML = '';
    for (const f of FORMATS) host.appendChild(window.__groupTherapy.fmtBadges(f));
    await new Promise(r => requestAnimationFrame(r));
    const pageBg = parse(getComputedStyle(document.body).backgroundColor);
    res[t] = [...host.querySelectorAll('.gt-fmt-b')].map(b => {
      const cs = getComputedStyle(b);
      const bg = parse(cs.backgroundColor), fg = parse(cs.color), bd = parse(cs.borderTopColor);
      return { label: b.textContent, bg: cs.backgroundColor, fg: cs.color,
               label_vs_fill: bg && fg ? ratio(fg, bg) : null,
               fill_vs_page: bg && pageBg ? ratio(bg, pageBg) : null,
               border_vs_page: bd && pageBg ? ratio(bd, pageBg) : null };
    });
  }
  return res;
}, ['light', 'dark']);

for (const t of ['light', 'dark']) {
  console.log(`\n[${t}]`);
  for (const b of out[t]) {
    console.log(`  ${String(b.label).padEnd(3)} ${b.fg} on ${b.bg}  label ${b.label_vs_fill ? b.label_vs_fill.toFixed(2) : '?'}:1` +
                `  fill-vs-page ${b.fill_vs_page ? b.fill_vs_page.toFixed(2) : '?'}:1  border-vs-page ${b.border_vs_page ? b.border_vs_page.toFixed(2) : '?'}:1`);
  }
}

for (const t of ['light', 'dark']) {
  const badges = out[t];
  ck(badges.length >= 3, `${t}: fixture rendered the badges (${badges.length})`);
  const worst = badges.reduce((w, b) => Math.min(w, b.label_vs_fill || 0), Infinity);
  ck(worst >= 4.5, `${t}: every label reads on its own badge — worst ${worst === Infinity ? 'n/a' : worst.toFixed(2)}:1`);
  // A badge whose fill is close to the page needs its outline to find its edge.
  const findable = badges.every(b => (b.fill_vs_page || 0) >= 1.4 || (b.border_vs_page || 0) >= 1.4);
  ck(findable, `${t}: every badge is findable — either its fill or its border separates it from the page`);
}
ck(posted.length === 0, `no write endpoint was called (${posted.length})`);
ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));

await page.locator('.gt-cons').screenshot({ path: resolve(HERE, 'logs', 'i564-fmt-badges.png') }).catch(() => {});
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
