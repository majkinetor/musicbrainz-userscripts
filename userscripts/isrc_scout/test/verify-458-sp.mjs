// #458 (per-track links) — Spotify as an addable per-track link provider.
// On release 5000a285 (Daft Punk — Random Access Memories, which links a Spotify
// album), switch to the Links tab and Find links: each track resolves its Spotify
// track URL from the token-free /embed/album/<id> page BY POSITION (title-guarded)
// and appears as an addable 'sp' candidate — no ISRC needed. Read-only — never submits.
// This release's recordings already carry Spotify track links, so the shim strips
// them from the WS2 response to expose the not-yet-linked state the resolver targets.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'isrc_scout.user.js'), 'utf8');
const MBID = '5000a285-b67e-4cfc-b54b-2b98f1810d2e';

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1100 }, bypassCSP: true });
await ctx.exposeBinding('__gmFetch', async (_s, o) => {
  try { const r = await ctx.request.fetch(o.url, { method: o.method || 'GET', headers: o.headers || {}, maxRedirects: 10 });
    return { status: r.status(), responseText: await r.text(), finalUrl: r.url() }; }
  catch (e) { return { status: 0, responseText: '', finalUrl: o.url }; }
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => {
  window.GM_getValue = (k, d) => d; window.GM_setValue = () => {};
  window.GM_info = { script: { name: 'ISRC Scout', version: 't', homepageURL: 'x' } };
  window.unsafeWindow = window;
  window.GM_xmlhttpRequest = (o) => {
    window.__gmFetch({ method: o.method || 'GET', url: o.url, headers: o.headers || {} }).then(r => {
      // Strip existing Spotify *track* rels from the release WS2 JSON so the tracks read as
      // not-yet-linked — that's the state the per-track resolver targets (else all sp slots
      // are already in the LINKED column and there's nothing to resolve).
      if (/musicbrainz\.org\/ws\/2\/release\//.test(o.url)) {
        try {
          const j = JSON.parse(r.responseText);
          (j.media || []).forEach(md => (md.tracks || []).forEach(tk => {
            const rec = tk.recording; if (rec && rec.relations) rec.relations = rec.relations.filter(x => !/open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\//i.test(x.url?.resource || ''));
          }));
          r.responseText = JSON.stringify(j);
        } catch (e) {}
      }
      o.onload && o.onload(r);
    }).catch(() => o.onerror && o.onerror({ status: 0 }));
  };
});
await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1500);
await page.addScriptTag({ content: code });
await page.waitForSelector('#ii-btn', { timeout: 20000 });
await page.click('#ii-btn');
await page.waitForSelector('#ii-sp-all', { timeout: 20000 });
await page.waitForFunction(() => /Release "/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 30000 });
// switch to the Links tab and Find links (Spotify resolves by position — no ISRC needed)
await page.click('.ii-tab[data-scope="links"]');
await page.waitForFunction(() => document.querySelectorAll('#ii-modal .ii-tl.cand[data-code="sp"]').length > 0, null, { timeout: 20000 });
await page.click('#ii-links-btn');
await page.waitForFunction(() => document.querySelectorAll('#ii-modal .ii-tl.new[data-code="sp"], #ii-modal .ii-tl.absent[data-code="sp"]').length > 0, null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(800);

const r = await page.evaluate(() => ({
  spNew: document.querySelectorAll('#ii-modal .ii-tl.new[data-code="sp"]').length,
  spAbsent: document.querySelectorAll('#ii-modal .ii-tl.absent[data-code="sp"]').length,
  sampleHref: (document.querySelector('#ii-modal .ii-tl.new[data-code="sp"]') || {}).href || '',
}));
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify(r, null, 1));
ck(r.spNew >= 1, `Spotify per-track links resolved as addable candidates (${r.spNew} new)`);
ck(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\//.test(r.sampleHref), `resolved a track URL, not an album URL ("${r.sampleHref}")`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
