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
  await page.evaluate(() => document.getElementById('mc-as-slot').scrollIntoView({ block: 'center' }));   // the slot of now: a repaint makes a new one
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
  // and shows: the last row's type pills hang below its cards, outside the body's box, which mustn't clip them
  const pill = await fr.evaluate(() => {
    const ps = [...document.querySelectorAll('.as-foot-type > *')], p = ps.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0], r = p.getBoundingClientRect();
    const e = document.elementFromPoint(r.left + r.width / 2, r.bottom - 3);
    return { shown: !!(e && p.contains(e)), at: e && e.tagName + '.' + e.className };
  });
  check(pill.shown, `the lowest type pill shows whole (${JSON.stringify(pill)})`);
  await page.screenshot({ path: 'test-results/mc-784-embedded.png' });
  // a store's take all in takes in each of its images that isn't a duplicate, after the covers; a duplicate stays
  // left out, with no take in and no type
  await until(() => fr.evaluate(() => !!document.querySelector('.as-more-all:not([disabled])')));
  const all = await fr.evaluate(async () => {
    const more = () => [...document.querySelectorAll('.as-sec-more + .as-grid .as-card')];
    const b = document.querySelector('.as-more-all:not([disabled])'), p = b && b.dataset.prov;
    const n = more().filter(c => !c.querySelector('.as-mcdup')).length;
    b.click();
    await new Promise(r => setTimeout(r, 300));
    const dups = more().filter(c => c.querySelector('.as-mcdup'));
    return { p, n, sy: window.scrollY, left: more().filter(c => !c.querySelector('.as-mcdup')).length, dups: dups.length, bare: dups.every(c => !c.querySelector('.as-undo, .as-foot-type')), last: !!document.querySelector('.as-grid .as-card.new:not(.del)') };
  });
  check(all.p && all.n > 0 && all.left < all.n && all.last, `take all in takes in the ${all.p} images that aren't duplicates (${JSON.stringify(all)})`);
  check(all.bare, `a duplicate has no take in and no type (${JSON.stringify(all)})`);
  // the frame never scrolls, or the gallery's bottom is cut off in the card
  const pinned = await fr.evaluate(async () => {
    window.scrollTo(0, 40);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return window.scrollY;
  });
  check(pinned === 0, `the frame stays scrolled to its top (${pinned})`);

  // the wheel over the gallery scrolls Mission Control, and the frame follows the slot; up when the card is
  // scrolled to its bottom already (how far it can go depends on the sandbox release's covers)
  const scrollerAt = () => page.evaluate(() => { let n = document.getElementById('mc-as-slot').parentElement; while (n && n.scrollHeight <= n.clientHeight) n = n.parentElement; return n ? { top: n.scrollTop, max: n.scrollHeight - n.clientHeight } : { top: -1, max: -1 }; });
  const scroller = async () => (await scrollerAt()).top;
  const at = await scrollerAt(), before = at.top;
  await page.mouse.move(g.slot[0] + 40, Math.max(g.slot[1], 0) + 40);
  await page.mouse.wheel(0, at.max - at.top >= 100 ? 200 : -200);
  const after = await until(scroller, v => v !== before);
  check(after !== before, `the wheel over the gallery scrolls the card (${before} → ${after})`);
  const g2 = await until(geo, v => v.frame[1] === v.slot[1]);
  check(g2.frame[1] === g2.slot[1], `the frame follows the slot (${JSON.stringify(g2)})`);

  // a cover full screen: the frame takes the window; Esc gives the card back
  // a store image: the sandbox archive's own often don't load
  await fr.evaluate(() => document.querySelector('.as-card.new:not(.del) .as-thumb img').click());
  const full = await until(geo, v => v.frame[2] === 1400 && v.frame[3] === 900);
  check(full.frame.join() === '0,0,1400,900', `full screen takes the window (${JSON.stringify(full)})`);
  await page.screenshot({ path: 'test-results/mc-784-full.png' });
  // setting a type there leaves the cover where it is (the bar took padding while focused, and moved it)
  const top = () => fr.evaluate(() => Math.round(document.querySelector('.as-lb-img').getBoundingClientRect().top));
  await until(() => fr.evaluate(() => { const i = document.querySelector('.as-lb-img'); return !!(i && i.complete && i.naturalWidth); }), Boolean);
  check(await fr.evaluate(() => document.querySelector('.as-lb-img').naturalWidth > 0), 'the store image shows full screen');
  const t0 = await top();
  await fr.locator('#as-lb .as-lb-type').click();
  await fr.locator('.as-pop input[type=checkbox]').first().waitFor();
  const t1 = await top();
  await fr.locator('.as-pop input[type=checkbox]').first().check();
  const t2 = await top();
  check(t1 === t0 && t2 === t0, `the cover stays put while its type is set (${t0} → ${t1} → ${t2})`);
  await fr.locator('body').press('Escape');   // the type picker
  await fr.locator('body').press('Escape');   // the full screen
  const back = await until(geo, v => v.frame.join() === v.slot.join());
  check(back.frame.join() === back.slot.join(), `Esc gives the card back (${JSON.stringify(back)})`);
});
