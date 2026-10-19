// #784: on a phone, a finger swipe over Art Station's gallery scrolls Mission Control's card. The frame lies fixed
// over the card's slot, so the browser's own scroll chaining never reached the card: the page stuck on the gallery.
// Read-only: nothing is applied.
import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control', values: { 'mc.settings': JSON.stringify({ v: 2, reloadAfter: false }) } }, pageErrors: ['MB is not defined'],
  viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });

const RELEASE = '1c0d1707-e032-48a4-acd8-dbaac77be17f';   // Journey Inwards, linked to discogs.com/release/1118432 (see 784-embedded-gallery)

test('#784: a swipe over the gallery scrolls the card on a phone', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  test.setTimeout(240_000);
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await inject('art_station');
  page.on('frameattached', async f => {
    await f.waitForLoadState('domcontentloaded').catch(() => {});
    if (/mc_frame=/.test(f.url())) await inject('art_station', { target: f }).catch(e => console.log('frame inject: ' + e.message));
  });
  await page.waitForFunction(() => window.__mcTest.found().as);
  await page.evaluate(() => document.querySelector('#mc-launch').click());
  await page.waitForSelector('#mc-root');
  await page.evaluate(() => document.querySelector('#mc-root [data-act="probe"]').click());
  await page.locator('#mc-root #mc-as-slot').waitFor({ timeout: 200_000 });
  const fr = page.frames().find(f => /mc_frame=/.test(f.url()));
  await fr.waitForSelector('.as-card', { timeout: 60_000 });
  const scrollerAt = () => page.evaluate(() => { let n = document.getElementById('mc-as-slot').parentElement; while (n && n.scrollHeight <= n.clientHeight) n = n.parentElement; return n ? { top: Math.round(n.scrollTop), max: n.scrollHeight - n.clientHeight } : { top: -1, max: -1 }; });
  // the card settled (its height still changes while the gallery fills), then its slot near the top of the screen
  let last = '';
  await until(async () => { const v = JSON.stringify(await scrollerAt()) + (await page.evaluate(() => document.getElementById('mc-as-slot').style.height)); const same = v === last; last = v; await page.waitForTimeout(700); return same; }, Boolean);
  await page.evaluate(() => { const s = document.getElementById('mc-as-slot'); let n = s.parentElement; while (n && n.scrollHeight <= n.clientHeight) n = n.parentElement; n.scrollTop += s.getBoundingClientRect().top - 60; });
  const geo = () => page.evaluate(() => {
    const s = document.getElementById('mc-as-slot').getBoundingClientRect(), f = document.querySelector('iframe[src*="mc_frame="]').getBoundingClientRect();
    return { slot: [Math.round(s.left), Math.round(s.top), Math.round(s.width), Math.round(s.height)], frame: [Math.round(f.left), Math.round(f.top), Math.round(f.width), Math.round(f.height)] };
  });
  const g = await until(geo, v => v.frame.join() === v.slot.join() && v.slot[3] > 150);
  check(g.frame.join() === g.slot.join(), `the frame lies over the slot (${JSON.stringify(g)})`);
  const at = await scrollerAt();
  // a slow swipe over the gallery, finger up (down when the card is near its bottom already); slow, so no coast
  const x = g.slot[0] + 30, top = Math.max(g.slot[1], 0) + 20, bot = Math.min(g.slot[1] + g.slot[3], 790) - 20, up = at.max - at.top >= 120;
  const ys = up ? [bot, top] : [top, bot];
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', ys[0]);
  for (let i = 1; i <= 20; i++) { await touch('touchMove', ys[0] + (ys[1] - ys[0]) * i / 20); await page.waitForTimeout(30); }
  await touch('touchEnd');
  const want = v => up ? v.top - at.top > 60 : at.top - v.top > 60;
  const after = await until(scrollerAt, want);
  console.log(JSON.stringify({ g, at, after, ys }));
  check(want(after), `the swipe over the gallery scrolls the card ${up ? 'down' : 'up'} (${at.top} → ${after.top} of ${at.max})`);
  const g2 = await until(geo, v => v.frame[1] === v.slot[1]);
  check(g2.frame[1] === g2.slot[1], `the frame follows the slot (${JSON.stringify(g2)})`);
});
