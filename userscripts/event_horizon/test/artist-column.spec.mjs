import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true } });

const cols = page => page.locator('.tr[data-row] .ar').count();

// Tracklist settings › Artist column by itself: on, a Various Artists release shows the column by itself;
// off, Show › Artist is one saved choice for every release
test('the Artist column follows the release, or your choice with the option off', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/');
  const id = await page.evaluate(async () => (await (await fetch('/ws/2/release?query=arid:89ad4ac3-39f7-470e-963a-56509c546377%20AND%20tracks:[4%20TO%2030]&limit=1&fmt=json')).json()).releases[0].id);
  const open = async () => {
    await page.goto('https://test.musicbrainz.org/release/' + id);
    await inject('event_horizon');
    await until(() => page.locator('.tr[data-row]').count(), n => n >= 2);
  };
  await open();
  check(await cols(page) > 0, 'a Various Artists release shows the column by itself');
  await page.locator('[data-plcfg="1"]').click();
  const chip = page.locator('#eh-plcfg [data-g=arAuto]');
  check(await until(() => chip.getAttribute('aria-pressed'), v => v !== null) === 'true', 'the option is on by default');
  await chip.click();
  check(await until(() => cols(page), n => n === 0) === 0, 'off: the column follows the saved choice, off at first');
  await page.keyboard.press('Escape');
  await page.locator('[data-arcol]').click();
  check(await until(() => cols(page), n => n > 0) > 0, 'Show › Artist turns it on');
  await open();
  check(await until(() => cols(page), n => n > 0) > 0, 'the choice is kept for the next release page');
});
