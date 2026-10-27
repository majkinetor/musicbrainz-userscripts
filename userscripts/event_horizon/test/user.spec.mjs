import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

test('an editor\'s profile shows its hero and statistics', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/user/majkinetor');
  await inject('event_horizon');
  check(await until(() => page.locator('.u-hero h1').textContent(), t => t === 'majkinetor') === 'majkinetor', 'the hero names the editor');
  const secs = await until(() => page.evaluate(() => [...document.querySelectorAll('#app>section.sec')].map(x => x.id)), v => v.length >= 3);
  check(['s-ued', 's-uvo', 's-uad'].every(x => secs.includes(x)), 'the statistics sections: ' + secs.join(', '));
  check(await page.locator('#s-ued .u-st').count() >= 8, 'the edits show as tiles');
  check(await page.locator('.u-tabs a.u-tab').count() >= 3, 'the profile\'s tabs link on');
  await attachShot(testInfo, page, 'user');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT, fullPage: true });
});

for (const [path, form] of [['/account/edit', 'Edit profile'], ['/account/preferences', 'Preferences'], ['/user/majkinetor/subscriptions/artist', 'Subscriptions'], ['/user/majkinetor/subscribers', 'Subscribers']]) {
  test(`an editor's ${form.toLowerCase()} page keeps MusicBrainz's page under the editor's header`, { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
    await page.goto('https://test.musicbrainz.org' + path);
    await inject('event_horizon');
    check(await until(() => page.locator('#eh-relhd .kicker').textContent(), t => t && t.includes(form)), 'the header names the page');
    check(await page.locator('#eh-relhd .u-tab').count() >= 3, 'the editor\'s tabs are in the header');
    check(!(await page.locator('#content ul.tabs').isVisible()), 'MusicBrainz\'s own tabs hide');
    check(await page.locator('#eh-relhd .u-av').evaluate(e => getComputedStyle(e).borderRadius) === '50%', 'EH\'s styles apply, CSP or not');
    await attachShot(testInfo, page, form.replace(/ /g, '-').toLowerCase());
    if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT.replace('.png', '-' + form.replace(/ /g, '-').toLowerCase() + '.png'), fullPage: true });
  });
}
