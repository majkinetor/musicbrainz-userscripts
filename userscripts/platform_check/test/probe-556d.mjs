// #556 — what exactly happens to the THIRD url. Dumps the row DOM, any banner
// the helper crashed into, and hooks console before the script loads.
// Sandbox only; every POST aborted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'platform_check.user.js'), 'utf8');
const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
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
  window.__con = [];
  for (const m of ['log', 'info', 'warn', 'error']) {
    const real = console[m].bind(console);
    console[m] = (...a) => { try { window.__con.push(m + ': ' + a.map(String).join(' ')); } catch (e) {} return real(...a); };
  }
}, [RELEASE, PENDING]);
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR: ' + e.message));
await page.route(() => true, r => r.request().method() === 'POST' ? r.abort() : r.continue());
await page.goto(`https://test.musicbrainz.org/release/${RELEASE}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(2500);
await page.addScriptTag({ content: code });
await page.waitForTimeout(25000);
const out = await page.evaluate(() => ({
  rows: [...document.querySelectorAll('tr.external-link-item')].map(r => ({
    href: (r.querySelector('a[href]') || {}).href || null,
    inputs: [...r.querySelectorAll('input')].map(i => ({ ph: i.placeholder, v: i.value })),
    text: (r.textContent || '').trim().slice(0, 160),
    nextClass: r.nextElementSibling ? r.nextElementSibling.className : null,
  })),
  banner: (document.querySelector('.pc-inject-banner, [class*=pc-banner], [id*=pc-inject]') || {}).textContent || null,
  bodyHasWarn: /select a link type|invalid|not a valid/i.test(document.body.innerText) ? document.body.innerText.match(/[^\n]*(select a link type|invalid|not a valid)[^\n]*/i)[0] : null,
  con: window.__con.filter(l => /Platform Check/.test(l)),
}));
console.log(JSON.stringify(out, null, 1));
await ctx.close();
