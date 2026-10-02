// #650 (majkinetor): "add option to FC to close the page after import is clicked" and "make FC
// button movable, and it should remember where it is positioned on particular provider".
//
// Fixtures: Bandcamp bullion.bandcamp.com/album/nearly, Deezer album 6575789.
import { test, check, sourceOf } from '../../../dev/test/harness.mjs';
import { readFile } from 'node:fs/promises';

test.use({ gm: { name: 'First Contact', persist: 'tabs' }, pageErrors: 'ignore' });   // the platforms' own scripts are not ours

const BC = 'https://bullion.bandcamp.com/album/nearly';
// A fresh, logged-out browser gets Bandcamp's modal dialog (a full-window backdrop at z-index 200,
// in <page-footer>'s shadow root). A button on the page sits under it like the rest of the page,
// so the page-level tests hide it, as a visitor would by answering it.
const noBandcampDialog = page => page.evaluate(() => new Promise(done => {
  const t0 = Date.now();
  (function hide() {
    const sr = document.querySelector('page-footer') && document.querySelector('page-footer').shadowRoot;
    if (sr) { const st = document.createElement('style'); st.textContent = '.dialog-container{display:none!important}'; sr.appendChild(st); return done(true); }
    if (Date.now() - t0 > 5000) return done(false);
    setTimeout(hide, 100);
  })();
}));
const DZ = 'https://www.deezer.com/en/album/6575789';

test('the button drags anywhere, each platform keeps its own place, Reset puts it back', { tag: ['@web'] }, async ({ page, inject }) => {
  const open = async url => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await inject('first_contact', { waitFor: '__fcTest' });
    await page.locator('#fc-root .fc-go').waitFor({ state: 'visible' });
  };
  const box = () => page.locator('#fc-root').boundingBox();
  const vp = page.viewportSize();

  await open(BC);
  const corner = await box();
  check(vp.width - (corner.x + corner.width) < 40 && vp.height - (corner.y + corner.height) < 80, `starts in the bottom-right corner (${JSON.stringify(corner)})`);
  let pages = 0;
  page.context().on('page', () => pages++);
  const go = page.locator('#fc-root .fc-go');
  const g = await go.boundingBox();
  await page.mouse.move(g.x + 20, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + 20 - 220, g.y + g.height / 2 - 300, { steps: 10 });
  await page.mouse.up();
  const moved = await box();
  check(Math.abs(moved.x - (corner.x - 220)) < 10 && Math.abs(moved.y - (corner.y - 300)) < 10, `follows the drag (${JSON.stringify(corner)} → ${JSON.stringify(moved)})`);
  await page.waitForTimeout(500);
  check(pages === 0, 'the drag is not an import');
  check(await page.locator('#fc-panel').count() === 0, 'nor a settings click');

  await open(BC);
  const again = await box();
  check(Math.abs(again.x - moved.x) < 3 && Math.abs(again.y - moved.y) < 3, `Bandcamp keeps the place after a reload (${JSON.stringify(again)})`);

  await open(DZ);
  const dz = await box();
  check(vp.width - (dz.x + dz.width) < 40 && vp.height - (dz.y + dz.height) < 80, `Deezer still has it in the corner (${JSON.stringify(dz)})`);

  // moved on Deezer too, for the two resets below
  const drag = async () => {
    const d = await page.locator('#fc-root .fc-go').boundingBox();
    await page.mouse.move(d.x + 20, d.y + d.height / 2);
    await page.mouse.down();
    await page.mouse.move(d.x + 20 - 220, d.y + d.height / 2 - 300, { steps: 10 });
    await page.mouse.up();
  };
  await drag();
  const inCorner = b => Math.abs(b.x + b.width - (corner.x + corner.width)) < 3 && Math.abs(b.y - corner.y) < 3;

  // majkinetor: "Reset: all | this one"; and the link was "not visible" on the dark panel
  await open(BC);
  await page.locator('#fc-root .fc-more').click();
  const reset = await page.evaluate(() => {
    document.documentElement.dataset.mbuTheme = 'dark';
    const el = document.querySelector('#fc-panel .fc-reset') || document.querySelector('#fc-panel .fc-reset-pos');
    const lum = c => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const fg = lum(getComputedStyle(document.querySelector('#fc-panel .fc-reset-pos')).color), bg = lum(getComputedStyle(document.getElementById('fc-panel')).backgroundColor);
    const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    delete document.documentElement.dataset.mbuTheme;
    return { text: el.textContent.replace(/\s+/g, ' ').trim(), ratio: Math.round(ratio * 10) / 10 };
  });
  check(reset.text === 'Reset: all | this one', `the reset reads "Reset: all | this one" (${JSON.stringify(reset.text)})`);
  check(reset.ratio >= 4.5, `the links read on the dark panel (contrast ${reset.ratio}:1)`);
  await page.locator('#fc-panel .fc-reset-pos').click();
  check(inCorner(await box()), 'this one: back in the corner on Bandcamp');
  await open(BC);
  check(inCorner(await box()), 'and it stays there after a reload');
  await open(DZ);
  check(!inCorner(await box()), 'Deezer keeps its own place');
  await page.locator('#fc-root .fc-more').click();
  await page.locator('#fc-panel .fc-reset-all').click();
  check(inCorner(await box()), 'all: back in the corner on Deezer');
  await open(BC);
  check(inCorner(await box()), 'and on Bandcamp');
});

