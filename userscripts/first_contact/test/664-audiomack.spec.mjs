// #664: Audiomack, through its signed API (the web player's public key, no login), as ISRC Scout
// and Platform Check read it.
//
// Fixtures: the album burna-boy/album/no-sign-of-weakness-6579609 (16 tracks, every one with its
// ISRC; barcode 075679623539; "TaTaTa (feat. Travis Scott)" and "Pardon" by Burna Boy, Stromae),
// and the song burna-boy/song/tatata-feat-travis-scott-2564133, a one-track release.
import { test, check, SANDBOX, sourceOf } from '../../../dev/test/harness.mjs';
import { readFile } from 'node:fs/promises';

test.use({ gm: { name: 'First Contact' }, pageErrors: 'ignore' });   // audiomack.com's own scripts are not ours
const text = c => c.map(a => a.name + a.join).join('');

async function read(page, inject, id) {
  await page.goto(SANDBOX + '/', { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  return page.evaluate(async id => window.__fcTest.providers.find(p => p.id === 'audiomack').fetchRelease(id), id);
}

test('Audiomack: an album with ISRCs, barcode, label and date; featured artists in the credit', { tag: ['@web'] }, async ({ page, inject }) => {
  const rel = await read(page, inject, 'burna-boy/album/no-sign-of-weakness-6579609');
  const tracks = rel.mediums.flatMap(m => m.tracks);
  check(rel.title === 'No Sign of Weakness' && text(rel.credit) === 'Burna Boy' && /^https:\/\/audiomack\.com\/burna-boy$/.test(rel.credit[0].url || ''), `title and credit, the uploader linked: ${rel.title} — ${text(rel.credit)} ${rel.credit[0].url}`);
  check(rel.barcode === '075679623539' && rel.labels.length === 1 && rel.labels[0].name === 'Spaceship/ Bad Habit/ Atlantic Records', `barcode and label: ${rel.barcode} ${JSON.stringify(rel.labels)}`);
  check(rel.date.year === 2025 && rel.date.month === 7 && rel.date.day === 10, `date: ${JSON.stringify(rel.date)}`);
  check(tracks.length === 16 && tracks.every(t => /^USAT2\d{7}$/.test(t.isrc || '') && t.lengthMs > 0 && /^https:\/\/audiomack\.com\/burna-boy\/song\//.test(t.url || '')), `16 tracks with ISRCs, lengths and song pages (${tracks.length})`);
  const tatata = tracks.find(t => t.title === 'TaTaTa'), pardon = tracks.find(t => t.title === 'Pardon');
  check(tatata && text(tatata.credit) === 'Burna Boy feat. Travis Scott', `TaTaTa: ${tatata && text(tatata.credit)}`);
  check(pardon && text(pardon.credit) === 'Burna Boy & Stromae', `Pardon: ${pardon && text(pardon.credit)}`);
  check(rel.urls[0].url === 'https://audiomack.com/burna-boy/album/no-sign-of-weakness-6579609' && rel.urls[0].linkType === 85, `link: ${JSON.stringify(rel.urls)}`);
  const ids = await page.evaluate(() => { const a = window.__fcTest.providers.find(p => p.id === 'audiomack'); return ['/burna-boy/album/no-sign-of-weakness-6579609', '/burna-boy/song/x-1/', '/burna-boy', '/search'].map(pathname => a.albumId({ pathname })); });
  check(JSON.stringify(ids) === JSON.stringify(['burna-boy/album/no-sign-of-weakness-6579609', 'burna-boy/song/x-1', null, null]), `album and song pages only: ${JSON.stringify(ids)}`);
});

test('Audiomack: a song is a one-track single', { tag: ['@web'] }, async ({ page, inject }) => {
  const rel = await read(page, inject, 'burna-boy/song/tatata-feat-travis-scott-2564133');
  const tracks = rel.mediums.flatMap(m => m.tracks);
  check(tracks.length === 1 && tracks[0].isrc === 'USAT22500257' && rel.barcode === '075679620514', `one track, its ISRC and barcode: ${JSON.stringify(tracks[0])} ${rel.barcode}`);
  check(rel.title === 'TaTaTa' && text(rel.credit) === 'Burna Boy feat. Travis Scott' && rel.types[0] === 'Single', `title, credit, type: ${rel.title} — ${text(rel.credit)} ${JSON.stringify(rel.types)}`);
});

test('Audiomack: the import button shows on an album page', { tag: ['@web'] }, async ({ page, inject }) => {
  await page.goto('https://audiomack.com/burna-boy/album/no-sign-of-weakness-6579609', { waitUntil: 'domcontentloaded' });
  try { await inject('first_contact', { waitFor: '__fcTest' }); }
  catch (e) { await page.evaluate(c => (0, eval)(c), await readFile(sourceOf('first_contact'), 'utf8')); }   // a CSP that refuses the inline <script>
  await page.locator('#fc-root .fc-go').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  check(await page.locator('#fc-root .fc-go').isVisible(), 'the import button shows on an Audiomack album page');
});
