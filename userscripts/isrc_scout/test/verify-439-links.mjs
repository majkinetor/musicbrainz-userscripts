// #439 (per-track links) — SoundCloud as an addable per-track link provider.
// On release ec2449a8 (links a SoundCloud set), switch to the Links tab and
// Find links: each track resolves its SoundCloud permalink from the set BY
// POSITION (title-guarded) and appears as an addable 'sc' candidate — no ISRC
// needed. Read-only — never submits.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'isrc_scout.user.js'), 'utf8');
const MBID = 'ec2449a8-3dc5-461c-80a1-e43d96345613';
const SET = 'https://soundcloud.com/ace-uzumakii/sets/ace-uzumakii-kawaiitrap';

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1100 }, bypassCSP: true });
await ctx.exposeBinding('__gmFetch', async (_s, o) => {
  try { const r = await ctx.request.fetch(o.url, { method: o.method || 'GET', headers: o.headers || {}, maxRedirects: 10 });
    return { status: r.status(), responseText: await r.text(), finalUrl: r.url() }; }
  catch (e) { return { status: 0, responseText: '', finalUrl: o.url }; }
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript((SET) => {
  window.GM_getValue = (k, d) => d; window.GM_setValue = () => {};
  window.GM_info = { script: { name: 'ISRC Scout', version: 't', homepageURL: 'x' } };
  window.unsafeWindow = window;
  window.GM_xmlhttpRequest = (o) => {
    window.__gmFetch({ method: o.method || 'GET', url: o.url, headers: o.headers || {} }).then(r => {
      if (/musicbrainz\.org\/ws\/2\/release\//.test(o.url)) {
        try { const j = JSON.parse(r.responseText); if (!(j.relations || []).some(x => /soundcloud\.com/.test(x.url?.resource || ''))) (j.relations = j.relations || []).push({ url: { resource: SET } }); r.responseText = JSON.stringify(j); } catch (e) {}
      }
      o.onload && o.onload(r);
    }).catch(() => o.onerror && o.onerror({ status: 0 }));
  };
}, SET);
await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1500);
await page.addScriptTag({ content: code });
await page.waitForSelector('#ii-btn', { timeout: 20000 });
await page.click('#ii-btn');
await page.waitForSelector('#ii-sc-all', { timeout: 20000 });
await page.waitForFunction(() => /Release "/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 30000 });
// #471: Links columns are always visible now — no tab to switch. Find links
// (SoundCloud resolves by position — no ISRC needed)
// wait for the table to render the SoundCloud candidate slots before resolving
await page.waitForFunction(() => document.querySelectorAll('#ii-modal .ii-tl.cand[data-code="sc"]').length > 0, null, { timeout: 20000 });
await page.click('#ii-links-btn');
await page.waitForFunction(() => document.querySelectorAll('#ii-modal .ii-tl.new[data-code="sc"], #ii-modal .ii-tl.absent[data-code="sc"]').length > 0, null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(800);

const r = await page.evaluate(() => ({
  scNew: document.querySelectorAll('#ii-modal .ii-tl.new[data-code="sc"]').length,
  scAbsent: document.querySelectorAll('#ii-modal .ii-tl.absent[data-code="sc"]').length,
  sampleHref: (document.querySelector('#ii-modal .ii-tl.new[data-code="sc"]') || {}).href || '',
}));
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify(r, null, 1));
ck(r.scNew >= 1, `SoundCloud per-track links resolved as addable candidates (${r.scNew} new)`);
ck(/soundcloud\.com\/[^/]+\/(?!sets\/)/.test(r.sampleHref), `resolved a track permalink, not a set URL ("${r.sampleHref}")`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
