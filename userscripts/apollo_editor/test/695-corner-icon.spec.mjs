// #695 (majkinetor): Apollo's corner launcher is its round icon, like every other
// corner launcher, not the "Original" + ⚙ pill. A click switches Apollo on and off,
// the icon wears a green status dot while Apollo is on, and a right-click
// opens the settings. Runs on test.musicbrainz.org.
import { test, check, attachShot, until, idle } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

test('the corner launcher is an icon: click switches, a status dot while on, right-click opens settings', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  await openApollo(page, inject, { release: '60e810ef-7ef1-4e90-8482-ab4653802786' });
  await page.waitForSelector('#tc-launch', { timeout: 10000 });
  const read = () => page.evaluate(() => {
    const b = document.getElementById('tc-launch'), r = b.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), text: b.textContent.trim(), svg: !!b.querySelector('img'), on: b.classList.contains('on'), dot: getComputedStyle(b, '::after').content !== 'none',
      title: b.title, apollo: window.__apolloEditor.apolloOn };
  });
  const a = await read();
  check(a.w === 40 && a.h === 40 && a.svg && !a.text, `a 40 px icon with no label (${JSON.stringify(a)})`);
  check(a.apollo && a.on && a.dot, 'a status dot while Apollo is on');
  check(/click/i.test(a.title) && /right-click: settings/i.test(a.title), `tooltip says what click and right-click do: ${a.title}`);
  await attachShot(testInfo, '#tc-launch', 'on');

  await page.click('#tc-launch');
  const b = await until(read, v => !v.apollo);
  check(!b.on && !b.dot, 'no dot while the original editor shows');
  await attachShot(testInfo, '#tc-launch', 'off');
  await page.click('#tc-launch');
  await until(read, v => v.apollo && v.on);
  await idle(page);

  await page.click('#tc-launch', { button: 'right' });
  await page.waitForSelector('#tc-settings', { timeout: 5000 });
  check(true, 'right-click opens the settings');
  check((await read()).apollo, 'the right-click did not switch Apollo');
  await page.click('#tc-launch', { button: 'right' });
  await until(() => page.evaluate(() => !document.getElementById('tc-settings')));
  check(true, 'a second right-click closes them');
});
