// The settings panel: theme, the page parts to hide, and the player's scale. Each
// applies at once, without a reload, and survives one (GM storage).
//
// - Theme: light by default; the whole bar is driven by custom properties that
//   .bcp-light overrides.
// - Hidden parts: the native player is hidden by default (the bar replaces it); the
//   track list and tags show until ticked.
// - Scale (70–130%): CSS zoom on the bar. The page's top padding and the dropdown and
//   panel offsets follow the bar's real height, and the panel itself keeps its size.
//   The font stack no longer leads with Courier New.
import { test, check } from '../../../dev/test/harness.mjs';

const ALBUM = 'https://phoebebridgers.bandcamp.com/album/punisher';
// Bandcamp's own player logs this when a play() is cut short; not ours
const PLAY_ABORT = 'play\\(\\) request was interrupted by a call to pause\\(\\)';
test.use({ profile: 'fresh', gm: { name: 'Bandcamp Player Enhanced', persist: true }, pageErrors: [PLAY_ABORT] });

async function load(page, inject) {
  await page.waitForTimeout(500);
  await inject('bandcamp_player_enhanced');
  await page.waitForSelector('#bc-sticky-player', { timeout: 15000 });
  await page.waitForTimeout(500);
}

test('theme, hidden parts and scale apply at once and survive a reload', { tag: ['@web', '@critical'] }, async ({ page, inject }) => {
  await page.goto(ALBUM, { waitUntil: 'domcontentloaded' });
  await load(page, inject);

  const state = () => page.evaluate(() => {
    const bar = document.getElementById('bc-sticky-player');
    const vis = sel => { const el = document.querySelector(sel); return el ? getComputedStyle(el).display !== 'none' : null; };
    const $ = id => document.getElementById(id);
    return {
      bg: getComputedStyle(bar).backgroundColor, light: bar.classList.contains('bcp-light'),
      player: vis('#player, .inline_player'), tracklist: vis('.track_list, ol.track_list, table.track_list'), tags: vis('.tralbum-tags, .tags'),
      barHeight: Math.round(bar.getBoundingClientRect().height),
      bodyPadding: parseInt(getComputedStyle(document.body).paddingTop, 10),
      ddTop: parseInt(getComputedStyle($('bcp-dropdown')).top, 10), spTop: parseInt(getComputedStyle($('bcp-settings-panel')).top, 10),
      font: getComputedStyle(bar).fontFamily,
      panelOpen: $('bcp-settings-panel').classList.contains('open'),
      panel: (r => ({ w: Math.round(r.width), h: Math.round(r.height) }))($('bcp-settings-panel').getBoundingClientRect()),
      boxes: { player: $('bcp-opt-player').checked, tracklist: $('bcp-opt-tracklist').checked, dark: $('bcp-opt-theme-dark').checked, scale: $('bcp-opt-scale').value },
    };
  });

  // defaults
  const d = await state();
  check(d.bg === 'rgb(255, 255, 255)', `the light theme is the default (${d.bg})`);
  check(d.player === false && d.tracklist === true && d.tags === true, `the native player is hidden; the track list and tags show (${d.player}, ${d.tracklist}, ${d.tags})`);
  check(d.bodyPadding === d.barHeight, `the page's top padding is the bar's height (${d.bodyPadding} vs ${d.barHeight})`);
  check(!/^courier/i.test(d.font), `the font stack doesn't lead with Courier New (${d.font})`);

  await page.click('#bcp-settings');
  await page.waitForTimeout(150);
  const opened = await state();
  check(opened.panelOpen, 'the gear opens the settings panel');
  check(opened.boxes.player === true, 'the "Native player" box is ticked by default');

  // each change applies at once
  await page.click('#bcp-opt-theme-dark');
  await page.click('#bcp-opt-tracklist');
  await page.fill('#bcp-opt-scale', '70');
  await page.dispatchEvent('#bcp-opt-scale', 'input');
  await page.waitForTimeout(200);
  const live = await state();
  check(live.bg === 'rgb(20, 20, 20)' && !live.light, `Dark applies at once (${live.bg})`);
  check(live.tracklist === false && live.player === false && live.tags === true, `ticking "Track list" hides it and nothing else (${live.player}, ${live.tracklist}, ${live.tags})`);
  check(live.barHeight < d.barHeight, `at 70% the bar is smaller (${live.barHeight} < ${d.barHeight})`);
  check(live.bodyPadding === live.barHeight, `the top padding follows the smaller bar (${live.bodyPadding} vs ${live.barHeight})`);
  check(Math.abs(live.ddTop - (live.barHeight + 2)) <= 1 && Math.abs(live.spTop - (live.barHeight + 2)) <= 1, `the dropdown and the panel sit just below it (${live.ddTop}, ${live.spTop} vs ~${live.barHeight + 2})`);
  check(live.panelOpen, 'the panel stays open through a scale change');
  check(Math.abs(live.panel.w - opened.panel.w) < 2 && Math.abs(live.panel.h - opened.panel.h) < 2, `the panel keeps its size at any scale (${JSON.stringify(opened.panel)} → ${JSON.stringify(live.panel)})`);

  // a click outside closes the panel (#bcp-time: #bcp-info and #bcp-title keep their clicks for the dropdown)
  await page.click('#bcp-time');
  await page.waitForTimeout(150);
  check(!(await state()).panelOpen, 'a click outside closes the panel');

  // …and all of it survives a reload
  await page.reload({ waitUntil: 'domcontentloaded' });
  await load(page, inject);
  const after = await state();
  check(after.bg === 'rgb(20, 20, 20)' && after.boxes.dark, `the dark theme survives a reload (${after.bg}, radio ${after.boxes.dark})`);
  check(after.tracklist === false && after.boxes.tracklist, `the hidden track list survives a reload (${after.tracklist}, box ${after.boxes.tracklist})`);
  check(after.player === false && after.tags === true, 'the untouched parts keep their defaults');
  check(after.boxes.scale === '70' && after.bodyPadding === after.barHeight, `the 70% scale survives a reload, padding still following (${after.boxes.scale}, ${after.bodyPadding} vs ${after.barHeight})`);

  // and back to Light
  await page.click('#bcp-settings');
  await page.waitForTimeout(150);
  await page.click('#bcp-opt-theme-light');
  await page.waitForTimeout(150);
  check((await state()).bg === 'rgb(255, 255, 255)', 'switching back to Light works');
});
