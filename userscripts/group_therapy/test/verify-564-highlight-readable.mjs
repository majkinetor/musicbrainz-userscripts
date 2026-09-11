// #564 (majkinetor, white theme): "GT highlight, blue text in tooltip hardly
// visible and black on blue name highlight".
//
// Two separate things, both in the hover layer:
//
//   1. ::highlight() painted a solid blue background but its foreground was
//      `color: var(--mbu-text-on-accent)`. His screenshots show the background
//      applied and the text NOT recoloured — the role label stayed black, the
//      artist links stayed link-blue, both on blue. A literal background working
//      while a var() foreground doesn't is the signature of custom properties
//      not resolving inside the highlight pseudo-element.
//   2. the hover tooltip's second line was `color: var(--mbu-info)` on a fixed
//      dark pill. In the light theme --mbu-info is a mid blue mixed toward dark
//      text, so it sits on #1b2430 at barely any contrast.
//
// ::highlight() styling cannot be read back with getComputedStyle — it isn't on
// any element — so this measures PIXELS: render the rule, screenshot, and
// compare the glyph colour against the background it is painted on.
//
// Run in BOTH engines. He is on Firefox, and the whole point is that a rule can
// work in one and silently drop in the other; a Chromium-only check would have
// told me the code was fine.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium, firefox } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.GT_SRC || resolve(HERE, '..', 'group_therapy.user.js');
const code = await readFile(SRC, 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// the shipped rules, pulled out of the script so this guards what actually ships
const hlRules = (code.match(/^\s*::highlight\(gt-hl-[a-z]+\)\{[^}]*\}/gm) || []).map(s => s.trim().replace(/^'|',?$/g, ''));
/* The .gt-tip rules sit in a template literal and the first one WRAPS across two
   lines. Anchored at line start on purpose: an unanchored match also caught the
   `.gt-tip` inside a JS selector STRING and swallowed code into the stylesheet,
   which broke the rules after it — the tooltip was then measured against a plain
   white page and reported a meaningless 18:1 "pass". */
const tipRules = (code.match(/^\s*\.gt-tip[\w .-]*\{[^}]*\}/gm) || []).map(x => x.trim());
console.log('highlight rules found:\n  ' + hlRules.join('\n  '));
ck(hlRules.length === 2, `both ::highlight rules were found in the source (${hlRules.length})`);
// The tokens the page would have, so a var() reference COULD resolve if the
// engine supports it there.
const tokens = (code.match(/const MBU_TOKENS = '([^']*)'/) || [])[1] || '';
ck(!!tokens, 'the design tokens were found');

const PAGE = `<!doctype html><meta charset="utf-8">
<style>${tokens}</style>
<style>
  body{background:#fff;color:#111;font:700 44px/1.25 Arial,sans-serif;margin:0;padding:0}
  /* MusicBrainz paints its relationship links blue; that is the colour that was
     showing through on his blue highlight, so reproduce it. */
  #a{display:inline-block;padding:6px 8px}
  #a b{color:#000}
  #a a{color:#1e5ecc;text-decoration:none}
  ${hlRules.join('\n  ')}
  ${tipRules.join('\n  ')}
</style>
<div id="a"><b>guitar</b> <a href="#">Sky Saxon</a></div>
<div class="gt-tip" id="t" style="position:static;display:inline-block"><div class="gt-tip-name">Saxon, Sky</div><div class="gt-tip-stat">8x - track B5 - release</div></div>
<script>
  const host = document.getElementById('a');
  const ranges = [];
  for (const n of [host.querySelector('b').firstChild, host.querySelector('a').firstChild]) {
    const r = document.createRange(); r.setStart(n, 0); r.setEnd(n, n.nodeValue.length); ranges.push(r);
  }
  if (window.CSS && CSS.highlights && typeof Highlight !== 'undefined') {
    CSS.highlights.set('gt-hl-existing', new Highlight(ranges[0]));
    CSS.highlights.set('gt-hl-new', new Highlight(ranges[1]));
    window.__hlOk = true;
  } else { window.__hlOk = false; }
</script>`;

const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

// Decode the screenshot by drawing it on a canvas in a throwaway page — no
// image-decoding dependency needed.
async function pixels(browser, png) {
  const p = await browser.newPage();
  await p.setContent('<canvas id="c"></canvas>');
  const out = await p.evaluate(async (b64) => {
    const img = new Image();
    await new Promise(res => { img.onload = res; img.src = 'data:image/png;base64,' + b64; });
    const c = document.getElementById('c'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const out = [];
    for (let i = 0; i < d.length; i += 4) out.push([d[i], d[i + 1], d[i + 2]]);
    return out;
  }, png.toString('base64'));
  await p.close();
  return out;
}

/* Two dominant colours: the highlight's background and the glyph core. Taking
   the pixel FURTHEST in luminance instead — the obvious approach, and the first
   one tried — picks up the white page bleeding in at the edge of the box, which
   reported a comfortable white-on-blue for a rule that was actually painting
   brown on blue. Text is rendered large so the glyph core outnumbers the
   antialiased fringe. */
function readMark(px) {
  const counts = new Map();
  for (const c of px) { const k = c.join(','); counts.set(k, (counts.get(k) || 0) + 1); }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ c: k.split(',').map(Number), n }));
  const bg = top[0].c;
  // the next most common colour that is not a near-neighbour of the background
  const far = top.find(t => t.c.some((v, i) => Math.abs(v - bg[i]) > 24)) || top[1] || top[0];
  return { bg, glyph: far.c, share: (far.n / px.length), ratio: contrast(bg, far.c) };
}

for (const [name, engine] of [['chromium', chromium], ['firefox', firefox]]) {
  const browser = await engine.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 600, height: 200 }, deviceScaleFactor: 2 });
  await page.setContent(PAGE);
  await page.waitForTimeout(400);
  const supported = await page.evaluate(() => window.__hlOk);
  console.log(`\n[${name}] CSS Custom Highlight API supported: ${supported}`);
  if (!supported) { console.log(`  skipped — this engine cannot show the highlight at all`); await browser.close(); continue; }

  const marks = {
    existing: readMark(await pixels(browser, await page.locator('#a b').screenshot())),
    new: readMark(await pixels(browser, await page.locator('#a a').screenshot())),
    tip: readMark(await pixels(browser, await page.locator('#t .gt-tip-stat').screenshot())),
  };
  for (const [k, m] of Object.entries(marks)) {
    console.log(`  ${k.padEnd(9)} glyph rgb(${m.glyph}) (${(m.share * 100).toFixed(1)}% of box) on rgb(${m.bg}) → ${m.ratio.toFixed(2)}:1`);
  }
  ck(marks.existing.ratio >= 4.5, `${name}: an existing-row match is readable on its highlight (${marks.existing.ratio.toFixed(2)}:1)`);
  ck(marks.new.ratio >= 4.5, `${name}: a new-row match is readable on its highlight (${marks.new.ratio.toFixed(2)}:1)`);
  ck(marks.tip.ratio >= 4.5, `${name}: the tooltip's stat line is readable on the tooltip (${marks.tip.ratio.toFixed(2)}:1)`);
  // the two highlights must still be telling apart from each other
  ck(marks.existing.bg.join() !== marks.new.bg.join(),
    `${name}: existing and new rows are still distinguishable (${marks.existing.bg} vs ${marks.new.bg})`);
  await browser.close();
}

console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
