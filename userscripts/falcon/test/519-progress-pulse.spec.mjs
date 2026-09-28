// #519 (majkinetor): "Just like with CH and Apollo (#412) lets have progress
// bar flashing while operation is in process as a visual marker that
// operation is in progress." A plain static bar looks the same whether a
// run is actively grinding through the queue or just idle at its last
// finished percentage.
// #519 follow-up (majkinetor, live: "It doesn't work") — the first attempt
// pulsed #falcon-progress-bar, the FILL — which sits at 0% width (an
// actually-invisible 0px box) for as long as nothing has finished yet,
// exactly when the pulse matters most. Moved to #falcon-progress-track,
// the always-full-width backdrop behind it.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf } from '../../../dev/test/harness.mjs';

// the script brings its own GM stand-ins, as it did before the harness
test.use({ gm: false });

test("#519: progress pulse", { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');

  const ck = check;

  await context.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  const errs = []; 
  page.on('pageerror', e => errs.push(e.message));
  // hold every worker mid-flight — stalled forever — so `running` stays true
  // long enough to observe the class instead of racing to completion.
  await page.route('**/artist/*/edit*', route => new Promise(() => {}));
  await page.goto('https://test.musicbrainz.org/', { waitUntil: 'load' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page.click('#falcon-launcher');
  await page.waitForSelector('#falcon-panel', { timeout: 5000 });

  // 1. idle — no pulse class, nothing queued/running yet.
  const idle = await page.evaluate(() => document.getElementById('falcon-progress-track').classList.contains('falcon-running'));
  ck(idle === false, `no pulse class before anything starts (got ${idle})`);

  // 2. running — the class is present the moment start() fires, and critically
  // while the FILL is still at 0% (nothing has finished yet) — the exact
  // scenario the first attempt got wrong.
  await page.evaluate(() => {
    const t = window.__falconTest;
    t.setQueue([{ id: '1', entityType: 'artist', mbid: 'aaaaaaaa-5190-0000-0000-000000000001', urls: [{ url: 'https://x.com/1' }], isrcs: [], disambiguation: '', cover: [], status: 'queued', error: '' }]);
    t.start();
  });
  const running = await page.evaluate(() => ({
    pulsing: document.getElementById('falcon-progress-track').classList.contains('falcon-running'),
    isRunning: window.__falconTest.isRunning(),
    fillWidth: document.getElementById('falcon-progress-bar').getBoundingClientRect().width,
    trackWidth: document.getElementById('falcon-progress-track').getBoundingClientRect().width,
  }));
  console.log('while running:', JSON.stringify(running));
  ck(running.isRunning === true, 'sanity: the run is actually active');
  ck(running.fillWidth === 0, 'sanity: the fill really is 0px wide at this point — nothing has finished yet');
  ck(running.trackWidth > 0, `the TRACK stays visible even while the fill is invisible (got ${running.trackWidth}px)`);
  ck(running.pulsing === true, `the pulse class is present on the track while a run is in progress (got ${running.pulsing})`);

  // the keyframes/rule this class relies on actually exist AND are actually
  // applied (not just present in a stylesheet somewhere unused).
  const anim = await page.evaluate(() => {
    const track = document.getElementById('falcon-progress-track');
    const cs = getComputedStyle(track);
    return { name: cs.animationName, duration: cs.animationDuration };
  });
  console.log('computed animation on the track:', JSON.stringify(anim));
  ck(anim.name === 'falcon-progress-pulse', `the pulse animation is actually applied to the track (got "${anim.name}")`);

  // 3. stop() — the class comes back off, even with the item still parked mid-flight.
  await page.evaluate(() => window.__falconTest.stop());
  const afterStop = await page.evaluate(() => document.getElementById('falcon-progress-track').classList.contains('falcon-running'));
  ck(afterStop === false, `stop() clears the pulse immediately (got ${afterStop})`);

  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
});
