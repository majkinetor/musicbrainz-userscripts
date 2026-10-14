// #650: the Beatport provider reads the release page's Next.js data (__NEXT_DATA__).
//
// Beatport shows the test browser (and Node's fetch) a Cloudflare check, but answers curl, so the
// spec fetches the release pages with curl and hands their documents to the provider (its `doc`
// argument).
//
// Fixtures: Fabrizio Fattori, "Mediterranean Africa" (2874243): 7 tracks, mix names kept except
// "Original Mix". "90s House Music Vol. 1 - Compiled By DjPope" (2126441): many release
// artists, so Various Artists.
import { test, check, sourceOf } from '../../../dev/test/harness.mjs';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test.use({ gm: { name: 'First Contact' } });

const html = async id => (await promisify(execFile)('curl', ['-sf', '--max-time', '30', `https://www.beatport.com/release/-/${id}`], { maxBuffer: 1 << 24 })).stdout;

async function read(page, id) {
  return page.evaluate(([id, h]) => {
    const bp = window.__fcTest.providers.find(p => p.id === 'beatport');
    return bp.fetchRelease(id, null, new DOMParser().parseFromString(h, 'text/html'));
  }, [id, await html(id)]);
}

test('a Beatport release: tracks in order with mix names and ISRCs, label, UPC, links', { tag: ['@web', '@critical'] }, async ({ page }) => {
  await page.goto('about:blank');
  await page.evaluate(c => (0, eval)(c), await readFile(sourceOf('first_contact'), 'utf8'));
  const text = c => c.map(a => a.name + a.join).join('');

  const rel = await read(page, '2874243');
  check(rel.title === 'Mediterranean Africa' && text(rel.credit) === 'Fabrizio Fattori', `title and credit: ${rel.title} — ${text(rel.credit)}`);
  check(rel.credit[0].url === 'https://www.beatport.com/artist/fabrizio-fattori/101904', `artist link: ${rel.credit[0].url}`);
  check(rel.labels[0].name === 'Best Record Italy' && rel.labels[0].catno === 'BSTX052' && /\/label\/best-record-italy\/79316$/.test(rel.labels[0].url), `label: ${JSON.stringify(rel.labels)}`);
  check(rel.barcode === '8605020106088' && rel.date.year === 2020 && rel.date.month === 2 && rel.date.day === 28, `UPC and date: ${rel.barcode} ${JSON.stringify(rel.date)}`);
  const tracks = rel.mediums[0].tracks;
  check(tracks.length === 7 && tracks.every(t => t.lengthMs > 0 && /^IT/.test(t.isrc || '')), `7 tracks with lengths and ISRCs (${tracks.length})`);
  check(tracks[0].title === 'Running On The Nile' && tracks[6].title === 'Babihe', `order, first and last: ${tracks[0].title} … ${tracks[6].title}`);
  check(tracks.some(t => t.title === 'Leg Pulling (Dub)') && tracks.some(t => t.title === 'Babe Black (Night Version)'), `mix names kept: ${tracks.map(t => t.title).join(' | ')}`);
  check(/^https:\/\/www\.beatport\.com\/track\/[^/]+\/13231351$/.test(tracks[0].url), `track link: ${tracks[0].url}`);
  check(rel.urls.map(u => u.linkType).join() === '74,980' && /\/release\/mediterranean-africa\/2874243$/.test(rel.urls[0].url), `links: ${JSON.stringify(rel.urls)}`);

  const va = await read(page, '2126441');
  check(text(va.credit) === 'Various Artists' && va.credit[0].mbid === '89ad4ac3-39f7-470e-963a-56509c546377', `many release artists → Various Artists: ${text(va.credit)}`);
  check(va.mediums[0].tracks.every(t => t.credit.length && t.credit[0].url), 'every compilation track has its own artist with a link');
});

// #745: a headless read (Mission Control's consolidation) of a Beatport release whose page Cloudflare refuses: it is
// read through Platform Check (pc:beatport-release), which answers with Beatport's API data, the page's own shape.
// A stand-in Platform Check answers here, with a release in the API's shape.
test('a Beatport page that is refused is read through Platform Check', { tag: ['@sandbox'] }, async ({ page }) => {
  await page.goto('https://test.musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(c => (0, eval)(c), await readFile(sourceOf('first_contact'), 'utf8'));
  const out = await page.evaluate(async () => {
    const asked = [];
    document.addEventListener('pc:beatport-release', e => {
      const d = JSON.parse(e.detail); asked.push(d.id);
      const tr = (id, n, name, mix, len, isrc) => ({ id, number: n, name, mix_name: mix, length_ms: len, isrc, slug: name.toLowerCase().replace(/\W+/g, '-'), url: `https://api.beatport.com/v4/catalog/tracks/${id}/`, release: { id: 7172118 }, artists: [{ id: 7, name: 'Ayria', slug: 'ayria' }] });
      const release = { id: 7172118, name: '13 Stitches', slug: '13-stitches', artists: [{ id: 7, name: 'Ayria', slug: 'ayria' }], label: { id: 9, name: 'Artoffact', slug: 'artoffact' }, catalog_number: 'AOF 300', upc: '628070649594', new_release_date: '2026-10-02', type: { name: 'Album' }, is_available_for_streaming: true,
        tracks: ['https://api.beatport.com/v4/catalog/tracks/2/', 'https://api.beatport.com/v4/catalog/tracks/1/'] };
      document.dispatchEvent(new CustomEvent('pc:beatport-release-result', { detail: JSON.stringify({ req: d.req, release, tracks: [tr(2, 2, 'Turn of the Tide', 'Original Mix', 241000, 'CA5KR2600002'), tr(1, 1, 'Feeding Your Monsters', 'Extended Mix', 260000, 'CA5KR2600001')] }) }));
    });
    const bp = window.__fcTest.providers.find(p => p.id === 'beatport');
    const doc = new DOMParser().parseFromString('<html><body></body></html>', 'text/html'); doc.fcOrigin = 'https://www.beatport.com';
    const rel = await bp.fetchRelease('7172118', null, doc);
    return { asked, title: rel.title, label: rel.labels[0], barcode: rel.barcode, tracks: rel.mediums[0].tracks.map(t => [t.title, t.lengthMs, t.isrc]) };
  });
  console.log(JSON.stringify(out));
  check(out.asked.join() === '7172118', 'Platform Check was asked for the release');
  check(out.title === '13 Stitches' && out.barcode === '628070649594' && out.label.catno === 'AOF 300', `the release: ${JSON.stringify(out)}`);
  check(JSON.stringify(out.tracks) === JSON.stringify([['Feeding Your Monsters (Extended Mix)', 260000, 'CA5KR2600001'], ['Turn of the Tide', 241000, 'CA5KR2600002']]), `the tracks, in the release's order, with lengths and ISRCs: ${JSON.stringify(out.tracks)}`);
});
