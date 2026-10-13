// #736: a faint clock by each external link in an entity page's sidebar opens a menu with the link's
// copies on the Wayback Machine. Plain links: the page sends nothing to archive.org.
//
// Fixture: a release the 736-archive spec made on test.musicbrainz.org, with a Spotify and a Discogs link.
import { test, check, until, SANDBOX, requireLogin, idle, attachShot } from '../../../dev/test/harness.mjs';
import { apolloGm } from './ap.mjs';

const REL = 'd61c4146-fca2-4353-b377-4be5c45b4fc5';

test.describe('archive menu', () => {
  test.use({ gm: apolloGm() });

  test('a clock by each link opens its Wayback menu; Discogs offers its API data', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
    const archived = [];
    page.on('request', r => { if (/web\.archive\.org/.test(r.url())) archived.push(r.url()); });
    await page.goto(`${SANDBOX}/release/${REL}`, { waitUntil: 'domcontentloaded' });
    await requireLogin(page);
    await idle(page);
    await inject('apollo_editor', { waitFor: '__apolloEditor' });
    const rows = await until(() => page.$$eval('#sidebar ul.external_links > li', lis => lis.map(li => ({ href: (li.querySelector('a[href^="http"]') || {}).href || '', clock: !!li.querySelector('.tc-wb') }))), v => v.some(r => r.clock));
    console.log(JSON.stringify(rows));
    check(rows.length >= 2 && rows.filter(r => r.href && !/musicbrainz\.org/.test(r.href)).every(r => r.clock), `every external link has a clock (${JSON.stringify(rows)})`);

    const spotify = page.locator('#sidebar ul.external_links > li', { has: page.locator('a[href*="spotify.com"]') }).locator('.tc-wb');
    await spotify.click();
    const items = await page.$$eval('.tc-wbmenu a', as => as.map(a => [a.textContent, a.getAttribute('href'), a.target]));
    const url = await page.locator('#sidebar a[href*="spotify.com"]').first().getAttribute('href');
    await attachShot(testInfo, page.locator('#sidebar'), 'sidebar with the menu');
    check(JSON.stringify(items.map(i => i[1])) === JSON.stringify([`https://web.archive.org/web/${url}`, `https://web.archive.org/web/http://web.archive.org/screenshot/${url}`, `https://web.archive.org/web/*/${url}`, `https://web.archive.org/save/${url}`]), `snapshot, screenshot, calendar, save (${JSON.stringify(items)})`);
    check(items.every(i => i[2] === '_blank'), 'each opens in a new tab');
    await page.mouse.click(5, 5);
    check(await page.locator('.tc-wbmenu').count() === 0, 'a click elsewhere closes it');

    await page.locator('#sidebar ul.external_links > li', { has: page.locator('a[href*="discogs.com"]') }).locator('.tc-wb').click();
    const dg = await page.$$eval('.tc-wbmenu a', as => as.map(a => a.getAttribute('href')));
    check(dg.length === 3 && dg.every(h => /api\.discogs\.com\/releases\/\d+$/.test(h)), `Discogs: its API data only (${JSON.stringify(dg)})`);
    check(archived.length === 0, `nothing sent to archive.org (${archived.join(', ')})`);
  });
});
