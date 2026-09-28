// #468 — shared corner-slot convention so independent scripts' floating launcher
// buttons never land on the same pixel. Apollo Editor / Art Station's switcher
// (data-mb-corner="br", order 10) keep their historical closest-to-the-corner
// spot; Falcon (order 20) stacks above them instead of overlapping.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, idle, frames } from '../../../dev/test/harness.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));

// the script brings its own GM stand-ins, as it did before the harness
test.use({ gm: false });

test("#468: corner slot", { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  const falconCode = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');
  const apolloCode = await readFile(resolve(HERE, '..', '..', 'apollo_editor', 'apollo_editor.user.js'), 'utf8');
  const artStationCode = await readFile(resolve(HERE, '..', '..', 'art_station', 'art_station.user.js'), 'utf8');

  await context.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_info = { script: { name: 'test', version: 't' } };
    window.unsafeWindow = window;
  });

  const ck = check;

  function rectOf(el) { return { top: el.offsetTop, bottom: el.getBoundingClientRect().bottom, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }; }

  async function checkNoOverlap(page, selA, selB) {
    return page.evaluate(({ selA, selB }) => {
      const a = document.querySelector(selA), b = document.querySelector(selB);
      if (!a || !b) return { ok: false, reason: 'missing element(s)', hasA: !!a, hasB: !!b };
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const overlap = !(ra.right <= rb.left || ra.left >= rb.right || ra.bottom <= rb.top || ra.top >= rb.bottom);
      return { ok: !overlap, ra: { top: ra.top, bottom: ra.bottom, left: ra.left, right: ra.right }, rb: { top: rb.top, bottom: rb.bottom, left: rb.left, right: rb.right } };
    }, { selA, selB });
  }

  // 1. Falcon + Apollo Editor on a real release edit page.
  {
    const page = await context.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto('https://test.musicbrainz.org/release/e3e7446a-71fd-43b9-8cbb-b48066a8b566/edit', { waitUntil: 'load' });
    await requireLogin(page);
    await idle(page);
    await page.addScriptTag({ content: falconCode });
    await page.addScriptTag({ content: apolloCode });
    await page.waitForSelector('#falcon-launcher', { timeout: 10000 });
    await page.waitForSelector('#tc-launch', { timeout: 10000 });
    await frames(page);
    const r = await checkNoOverlap(page, '#falcon-launcher', '#tc-launch');
    console.log('Falcon vs Apollo:', JSON.stringify(r));
    ck(r.ok, `Falcon launcher and Apollo's #tc-launch do not overlap (${JSON.stringify(r)})`);
    ck(r.ra && r.rb && r.ra.bottom <= r.rb.top, 'Falcon (order 20) sits ABOVE Apollo (order 10, keeps its old spot)');
    ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
    await page.close();
  }

  // 2. Falcon + Art Station on a real cover-art page.
  {
    const page = await context.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto('https://test.musicbrainz.org/release/e3e7446a-71fd-43b9-8cbb-b48066a8b566/cover-art', { waitUntil: 'load' });
    await requireLogin(page);
    await idle(page);
    await page.addScriptTag({ content: falconCode });
    await page.addScriptTag({ content: artStationCode });
    await page.waitForSelector('#falcon-launcher', { timeout: 10000 });
    await page.waitForSelector('#as-switch-wrap', { timeout: 10000 }).catch(() => {});
    await frames(page);
    const r = await checkNoOverlap(page, '#falcon-launcher', '#as-switch-wrap');
    console.log('Falcon vs Art Station:', JSON.stringify(r));
    ck(r.ok, `Falcon launcher and Art Station's #as-switch-wrap do not overlap (${JSON.stringify(r)})`);
    ck(r.ra && r.rb && r.ra.bottom <= r.rb.top, 'Falcon (order 20) sits ABOVE Art Station (order 10, keeps its old spot)');
    ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
    await page.close();
  }
});