test('Close this page after the import: off, the page stays; on, it closes; not when the editor opened here', { tag: ['@web'] }, async ({ page, inject }) => {
  await page.goto(BC, { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  await page.locator('#fc-root .fc-go').waitFor({ state: 'visible' });
  const run = tab => page.evaluate(async tab => {
    window.open = () => (tab ? {} : null);                          // a tab, or one the browser blocked
    HTMLFormElement.prototype.submit = function () { };             // the seed isn't sent
    window.__fcClosed = false;
    await window.__fcTest.importCurrent();
    return window.__fcClosed;
  }, tab);
  check(await run(true) === false, 'off by default: the page stays');
  await page.locator('#fc-root .fc-more').click();
  await page.locator('#fc-panel .fc-close-after').check();
  await page.keyboard.press('Escape');
  check(await run(true) === true, 'on: the page closes once the editor has the release');
  check(await run(false) === false, 'on, but the editor opened in this tab: nothing to close');
});

// majkinetor: "add option for it to keep its position when scrolling … I put the widget above the
// cover and want to stay there". On, a moved button scrolls with the page; off, it stays on screen.
test('Moved button scrolls with the page: on, it stays over its spot on the page; off, on the screen', { tag: ['@web'] }, async ({ page, inject }) => {
  const open = async () => {
    await page.goto(BC, { waitUntil: 'domcontentloaded' });
    await inject('first_contact', { waitFor: '__fcTest' });
    await page.locator('#fc-root .fc-go').waitFor({ state: 'visible' });
    await noBandcampDialog(page);
  };
  const box = () => page.locator('#fc-root').boundingBox();
  const scrollTo = async y => { await page.evaluate(y => window.scrollTo(0, y), y); await page.waitForTimeout(150); };
  await open();
  await page.locator('#fc-root .fc-more').click();
  await page.locator('#fc-panel .fc-scroll-opt').check();
  await page.keyboard.press('Escape');
  const g = await page.locator('#fc-root .fc-go').boundingBox();
  await page.mouse.move(g.x + 20, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + 20 - 500, 250, { steps: 10 });
  await page.mouse.up();
  const placed = await box();
  check(Math.abs(placed.y + placed.height / 2 - 250) < 10, `dropped where it was let go (${JSON.stringify(placed)})`);
  await scrollTo(400);
  const scrolled = await box();
  const sy = await page.evaluate(() => window.scrollY);
  check(sy > 100 && Math.abs(scrolled.y - (placed.y - sy)) < 3 && Math.abs(scrolled.x - placed.x) < 3, `on: it scrolls with the page (${placed.y} → ${scrolled.y}, scrolled ${sy})`);

  await open();
  await scrollTo(0);
  const reloaded = await box();
  check(Math.abs(reloaded.y - placed.y) < 3 && Math.abs(reloaded.x - placed.x) < 3, `on: the same spot on the page after a reload (${JSON.stringify(reloaded)})`);

  await page.locator('#fc-root .fc-more').click();
  await page.locator('#fc-panel .fc-scroll-opt').uncheck();
  await page.keyboard.press('Escape');
  await scrollTo(400);
  const fixed = await box();
  check(Math.abs(fixed.y - placed.y) < 3, `off: it stays on the screen while the page scrolls (${placed.y} → ${fixed.y})`);
});

// majkinetor: "make settings more compact and prevent overflow" — with the button dragged near the
// top, the settings ran off the window's left edge and covered the button. Wherever the button
// is, the settings are inside the window and clear of it.
test('the settings stay inside the window and off the button, wherever it was dragged', { tag: ['@web'] }, async ({ page, inject }) => {
  await page.goto(BC, { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  await page.locator('#fc-root .fc-go').waitFor({ state: 'visible' });
  const vp = page.viewportSize();
  await page.locator('#fc-root .fc-more').click();                      // as in the report: ⚙︎ only on hover,
  await page.locator('#fc-panel .fc-gear-hover-opt').check();           // a tab above the button
  await page.keyboard.press('Escape');
  const spots = { 'top right': [vp.width - 60, 60], 'top left': [60, 60], 'bottom left': [60, vp.height - 30], 'middle': [vp.width / 2, vp.height / 2], 'just below the top': [vp.width - 150, 200] };
  for (const [name, [x, y]] of Object.entries(spots)) {
    const g = await page.locator('#fc-root .fc-go').boundingBox();
    await page.mouse.move(g.x + 10, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 8 });
    await page.mouse.up();
    await page.locator('#fc-root .fc-go').hover();
    await page.locator('#fc-root .fc-more').click();
    const p = await page.locator('#fc-panel').boundingBox(), b = await page.locator('#fc-root').boundingBox();
    const inside = p.x >= 0 && p.y >= 0 && p.x + p.width <= vp.width && p.y + p.height <= vp.height;
    const clear = p.y + p.height <= b.y || p.y >= b.y + b.height || p.x + p.width <= b.x || p.x >= b.x + b.width;
    check(inside, `${name}: inside the window (${JSON.stringify(p)})`);
    check(clear, `${name}: not over the button (panel ${JSON.stringify(p)}, button ${JSON.stringify(b)})`);
    if (process.env.FC_SHOT && name === 'just below the top') await page.screenshot({ path: process.env.FC_SHOT, clip: { x: Math.min(p.x, b.x) - 10, y: Math.min(p.y, b.y) - 10, width: Math.max(p.x + p.width, b.x + b.width) - Math.min(p.x, b.x) + 20, height: Math.max(p.y + p.height, b.y + b.height) - Math.min(p.y, b.y) + 20 } });
    await page.keyboard.press('Escape');
  }
});

// majkinetor: "it draws over bandcamp extended player" — a button scrolling with the page is page
// content, so a fixed bar on the page (Bandcamp Player Enhanced's player) goes over it.
test('Scrolls with the page: the button goes under a fixed bar on the page, not over it', { tag: ['@web'] }, async ({ page, inject }) => {
  await page.goto(BC, { waitUntil: 'domcontentloaded' });
  await inject('bandcamp_player_enhanced');
  await inject('first_contact', { waitFor: '__fcTest' });
  await page.locator('#bc-sticky-player').waitFor({ state: 'visible' });
  await noBandcampDialog(page);
  await page.locator('#fc-root .fc-go').waitFor({ state: 'visible' });
  await page.locator('#fc-root .fc-more').click();
  await page.locator('#fc-panel .fc-scroll-opt').check();
  await page.keyboard.press('Escape');
  const g = await page.locator('#fc-root .fc-go').boundingBox();
  await page.mouse.move(g.x + 20, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + 20 - 300, 300, { steps: 10 });
  await page.mouse.up();
  const bar = await page.locator('#bc-sticky-player').boundingBox();
  const b = await page.locator('#fc-root').boundingBox();
  await page.evaluate(dy => window.scrollBy(0, dy), b.y - bar.y - 5);   // the button's top edge now under the bar
  await page.waitForTimeout(150);
  const hit = await page.evaluate(() => {
    const r = document.getElementById('fc-root').getBoundingClientRect(), bar = document.getElementById('bc-sticky-player').getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, Math.max(r.top, 0) + 2);
    return { onBar: r.top < bar.bottom, top: el && !!el.closest('#bc-sticky-player'), fc: el && !!el.closest('#fc-root') };
  });
  check(hit.onBar, 'the button has scrolled under the bar');
  check(hit.top && !hit.fc, `the bar is drawn over the button (${JSON.stringify(hit)})`);
});

// majkinetor: "for some reason button still moves on spotify … and apple music … but not on qobuz
// and bandcamp". Spotify and Apple Music keep the window still and scroll a panel inside it: the
// button follows that panel, and is cut off where the panel ends.
for (const [name, url, viaEval] of [
  ['Spotify', 'https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa', true],
  ['Apple Music', 'https://music.apple.com/us/album/random-access-memories/617154241', true],   // both CSPs refuse the inline <script>: eval, as 650-apple does
]) {
  test(`Scrolls with the page on ${name}, where a panel scrolls and not the window`, { tag: ['@web'] }, async ({ page, inject }) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    if (viaEval) await page.evaluate(c => (0, eval)(c), await readFile(sourceOf('first_contact'), 'utf8'));
    else await inject('first_contact', { waitFor: '__fcTest' });
    await page.locator('#fc-root .fc-go').waitFor({ state: 'visible' });
    // the panel that scrolls: what the script has to find
    const scroller = () => page.evaluate(() => {
      let best = null, area = 0;
      for (const el of document.body.querySelectorAll('*')) {
        if (el.scrollHeight <= el.clientHeight + 1 || el.clientHeight < 200 || !/auto|scroll|overlay/.test(getComputedStyle(el).overflowY)) continue;
        if (el.clientWidth * el.clientHeight > area) { area = el.clientWidth * el.clientHeight; best = el; }
      }
      if (best) best.dataset.fcTestScroller = '1';
      return !!best && document.scrollingElement.scrollHeight <= document.scrollingElement.clientHeight + 1;
    });
    await page.waitForFunction(() => document.body.scrollHeight > 0);
    await page.waitForTimeout(3000);   // the album's content renders after the shell
    await page.evaluate(() => { const c = document.getElementById('onetrust-consent-sdk'); if (c) c.remove(); });   // Spotify's cookie banner, over the corner
    check(await scroller(), `${name}: the window stands still and a panel scrolls`);
    await page.locator('#fc-root .fc-more').click();
    await page.locator('#fc-panel .fc-scroll-opt').check();
    await page.keyboard.press('Escape');
    const g = await page.locator('#fc-root .fc-go').boundingBox();
    await page.mouse.move(g.x + 20, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(g.x + 20 - 300, 400, { steps: 10 });
    await page.mouse.up();
    const placed = await page.locator('#fc-root').boundingBox();
    await page.evaluate(() => { document.querySelector('[data-fc-test-scroller]').scrollTop += 150; });
    await page.waitForTimeout(200);
    const after = await page.locator('#fc-root').boundingBox();
    check(Math.abs(after.y - (placed.y - 150)) < 3 && Math.abs(after.x - placed.x) < 3, `${name}: the button scrolls with the panel (${placed.y} → ${after.y})`);
    await page.evaluate(() => { document.querySelector('[data-fc-test-scroller]').scrollTop += 2000; });
    await page.waitForTimeout(200);
    const gone = await page.evaluate(() => { const r = document.getElementById('fc-root'); return getComputedStyle(r).visibility === 'hidden' || r.getBoundingClientRect().bottom < document.querySelector('[data-fc-test-scroller]').getBoundingClientRect().top + 1 || !!r.style.clipPath; });
    check(gone, `${name}: scrolled past the panel's top, it is cut off there`);

    // majkinetor: "positions only when I move" — after a reload it sat against the window until the
    // first scroll. Now it stays unseen until the panel is there, then fades in on its spot.
    await page.evaluate(() => { document.querySelector('[data-fc-test-scroller]').scrollTop = 0; });
    await page.waitForTimeout(200);
    const home = await page.locator('#fc-root').boundingBox();
    await page.goto(url, { waitUntil: 'commit' });
    await page.waitForFunction(() => document.body);
    await page.evaluate(c => (0, eval)(c), await readFile(sourceOf('first_contact'), 'utf8'));
    const seen = [];
    for (let i = 0; i < 60; i++) {
      seen.push(await page.evaluate(() => { const r = document.getElementById('fc-root'); if (!r) return null; const b = r.getBoundingClientRect(); return { o: Number(getComputedStyle(r).opacity), v: getComputedStyle(r).visibility, x: Math.round(b.x), y: Math.round(b.y) }; }));
      await page.waitForTimeout(100);
    }
    const shown = seen.filter(v => v && v.o > 0.05 && v.v !== 'hidden');
    const astray = shown.filter(v => Math.abs(v.x - home.x) > 3 || Math.abs(v.y - home.y) > 3);
    check(shown.length > 0, `${name}: it shows after a reload`);
    check(!astray.length, `${name}: after a reload it is never seen anywhere but its spot (${JSON.stringify(home)}; astray ${JSON.stringify(astray.slice(0, 3))})`);
    check(seen[0] === null || seen[0].o < 0.05, `${name}: unseen at first, then it fades in (${JSON.stringify(seen[0])})`);
  });
}
