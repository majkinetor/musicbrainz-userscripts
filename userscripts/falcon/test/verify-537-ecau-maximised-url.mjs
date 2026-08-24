// #537 follow-up (chaban-mb): "The problem stems from the maximised image URL
// not being available, right? A case could be made to modify ECAU so it
// replaces the image link to the maximised version or adding data attributes."
//
// Right — and Falcon can read either shape without owning a single per-provider
// rule, which is the part that was ruled out. This uses chaban's own three
// markup samples verbatim:
//
//   1. no scripts        — <a href> is the 1280 image
//   2. vanilla ECAU      — same href, plus a "3000×3000" caption describing an
//                          image whose URL appears nowhere in the DOM
//   3. modified ECAU     — either the href IS the maximised url, or the anchor
//                          carries data-maximised-url
//
// Falcon must keep today's behaviour for 1 and 2, and prefer the maximised URL
// for 3. Nothing is fetched or submitted: this is DOM reading only.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

const REL = 'a6177137-9a26-4b34-b42d-2ae333066704';
const BASE = 'https://resources.tidal.com/images/3d3b10bb/b6c4/4f2a/9956/6781dce540ac';
const LINKED = `${BASE}/1280x1280.jpg`;
const MAXED = `${BASE}/origin.jpg`;
const CAPTION = '<span class="label">3000×3000, 3.53 MB, JPEG</span>';

const figure = (anchorAttrs, href, caption) => `
  <figure class="cover-image" data-provider="Tidal">
    <a href="${href}"${anchorAttrs}><img src="${BASE}/320x320.jpg" alt="front" title="front"></a>
    <figcaption><span class="label" data-fresh-key="front">Type: front</span>
      <span class="label">Source: Tidal</span>${caption || ''}</figcaption>
  </figure>`;
const pageFor = fig => `<!doctype html><meta charset="utf-8"><title>fake Harmony</title><body>
  <a href="https://musicbrainz.org/release/${REL}">Open in MusicBrainz</a>${fig}</body>`;

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const ctx = await chromium.launch({ headless: true });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR ' + e.message));

const scrapeWith = async (fig) => {
  await page.route('https://harmony.pulsewidth.org.uk/release/actions*', route =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pageFor(fig) }));
  await page.goto('https://harmony.pulsewidth.org.uk/release/actions?x=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.addScriptTag({ content: `window.GM_getValue=(k,d)=>d;window.GM_setValue=()=>{};window.GM_info={script:{name:'Falcon',version:'t'}};\n` + code });
  await page.waitForTimeout(300);
  const out = await page.evaluate(() => window.__falconTest.scrapeHarmonyCover());
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  return out;
};

// 1. no scripts at all
const plain = await scrapeWith(figure('', LINKED, ''));
console.log('no scripts        → ' + JSON.stringify(plain.coverCandidates[0]));
ck(plain.coverCandidates[0].url === LINKED, 'without ECAU, the anchor href is used (unchanged)');
ck(plain.coverCandidates[0].width === undefined, 'and there is no caption to read a size from');

// 2. vanilla ECAU — caption present, url still the smaller one
const vanilla = await scrapeWith(figure('', LINKED, CAPTION));
console.log('vanilla ECAU      → ' + JSON.stringify(vanilla.coverCandidates[0]));
ck(vanilla.coverCandidates[0].url === LINKED, 'with vanilla ECAU the href is still all there is, so it is still used');
ck(vanilla.coverCandidates[0].width === 3000, 'the caption is read — and describes an image the DOM does not link (the whole problem)');

// 3a. modified ECAU: href replaced
const replaced = await scrapeWith(figure('', MAXED, CAPTION));
console.log('ECAU href swapped → ' + JSON.stringify(replaced.coverCandidates[0]));
ck(replaced.coverCandidates[0].url === MAXED, 'if ECAU swaps the href, Falcon needs no change at all');
ck(replaced.coverCandidates[0].width === 3000, 'and now the caption and the url finally describe the same image');

// 3b. modified ECAU: data attribute
for (const attr of ['data-maximised-url', 'data-maximized-url']) {
  const tagged = await scrapeWith(figure(` ${attr}="${MAXED}"`, LINKED, CAPTION));
  console.log(`ECAU ${attr} → ` + JSON.stringify(tagged.coverCandidates[0]));
  ck(tagged.coverCandidates[0].url === MAXED, `${attr} is preferred over the href`);
}

// a junk attribute must not hijack the candidate
const junk = await scrapeWith(figure(' data-maximised-url="not-a-url"', LINKED, CAPTION));
console.log('junk attribute    → ' + JSON.stringify(junk.coverCandidates[0]));
ck(junk.coverCandidates[0].url === LINKED, 'a non-http attribute is ignored rather than trusted');

await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
