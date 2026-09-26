// #501: the settings moved from localStorage to GM storage. When GM storage has no
// value yet, the old localStorage one is adopted once; the old key stays in place.
import { test, check } from '../../../dev/test/harness.mjs';

const ALBUM = 'https://phoebebridgers.bandcamp.com/album/punisher';
const PLAY_ABORT = 'play\\(\\) request was interrupted by a call to pause\\(\\)';
test.use({ profile: 'fresh', gm: { name: 'Bandcamp Player Enhanced' }, pageErrors: [PLAY_ABORT] });

test('old localStorage settings are adopted into GM storage', { tag: ['@web'] }, async ({ page, inject }) => {
  await page.goto(ALBUM, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('bcp_theme', 'dark');
    localStorage.setItem('bcp_scale', '85');
    localStorage.setItem('bcp_hide_opts', JSON.stringify({ player: true, tracklist: true, tags: false }));
  });
  await inject('bandcamp_player_enhanced');
  await page.waitForSelector('#bc-sticky-player', { timeout: 15000 });
  await page.waitForTimeout(500);

  const m = await page.evaluate(() => ({
    theme: GM_getValue('bcp_theme'), scale: GM_getValue('bcp_scale'), hide: JSON.parse(GM_getValue('bcp_hide_opts') || 'null'),
    oldKept: localStorage.getItem('bcp_theme') !== null,
    bg: getComputedStyle(document.getElementById('bc-sticky-player')).backgroundColor,
  }));
  check(m.theme === 'dark' && m.scale === '85', `the theme and the scale are adopted (${m.theme}, ${m.scale})`);
  check(m.hide && m.hide.tracklist === true, `the hidden parts are adopted (${JSON.stringify(m.hide)})`);
  check(m.bg === 'rgb(20, 20, 20)', `the adopted theme is applied (${m.bg})`);
  check(m.oldKept, 'the old localStorage key is left in place');
});
