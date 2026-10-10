// #695 (majkinetor): Apollo's corner launcher is its round icon, like every other
// corner launcher, not the "Original" + ⚙ pill. A click switches Apollo on and off,
// the icon is in colour (monochrome while off) while Apollo is on, and a right-click
// opens the settings. Runs on test.musicbrainz.org.
import { test, check, attachShot, until, idle } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

test('the corner launcher is an icon: click switches, monochrome while off, right-click opens settings', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  await openApollo(page, inject, { release: '60e810ef-7ef1-4e90-8482-ab4653802786' });
  await page.waitForSelector('#tc-launch', { timeout: 10000 });
  const read = () => page.evaluate(() => {
    const b = document.getElementById('tc-launch'), r = b.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), text: b.textContent.trim(), svg: !!b.querySelector('img'), on: b.classList.contains('on'), grey: getComputedStyle(b.querySelector('img')).filter.includes('grayscale'),
      title: b.title, apollo: window.__apolloEditor.apolloOn };
  });
  const a = await read();
  check(a.w === 40 && a.h === 40 && a.svg && !a.text, `a 40 px icon with no label (${JSON.stringify(a)})`);
  check(a.apollo && a.on && !a.grey, 'in colour while Apollo is on');
  check(/click/i.test(a.title) && /right-click: settings/i.test(a.title), `tooltip says what click and right-click do: ${a.title}`);
  await attachShot(testInfo, '#tc-launch', 'on');

  await page.click('#tc-launch');
  const b = await until(read, v => !v.apollo);
  check(!b.on && b.grey, 'monochrome while the original editor shows');
  await attachShot(testInfo, '#tc-launch', 'off');
  await page.click('#tc-launch');
  await until(read, v => v.apollo && v.on);
  await idle(page);

  await page.click('#tc-launch', { button: 'right' });
  await page.waitForSelector('#tc-settings', { timeout: 5000 });
  check(true, 'right-click opens the settings');
  check((await read()).apollo, 'the right-click did not switch Apollo');
  for (const tab of ['general', 'matching', 'appearance']) {
    await page.click(`#tc-settings .tc-tab-btn[data-tab="${tab}"]`);
    const h = await page.evaluate(() => {
      const s = document.getElementById('tc-settings'), hd = s.querySelector('.mbu-cfg-h'), help = hd.querySelector('.mbu-help'), img = hd.querySelector('.mbu-cfg-ic img');
      const sr = s.getBoundingClientRect(), hr = help.getBoundingClientRect();
      return { img: !!img && img.src === document.querySelector('#tc-launch img').src, scrollX: s.scrollWidth - s.clientWidth, helpIn: hr.right <= sr.right - 1 };
    });
    check(h.img, `${tab}: the settings header wears the launcher's icon`);
    check(h.scrollX <= 0 && h.helpIn, `${tab}: the settings don't overflow sideways (${JSON.stringify(h)})`);
  }
  // a real time-stamped version (the harness shows "vtest") in wider fonts (Firefox) pushed Help out of the
  // header; squeeze the dialog to stand in for the wider fonts
  const sq = await page.evaluate(() => {
    const s = document.getElementById('tc-settings'); s.style.width = '300px';
    s.querySelector('.mbu-cfg-ver').textContent = 'v2026.10.10.100123';
    const sr = s.getBoundingClientRect(), hr = s.querySelector('.mbu-cfg-h .mbu-help').getBoundingClientRect();
    const r = { scrollX: s.scrollWidth - s.clientWidth, helpIn: hr.right <= sr.right - 1 }; s.style.width = ''; return r;
  });
  check(sq.scrollX <= 0 && sq.helpIn, `a cramped header shrinks the version, not pushes Help out (${JSON.stringify(sq)})`);
  await attachShot(testInfo, page.locator('#tc-settings'), 'settings');
  await page.click('#tc-launch', { button: 'right' });
  await until(() => page.evaluate(() => !document.getElementById('tc-settings')));
  check(true, 'a second right-click closes them');
});
