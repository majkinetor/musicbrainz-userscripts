// Verify #431 — position-matched fills get a duration plausibility check. Reproduces
// chaban's exact scenario: the 4-track release "Never Ever Ever" importing the 12-track
// Deezer album 534356522 ("When I Was Lost, I Found Myself"). The wrong-link Deezer rel
// has since been removed from MB, so the probe re-injects it into the WS2 response.
// Expect: the 12-vs-4 wrong-edition warning, 4 fills all flagged amber (different album
// → durations differ), "⚠ 4 implausible" in the summary — and fills NOT dropped.
//
//   node test/verify-431.mjs [--headed]
import { chromium }      from 'playwright';
import { readFile }      from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE        = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(HERE, '..', 'isrc_scout.user.js');
const headed      = process.argv.includes('--headed');
const MBID = 'ad4287f9-c658-45bb-b0c6-4d71f79d3fdd';
const DEEZER_URL = 'https://www.deezer.com/album/534356522';

const ctx = await chromium.launchPersistentContext(resolve(HERE, '..', '..', '..', '.pw-profile'), { headless: !headed, viewport: { width: 1600, height: 1100 }, bypassCSP: true });
await ctx.exposeBinding('__gmFetch', async (_s, opts) => {
  try {
    const resp = await ctx.request.fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, maxRedirects: 20 });
    return { status: resp.status(), responseText: await resp.text(), finalUrl: resp.url() };
  } catch (e) { return { status: 0, responseText: '', finalUrl: opts.url }; }
});
const code = await readFile(SCRIPT_PATH, 'utf8');
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(DEEZER_URL => {
  window.GM_getValue = (k, d) => d; window.GM_setValue = () => {};
  window.GM_info = { script: { name: 'ISRC Scout', version: 't', homepageURL: 'x' } };
  window.unsafeWindow = window;
  window.GM_xmlhttpRequest = (o) => {
    window.__gmFetch({ method: o.method || 'GET', url: o.url, headers: o.headers || {} }).then(r => {
      // re-inject the (since removed) wrong Deezer link into the MB release payload
      if (/musicbrainz\.org\/ws\/2\/release\//.test(o.url)) {
        try { const j = JSON.parse(r.responseText); (j.relations = j.relations || []).push({ url: { resource: DEEZER_URL } }); r.responseText = JSON.stringify(j); } catch (e) {}
      }
      o.onload && o.onload(r);
    }).catch(() => o.onerror && o.onerror({ status: 0, responseText: '' }));
  };
}, DEEZER_URL);
await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1500);
await page.addScriptTag({ content: code });
await page.waitForSelector('#ii-btn', { timeout: 20000 });
await page.click('#ii-btn');
await page.waitForSelector('#ii-dz-all', { timeout: 20000 });
await page.waitForFunction(() => /Release "/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 30000 });
await page.waitForTimeout(800);
await page.click('#ii-dz-all');
await page.waitForFunction(() => /Deezer done/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 120000 });
await page.waitForTimeout(500);

const r = await page.evaluate(() => {
  const log = document.getElementById('ii-log-out')?.textContent || '';
  const suspects = [...document.querySelectorAll('input.ii-in-suspect')];
  const filled = [...document.querySelectorAll('#ii-modal tbody input')].filter(i => i.dataset.autofill === '1' && i.value.trim()).length;
  return {
    editionWarn: /12 track\(s\) but this release has 4/.test(log),
    doneLine: (log.match(/Deezer done[^\n]*/) || [''])[0],
    perRowWarns: (log.match(/filled by position, but length differs/g) || []).length,
    suspectCount: suspects.length,
    suspectTitle: suspects[0] ? suspects[0].title : '',
    filled,
  };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify(r, null, 1));
// one of the 4 pairs sits near the 10s tolerance boundary, so the flagged count can be
// 3 or 4 depending on upstream duration data — assert internal CONSISTENCY, not an
// exact number: most fills flagged, per-row warns and the summary agree with the ambers.
ck(r.editionWarn, 'wrong-edition banner: 12 tracks vs 4 warned before fills finished');
ck(/4 filled/.test(r.doneLine), `all 4 position fills kept ("${r.doneLine}")`);
ck(r.suspectCount >= 3, `most fills flagged amber (${r.suspectCount})`);
ck(r.perRowWarns === r.suspectCount, `per-row warnings match the amber inputs (${r.perRowWarns})`);
ck(new RegExp('⚠ ' + r.suspectCount + ' implausible').test(r.doneLine), `summary count agrees ("${r.doneLine}")`);
ck(/matched by position only, but length differs/.test(r.suspectTitle), 'amber input explains itself in the tooltip');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
