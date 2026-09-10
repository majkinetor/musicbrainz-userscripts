// #582 (majkinetor): "When I open an existing release for editing the recording
// auto-matching runs even though all recordings are linked already." His log:
// two /ws/2 round-trips — the release-group recording pool and the position
// index, 26 seconds and a 503 retry between them — and then
// "recording auto-match: linked 0 of 0 unset tracks".
//
// The pass read what needed matching only AFTER paying for both lookups. It now
// reads first (waiting, but only while the tracklist is still empty, since the
// pass fires while MB may still be loading collapsed media) and returns before
// any network when nothing is unset.
//
// Measured on the wire, not in the log: every /ws/2 URL the page requests is
// recorded, and the two the pass would have made must not be among them. The
// release is opened with autoMatchRec ON, exactly his setup.
//
// Pre-fix build: both lookups fire, and the status reads "linked 0 of 0".
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.AE_SRC || resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');
const MBID = process.env.MBID || '55530bc0-97ec-4256-97fc-e6058958c251';   // 13 tracks, every one already linked
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript(() => {
  const store = new Map([['apolloEditor.settings.v1', JSON.stringify({ autoMatchRec: true, discogsUrlMatch: false })]]);
  window.GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Apollo Editor', version: 't' } };
  window.GM_xmlhttpRequest = () => {};
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const posted = [];
await page.route(/\/ws\/js\/edit\/|\/relationship-editor|\/edit\/create/i, r => { posted.push(r.request().url()); return r.abort(); });
const ws = [];
page.on('request', r => { const u = r.url(); if (u.includes('/ws/2/')) ws.push(u); });

await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(5000);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, null, { timeout: 20000 });
ck(await page.evaluate(() => !!window.__apolloEditor.settings.autoMatchRec), 'fixture really has auto-match-recordings ON (the effective setting, not the default)');

// enter the Recordings tab — this is what fires the pass on load
await page.evaluate(() => {
  const b = [...document.querySelectorAll('#tc-nav-bar button, #tc-nav-bar a')].find(x => x.textContent.trim().toLowerCase().startsWith('recording'));
  if (b) b.click();
});
await page.waitForSelector('#tc-recwrap tbody tr.tc-recrow', { state: 'attached', timeout: 20000 });
// generous: his pre-fix run took ~35s to get through both lookups
await page.waitForTimeout(20000);

const rows = await page.evaluate(() => {
  const r = window.__apolloEditor.readRecordings();
  return { total: r.length, unset: r.filter(x => !x.recGid).length,
           status: (document.querySelector('#tc-recwrap .tc-rec-amstatus') || {}).textContent || '',
           log: (window.__apolloEditor.logMarkdown ? window.__apolloEditor.logMarkdown() : '') };
});
console.log('\nrows:', JSON.stringify({ ...rows, log: undefined }));
console.log('\n--- Apollo log ---\n' + String(rows.log).split('\n').filter(l => /auto-match|recording|match/i.test(l)).join('\n'));
const rgPool = ws.filter(u => /\/ws\/2\/recording\?query=rgid:/.test(u));
const posIdx = ws.filter(u => /\/ws\/2\/release\?release-group=.*inc=recordings/.test(u));
console.log('/ws/2 calls seen:', ws.length);
ws.forEach(u => console.log('   ' + u.slice(0, 130)));

ck(rows.total > 0, `the tracklist loaded (${rows.total} tracks)`);
ck(rows.unset === 0, `every track is already linked — the case he reported (${rows.unset} unset)`);
ck(rgPool.length === 0, `no release-group recording pool was fetched (${rgPool.length})`);
ck(posIdx.length === 0, `no release-group position index was fetched (${posIdx.length})`);
ck(/already linked/.test(rows.status), `the pane says why nothing happened, not "linked 0 of 0": "${rows.status}"`);
ck(!posted.some(u => /\/edit\/create/.test(u)), 'nothing was submitted');
ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
