// #650: the Qobuz provider reads the store page itself (Qobuz's API answers only from the
// countries it serves; the page is rendered everywhere).
//
// Fixture: Daft Punk, "Random Access Memories" (gb-en, 0886443927087). Qobuz's own per-track
// artist names Thomas Bangalter on two tracks; the credit must stay Daft Punk.
import { test, check, sourceOf } from '../../../dev/test/harness.mjs';
import { readFile } from 'node:fs/promises';

test.use({ gm: { name: 'First Contact' }, pageErrors: 'ignore' });   // qobuz.com's own scripts are not ours

test('a Qobuz album page: main artists with their links, feat. from titles, label, UPC', { tag: ['@web', '@critical'] }, async ({ page }) => {
  await page.goto('https://www.qobuz.com/gb-en/album/random-access-memories-daft-punk/0886443927087', { waitUntil: 'domcontentloaded' });
  await page.evaluate(c => (0, eval)(c), await readFile(sourceOf('first_contact'), 'utf8'));
  await page.locator('#fc-root .fc-go').waitFor({ state: 'visible' });
  const rel = await page.evaluate(() => { const qz = window.__fcTest.providers.find(p => p.id === 'qobuz'); return qz.fetchRelease(qz.albumId(location)); });
  const text = c => c.map(a => a.name + a.join).join('');
  check(rel.title === 'Random Access Memories' && text(rel.credit) === 'Daft Punk', `title and credit: ${rel.title} — ${text(rel.credit)}`);
  check(/qobuz\.com\/gb-en\/interpreter\/daft-punk\/36819$/.test(rel.credit[0].url || ''), `artist link: ${rel.credit[0].url}`);
  check(rel.labels[0] && rel.labels[0].name === 'Columbia' && rel.barcode === '0886443927087', `label and UPC: ${JSON.stringify(rel.labels)} ${rel.barcode}`);
  const tracks = rel.mediums.flatMap(m => m.tracks);
  check(tracks.length === 13 && tracks.every(t => t.lengthMs > 0), `13 tracks with lengths (${tracks.length})`);
  check(text(tracks[2].credit) === 'Daft Punk', `track 3 stays Daft Punk, not Qobuz's "Thomas Bangalter": ${text(tracks[2].credit)}`);
  const lucky = tracks.find(t => t.title === 'Get Lucky');
  check(lucky && text(lucky.credit) === 'Daft Punk feat. Pharrell Williams & Nile Rodgers', `Get Lucky: ${lucky && text(lucky.credit)}`);
  check(rel.urls[0].linkType === 74 && /\/gb-en\/album\/random-access-memories-daft-punk\/0886443927087$/.test(rel.urls[0].url), `link: ${JSON.stringify(rel.urls)}`);
});
