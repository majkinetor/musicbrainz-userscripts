import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

test("an empty search shows our tip, not the browser's, with the type letters", { tag: '@prod' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://musicbrainz.org/search?query=music&type=series&method=indexed');
  await inject('event_horizon');
  await until(() => page.locator('#app .hm-srch input[name=query]').count(), n => n === 1);
  const box = page.locator('.hm-srch input[name=query]');
  await box.fill('');
  await box.press('Enter');
  const tip = page.locator('#mbu-tip.mbu-tip-on');
  check(await until(() => tip.count(), n => n === 1) === 1, 'the tip shows');
  const t = await tip.textContent();
  check(/Type what to search for/.test(t) && /w yesterday/.test(t) && /e.editor/.test(t), 'it says what to do and lists the letters');
  check(/type=series/.test(page.url()), 'nothing was searched');
  await attachShot(testInfo, page, 'empty');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT, clip: { x: 0, y: 0, width: 1400, height: 500 } });
  await box.pressSequentially('x');
  check(await until(() => tip.count(), n => n === 0) === 0, 'typing hides it');
});

test.describe('with recent searches in the field', () => {
  test.use({ gm: { name: 'Event Horizon', values: { view: { hmQs: 'combo' }, searches: [{ q: 'yesterday', t: 'work' }, { q: 'hania', t: 'artist' }, { q: 'majkinetor', t: 'editor' }] } } });
  test('the list shows only the chosen type\'s searches', { tag: '@prod' }, async ({ page, inject }, testInfo) => {
    await page.goto('https://musicbrainz.org/search?query=music&type=work&method=indexed');
    await inject('event_horizon');
    await until(() => page.locator('#app .hm-srch .hm-qc').count(), n => n === 1);
    const shown = () => page.locator('.hm-qd button:not([hidden])').allTextContents();
    await page.locator('.hm-srch input[name=query]').fill('');
    if (await page.locator('.hm-qd').isHidden()) await page.locator('.hm-qc').click();
    check(await page.locator('.hm-qd').isVisible(), 'the list is open');
    check((s => s.includes('yesterday') && !s.includes('hania') && !s.includes('majkinetor'))(await shown()), 'Work shows only works: ' + await shown());
    await attachShot(testInfo, page, 'work');
    if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT.replace('.png', '-combo.png'), clip: { x: 0, y: 0, width: 1400, height: 500 } });
    await page.locator('.hm-srch input[name=query]').pressSequentially('e ');
    check(await page.locator('.hm-srch .hm-ty').textContent() === 'Editor', 'e and a space picks Editor');
    if (await page.locator('.hm-qd').isHidden()) await page.locator('.hm-qc').click();
    check(await page.locator('.hm-qd').isVisible(), 'the list is open on Editor');
    check(JSON.stringify(await shown()) === '["majkinetor"]', 'Editor shows only its search: ' + await shown());
  });
});
