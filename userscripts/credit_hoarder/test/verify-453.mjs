// Verify #453 — Metal Archives source. Two live checks against the real site:
//  (1) extraction + engine mapping (metal_archives.js bundled alone, getArtistRoles
//      stubbed so we see the bridged Discogs role + track-scoping), and
//  (2) the end-to-end tab-side harvest with the REAL built dist bundle: it clears the
//      Cloudflare challenge in a real browser, extracts, and posts over GM storage.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const here = createRequire('C:/Work/mb-userscripts/userscripts/credit_hoarder/');
const esbuild = here('esbuild');
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
const ROOT = 'C:/Work/mb-userscripts/userscripts/credit_hoarder';

// stub mappers.js (getArtistRoles echoes the bridged role) so part (1) sees the parse/bridge
const stub = join(tmpdir(), 'ch-ma-mappers-stub.js');
await writeFile(stub, `export function getArtistRoles(a){ if(!a||!a.role) return []; return [{linkType:'ROLE:'+a.role, entityType:'artist', attributes:[], artist:a}]; }`);
const modBundle = (await esbuild.build({
    entryPoints: [ROOT + '/src/sources/metal_archives.js'], bundle: true, format: 'iife', globalName: 'MA', write: false,
    plugins: [{ name: 'stub', setup(b) { b.onResolve({ filter: /mappers\.js$/ }, () => ({ path: stub })); } }],
})).outputFiles[0].text;
const distBundle = await readFile(ROOT + '/dist/credit_hoarder.user.js', 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message.split('\n')[0]));
await page.addInitScript(() => {
    window.__gm = {}; window.GM_setValue = (k, v) => { window.__gm[k] = v; }; window.GM_getValue = (k, d) => (k in window.__gm ? window.__gm[k] : d);
    window.GM_deleteValue = k => { delete window.__gm[k]; }; window.GM_addValueChangeListener = () => 0; window.GM_removeValueChangeListener = () => {};
    window.GM_openInTab = () => ({ close() {} }); window.GM_xmlhttpRequest = () => {}; window.unsafeWindow = window;
});
let fail = 0; const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// ── (1) extraction + engine on Nightwish/Once (orchestral, track qualifiers) + empty ──
for (const [tag, url, expect] of [
    ['orchestral', 'https://www.metal-archives.com/albums/Nightwish/Once/39218', { tracks: 11, band: 5 }],
    ['empty', 'https://www.metal-archives.com/albums/Turandyarkh/Book_I/1093169', { tracks: 5, band: 0 }],
]) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2200);
    await page.addScriptTag({ content: modBundle });
    const r = await page.evaluate(() => {
        const h = MA.extractMaLineupDom(document); const eng = MA.metalArchivesToEngine(h); const rel = MA.metalArchivesReleaseArtists(h);
        const roles = [...new Set(eng.tracklistRels.map(x => x.linkType))];
        // a track-scoped credit stays scoped (Marco Hietala "Vocals (tracks 2,4,6,8,11)" → 5, not 11)
        const marco = h.band.find(b => /Hietala/.test(b.name));
        const marcoVocal = marco ? eng.tracklistRels.filter(x => x.artist.name === marco.name && x.linkType === 'ROLE:Vocals').length : -1;
        return { tracks: h.tracks.length, band: h.band.length, misc: h.misc.length, nRels: eng.tracklistRels.length, roles, relArtists: rel.artists.length, relUrlOk: rel.artists.every(a => a.resource_url), marcoVocal };
    });
    console.log(`\n[${tag}] tracks=${r.tracks} band=${r.band} misc=${r.misc} rels=${r.nRels} relArtists=${r.relArtists}`);
    if (tag === 'orchestral') {
        console.log('  roles:', JSON.stringify(r.roles.slice(0, 12)));
        check(r.tracks === 11 && r.band === 5 && r.misc >= 5, 'extracted the orchestral lineup');
        check(r.roles.includes('ROLE:Composed By') && r.roles.includes('ROLE:Lyrics By') && r.roles.includes('ROLE:Guitar'), 'roles bridged to the Discogs vocabulary');
        check(r.marcoVocal === 5, `a "(tracks 2,4,6,8,11)" credit stays scoped to 5 tracks (got ${r.marcoVocal})`);
        check(r.relArtists > 0 && r.relUrlOk, 'release-staff carry resolvable MA person URLs');
    } else check(r.band === 0 && r.misc === 0 && r.nRels === 0, 'empty album imports nothing');
}

// ── (2) tab-side harvest with the REAL dist bundle (clears Cloudflare, posts over GM) ──
await page.goto('https://www.metal-archives.com/albums/Nightwish/Once/39218#ch-req=t1', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(2500);
await page.addScriptTag({ content: distBundle });
await page.waitForFunction(() => window.__gm && window.__gm['ch-ma-result:t1'], { timeout: 15000 }).catch(() => {});
const h = await page.evaluate(() => window.__gm['ch-ma-result:t1'] || { none: true });
console.log(`\n[harvest] ok=${h.ok} albumId=${h.albumId} tracks=${(h.tracks || []).length} band=${(h.band || []).length}`);
check(!h.none && h.ok === true, 'real dist bundle harvests the MA page (clears Cloudflare) and posts over GM storage');
check(h.albumId === '39218', 'albumId parsed from the harvest URL');

console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
