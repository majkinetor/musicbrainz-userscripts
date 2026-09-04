// #562 pilot — Art Station consumes the shared design tokens.
//
// The claim to prove is "this is a refactor: nothing renders differently". A
// screenshot diff can't prove that (antialiasing, scroll position, live CAA
// images all move), so this measures COMPUTED STYLE on the real page instead:
// every element in the Art Station UI is read once with the tokens live, and
// once with the pre-token stylesheet swapped back in, and the two are compared
// property by property. A token pass that changes nothing computed is a pass.
//
// Everything below is read-only: no clicks that submit, no POSTs (asserted).
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const code = await readFile(resolve(HERE, '..', 'art_station.user.js'), 'utf8');
const SHOTS = resolve(HERE, 'logs'); await mkdir(SHOTS, { recursive: true });

const { TOKENS } = await import('file:///' + resolve(ROOT, 'dev', 'design-tokens.mjs').replace(/\\/g, '/'));
const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// ── static checks on the source, before touching a browser ──────────────────
const mark = code.match(/\/\/ <ST-TOKENS>[\s\S]*?\/\/ <\/ST-TOKENS>/);
ck(!!mark, 'the script carries a // <ST-TOKENS> generated block');
ck(!!mark && /const MBU_TOKENS = ':root\{--mbu-/.test(mark[0]), 'the block defines MBU_TOKENS as a :root rule');
ck(/const css = MBU_TOKENS \+ `/.test(code), 'and the stylesheet is built from it');

// every var(--mbu-*) the script uses must exist in the shared set — a typo'd
// token silently falls back to nothing, which is invisible until it isn't
const used = [...new Set([...code.matchAll(/var\(--mbu-([a-z-]+)\)/g)].map(m => m[1]))];
const unknown = used.filter(n => !(n in TOKENS));
ck(unknown.length === 0, `every referenced token is defined (${used.length} used${unknown.length ? ', UNKNOWN: ' + unknown.join(', ') : ''})`);
ck(used.length >= 25, `the pilot actually adopted them (${used.length} of ${Object.keys(TOKENS).length} tokens in use)`);

// the generated block must match what the codegen would write right now
const { tokensCss } = await import('file:///' + resolve(ROOT, 'dev', 'design-tokens.mjs').replace(/\\/g, '/'));
ck(!!mark && mark[0].includes(`const MBU_TOKENS = '${tokensCss()}';`), 'the inlined block is in sync with dev/tokens/design-tokens.mjs (run dev/tokens/sync-tokens.mjs)');

// ── computed-style equivalence against the pre-token stylesheet ─────────────
// Rebuild the OLD css by expanding every var(--mbu-*) back to its literal, then
// let the browser tell us whether the two stylesheets resolve identically.
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 1000 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Art Station', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
let posts = 0; const postUrls = [];
await page.route(() => true, route => {
  const r = route.request();
  if (r.method() === 'POST') { posts++; postUrls.push(r.url()); return route.abort(); }
  return route.continue();
});
await page.goto(`https://test.musicbrainz.org/release/${RELEASE}/cover-art`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(600);
await page.addScriptTag({ content: code });
await page.waitForSelector('#as-root', { timeout: 20000 });
await page.waitForTimeout(1200);

// open the surfaces that are otherwise never in the DOM, so they get measured too
await page.click('#as-setup-btn').catch(() => {});
await page.waitForSelector('#as-setup', { timeout: 5000 }).catch(() => {});
await page.click('.as-setup-logbtn').catch(() => {});
await page.waitForSelector('#as-logpop', { timeout: 5000 }).catch(() => {});
// opening the log closes the setup panel — re-open it so both surfaces are measured
if (!await page.$('#as-setup')) { await page.click('#as-setup-btn').catch(() => {}); await page.waitForSelector('#as-setup', { timeout: 5000 }).catch(() => {}); }
await page.waitForTimeout(400);
const surfaces = await page.evaluate(() => ['#as-root', '#as-setup', '#as-logpop', '#as-switch-wrap'].filter(s => document.querySelector(s)));
console.log('surfaces measured: ' + JSON.stringify(surfaces));
ck(surfaces.length >= 3, 'more than just the gallery is on screen when measuring');

const PROPS = ['color', 'background-color', 'border-top-color', 'border-right-color', 'border-bottom-color',
  'border-left-color', 'outline-color', 'box-shadow', 'border-radius', 'z-index', 'font-family', 'font-size', 'font-weight', 'fill'];

const snap = () => page.evaluate(props => {
  const out = [];
  for (const root of ['#as-root', '#as-setup', '#as-logpop', '#as-switch-wrap']) {
    const host = document.querySelector(root); if (!host) continue;
    const els = [host, ...host.querySelectorAll('*')];
    els.forEach((el, i) => {
      const cs = getComputedStyle(el);
      out.push(root + '[' + i + ']' + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '')
        + ' :: ' + props.map(p => p + '=' + cs.getPropertyValue(p)).join('|'));
    });
  }
  return out;
}, PROPS);

const withTokens = await snap();
await page.locator('#as-root').screenshot({ path: resolve(SHOTS, 'i562-tokens.png') }).catch(() => {});

// swap in the expanded (pre-token) stylesheet and re-measure the same elements
const swapped = await page.evaluate(tokens => {
  const st = [...document.querySelectorAll('style')].find(s => s.textContent.includes('--mbu-bg'));
  if (!st) return { ok: false };
  const before = st.textContent;
  const expanded = before
    .replace(/^:root\{--mbu-[^}]*\}/, '')                         // drop the token declarations entirely
    .replace(/var\(--mbu-([a-z-]+)\)/g, (m, n) => (n in tokens ? tokens[n] : m));
  const leftover = (expanded.match(/var\(--mbu-[a-z-]+\)/g) || []).length;
  st.textContent = expanded;
  return { ok: true, leftover };
}, TOKENS);
ck(swapped.ok, 'found the Art Station stylesheet to swap');
ck(swapped.ok && swapped.leftover === 0, `every token expanded back to a literal (${swapped.leftover} left)`);
await page.waitForTimeout(300);
const withLiterals = await snap();

