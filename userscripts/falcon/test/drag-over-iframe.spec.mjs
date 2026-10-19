// majkinetor (2026-10-19): "falcon is glitchy when moving window around during batch processing". During a batch
// the workers pane holds the workers' iframes, and a mouse over an iframe sends its moves and its release to the
// iframe's document, not to the page: the window stopped following while the cursor crossed a worker, then jumped,
// and a release over one left it dragging. While a drag is on, iframes now let the pointer through.
//
// test.musicbrainz.org's front page with a stand-in for a worker: a same-origin iframe filling the window under its
// header, as the workers pane does. Each move jumps past the header in one step, as a fast drag does while the page
// is busy (a worker's MusicBrainz page booting), so it lands on the iframe before the window catches up. Nothing is
// edited.
import { readFile } from 'node:fs/promises';
import { test, check, sourceOf } from '../../../dev/test/harness.mjs';

test.use({ gm: false });

test('the window follows a drag across a worker iframe, and lets go over one', { tag: ['@sandbox'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');
  await context.addInitScript(() => {
    window.__mbuTest = true; const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d; window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('https://test.musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest);
  await page.evaluate(() => document.getElementById('falcon-launcher').click());
  await page.waitForSelector('#falcon-hdr', { state: 'visible' });
  // a worker's stand-in: a same-origin page filling the window under its header
  await page.evaluate(() => {
    const p = document.getElementById('falcon-panel'), h = document.getElementById('falcon-hdr');
    const f = document.createElement('iframe'); f.id = 'stand-in'; f.src = '/robots.txt';
    f.style.cssText = `position:absolute;left:0;right:0;bottom:0;top:${h.offsetTop + h.offsetHeight}px;width:100%;height:calc(100% - ${h.offsetTop + h.offsetHeight}px);z-index:5;border:0;background:#fff`;
    if (getComputedStyle(p).position === 'static') p.style.position = 'fixed';
    p.appendChild(f);
  });
  const hdr = await page.evaluate(() => { const h = document.getElementById('falcon-hdr').getBoundingClientRect(), p = document.getElementById('falcon-panel').getBoundingClientRect(); return { x: Math.round(p.left + 30), y: Math.round(h.top + h.height / 2), left: Math.round(p.left), top: Math.round(p.top) }; });
  const at = () => page.evaluate(() => { const p = document.getElementById('falcon-panel').getBoundingClientRect(); return { left: Math.round(p.left), top: Math.round(p.top) }; });
  await page.mouse.move(hdr.x, hdr.y);
  await page.mouse.down();
  // each move lands 60px below the header, on the iframe
  const path = [];
  for (let i = 1; i <= 5; i++) {
    await page.mouse.move(hdr.x - 40 * i, hdr.y + 60 * i);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    path.push(await at());
  }
  console.log(JSON.stringify({ start: hdr, path }));
  const last = path[path.length - 1];
  check(last.left === hdr.left - 200 && last.top === hdr.top + 300, `the window followed the drag across the iframe (${JSON.stringify(last)}, from ${hdr.left},${hdr.top})`);
  // let go with the cursor on the iframe, then move on
  await page.mouse.move(hdr.x - 200, hdr.y + 360);
  await page.mouse.up();
  await page.mouse.move(hdr.x - 100, hdr.y + 200);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const after = await at();
  check(after.left === hdr.left - 200 && after.top === hdr.top + 360, `let go over the iframe, it stays where it was let go (${JSON.stringify(after)})`);
  check(await page.evaluate(() => getComputedStyle(document.getElementById('stand-in')).pointerEvents) !== 'none', 'and iframes take the pointer again');
});
