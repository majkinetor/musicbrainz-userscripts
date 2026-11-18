import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

test('an editor\'s profile shows its hero and statistics', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/user/majkinetor');
  await inject('event_horizon');
  check(await until(() => page.locator('.u-hero h1').textContent(), t => t === 'majkinetor') === 'majkinetor', 'the hero names the editor');
  const secs = await until(() => page.evaluate(() => [...document.querySelectorAll('#app>section.sec')].map(x => x.id)), v => v.length >= 3);
  check(['s-ued', 's-uvo', 's-uad'].every(x => secs.includes(x)), 'the statistics sections: ' + secs.join(', '));
  check(await page.locator('#s-ued .u-st').count() >= 8, 'the edits show as tiles');
  check(await page.locator('.u-nav a.u-nt').count() >= 3, "the profile's tabs link on");
  check(await page.locator('.u-nav a.u-nt.on').count() === 1, 'the open page is marked');
  check(await page.locator('.u-nav .u-ng.acc a.u-nti[data-tip]').count() >= 4, 'the account pages are icons with a tip');
  check(await page.locator('.u-nav .u-ng.acc a.u-nti').last().getAttribute('href').then(h => h.endsWith('/account/donation')), 'Donation check comes last');
  check(await page.locator('.u-nav .u-dd .u-ddm a').count() === 2, 'Subscriptions and Subscribers are one menu');
  await page.locator('.u-nav .u-dd > a.u-nt').hover();
  check(await page.locator('.u-nav .u-ddm').isVisible(), 'the menu opens on hover');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT.replace('.png', '-menu.png'), clip: { x: 0, y: 0, width: 1400, height: 520 } });
  await attachShot(testInfo, page, 'user');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT, fullPage: true });
});

for (const [path, form] of [['/account/edit', 'Edit profile'], ['/account/preferences', 'Preferences'], ['/account/donation', 'Donation check'], ['/account/applications', 'Applications'], ['/user/majkinetor/subscriptions/artist', 'Subscriptions'], ['/user/majkinetor/subscribers', 'Subscribers']]) {
  test(`an editor's ${form.toLowerCase()} page keeps MusicBrainz's page under the editor's header`, { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
    await page.goto('https://test.musicbrainz.org' + path);
    await inject('event_horizon');
    // account tabs are icons named by their tip; Subscribers sits in the Subscriptions menu
    const mark = form === 'Subscribers' ? 'Subscriptions' : form;
    check(await until(() => page.locator('#eh-relhd .u-nt.on').evaluate(e => e.getAttribute('aria-label') || e.textContent), t => t && t.includes(mark)), 'the header marks the page');
    if (form.startsWith('Subscri')) check(await page.locator('#eh-relhd .u-ddm a.on').count() === 1, 'the menu marks the open page');
    check(await page.locator('#eh-relhd .u-nt').count() >= 3, 'the editor\'s tabs are in the header');
    check(!(await page.locator('#content ul.tabs').isVisible()), 'MusicBrainz\'s own tabs hide');
    check(await page.locator('#eh-relhd .u-av').evaluate(e => getComputedStyle(e).borderRadius) === '50%', 'EH\'s styles apply, CSP or not');
    await attachShot(testInfo, page, form.replace(/ /g, '-').toLowerCase());
    if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT.replace('.png', '-' + form.replace(/ /g, '-').toLowerCase() + '.png'), fullPage: true });
  });
}
