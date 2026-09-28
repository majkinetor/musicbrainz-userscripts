// #511: "Start from track 1" (on by default) used to click the first track to warm the
// buffer. Bandcamp pauses any OTHER tab the moment a new tab's <audio> starts playing,
// even muted, so opening a second album tab stopped the first one's playback. The
// preload now calls Bandcamp's own gplaylist.set_initial_track(0), which picks the
// track a later Play starts from without touching the <audio> element.
import { test, check, until, idle } from '../../../dev/test/harness.mjs';

const ALBUM = 'https://phoebebridgers.bandcamp.com/album/stranger-in-the-alps';
const PLAY_ABORT = 'play\\(\\) request was interrupted by a call to pause\\(\\)';
const GM = { name: 'Bandcamp Player Enhanced' };
test.use({ profile: 'fresh', gm: GM, pageErrors: [PLAY_ABORT] });

const playerState = page => page.evaluate(() => {
  const a = document.querySelector('audio');
  return { track: window.gplaylist?._track, state: window.gplaylist?._state, src: !!(a && a.src) };
});

test('a second tab picks track 1 without playing, so the first tab keeps playing', { tag: ['@web', '@critical'] }, async ({ context, page, inject }) => {
  // tab A really plays
  await page.goto(ALBUM, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.gplaylist && document.querySelector('.playbutton'), null, { timeout: 30000 });
  await page.evaluate(() => document.querySelector('.playbutton').click());
  check(await until(() => page.evaluate(() => { const a = document.querySelector('audio'); return !!a && !a.paused; })), 'tab A is playing before tab B opens');

  // tab B loads the same album with the script
  const tabB = await context.newPage();
  await tabB.goto(ALBUM, { waitUntil: 'domcontentloaded' });
  await idle(tabB);
  await inject('bandcamp_player_enhanced', { target: tabB });
  await tabB.waitForSelector('#bc-sticky-player', { timeout: 15000 });

  // the preload has run once track 1 is picked; "nothing played" is read then
  const b = await until(() => playerState(tabB), b => b.track === 0);
  check(b.track === 0, `tab B picked the first track (${b.track})`);
  check(b.state === 'IDLE' && !b.src, `tab B never started playing, nor loaded audio (${b.state}, src ${b.src})`);
  check(await page.evaluate(() => !document.querySelector('audio')?.paused), 'tab A is STILL playing');
  // the title is read from TralbumData through the page's window (unsafeWindow, #501)
  const [title, first] = await tabB.evaluate(() => [document.getElementById('bcp-title')?.textContent, window.TralbumData?.trackinfo?.[0]?.title]);
  check(title && title === first, `tab B shows track 1's title though nothing played ("${title}", expected "${first}")`);
  check(await tabB.evaluate(() => document.getElementById('bcp-opt-preload')?.checked), '"Start from track 1" is on by default');
});

test.describe('with "Start from track 1" off', () => {
  test.use({ gm: { ...GM, values: { bcp_preload: '0' } } });
  test("Bandcamp's own track choice is left alone", { tag: ['@web'] }, async ({ page, inject }) => {
    await page.goto(ALBUM, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.gplaylist, null, { timeout: 30000 });
    await idle(page);
    const own = await page.evaluate(() => window.gplaylist?._track);
    await inject('bandcamp_player_enhanced');
    await page.waitForSelector('#bc-sticky-player', { timeout: 15000 });
    // the script has read its settings once the box shows them; the track is read then
    await page.waitForFunction(() => document.getElementById('bcp-opt-preload'), null, { timeout: 15000 });
    await idle(page);
    const s = await playerState(page);
    check(await page.evaluate(() => document.getElementById('bcp-opt-preload')?.checked === false), 'the box shows the saved "off"');
    check(s.track === own, `the track stays Bandcamp's own (${own} → ${s.track})`);
  });
});
