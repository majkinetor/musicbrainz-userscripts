// #695 (majkinetor): Art Station's corner launcher is its round icon, like every
// other corner launcher, not the "Original" + ⚙ pill. A click switches between
// Art Station and MusicBrainz's own page, the icon wears a green status dot
// while Art Station shows, and a right-click opens the settings. Runs on
// test.musicbrainz.org.
import { test, check, attachShot, until } from '../../../dev/test/harness.mjs';
import { openArtStation } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

test('the corner launcher is an icon: click switches, a status dot while on, right-click opens settings', { tag: ['@sandbox'] }, async ({ page, inject }, testInfo) => {
  await openArtStation(page, inject);
  const read = () => page.evaluate(() => {
    const b = document.getElementById('as-switch'), r = b.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), text: b.textContent.trim(), img: !!b.querySelector('img'), on: b.classList.contains('on'), dot: getComputedStyle(b, '::after').content !== 'none',
      title: b.title, gear: !!document.getElementById('as-setup-btn'), asShown: !document.getElementById('as-root').classList.contains('as-orig') };
  });
  const a = await read();
  check(a.w === 40 && a.h === 40 && a.img && !a.text, `a 40 px icon with no label (${JSON.stringify(a)})`);
  check(!a.gear, 'no separate gear button');
  check(a.on && a.dot && a.asShown, 'a status dot while Art Station shows');
  check(/click/i.test(a.title) && /right-click: settings/i.test(a.title), `tooltip says what click and right-click do: ${a.title}`);
  await attachShot(testInfo, '#as-switch', 'on');

  await page.click('#as-switch');
  const b = await until(read, v => !v.asShown);
  check(!b.on && !b.dot, 'no dot while the original page shows');
  await attachShot(testInfo, '#as-switch', 'off');
  await page.click('#as-switch');
  await until(read, v => v.asShown && v.on);

  await page.click('#as-switch', { button: 'right' });
  await page.waitForSelector('#as-setup', { timeout: 5000 });
  check(true, 'right-click opens the settings');
  check((await read()).asShown, 'the right-click did not switch the page');
  await page.click('#as-switch', { button: 'right' });
  await until(() => page.evaluate(() => !document.getElementById('as-setup')));
  check(true, 'a second right-click closes them');
});
