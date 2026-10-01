// #650 (majkinetor): "Volumio and HDTracks and Soundcloud left." Their public APIs, as ISRC Scout
// and Platform Check read them.
//
// Fixtures: Volumo 8721554513038 ("Stand Your Ground EP", four artists, label and catalog number);
// HDtracks 5e182300c10cf717bb0315f2 (Daft Punk, "Random Access Memories"); SoundCloud
// mogwaa-music/sets/hazy-dreams-2 (ISRC Scout's #439 fixture).
import { test, check, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'First Contact' } });
const text = c => c.map(a => a.name + a.join).join('');

async function read(page, inject, id, key) {
  await page.goto(SANDBOX + '/', { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  return page.evaluate(async ([id, key]) => window.__fcTest.providers.find(p => p.id === id).fetchRelease(key), [id, key]);
}

test('Volumo: artists with their links, ISRCs, label and catalog number, barcode', { tag: ['@web', '@critical'] }, async ({ page, inject }) => {
  const rel = await read(page, inject, 'volumo', '8721554513038');
  check(rel.title === 'Stand Your Ground EP' && rel.barcode === '8721554513038', `title and barcode: ${rel.title} ${rel.barcode}`);
  check(rel.labels.length === 1 && rel.labels[0].name === 'Outsider Records (UK)' && rel.labels[0].catno === 'OUTSIDER002', `label: ${JSON.stringify(rel.labels)}`);
  const tracks = rel.mediums.flatMap(m => m.tracks);
  check(tracks.length === 4 && tracks.every(t => /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(t.isrc || '') && t.lengthMs > 0), `4 tracks with ISRCs and lengths (${tracks.length})`);
  check(tracks.every(t => t.credit.length && t.credit.every(a => /^https:\/\/volumo\.com\/artist\/\d+$/.test(a.url || ''))), 'every track artist has a Volumo link');
  check(rel.date.year === 2026 && rel.urls[0].url === 'https://volumo.com/album/8721554513038', `date and link: ${JSON.stringify(rel.date)} ${rel.urls[0].url}`);
  const ids = await page.evaluate(() => { const v = window.__fcTest.providers.find(p => p.id === 'volumo'); return ['/album/8721554513038-stand-your-ground-ep', '/album/1798896', '/artist/42309-ciuciek'].map(pathname => v.albumId({ pathname })); });
  check(JSON.stringify(ids) === JSON.stringify(['8721554513038', '1798896', null]), `album pages only: ${JSON.stringify(ids)}`);
});

test('HDtracks: tracks with ISRCs in disc order, label, barcode', { tag: ['@web', '@critical'] }, async ({ page, inject }) => {
  const rel = await read(page, inject, 'hdtracks', '5e182300c10cf717bb0315f2');
  check(rel.title === 'Random Access Memories' && text(rel.credit) === 'Daft Punk', `title and credit: ${rel.title} — ${text(rel.credit)}`);
  check(rel.barcode === '886443984059' && rel.labels[0].name === 'Columbia' && rel.date.year === 2013, `barcode, label, date: ${rel.barcode} ${JSON.stringify(rel.labels)} ${JSON.stringify(rel.date)}`);
  const tracks = rel.mediums.flatMap(m => m.tracks);
  check(tracks.length === 13 && tracks[0].isrc === 'USQX91300101' && tracks.every(t => t.lengthMs > 0), `13 tracks, in order, with ISRCs (${tracks.length}, ${tracks[0].isrc})`);
  const lucky = tracks.find(t => t.title === 'Get Lucky');
  check(lucky && /^Daft Punk feat\./.test(text(lucky.credit)), `Get Lucky: ${lucky && text(lucky.credit)}`);
  const ids = await page.evaluate(() => { const h = window.__fcTest.providers.find(p => p.id === 'hdtracks'); return [{ pathname: '/', hash: '#/album/5e182300c10cf717bb0315f2' }, { pathname: '/', hash: '#/search?q=x' }].map(l => h.albumId(l)); });
  check(JSON.stringify(ids) === JSON.stringify(['5e182300c10cf717bb0315f2', null]), `album pages only, by the address's hash: ${JSON.stringify(ids)}`);
});

test('SoundCloud: a set, its tracks with ISRCs, the uploader linked', { tag: ['@web'] }, async ({ page, inject }) => {
  const rel = await read(page, inject, 'soundcloud', '/mogwaa-music/sets/hazy-dreams-2');
  const tracks = rel.mediums.flatMap(m => m.tracks);
  console.log(JSON.stringify({ title: rel.title, credit: text(rel.credit), types: rel.types, barcode: rel.barcode, labels: rel.labels, date: rel.date, n: tracks.length, t0: tracks[0] }));
  check(rel.title && tracks.length > 1 && tracks.every(t => t.lengthMs > 0 && /soundcloud\.com\//.test(t.url || '')), `a set with its tracks (${rel.title}, ${tracks.length})`);
  check(tracks.some(t => /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(t.isrc || '')), 'the distributed set has ISRCs');
  check(rel.urls[0].linkType === 85 && /soundcloud\.com\/mogwaa-music\/sets\/hazy-dreams-2/.test(rel.urls[0].url), `link: ${JSON.stringify(rel.urls)}`);
});
