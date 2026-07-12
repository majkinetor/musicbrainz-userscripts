// #407 (artists) — auto-match an unset release Artist to its unique exact MusicBrainz hit.
// Loads a real /edit page, forces the release artist credit into an unresolved state
// (name kept, gid stripped) BEFORE Apollo mounts, opens the Tracklist tab
// (→ loadAndRender → matchReleaseArtist), and asserts the artist re-resolved to its MBID.
// Also checks the Matching-tab "Artist" checkbox (present + ON by default).
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');

const CODE = await readFile('C:/Work/mb-userscripts/userscripts/apollo_editor/apollo_editor.user.js', 'utf8');
const REL = '43794b9b-ac76-4591-807f-c192d6258ba0';   // Ko Sira — release artist "Oumou Sangaré" (unique exact)
const OS_GID = '2013f3af-51a3-404d-9afc-91b3f277ea4e';

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1050 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'Apollo', version: 'test' } }; });
await page.goto(`https://musicbrainz.org/release/${REL}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.error('NOT LOGGED IN — run login first'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(4500);

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// 1) force the release artist unresolved BEFORE Apollo loads (name kept, no gid)
const pre = await page.evaluate(() => {
  const rel = window.MB.releaseEditor.rootField.release();
  const names = rel.artistCredit().names;   // plain array of { artist, name, joinPhrase }
  const nm = names[0].artist.name;
  // rebuild the credit with a stub artist (no gid) — the "seeded/typed" state
  rel.artistCredit({ names: names.map(n => ({ artist: { name: n.artist.name }, name: n.name, joinPhrase: n.joinPhrase })) });
  const a = rel.artistCredit().names[0].artist;
  return { name: a && a.name, gid: (a && a.gid) || null, forcedFrom: nm };
});
ck(pre.name === 'Oumou Sangaré' && !pre.gid, `forced an unresolved "Oumou Sangaré" release artist (was ${pre.forcedFrom})`);

// 2) inject Apollo, open the Tracklist tab (triggers loadAndRender → matchReleaseArtist)
await page.addScriptTag({ content: CODE });
await page.waitForTimeout(1200);
await page.evaluate(() => { const t = document.querySelector('a[href="#tracklist"]'); if (t) t.click(); });
await page.waitForTimeout(7000);

const post = await page.evaluate(() => {
  const a = window.MB.releaseEditor.rootField.release().artistCredit().names[0].artist;
  return { gid: (a && a.gid) || null, id: (a && a.id) || null, name: a && a.name };
});
ck(post.gid === OS_GID, `release artist auto-matched to Oumou Sangaré MBID (got ${post.gid})`);
ck(!!post.id, `resolved entity carries a numeric id (${post.id}) — full entity, not a stub (#348)`);

// 3) Matching-tab "Artist" checkbox present + default ON
await page.evaluate(() => { const g = document.querySelector('.tc-launch-gear'); if (g) g.click(); });
await page.waitForTimeout(600);
const ui = await page.evaluate(() => {
  const mt = [...document.querySelectorAll('.tc-tab-btn')].find(b => /matching/i.test(b.textContent)); if (mt) mt.click();
  const cb = document.querySelector('#tc-s-automatchartist'); const row = cb && cb.closest('.tc-s-row');
  return { present: !!cb, checked: cb && cb.checked, rowText: row && row.textContent.replace(/\s+/g, ' ').trim() };
});
ck(ui.present && ui.checked === true, 'Matching tab has an "Artist" checkbox, ON by default');
ck(/Tracklist.*Recordings.*Label.*Artist/i.test(ui.rowText || ''), `row: "${ui.rowText}"`);
ck(errs.filter(e => !/ResizeObserver/.test(e)).length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));

console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
