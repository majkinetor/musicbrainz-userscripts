import { test, check, until, attachShot, idle } from '../../../dev/test/harness.mjs';
import { RELEASE } from '../../art_station/test/as.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// a release's cover opens Art Station's viewer over Event Horizon's page, read-only
test('the cover opens Art Station\'s viewer', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await idle(page);
  await inject('art_station');
  await inject('event_horizon');
  const cover = page.locator('#app .art [data-relcover]');
  await cover.waitFor({ timeout: 30000 });
  await until(() => page.evaluate(() => document.querySelector('#app .art [data-relcover]')?.hasAttribute('data-full')), v => v);
  await cover.click();
  const lb = page.locator('#as-lb');
  check(await until(() => lb.isVisible(), v => v), 'the viewer opens');
  check(await page.locator('#as-root').count() === 0, 'no gallery is drawn');
  check(!await page.locator('#as-lb .as-lb-del').isVisible(), 'no delete button');
  check(!await page.locator('#as-lb .as-lb-rotwrap').isVisible(), 'no rotate buttons');
  const shown = () => page.evaluate(() => { const i = document.querySelector('#as-lb .as-lb-img'); return i.classList.contains('loading') ? '' : i.src; });
  const first = await until(shown, v => v);
  check(first, 'the image loads');
  await attachShot(testInfo, page, 'viewer');
  await page.keyboard.press('Escape');
  check(await until(() => lb.isVisible(), v => !v) === false, 'Esc closes it');
  // arrows walk the images it was given
  const answered = await page.evaluate(([release, image]) => {
    const ask = new CustomEvent('mbu-gallery-open', { cancelable: true, detail: JSON.stringify({ release, start: 1, images: [{ id: 1, types: ['Front'], comment: 'the sleeve', image }, { id: 2, types: ['Back'], image: image + '?second' }] }) });
    document.dispatchEvent(ask);
    return ask.defaultPrevented;
  }, [RELEASE, first]);
  check(answered, 'Art Station answers the event');
  await until(() => lb.isVisible(), v => v);
  const start = await until(shown, v => v);
  check(await until(() => page.locator('#as-lb .as-lb-cmt-text').textContent(), v => v === 'the sleeve') === 'the sleeve', 'the comment shows');
  check(/[0-9]+ *× *[0-9]+/.test(await until(() => page.locator('#as-lb .as-lb-cap').textContent(), v => /×/.test(v))), 'the dimensions show');
  await page.keyboard.press('ArrowRight');
  check(await until(shown, v => v && v !== start), 'the arrow moves to the next image');
});
