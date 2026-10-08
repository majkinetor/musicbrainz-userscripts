// #687: Send to Harmony. The button between Import and ⚙︎ sends a platform Harmony knows by its
// album link, at once; another platform by the barcode it reads first; YouTube Music and Amazon
// Music have neither, so it's greyed out. ⚙︎ → Send to Harmony button hides it. Every link asks for
// category=preferred, so Harmony uses the providers and region in its own settings (spoonkuh on #687),
// and Close this page after the import closes the page once it's sent (majkinetor on #687).
//
// The album pages are stand-ins (routed, no network): only the button and what it sends are checked,
// and Harmony's tab is answered by a stand-in too (the harness's GM_openInTab opens none).
import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'First Contact' } });

const stub = async (page, url) => {
  await page.route(url, r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>album</title><body><h1>album</h1></body>' }));
  await page.goto(url);
};
const harmonyTabs = context => context.route('https://harmony.pulsewidth.org.uk/release?*', r => r.fulfill({ contentType: 'text/html', body: '<title>Harmony</title>' }));

test('Send to Harmony: a platform Harmony knows goes by its album link', { tag: ['@unit', '@critical'] }, async ({ page, context, inject }) => {
  await harmonyTabs(context);
  await stub(page, 'https://www.deezer.com/en/album/6575789');
  await inject('first_contact', { waitFor: '__fcTest' });
  const b = page.locator('#fc-root .fc-harmony');
  await b.waitFor({ state: 'visible' });
  const order = await page.evaluate(() => [...document.querySelectorAll('#fc-root > button')].map(x => x.className));
  check(order.join() === 'fc-go,fc-harmony,fc-more', `between Import and ⚙︎: ${order}`);
  check(/^Send to Harmony: look this Deezer album up/.test(await b.getAttribute('title')), `the tooltip says what it does: ${await b.getAttribute('title')}`);
  await b.click();
  const sent = await until(() => page.evaluate(() => window.__fcLastHarmony), v => !!v);
  check(sent === 'https://harmony.pulsewidth.org.uk/release?url=https%3A%2F%2Fwww.deezer.com%2Falbum%2F6575789&category=preferred', `the canonical album link, with Harmony's own settings: ${sent}`);
  check(!(await page.evaluate(() => window.__fcClosed)), 'the page stays open: Close this page after the import is off');

  // Close this page after the import: on, sending to Harmony closes the page too
  await page.locator('#fc-root .fc-more').click();
  await page.locator('#fc-panel .fc-close-after').check();
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.__fcLastHarmony = null; });
  await b.click();
  check(!!(await until(() => page.evaluate(() => window.__fcLastHarmony), v => !!v)), 'sent again');
  check(await until(() => page.evaluate(() => !!window.__fcClosed), v => v), 'and the page closes');
});

test('Send to Harmony: Apple Music sends no region, so Harmony uses its own settings', { tag: ['@unit'] }, async ({ page, context, inject }) => {
  await harmonyTabs(context);
  await stub(page, 'https://music.apple.com/gb/album/how-to-hit-what-and-how-hard/1264541452');
  await inject('first_contact', { waitFor: '__fcTest' });
  await page.locator('#fc-root .fc-harmony').click();
  const sent = await until(() => page.evaluate(() => window.__fcLastHarmony), v => !!v);
  check(sent === 'https://harmony.pulsewidth.org.uk/release?url=https%3A%2F%2Fmusic.apple.com%2Fgb%2Falbum%2F1264541452&category=preferred', `the link carries the store, no region: ${sent}`);
});

test('Send to Harmony: another platform goes by the barcode it reads first', { tag: ['@unit'] }, async ({ page, context, inject }) => {
  await harmonyTabs(context);
  await stub(page, 'https://volumo.com/album/12345-some-album');
  await inject('first_contact', { waitFor: '__fcTest' });
  const b = page.locator('#fc-root .fc-harmony');
  check(/read the barcode here first \(Harmony can't look up Volumo\)/.test(await b.getAttribute('title')), `the tooltip says it reads first: ${await b.getAttribute('title')}`);
  // the read itself is Volumo's (650-volumo-hdtracks-soundcloud); here it answers once released
  await page.evaluate(() => {
    const v = window.__fcTest.providers.find(p => p.id === 'volumo');
    v.fetchRelease = (id, progress) => new Promise(res => { progress(3, 12); window.__release = () => res({ barcode: '0880918228549' }); });
  });
  await b.click();
  const reading = await until(() => page.locator('#fc-root .fc-go span').textContent(), t => /^Reading Volumo for Harmony… 3\/12/.test(t));
  check(/^Reading Volumo for Harmony… 3\/12/.test(reading), `the button shows the read: ${reading}`);
  await page.evaluate(() => window.__release());
  const sent = await until(() => page.evaluate(() => window.__fcLastHarmony), v => !!v);
  check(sent === 'https://harmony.pulsewidth.org.uk/release?gtin=0880918228549&category=preferred', `the barcode: ${sent}`);
  check(await until(() => page.locator('#fc-root .fc-go span').textContent(), t => t === 'Import to MusicBrainz') === 'Import to MusicBrainz', 'Import reads as before once sent');

  // no barcode: nothing is sent, and the toast says why
  await page.evaluate(() => { window.__fcLastHarmony = null; window.__fcTest.providers.find(p => p.id === 'volumo').fetchRelease = async () => ({ barcode: null }); });
  await b.click();
  const toast = await until(() => page.evaluate(() => (document.getElementById('mbu-toast') || {}).textContent || ''), t => /no barcode/.test(t));
  check(/Volumo gives no barcode for this album/.test(toast), `the toast says why: ${toast}`);
  check(await page.evaluate(() => window.__fcLastHarmony) === null, 'nothing sent');
});

test('Send to Harmony: greyed out on YouTube Music; the setting hides it', { tag: ['@unit'] }, async ({ page, inject }) => {
  await stub(page, 'https://music.youtube.com/browse/MPREb_abcdefghijk');
  await inject('first_contact', { waitFor: '__fcTest' });
  const b = page.locator('#fc-root .fc-harmony');
  await b.waitFor({ state: 'visible' });
  check(await b.getAttribute('aria-disabled') === 'true', 'greyed out');
  check(/can't look up YouTube Music, and YouTube Music shows no barcode/.test(await b.getAttribute('title')), `the tooltip says why: ${await b.getAttribute('title')}`);
  await b.click({ force: true });   // aria-disabled: Playwright won't click it otherwise
  const toast = await until(() => page.evaluate(() => (document.getElementById('mbu-toast') || {}).textContent || ''), t => /YouTube Music/.test(t));
  check(/can't look up YouTube Music/.test(toast), `a click says why: ${toast}`);
  check(await page.evaluate(() => window.__fcLastHarmony || null) === null, 'and sends nothing');

  await page.locator('#fc-root .fc-more').click();
  const opt = page.locator('#fc-panel .fc-harmony-opt');
  check(await opt.isChecked(), 'the setting is on by default');
  await opt.uncheck();
  check(await until(() => b.isVisible(), v => !v) === false, 'off: the button goes at once');
  await opt.check();
  check(await until(() => b.isVisible(), v => v), 'on: it is back');
});
