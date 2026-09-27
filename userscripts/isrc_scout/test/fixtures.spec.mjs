// ISRC Scout loads cleanly on every release in fixtures.json and shows what MusicBrainz
// has. The script is injected at document-start, before the page's own scripts and
// before <body> exists, so a load-time bug that only bites there (observing a null
// document.body, say) fails here as a page error.
//
// Each fixture checks itself against the web service of the same server (track count,
// ISRC count, streaming links), so nothing depends on a particular state of the data.
// test.musicbrainz.org, read-only.
import { readFileSync } from 'node:fs';
import { test, check, mbJson, SANDBOX, attachShot } from '../../../dev/test/harness.mjs';
import { openScout, logText } from './is.mjs';

const FIXTURES = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'));
test.use({ gm: { name: 'ISRC Scout' } });

for (const f of FIXTURES) {
  const tags = (f.tags || '').split(/\s+/).filter(Boolean).map(t => '@' + t);
  test(f.name, { tag: ['@fixture', '@sandbox', ...tags] }, async ({ page, inject }, testInfo) => {
    const data = await mbJson(`${SANDBOX}/ws/2/release/${f.mbid}?inc=recordings+isrcs+url-rels&fmt=json`);
    const tracks = data.media.flatMap(m => m.tracks || []);
    const isrcs = tracks.reduce((n, t) => n + ((t.recording && t.recording.isrcs) || []).length, 0);
    const missing = tracks.filter(t => !((t.recording && t.recording.isrcs) || []).length).length;
    const links = (data.relations || []).map(r => (r.url && r.url.resource) || '');
    const deezer = links.some(u => /deezer\.com\/(?:[a-z]{2}\/)?album\//.test(u)), spotify = links.some(u => /open\.spotify\.com\/album\//.test(u));
    const status = missing === 0 ? `✓ ${tracks.length}/${tracks.length}` : `⚠ ${tracks.length - missing}/${tracks.length}`;

    await openScout(page, inject, { release: f.mbid });
    const seen = await page.evaluate(() => ({
      btnStatus: document.getElementById('ii-btn-status')?.textContent?.trim() || '',
      rows: document.querySelectorAll('#ii-tbody tr[data-idx]').length,
      samps: document.querySelectorAll('#ii-tbody .ii-existing samp').length,
      // shown when the release links the provider, or a release in its group does (.ii-rg, #302)
      dz: (b => ({ shown: b.style.display !== 'none', rg: b.classList.contains('ii-rg') }))(document.getElementById('ii-dz-all')),
      sp: (b => ({ shown: b.style.display !== 'none', rg: b.classList.contains('ii-rg') }))(document.getElementById('ii-sp-all')),
    }));
    check(seen.btnStatus === status, `the button's status matches (${seen.btnStatus} vs ${status})`);
    check(seen.rows === tracks.length, `one row per track (${seen.rows} vs ${tracks.length})`);
    check(seen.samps === isrcs, `the existing ISRCs are shown (${seen.samps} vs ${isrcs})`);
    check(seen.dz.shown === (deezer || seen.dz.rg) && seen.sp.shown === (spotify || seen.sp.rg), `the Deezer and Spotify buttons show when there is a link (${JSON.stringify({ dz: seen.dz, sp: seen.sp })}, release links: deezer ${deezer}, spotify ${spotify})`);
    check((await logText(page)).trim().length > 0, 'the log pane has content');
    await attachShot(testInfo, page, 'dialog');
  });
}
