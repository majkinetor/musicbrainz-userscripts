// #453: the Metal Archives source, checked against the live site.
//  1. Extraction and the engine mapping: metal_archives.js bundled alone, with
//     getArtistRoles stubbed to echo the bridged Discogs role, so the parse, the role
//     bridge and the track scoping are what's seen. Albums: orchestral with track
//     qualifiers, an empty one, a split, and a split with track-qualified other staff.
//  2. The tab-side harvest with the real built script: it gets past Cloudflare in a
//     real browser, extracts, and posts the result over GM storage.
//
// Metal Archives only, nothing on MusicBrainz.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, check, REPO, sourceOf } from '../../../dev/test/harness.mjs';

const CH = join(REPO, 'userscripts/credit_hoarder');
// esbuild comes with Credit Hoarder's own packages (pnpm --dir userscripts/credit_hoarder
// install). Loaded in the test, not here: every spec file is loaded to list the tests,
// so a top-level require broke every run of every script where those aren't installed.
const esbuildOf = () => createRequire(join(CH, 'package.json'))('esbuild');
test.use({ gm: { name: 'Credit Hoarder', xhr: 'none' }, pageErrors: 'ignore' });   // a third-party site's own errors

test('Metal Archives lineups parse, scope to their tracks, and harvest through the built script', { tag: ['@web'] }, async ({ page, inject }) => {
  test.setTimeout(10 * 60_000);
  const stub = join(tmpdir(), 'ch-ma-mappers-stub.js');
  await writeFile(stub, "export function getArtistRoles(a){ if(!a||!a.role) return []; return [{linkType:'ROLE:'+a.role, entityType:'artist', attributes:[], artist:a}]; }");
  const modBundle = (await esbuildOf().build({
    entryPoints: [join(CH, 'src/sources/metal_archives.js')], bundle: true, format: 'iife', globalName: 'MA', write: false,
    plugins: [{ name: 'stub', setup(b) { b.onResolve({ filter: /mappers\.js$/ }, () => ({ path: stub })); } }],
  })).outputFiles[0].text;
  const load = async url => { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }); await page.waitForTimeout(2200); await page.addScriptTag({ content: modBundle }); };

  // ── 1. extraction and mapping ──
  for (const [tag, url] of [
    ['orchestral', 'https://www.metal-archives.com/albums/Nightwish/Once/39218'],
    ['empty', 'https://www.metal-archives.com/albums/Turandyarkh/Book_I/1093169'],
    ['split', 'https://www.metal-archives.com/albums/Undergang/Kuolema_parantaa_kaikki_haavat/537262'],
  ]) {
    await load(url);
    const r = await page.evaluate(() => {
      const h = MA.extractMaLineupDom(document); const eng = MA.metalArchivesToEngine(h); const rel = MA.metalArchivesReleaseArtists(h);
      const roles = [...new Set(eng.tracklistRels.map(x => x.linkType))];
      // Marco Hietala "Vocals (tracks 2,4,6,8,11)" → 5 tracks, not 11
      const marco = h.band.find(b => /Hietala/.test(b.name));
      const marcoVocal = marco ? eng.tracklistRels.filter(x => x.artist.name === marco.name && x.linkType === 'ROLE:Vocals').length : -1;
      // a split: each band's members only on that band's tracks
      let splitMisplaced = 0, splitBandTracks = 0;
      if (/split/i.test(h.type)) {
        const bandOf = new Map(h.tracks.map(t => [String(t.position), t.band]));
        const memberBand = new Map([...h.band, ...h.guest].map(m => [m.name, m.band]));
        splitBandTracks = new Set(h.tracks.filter(t => t.band).map(t => t.band)).size;
        splitMisplaced = eng.tracklistRels.filter(x => memberBand.get(x.artist.name) && memberBand.get(x.artist.name) !== bandOf.get(String(x.track.position))).length;
      }
      return { tracks: h.tracks.length, band: h.band.length, misc: h.misc.length, nRels: eng.tracklistRels.length, roles, relArtists: rel.artists.length, relUrlOk: rel.artists.every(a => a.resource_url), marcoVocal, splitMisplaced, splitBandTracks };
    });
    if (tag === 'orchestral') {
      check(r.tracks === 11 && r.band === 5 && r.misc >= 5, `the orchestral lineup is extracted (${JSON.stringify({ tracks: r.tracks, band: r.band, misc: r.misc })})`);
      check(['ROLE:Composed By', 'ROLE:Lyrics By', 'ROLE:Electric Guitar', 'ROLE:Electric Bass Guitar'].every(x => r.roles.includes(x)), 'roles are bridged (guitars → electric, bass → electric bass guitar)');
      check(r.marcoVocal === 5, `a "(tracks 2,4,6,8,11)" credit stays on those 5 tracks (${r.marcoVocal})`);
      check(r.relArtists > 0 && r.relUrlOk, 'release staff carry resolvable Metal Archives person URLs');
    } else if (tag === 'split') {
      check(r.splitBandTracks >= 2 && r.splitMisplaced === 0, `a split credits each band's members on its own tracks only (${r.splitBandTracks} bands, ${r.splitMisplaced} misplaced)`);
    } else {
      check(r.band === 0 && r.misc === 0 && r.nRels === 0, 'an empty album imports nothing');
    }
  }

  // a split's other staff: "Engineering (tracks 1, 2)", "Recording (tracks 3-9)", "Executive producer"
  await load('https://www.metal-archives.com/albums/Gonkulator/Gonkulator_-_Undinism/84563');
  const g = await page.evaluate(() => {
    const h = MA.extractMaLineupDom(document); const eng = MA.metalArchivesToEngine(h); const rel = MA.metalArchivesReleaseArtists(h);
    const posOf = name => [...new Set(eng.tracklistRels.filter(x => new RegExp(name).test(x.artist.name)).map(x => String(x.track.position)))].sort((a, b) => +a - +b);
    return {
      bruce: posOf('Bennett'), scott: posOf('Harper'),
      qualifiedAtRelease: rel.artists.filter(a => /Bennett|Harper/.test(a.name)).length,
      execRelease: rel.artists.filter(a => /Infection/.test(a.name) && /Executive/i.test(a.maRole || '')).length,
      execTrack: eng.tracklistRels.filter(x => /Infection/.test(x.artist.name) && /Executive/i.test(x.linkType)).length,
    };
  });
  check(JSON.stringify(g.bruce) === '["1","2"]', `"Engineering (tracks 1, 2)" is on exactly tracks 1 and 2 (${g.bruce})`);
  check(JSON.stringify(g.scott) === '["3","4","5","6","7","8","9"]', `"Recording (tracks 3-9)" is on exactly tracks 3-9 (${g.scott})`);
  check(g.qualifiedAtRelease === 0, 'track-qualified staff is not also credited on the release');
  check(g.execRelease >= 1 && g.execTrack === 0, 'an unqualified "Executive producer" stays a release credit');

  // ── 2. the tab-side harvest, with the built script ──
  await page.goto('https://www.metal-archives.com/albums/Nightwish/Once/39218#ch-req=t1', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
  await inject('credit_hoarder');
  await page.waitForFunction(() => GM_getValue('ch-ma-result:t1'), null, { timeout: 15000 }).catch(() => {});
  const h = await page.evaluate(() => GM_getValue('ch-ma-result:t1') || { none: true });
  check(!h.none && h.ok === true, 'the built script harvests the page and posts it over GM storage');
  check(h.albumId === '39218', `the album id comes from the harvest URL (${h.albumId})`);
});
