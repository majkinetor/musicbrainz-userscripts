// The wheel over the bar seeks (so you can scrub without aiming at the seek bar), but
// not over the parts that scroll or adjust on their own:
// - over the volume control it changes the volume, by VOL_STEP per tick;
// - over the open track dropdown it scrolls the list. The dropdown is a DOM child of
//   the bar even though it renders elsewhere, so every tick used to seek instead.
import { test, check } from '../../../dev/test/harness.mjs';

const ALBUM = 'https://phoebebridgers.bandcamp.com/album/punisher';   // 11 tracks: the dropdown scrolls
const PLAY_ABORT = 'play\\(\\) request was interrupted by a call to pause\\(\\)';
// a known volume, as for a user who saved one before
test.use({ profile: 'fresh', gm: { name: 'Bandcamp Player Enhanced', values: { bcp_volume: '0.5', bcp_muted: '0' } }, pageErrors: [PLAY_ABORT] });

test('the wheel seeks over the bar, but sets the volume over its control and scrolls the open dropdown', { tag: ['@web'] }, async ({ page, inject }) => {
  await page.goto(ALBUM, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await inject('bandcamp_player_enhanced');
  await page.waitForSelector('#bc-sticky-player', { timeout: 15000 });
  await page.waitForTimeout(500);

  const time = () => page.evaluate(() => (document.querySelector('audio') || {}).currentTime || 0);
  const vol = () => page.evaluate(() => parseFloat(document.getElementById('bcp-vol').value));
  const hover = async sel => { const b = await page.locator(sel).boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + Math.min(40, b.height / 2)); };
  const wheel = async dy => { await page.mouse.wheel(0, dy); await page.waitForTimeout(200); };

  // over the bar: seek
  await hover('#bcp-time');
  let t0 = await time(); await wheel(-100);
  let t1 = await time();
  check(t1 - t0 >= 3, `the wheel over the bar seeks forward ~5 s (${t0} → ${t1})`);

  // over the volume control: volume, no seek
  await hover('.bcp-vol-wrap');
  const v0 = await vol(); t0 = await time();
  await wheel(-100);
  const v1 = await vol(); t1 = await time();
  check(v1 > v0, `the wheel up over the volume control raises the volume (${v0} → ${v1})`);
  check(Math.abs(t1 - t0) < 1, `…and doesn't seek (${t0} → ${t1})`);
  await wheel(100); await wheel(100);
  const v2 = await vol();
  check(v2 < v1, `the wheel down lowers it (${v1} → ${v2})`);

  // over the open dropdown: scroll, no seek
  await page.click('#bcp-info');
  await page.waitForTimeout(200);
  check(await page.evaluate(() => document.getElementById('bcp-dropdown').classList.contains('open')), 'the track dropdown opens');
  await hover('#bcp-dropdown');
  const s0 = await page.evaluate(() => document.getElementById('bcp-dropdown').scrollTop); t0 = await time();
  await wheel(400);
  const s1 = await page.evaluate(() => document.getElementById('bcp-dropdown').scrollTop); t1 = await time();
  check(s1 > s0, `the wheel over the open dropdown scrolls the list (${s0} → ${s1})`);
  check(Math.abs(t1 - t0) < 1, `…and doesn't seek (${t0} → ${t1})`);
});
