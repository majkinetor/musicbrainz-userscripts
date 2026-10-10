// majkinetor: Falcon's corner launcher showed through Art Station's settings panel
// (the launchers sit at 2147483000, the panel was at 99999), and the panel's
// shared header sat flush against its border. Runs on test.musicbrainz.org.
import { test, check, attachShot } from '../../../dev/test/harness.mjs';
import { openArtStation } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

test('the settings panel covers the corner launchers, and its header has padding', { tag: ['@sandbox', '@cosmetic'] }, async ({ page, inject }, testInfo) => {
  await openArtStation(page, inject);
  // a launcher under the panel, standing in for Falcon's (same inline z-index)
  await page.evaluate(() => {
    const b = document.createElement('button'); b.id = 'fake-launcher';
    b.style.cssText = 'position:fixed;right:30px;bottom:80px;z-index:2147483000;width:40px;height:40px;border-radius:50%;border:none;background:red';
    document.body.appendChild(b);
  });
  await page.click('#as-switch', { button: 'right' });
  await page.waitForSelector('#as-setup', { timeout: 5000 });
  const r = await page.evaluate(() => {
    const l = document.getElementById('fake-launcher').getBoundingClientRect();
    const top = document.elementFromPoint(l.left + l.width / 2, l.top + l.height / 2);
    const p = document.getElementById('as-setup').getBoundingClientRect();
    const h = document.querySelector('#as-setup>.mbu-cfg-h');
    const help = h.querySelector('.mbu-help')?.getBoundingClientRect();
    const name = h.querySelector('.mbu-cfg-name').getBoundingClientRect();
    return { covered: !!top?.closest('#as-setup'), helpRight: help ? Math.round(p.right - help.right) : null, helpTop: help ? Math.round(help.top - p.top) : null, nameLeft: Math.round(name.left - p.left) };
  });
  await attachShot(testInfo, '#as-setup', 'settings');
  check(r.covered, 'the panel is on top of a corner launcher');
  check(r.helpRight === null || r.helpRight >= 8, `Help keeps off the right border (${r.helpRight} px)`);
  check(r.helpTop === null || r.helpTop >= 6, `Help keeps off the top border (${r.helpTop} px)`);
  check(r.nameLeft >= 8, `the header keeps off the left border (${r.nameLeft} px)`);
});
