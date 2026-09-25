// #618: on a Various Artists release, the #437 co-credit lookup used the special-purpose
// "Various Artists" entity as a known artist — every ambiguous name cost an extra paced
// `recording?query=arid:<VA> AND artistname:"…"` search that can never help.
//
// test.musicbrainz.org, a VA release, nothing submitted: track 1's artist is turned into
// the unresolved, deliberately ambiguous name "Joni" (several exact MB artists), and the
// tracklist is re-matched. Every request Apollo sends is observed (no routing) and the
// co-credit searches seeded with Various Artists are counted. APOLLO_SRC=<old build> to
// watch it fire.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.APOLLO_SRC || resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');
const REL = process.argv[2] || '5213f47a-58f6-4c33-a968-050d5f662ceb';   // "Paste Sampler 117" — Various Artists, 7 tracks (sandbox)
const VA = '89ad4ac3-39f7-470e-963a-56509c546377';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript(() => { const s = new Map(); window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d; window.GM_setValue = (k, v) => s.set(k, v); window.GM_info = { script: { name: 'Apollo Editor', version: 't' } }; });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const reqs = []; page.on('request', r => reqs.push(decodeURIComponent(r.url())));
await page.goto(`https://test.musicbrainz.org/release/${REL}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForFunction(() => window.MB && MB.releaseEditor && MB.releaseEditor.rootField && MB.releaseEditor.rootField.release(), null, { timeout: 60000 });
await page.waitForTimeout(2500);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => window.__apolloEditor, null, { timeout: 20000 });
await page.evaluate(() => { const a = [...document.querySelectorAll('a')].find(x => x.textContent.trim() === 'Tracklist'); if (a) a.click(); });
await page.waitForTimeout(3000);
await page.evaluate(() => MB.releaseEditor.rootField.release().mediums().forEach(m => { if (!m.loaded()) m.loadTracks(); }));
await page.waitForFunction(() => MB.releaseEditor.rootField.release().mediums().every(m => m.loaded()), null, { timeout: 30000 });

const relGids = await page.evaluate(() => { const A = window.__apolloEditor; return A.releaseArtistGids ? A.releaseArtistGids() : null; });
console.log('release artist credit gids:', JSON.stringify(relGids));
ck(!relGids || relGids.includes(VA), 'the fixture really is a Various Artists release');

// track 1 → the unresolved, ambiguous name "Joni" (as a freshly pasted/typed credit would be)
await page.evaluate(() => {
  const t = MB.releaseEditor.rootField.release().mediums()[0].tracks()[0];
  t.artistCredit({ names: [{ artist: { name: 'Joni' }, name: 'Joni', joinPhrase: '' }] });
});
await page.waitForTimeout(800);
const mark = reqs.length;
const model = await page.evaluate(async () => { const m = await window.__apolloEditor.buildModel(); const t = m.tracks[0]; return { slot: t.slots[0] && { creditedAs: t.slots[0].creditedAs, status: t.slots[0].status, candidates: (t.slots[0].candidates || []).length } }; });
await page.waitForTimeout(1500);
const sent = reqs.slice(mark);
const credVA = sent.filter(u => /\/ws\/2\/recording\?/.test(u) && u.includes('arid:' + VA));
const cred = sent.filter(u => /\/ws\/2\/recording\?/.test(u) && /arid:/.test(u));
console.log('slot:', JSON.stringify(model.slot));
console.log('co-credit searches sent:', cred.length, cred.map(u => u.replace(/^.*query=/, '').replace(/&.*$/, '')).join(' | '));
ck(model.slot && model.slot.creditedAs === 'Joni' && model.slot.status !== 'set', 'track 1 was matched as the unresolved name "Joni"');
ck(credVA.length === 0, `no co-credit search seeded with Various Artists (${credVA.length})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
