// #766 (chaban-mb): "Other tools such as Harmony … format ISRCs to make them more readable for
// humans." majkinetor: "make it optional, on by default. MC takes format sent by Scout".
//
// The tracklist's ISRC column on test.musicbrainz.org: CC-XXX-YY-NNNNN on screen, the plain code
// in the DOM (what a copy takes), and the setting, shared with Mission Control, turns it off.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });

// what is drawn: the parts and the dash CSS puts after each (innerText leaves ::after out)
const cells = page => page.evaluate(() => [...document.querySelectorAll('.ii-trk-isrc')].map(a => {
  const parts = [...a.querySelectorAll('.ii-isrcf > span')];
  const shown = parts.length ? parts.map(p => p.textContent + (getComputedStyle(p, '::after').content.replace(/^none$/, '').replace(/"/g, ''))).join('') : a.textContent;
  return { text: a.textContent, shown };
}));

test('ISRCs in parts by default, plain in a copy, and the shared setting turns it off', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await openScout(page, inject, { open: false });
  try {
    // a page-load lookup MusicBrainz throttled leaves "?"; the dialog loads it again (#607)
    const status = await until(() => page.evaluate(() => document.getElementById('ii-btn-status')?.textContent || ''), t => /^[✓⚠?]/.test(t), { timeout: 45000 });
    if (status.startsWith('?')) { await page.evaluate(() => document.getElementById('ii-btn').click()); await page.waitForSelector('#ii-modal.open', { timeout: 15000 }); await page.keyboard.press('Escape'); }
    const on = await until(() => cells(page), c => c.length > 0, { timeout: 45000 });
    console.log('on: ' + JSON.stringify(on.slice(0, 2)));
    check(on.length && on.every(c => /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(c.text)), 'the DOM text is the plain ISRC');
    check(on.length && on.every(c => /^[A-Z]{2}-[A-Z0-9]{3}-\d{2}-\d{5}$/.test(c.shown)), 'shown as CC-XXX-YY-NNNNN');
    await page.evaluate(() => document.getElementById('ii-btn').click());
    await page.waitForSelector('#ii-modal.open', { timeout: 15000 });
    check(await page.evaluate(() => document.getElementById('ii-isrc-format').checked), 'the setting is on by default');
    await page.evaluate(() => document.getElementById('ii-isrc-format').click());
    check(await page.evaluate(() => localStorage.getItem('mbu.isrcFormat')) === 'false', 'off is stored in shared storage, for Mission Control');
    const off = await until(() => cells(page), c => c.length > 0 && c.every(x => x.shown === x.text), { timeout: 45000 });
    check(off.length && off.every(c => c.shown === c.text), 'off: the tracklist shows the plain ISRC');
  } finally {
    await page.evaluate(() => localStorage.removeItem('mbu.isrcFormat'));
  }
});
