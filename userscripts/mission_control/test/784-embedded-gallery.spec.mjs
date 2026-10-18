// #784: Art Station's own gallery in Mission Control's cover-art card. Both scripts run for real: Art Station's
// frame (the cover-art page, sourcing from the release's Discogs link) shows over the card's slot, without
// MusicBrainz's page, clipped to the card; the wheel over it scrolls Mission Control; a cover opened full screen in
// it takes the whole window, and Esc gives the card back. Read-only: nothing is applied.
import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control', values: { 'mc.settings': JSON.stringify({ v: 2, reloadAfter: false }) } }, pageErrors: ['MB is not defined'] });

const RELEASE = '1c0d1707-e032-48a4-acd8-dbaac77be17f';   // Journey Inwards, linked to discogs.com/release/1118432 (front and back)

test('#784: the gallery shows in the card, scrolls with it and goes full screen', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await inject('art_station');
  page.on('frameattached', async f => {
    await f.waitForLoadState('domcontentloaded').catch(() => {});
    if (/mc_frame=/.test(f.url())) await inject('art_station', { target: f }).catch(e => console.log('frame inject: ' + e.message));
  });
  await page.waitForFunction(() => window.__mcTest.found().as);
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.locator('#mc-root #mc-as-slot').waitFor({ timeout: 200_000 });
  const fr = page.frames().find(f => /mc_frame=/.test(f.url()));
  await fr.waitForSelector('.as-sec-more', { timeout: 60_000 });
  await page.locator('#mc-root #mc-as-slot').scrollIntoViewIfNeeded();
  const geo = () => page.evaluate(() => {
    const s = document.getElementById('mc-as-slot').getBoundingClientRect(), f = document.querySelector('iframe[src*="mc_frame="]'), r = f.getBoundingClientRect();
    return { slot: [Math.round(s.left), Math.round(s.top), Math.round(s.width), Math.round(s.height)], frame: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], op: getComputedStyle(f).opacity };
  });
  const g = await until(geo, v => v.op === '1' && v.frame.join() === v.slot.join());
  console.log(JSON.stringify(g));
  check(g.op === '1' && g.frame.join() === g.slot.join() && g.slot[3] > 150, `the frame lies over the slot, the slot as tall as the gallery (${JSON.stringify(g)})`);
  const inFrame = await fr.evaluate(() => ({ embed: document.documentElement.classList.contains('as-embed'), header: !!(document.querySelector('.header, #header') || {}).offsetParent, more: document.querySelectorAll('.as-sec-more + .as-grid .as-card').length }));
  check(inFrame.embed && !inFrame.header && inFrame.more > 0, `the gallery alone, the store's other images left out in it (${JSON.stringify(inFrame)})`);
  // the whole gallery fits the frame: the last cards and the type pills hanging below them; the take-in button clear of NEW
  const fit = await until(() => fr.evaluate(() => {
    const low = Math.max(...[...document.querySelectorAll('.as-card, .as-foot-type, .as-type, .as-type-add')].map(x => x.getBoundingClientRect().bottom));
    const b = document.querySelector('.as-card.new .as-undo'), n = b && b.closest('.as-card').querySelector('.as-newban');
    return { low: Math.ceil(low), h: innerHeight, clear: !!(b && n && b.getBoundingClientRect().right <= n.getBoundingClientRect().left + 8) };
  }), v => v.low <= v.h);
  check(fit.low <= fit.h, `the gallery's lowest part is inside the frame (${JSON.stringify(fit)})`);
  check(fit.clear, `take in sits left of the NEW ribbon (${JSON.stringify(fit)})`);
  await page.screenshot({ path: 'test-results/mc-784-embedded.png' });

  // the wheel over the gallery scrolls Mission Control, and the frame follows the slot
  const scroller = () => page.evaluate(() => { let n = document.getElementById('mc-as-slot').parentElement; while (n && n.scrollHeight <= n.clientHeight) n = n.parentElement; return n ? n.scrollTop : -1; });
  const before = await scroller();
  await page.mouse.move(g.slot[0] + 40, Math.max(g.slot[1], 0) + 40);
  await page.mouse.wheel(0, 200);
  const after = await until(scroller, v => v !== before);
  check(after !== before, `the wheel over the gallery scrolls the card (${before} → ${after})`);
  const g2 = await until(geo, v => v.frame[1] === v.slot[1]);
  check(g2.frame[1] === g2.slot[1], `the frame follows the slot (${JSON.stringify(g2)})`);

  // a cover full screen: the frame takes the window; Esc gives the card back
  await fr.evaluate(() => document.querySelector('.as-card:not(.del) .as-thumb img').click());
  const full = await until(geo, v => v.frame[2] === 1400 && v.frame[3] === 900);
  check(full.frame.join() === '0,0,1400,900', `full screen takes the window (${JSON.stringify(full)})`);
  await page.screenshot({ path: 'test-results/mc-784-full.png' });
  await fr.locator('body').press('Escape');
  const back = await until(geo, v => v.frame.join() === v.slot.join());
  check(back.frame.join() === back.slot.join(), `Esc gives the card back (${JSON.stringify(back)})`);
});
