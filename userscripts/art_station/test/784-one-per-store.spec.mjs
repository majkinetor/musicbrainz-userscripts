// #784: in Mission Control's frame, the stores that give one image each (a digital release: every store has its
// front) share one row of the stores' other images, the largest first, with one take all in for them; a store with
// more images keeps a row of its own. Setup as in 772-mc-extras: drawn stripe patterns, given a store by the test
// hook; every POST is aborted at the network.
import { test, check, until, requireLogin, idle, SANDBOX } from '../../../dev/test/harness.mjs';
import { RELEASE, blockPosts } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

const TOKEN = 'mc784one';

test('#784: the stores with one image each share a row of the other images', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  test.setTimeout(180_000);
  await blockPosts(page);
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await page.evaluate(t => {
    const f = document.createElement('iframe'); f.id = 'mcf'; f.style.cssText = 'width:1200px;height:900px';
    f.src = `/release/${location.pathname.split('/')[2]}/cover-art?mc_frame=${t}&mc_embed=1`;
    document.body.appendChild(f);
  }, TOKEN);
  const frame = await until(async () => { const h = await page.$('#mcf'); const f = h && await h.contentFrame(); return f && /cover-art/.test(f.url()) ? f : null; });
  await frame.waitForLoadState('domcontentloaded');
  await idle(frame);
  await inject('art_station', { target: frame });
  await frame.waitForSelector('#as-root', { timeout: 20000 });

  // Amazon's is the best front; Tidal and Qobuz give one image each, Discogs two: all pictures of their own
  await frame.evaluate(async () => {
    const draw = (seed, w, h) => new Promise(res => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d');
      for (let i = 0; i < 9; i++) { const v = (seed * 97 + i * 53 + (i * i * seed) % 41) % 256; g.fillStyle = `rgb(${v},${(v * 3) % 256},${255 - v})`; g.fillRect(Math.floor(i * w / 9), 0, Math.ceil(w / 9), h); }
      c.toBlob(b => res(b), 'image/png');
    });
    const spec = [['a1', 1, 600, 'Amazon'], ['t1', 2, 300, 'Tidal'], ['q1', 3, 500, 'Qobuz'], ['d1', 4, 350, 'Discogs'], ['d2', 5, 320, 'Discogs']];
    const dt = new DataTransfer();
    for (const [n, seed, w] of spec) dt.items.add(new File([await draw(seed, w, w)], `x${n}.png`, { type: 'image/png' }));
    const before = new Set(window.__asTest.mc.model().map(x => x.id));
    window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    let fresh = [];
    for (let i = 0; i < 100; i++) {
      await new Promise(r => setTimeout(r, 100));
      fresh = window.__asTest.mc.model().filter(x => !before.has(x.id));
      if (fresh.length === 5 && fresh.every(x => x.w > 0)) break;
    }
    fresh.sort((a, b) => a._seq - b._seq);
    fresh.forEach((x, i) => { x._provider = spec[i][3]; x._provUrl = 'https://' + spec[i][3].toLowerCase() + '.test/album'; x.types = []; x._tag = spec[i][0]; });
    await window.__asTest.mc.offer(fresh[0], fresh.slice(1));
  });
  const tagOf = () => frame.evaluate(() => {
    const tag = c => (window.__asTest.mc.model().find(x => String(x.id) === c.dataset.id) || {})._tag;
    return [...document.querySelectorAll('.as-sec-more')].map(h => ({ t: h.querySelector('h3').textContent, cards: [...h.nextElementSibling.querySelectorAll('.as-card')].map(tag).join() }));
  });
  const rows = await until(tagOf, v => v.length === 2 && !/checking/.test(JSON.stringify(v)));
  console.log(JSON.stringify(rows));
  check(rows.length === 2, `two rows: the shared one and Discogs' (${JSON.stringify(rows)})`);
  check(/one from each store/.test(rows[0].t) && rows[0].cards === 'q1,t1', `the one-image stores share the first row, the largest first (${JSON.stringify(rows[0])})`);
  check(/Discogs/.test(rows[1].t) && rows[1].cards === 'd1,d2', `Discogs keeps its own row (${JSON.stringify(rows[1])})`);
  await until(() => frame.evaluate(() => !!document.querySelector('.as-sec-more .as-more-all:not([disabled])')));
  const took = await frame.evaluate(async () => {
    document.querySelector('.as-sec-more .as-more-all').click();
    await new Promise(r => setTimeout(r, 300));
    return window.__asTest.mc.model().filter(x => x._tag && x._mcOffer && !x._del).map(x => x._tag).sort().join();
  });
  check(took === 'q1,t1', `the shared row's take all in takes in both its images (${took})`);
});
