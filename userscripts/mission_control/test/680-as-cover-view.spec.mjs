// #680: a click on a cover in Art Station's card shows it full screen, with ← / → to the other one
// (the best found and the current front), so the two can be compared. AS sends the best one in full
// (`best.full`, a data URL: the file lives in its hidden frame) and the front's archive image
// (`current.full`). A stand-in AS answers the probe with two drawn covers.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // any sandbox release: the findings are the stand-in's

test('#680: covers full screen, ← → between them', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(() => {
    const draw = (w, h, color) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, w, h); return c.toDataURL('image/png'); };
    window.__covers = { bestThumb: draw(50, 50, '#c00'), bestFull: draw(1400, 1200, '#c00'), curThumb: draw(25, 25, '#00c'), curFull: draw(500, 500, '#00c') };
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail), v = window.__covers;
      setTimeout(() => send('mc:findings', { id: 'as', run: d.run, findings: [{ key: 'discogs', name: 'Discogs', url: 'https://www.discogs.com/release/8846789', state: 'new' }],
        best: { provider: 'Discogs', w: 1400, h: 1200, bytes: 300000, of: 3, thumb: v.bestThumb, full: v.bestFull, larger: true, replace: true,
          current: { id: 1, w: 500, h: 500, bytes: 48000, thumb: v.curThumb, full: v.curFull } } }), 50);
    });
    send('mc:provider', { id: 'as', name: 'Art Station', version: 1, capabilities: ['probe', 'apply'] });
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  const covers = page.locator('#mc-root [data-card="as"] .mc-cov');
  await covers.first().waitFor();
  check(await covers.count() === 2, 'both covers in the card can be clicked');

  const v = page.locator('#mc-cover');
  const seen = () => page.evaluate(() => ({ src: document.querySelector('#mc-cover img').src, t: document.querySelector('#mc-cover .mc-cov-t').textContent,
    i: document.querySelector('#mc-cover .mc-cov-i').textContent, n: document.querySelector('#mc-cover .mc-cov-n').textContent,
    w: Math.round(document.querySelector('#mc-cover img').getBoundingClientRect().width), vw: innerWidth }));
  const C = await page.evaluate(() => window.__covers);
  await covers.nth(0).click();
  await v.waitFor();
  let s = await seen();
  console.log(JSON.stringify({ ...s, src: s.src.slice(0, 30) }));
  check(s.src === C.bestFull && s.t === 'Best cover' && /Discogs · 1400 × 1200 · 293 KB/.test(s.i) && s.n === '1 / 2', 'the best cover, in full, named with its size');
  check(s.w > 600, `full screen, not the preview (${s.w} px of ${s.vw})`);
  await page.screenshot({ path: 'test-results/mc-680-cover-view.png' });
  await page.keyboard.press('ArrowRight');
  s = await seen();
  check(s.src === C.curFull && s.t === 'Current front' && /500 × 500/.test(s.i) && s.n === '2 / 2', '→ the current front');
  await page.keyboard.press('ArrowRight');
  check((await seen()).src === C.bestFull, '→ again: round to the best');
  await page.locator('#mc-cover .mc-cov-go.prev').click();
  check((await seen()).src === C.curFull, 'the on-screen ‹ works too');
  await page.keyboard.press('Escape');
  check(await v.count() === 0 && await page.locator('#mc-root').count() === 1, 'Esc closes the viewer, not Mission Control');

  await covers.nth(1).click();
  check((await seen()).src === C.curFull, 'a click on the current front opens on it');
  await page.locator('#mc-cover .mc-cov-stage').click({ position: { x: 5, y: 5 } });
  check(await v.count() === 0, 'a click beside the image closes it');
});
