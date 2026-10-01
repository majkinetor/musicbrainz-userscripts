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