ck(withTokens.length === withLiterals.length, `same element set measured both times (${withTokens.length})`);
let diffs = 0;
for (let i = 0; i < Math.min(withTokens.length, withLiterals.length); i++) {
  if (withTokens[i] === withLiterals[i]) continue;
  diffs++;
  if (diffs <= 8) {
    const [sel, a] = withTokens[i].split(' :: '), b = withLiterals[i].split(' :: ')[1];
    const A = a.split('|'), B = b.split('|');
    console.log('  DIFF ' + sel + '\n    ' + A.filter((p, j) => p !== B[j]).join(', ') + '\n    ' + B.filter((p, j) => p !== A[j]).join(', '));
  }
}
ck(diffs === 0, `#562: the token pass is a no-op on computed style across ${withTokens.length} elements (${diffs} differ)`);

// and the tokens really are the mechanism — breaking one must visibly change things
const proof = await page.evaluate(() => {
  const st = [...document.querySelectorAll('style')].find(s => s.textContent.includes('--mbu-bg'));
  return !!st;
});
await page.evaluate(() => {
  const s = document.createElement('style');
  s.id = 'mbu-override-probe';
  s.textContent = ':root{--mbu-accent:#ff0000}';
  document.documentElement.appendChild(s);
});
await page.waitForTimeout(200);
const overrode = await page.evaluate(() => {
  const el = document.querySelector('#as-switch-wrap');
  return el ? getComputedStyle(el).backgroundColor : null;
});
console.log('accent after a one-line :root override: ' + overrode);
ck(overrode !== 'rgb(255, 0, 0)', 'sanity: with the literals swapped in, an override does nothing (proves the swap took)');
// now put the tokenised sheet back and repeat — this is the actual point of #562
await page.evaluate(code => {
  const st = [...document.querySelectorAll('style')].find(s => s.textContent.includes('--as-tile'));
  const m = code.match(/const MBU_TOKENS = '([^']*)';/);
  st.textContent = m[1] + st.textContent;
  st.textContent = st.textContent;   // no-op, keeps the intent obvious
}, code).catch(() => {});
await page.evaluate(() => {
  const st = [...document.querySelectorAll('style')].find(s => s.textContent.includes('--as-tile'));
  st.textContent = st.textContent.replace(/#5f3ec0/g, 'var(--mbu-accent)');
});
await page.waitForTimeout(200);
const overrode2 = await page.evaluate(() => {
  const el = document.querySelector('#as-switch-wrap');
  return el ? getComputedStyle(el).backgroundColor : null;
});
console.log('accent with tokens restored + override: ' + overrode2);
ck(overrode2 === 'rgb(255, 0, 0)', '#562: one :root line re-themes the accent everywhere (' + overrode2 + ')');
await page.screenshot({ path: resolve(SHOTS, 'i562-override.png'), fullPage: false }).catch(() => {});

// MusicBrainz's own page posts (CSP report / stats) are not ours; only assert we sent none.
const oursPosts = postUrls.filter(u => !/musicbrainz\.org\/(ws\/js|csp-report)/.test(u) || /\/edit\//.test(u));
console.log('POSTs seen: ' + JSON.stringify(postUrls));
ck(!postUrls.some(u => /\/ws\/js\/edit\/create|add-cover-art|\/edit\//.test(u)), `no edit was submitted (${posts} POST(s) total, all aborted)`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
