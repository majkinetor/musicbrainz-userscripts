// #972: a store's big file is at times a smaller picture enlarged (Tidal's 3000 from a 1500 master). Three
// pictures of one drawn scene are dropped on the gallery: drawn at 2400 (genuine), drawn at 1200 (genuine, the
// smaller copy), and the 1200 one enlarged to 2400. Only the enlarged one is flagged, at ≈1200, with its badge;
// the genuine 2400 is not. Turned off, the flag and the badge go. Nothing is uploaded.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openArtStation } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

test('#972: an enlarged picture is told by its real size, a genuine one is not', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  test.setTimeout(180000);
  await openArtStation(page, inject);
  await page.evaluate(async () => {
    // one scene, drawn at any size: shapes and text with sharp edges, the same for every size (a seeded PRNG)
    const draw = (S, scene) => {
      const c = document.createElement('canvas'); c.width = c.height = S;
      const g = c.getContext('2d'), k = S / 1000; let seed = 972;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      g.fillStyle = '#e8e0d0'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 160; i++) {
        const x = rnd() * 1000, y = rnd() * 1000, w = 20 + rnd() * 120, h = 20 + rnd() * 120, col = `hsl(${Math.floor(rnd() * 360)},${40 + Math.floor(rnd() * 50)}%,${15 + Math.floor(rnd() * 60)}%)`, kind = rnd();
        g.fillStyle = col;
        if (kind < 0.5) g.fillRect(x * k, y * k, w * k, h * k);
        else if (kind < 0.8) { g.beginPath(); g.arc(x * k, y * k, w / 2 * k, 0, 7); g.fill(); }
        else { g.font = `bold ${Math.round(h / 2 * k)}px sans-serif`; g.fillText('MUSIC', x * k, y * k); }
      }
      if (scene) { const e = document.createElement('canvas'); e.width = e.height = scene; const ge = e.getContext('2d'); ge.imageSmoothingQuality = 'high'; ge.drawImage(c, 0, 0, scene, scene); return e; }
      return c;
    };
    const file = async (c, name) => new File([await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92))], name, { type: 'image/jpeg' });
    const files = [await file(draw(2400), 'genuine-2400.jpg'), await file(draw(1200), 'copy-1200.jpg'), await file(draw(1200, 2400), 'enlarged-2400.jpg')];
    const dt = new DataTransfer(); for (const f of files) dt.items.add(f);
    window.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  const items = () => page.evaluate(() => window.__asTest.up.items().filter(x => /\.jpg$/.test(x.name)));
  await until(async () => { const xs = await items(); return xs.length === 3 && xs.every(x => x.w > 0); }, Boolean, { timeout: 30000 });
  await page.evaluate(() => window.__asTest.up.scan());
  const by = Object.fromEntries((await items()).map(x => [x.name, x]));
  console.log(JSON.stringify(by));
  check(by['enlarged-2400.jpg'].realW === 1200 && by['enlarged-2400.jpg'].realH === 1200, `the enlarged 2400 is flagged at 1200: ${JSON.stringify(by['enlarged-2400.jpg'])}`);
  check(!by['genuine-2400.jpg'].realW, `the genuine 2400 is not flagged: ${JSON.stringify(by['genuine-2400.jpg'])}`);
  check(!by['copy-1200.jpg'].realW, 'the 1200 copy is not checked (under 1600 px)');
  const badges = await page.$$eval('.as-card .as-dim-up', els => els.map(e => e.textContent));
  check(badges.length === 1 && /→ ≈1200 × 1200/.test(badges[0]), `one badge, on the enlarged picture: ${JSON.stringify(badges)}`);

  // turned off: no flag, no badge
  await page.click('#as-switch', { button: 'right' });
  await page.waitForSelector('#as-setup', { timeout: 5000 });
  const box = page.locator('.as-setup-upscale');
  if (await box.count()) {
    await box.uncheck();
    check(await page.$$eval('.as-card .as-dim-up', els => els.length) === 0, 'off: the badge is gone');
    check(await page.evaluate(() => !window.__asTest.up.isUp({ _realW: 1200, w: 2400, h: 2400 })), 'off: nothing counts as enlarged');
  } else check(false, 'the setting\'s checkbox is in the setup panel');
});
