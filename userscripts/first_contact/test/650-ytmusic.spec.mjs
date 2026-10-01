// #650: the YouTube Music provider, from the web player's own API (youtubei/v1, anonymous).
//
// Fixture: Daft Punk, "Random Access Memories": album page MPREb_K8qWMWVqXGi, playlist
// OLAK5uy_kNhM2yaBTOVwrcZJepB1C9P3-n5_Sfy5c. Get Lucky lists Pharrell Williams and Nile Rodgers
// as artists; its title says they are featured.
import { test, check, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'First Contact' } });

const LIST = 'OLAK5uy_kNhM2yaBTOVwrcZJepB1C9P3-n5_Sfy5c';

test('a YouTube Music album: kind, year, tracks with lengths, artists with their channels', { tag: ['@web', '@critical'] }, async ({ page, inject }) => {
  await page.goto(SANDBOX + '/', { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  const { rel, viaList, ids } = await page.evaluate(async list => {
    const yt = window.__fcTest.providers.find(p => p.id === 'ytmusic');
    const ids = [{ pathname: '/browse/MPREb_K8qWMWVqXGi' }, { pathname: '/playlist', search: '?list=' + list }, { pathname: '/watch', search: '?v=5NV6Rdv1a3I' }, { pathname: '/channel/UCRr1xG_2WIDs18a6cIiCxeA' }].map(l => yt.albumId(l));
    return { rel: await yt.fetchRelease('MPREb_K8qWMWVqXGi'), viaList: await yt.fetchRelease('list:' + list), ids };
  }, LIST);
  const text = c => c.map(a => a.name + a.join).join('');
  check(JSON.stringify(ids) === JSON.stringify(['MPREb_K8qWMWVqXGi', 'list:' + LIST, null, null]), `album pages and album playlists only: ${JSON.stringify(ids)}`);
  check(rel.title === 'Random Access Memories' && text(rel.credit) === 'Daft Punk' && rel.credit[0].url === 'https://music.youtube.com/channel/UCRr1xG_2WIDs18a6cIiCxeA', `title and credit: ${rel.title} — ${text(rel.credit)} ${rel.credit[0].url}`);
  check(rel.types.join() === 'Album' && rel.date.year === 2013 && rel.barcode === null && rel.labels.length === 0, `kind and year, no barcode or label: ${rel.types} ${JSON.stringify(rel.date)}`);
  const tracks = rel.mediums[0].tracks;
  check(tracks.length === 13 && tracks.every(t => t.lengthMs > 0 && /watch\?v=/.test(t.url || '')), `13 tracks with lengths and links (${tracks.length})`);
  const lucky = tracks.find(t => t.title === 'Get Lucky');
  check(lucky && text(lucky.credit) === 'Daft Punk feat. Pharrell Williams & Nile Rodgers', `Get Lucky: "${lucky && lucky.title}" — ${lucky && text(lucky.credit)}`);
  check(lucky && lucky.credit.every(a => /music\.youtube\.com\/channel\/UC/.test(a.url || '')), 'every Get Lucky artist has its channel');
  check(rel.urls[0].url === 'https://music.youtube.com/playlist?list=' + LIST && rel.urls[0].linkType === 85, `link: the album playlist (${JSON.stringify(rel.urls)})`);
  check(viaList.title === rel.title && viaList.mediums[0].tracks.length === 13, `an album playlist page reads the same album (${viaList.title}, ${viaList.mediums[0].tracks.length})`);
});

// YouTube Music enforces Trusted Types: a plain innerHTML is refused ("This document requires
// 'TrustedHTML' assignment"), which kept the button off the page until mbuHtml. It also turns
// away a headless browser's user agent, so the test borrows a desktop one.
test.describe('on the live page', () => {
  test.use({ pageErrors: 'ignore', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' });
  test('the button shows on an album playlist page, and its panel opens', { tag: ['@web'] }, async ({ page, inject }) => {
    const refused = [];
    page.on('console', m => { if (/TrustedHTML/.test(m.text())) refused.push(m.text().slice(0, 160)); });
    await inject('first_contact', { atStart: true });
    await page.goto('https://music.youtube.com/playlist?list=' + LIST, { waitUntil: 'domcontentloaded' });
    const shown = await page.locator('#fc-root .fc-go').waitFor({ state: 'visible', timeout: 30000 }).then(() => true, () => false);
    check(shown, `the button is on the page${refused.length ? ' — refused: ' + refused.join(' | ') : ''}`);
    if (!shown) return;
    await page.locator('#fc-root .fc-more').click();
    check(await page.locator('#fc-panel .fc-server').isVisible(), 'the settings panel opens');
  });
});
