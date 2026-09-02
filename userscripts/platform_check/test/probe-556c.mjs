// #556 follow-up (chaban-mb's log): three URLs queued, only the FIRST landed.
// Drive the real inject path against three URLs on the sandbox release editor
// and watch what happens to the "Add another link" input between iterations.
//
// Sandbox only (test.musicbrainz.org) and the submit button is never touched —
// every POST is aborted at the network layer and asserted.
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'platform_check.user.js'), 'utf8');
const SHOTS = resolve(HERE, 'logs'); await mkdir(SHOTS, { recursive: true });

const RELEASE = process.env.PC_RELEASE || '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
// three providers, in the same shape as chaban's queue (deezer first, then two more)
const PENDING = {
  deezer: 'https://www.deezer.com/album/978648191',
  tidal: 'https://tidal.com/album/522735526',
  qobuz: 'https://www.qobuz.com/us-en/album/as-oneself-arkta-/uqj72odvp0ofm',
};

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 1100 } });
await ctx.addInitScript(([mbid, pending]) => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Platform Check', version: 't' } };
  try { localStorage.setItem('pc:pending:' + mbid, JSON.stringify(pending)); } catch (e) {}
  // Trace what the add-link input does across iterations: identity, connectedness,
  // and value. This is the thing the theory is about.
  window.__trace = [];
  const t = (what, extra) => window.__trace.push(Object.assign({ t: Date.now(), what }, extra || {}));
  window.__t = t;
}, [RELEASE, PENDING]);

const page = ctx.pages()[0] || await ctx.newPage();
const logs = [];
page.on('console', m => { const s = m.text(); if (/Platform Check/.test(s)) logs.push(m.type() + ': ' + s); });
page.on('pageerror', e => logs.push('pageerror: ' + e.message));
let posts = 0; const postUrls = [];
await page.route(() => true, route => {
  const r = route.request();
  if (r.method() === 'POST') { posts++; postUrls.push(r.url()); return route.abort(); }
  return route.continue();
});

await page.goto(`https://test.musicbrainz.org/release/${RELEASE}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN — see reference_test_musicbrainz_instance'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(2500);

// Watch every add-link input the page ever mounts, so a swap is visible.
await page.evaluate(() => {
  const RE = /^(?:add (?:another )?link|add another url)$/i;
  let seq = 0;
  const seen = new WeakMap();
  const scan = () => {
    for (const i of document.querySelectorAll('input[type="text"], input[type="url"], input:not([type])')) {
      if (!RE.test((i.placeholder || '').trim())) continue;
      if (!seen.has(i)) { seen.set(i, ++seq); window.__t('mount', { id: seq, value: i.value }); }
    }
  };
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  scan();
  window.__addInputId = el => seen.get(el) || null;
});

await page.addScriptTag({ content: code });
await page.waitForTimeout(30000);

const state = await page.evaluate(() => ({
  rows: [...document.querySelectorAll('tr.external-link-item')].map(r => (r.querySelector('a[href]') || {}).href || '(no link)'),
  addInputs: [...document.querySelectorAll('input')].filter(i => /^(?:add (?:another )?link|add another url)$/i.test((i.placeholder || '').trim())).map(i => ({ value: i.value, connected: i.isConnected })),
  pendingLeft: localStorage.getItem('pc:pending:' + location.pathname.match(/release\/([0-9a-f-]{36})/)[1]),
  trace: window.__trace,
}));

console.log('\n── external-link rows now on the page ──');
state.rows.forEach(r => console.log('  ' + r));
console.log('\n── add-link inputs mounted over time (id = distinct DOM node) ──');
state.trace.forEach(t => console.log(`  #${t.id} value=${JSON.stringify(t.value)}`));
console.log('\n── live add-link inputs ──');
console.log('  ' + JSON.stringify(state.addInputs));
console.log('\n── script console ──');
logs.forEach(l => console.log('  ' + l));
console.log('\npending left in localStorage: ' + state.pendingLeft);

const want = Object.values(PENDING);
const landed = want.filter(u => state.rows.some(h => h.replace(/\/$/, '').includes(u.split('/album/')[1]?.split('/')[0] || '\u0000')));
console.log(`\nlanded ${landed.length}/${want.length}: ${JSON.stringify(landed)}`);
console.log('POSTs (all aborted): ' + JSON.stringify(postUrls));
if (postUrls.some(u => /ws\/js\/edit\/create|\/edit$/.test(u))) console.log('!! an edit POST was attempted (aborted)');
await page.screenshot({ path: resolve(SHOTS, 'i556-3urls.png'), fullPage: false }).catch(() => {});
await ctx.close();
