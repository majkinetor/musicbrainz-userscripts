// #564 (majkinetor): "Apollo tracklist in white theme doesn't have edit
// background and in dark has them black which doesn't look good. They should be
// transparent as in white theme."
//
// Measures, rather than reasons about, the computed background of every input in
// the tracklist mirror under kellnerd's real "Dark Side of MusicBrainz" —
// the userstyle the rest of the theme harness already tests against.
//
// Run: node test/verify-564-tracklist-bg.mjs           (dark userstyle)
//      node test/verify-564-tracklist-bg.mjs --light   (no userstyle)
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const SEED_PATH = resolve(HERE, 'seed-saigon.local.json');
const ORIGIN = process.env.TC_ORIGIN || 'https://test.musicbrainz.org';
const STYLE_URL = 'https://raw.githubusercontent.com/kellnerd/userstyles/main/musicbrainz-dark.user.css';
const DARK = !process.argv.includes('--light');
const SHOT = process.argv.includes('--shot');

const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
// Fetched, not vendored: a stale copy would test a userstyle nobody runs.
const rawStyle = await (await fetch(STYLE_URL)).text();
// It ships as a UserCSS @-moz-document wrapper; take the body so it applies here.
const css = rawStyle.replace(/^[\s\S]*?@-moz-document[^{]*\{/, '').replace(/\}\s*$/, '');

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !process.argv.includes('--headed'), viewport: { width: 1700, height: 1100 }, deviceScaleFactor: 2 });
const page = ctx.pages()[0] || await ctx.newPage();
// The seed reaches the editor by POSTing to /release/add, which only RENDERS a
// prefilled editor. Any POST that would create an edit is blocked outright.
await page.route(() => true, r => {
  const req = r.request();
  if (req.method() === 'POST' && /\/ws\/js\/edit\//.test(req.url())) return r.abort();
  return r.continue();
});

await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.error('not logged in'); await ctx.close(); process.exit(3); }
await page.evaluate(() => localStorage.setItem('trackCannon.settings.v1', JSON.stringify({ replace: true, autoRun: false })));
await page.evaluate(({ origin, params }) => {
  const f = document.createElement('form'); f.method = 'POST'; f.action = origin + '/release/add'; f.style.display = 'none';
  const add = (n, v) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = n; i.value = v; f.appendChild(i); };
  for (const [k, v] of Object.entries(params)) Array.isArray(v) ? v.forEach(x => add(k, x)) : add(k, v);
  document.body.appendChild(f); f.submit();
}, { origin: ORIGIN, params: seed });
await page.waitForLoadState('domcontentloaded');
if (await page.locator('h1', { hasText: /Confirm form submission/i }).count().catch(() => 0)) {
  await page.locator('button[type=submit]', { hasText: /Continue/i }).first().click();
  await page.waitForLoadState('domcontentloaded');
}
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length; } catch { return false; } }, null, { timeout: 120000 });

if (DARK) await page.addStyleTag({ content: css });
await page.addScriptTag({ content: scriptCode });
// The mirror lives in the release editor's Tracklist tab, which is not the
// active one on load — jQuery UI keeps inactive panels display:none, and a bare
// .click() on the tab link does not trigger its handler.
await page.evaluate(() => {
  const nav = document.querySelector('#release-editor .ui-tabs-nav, #release-editor ul.ui-tabs-nav');
  const a = nav && [...nav.querySelectorAll('a')].find(x => (x.getAttribute('href') || '').includes('tracklist'));
  if (a) a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
});
await page.waitForSelector('.tc-mirror', { state: 'visible', timeout: 60000 });
await page.waitForTimeout(2500);

const report = await page.evaluate(() => {
  const seen = new Map();
  const rgb = el => getComputedStyle(el).backgroundColor;
  for (const el of document.querySelectorAll('.tc-mirror input')) {
    const key = el.className || '(no class)';
    if (!seen.has(key)) seen.set(key, { cls: key, type: el.getAttribute('type'), bg: rgb(el), n: 0 });
    seen.get(key).n++;
  }
  const row = document.querySelector('.tc-mirror tbody tr');
  return {
    theme: document.documentElement.getAttribute('data-mbu-theme'),
    rowBg: row ? rgb(row) : null,
    inputs: [...seen.values()],
  };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const USERSTYLE_DIMMED = 'rgb(34, 34, 34)';   // --background-dimmed, what it used to paint them

console.log('theme        : ' + report.theme);
console.log('row background: ' + report.rowBg);
console.log('mirror inputs:');
for (const i of report.inputs) {
  const opaque = i.bg !== 'rgba(0, 0, 0, 0)' && i.bg !== 'transparent';
  console.log(`  ${(i.cls).padEnd(28)} type=${String(i.type).padEnd(6)} n=${String(i.n).padEnd(3)} ${i.bg}${opaque ? '   <-- OPAQUE' : ''}`);
}
// A field with no state class carries no meaning of its own, so it must show the
// row through it — that is the whole of #564. A field that DOES carry a state
// (diff / preview / pending) has to keep its own fill, which is what an
// !important base rule would have quietly destroyed.
const plain = report.inputs.filter(i => !/diff|gcpreview|hasfeat|pending|can-split/.test(i.cls));
const stateful = report.inputs.filter(i => /diff|gcpreview|hasfeat|pending|can-split/.test(i.cls));
ck(plain.length > 0 && plain.every(i => i.bg === TRANSPARENT),
   `every plain tracklist input is transparent (${plain.filter(i => i.bg !== TRANSPARENT).map(i => i.cls + '=' + i.bg).join(', ') || 'all ' + plain.length})`);
ck(plain.every(i => i.bg !== USERSTYLE_DIMMED), 'none of them is painted by the userstyle any more');
if (stateful.length) {
  ck(stateful.every(i => i.bg !== TRANSPARENT && i.bg !== USERSTYLE_DIMMED),
     `state fills survive and are still their own colour (${stateful.map(i => i.cls.split(' ').pop() + '=' + i.bg).join(', ')})`);
} else {
  console.log('note: this seed produced no diff/preview rows, so state fills were not exercised');
}

if (SHOT) {
  const mirror = await page.$('.tc-mirror');
  const b = await mirror.boundingBox();
  await page.screenshot({ path: resolve(HERE, `_564-${DARK ? 'dark' : 'light'}.png`), clip: { x: b.x, y: b.y, width: Math.min(b.width, 1650), height: Math.min(b.height, 320) } });
  console.log('shot written');
}
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
