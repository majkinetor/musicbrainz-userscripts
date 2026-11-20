import { test, expect, idle } from '../../../dev/test/harness.mjs';
test.use({ gm: { name: 'Event Horizon' } });

for (const [k, v] of [['barcode', '5099749994324'], ['catno', 'CDP 7 46185 2'], ['mbid', 'a74b1b7f-71a5-4011-9441-d0b5e4122711']]) {
  test('an other lookup by ' + k + ' stays in the viewer', { tag: '@sandbox' }, async ({ page, inject }) => {
    const logs = []; page.on('console', m => logs.push(m.text()));
    await page.goto('https://test.musicbrainz.org/');
    await idle(page); await inject('event_horizon');
    await page.evaluate(() => { window.__kept = 1; });
    if (!(await page.locator('#app a.hm-all').isVisible())) await page.locator('#app .hm-tg').first().click();
    await page.locator('#app a.hm-all').click();
    const form = page.locator('#app form[data-sl]');
    await form.locator('[data-sl-add]').selectOption('other-lookup.' + k);
    await form.locator('.sl-row[data-f="other-lookup.' + k + '"] input').fill(v);
    await form.locator('.sl-row[data-f="other-lookup.' + k + '"] input').press('Enter');
    await page.waitForTimeout(6000);
    console.log(k, page.url(), logs.filter(l => /lookup|Search/i.test(l)).join(' | '));
    expect(await page.evaluate(() => window.__kept)).toBe(1);
  });
}
