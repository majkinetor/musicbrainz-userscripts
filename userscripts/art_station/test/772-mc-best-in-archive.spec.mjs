// #772: the best front was never compared with the archive, so Discogs' first image showed in the gallery as new,
// counted in Discogs' take all in, while the archive's front was the same picture (release d7231e0b on
// musicbrainz.org, Earth, discogs.com/release/323558). It is now marked "in archive" like the stores' other images.
//
// The frame is a real cover-art page in an iframe of the release page; the stores' images are drawn stripe patterns
// given a store by the test hook, and every archive cover's thumbnail is made to be the best front's picture.
// Read-only: nothing is entered.
import { test, check, until, requireLogin, idle, SANDBOX } from '../../../dev/test/harness.mjs';
import { RELEASE, blockPosts } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

const TOKEN = 'mc772b';
const archIsBest = code => code.replace('let r = await hashOf(thumb(x.id, 250));', 'let r = await hashOf(window.__arch || thumb(x.id, 250));');

test('#772: a best front that is already in the archive is marked so and not taken in', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
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
  await inject('art_station', { target: frame, transform: archIsBest });
  await frame.waitForSelector('#as-root', { timeout: 20000 });

  // Discogs 1 (the best front, the archive's picture), Discogs 2 (a picture of its own)
  const res = await frame.evaluate(async () => {
    const draw = (seed, w, h) => new Promise(res => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d');
      for (let i = 0; i < 9; i++) { const v = (seed * 97 + i * 53 + (i * i * seed) % 41) % 256; g.fillStyle = `rgb(${v},${(v * 3) % 256},${255 - v})`; g.fillRect(Math.floor(i * w / 9), 0, Math.ceil(w / 9), h); }
      c.toBlob(b => res(b), 'image/png');
    });
    window.__arch = URL.createObjectURL(await draw(1, 250, 250));
    const spec = [['d1', 1, 600], ['d2', 2, 500]];
    const dt = new DataTransfer();
    for (const [n, seed, w] of spec) dt.items.add(new File([await draw(seed, w, w)], `x${n}.png`, { type: 'image/png' }));
    const before = new Set(window.__asTest.mc.model().map(x => x.id));
    const archived = window.__asTest.mc.model().filter(x => !x._new && x.id).length;
    window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    let fresh = [];
    for (let i = 0; i < 100; i++) {
      await new Promise(r => setTimeout(r, 100));
      fresh = window.__asTest.mc.model().filter(x => !before.has(x.id));
      if (fresh.length === 2 && fresh.every(x => x.w > 0)) break;
    }
    fresh.sort((a, b) => a._seq - b._seq);
    fresh.forEach((x, i) => { x._provider = 'Discogs'; x._provUrl = 'https://discogs.test/release'; x.types = []; x._tag = spec[i][0]; });
    fresh[0]._del = true; fresh[0]._mcOffer = true;   // left out, as Mission Control's card leaves a front the archive has
    const extras = await window.__asTest.mc.offer(fresh[0], fresh.slice(1));
    const card = x => document.querySelector(`.as-card[data-id="${x.id}"]`);
    return {
      archived,
      best: fresh[0]._mcDup || '',
      extras: extras.map(e => [e.key, e.dup || '']),
      label: (card(fresh[0]).querySelector('.as-mcdup') || {}).textContent || '',
      bare: !card(fresh[0]).querySelector('.as-undo, .as-foot-type'),
      all: [...document.querySelectorAll('.as-more-all')].map(b => b.textContent.trim()).join('|'),
    };
  });
  console.log(JSON.stringify(res));
  check(res.archived > 0, `the release has covers in the archive (${res.archived})`);
  check(/^in archive/.test(res.best), `the best front is marked as in the archive (${res.best || 'not marked'})`);
  check(res.label === res.best && res.bare, `its card says so, with no take in and no type (${res.label})`);
  check(JSON.stringify(res.extras) === '[["Discogs#2",""]]', `the picture of its own is offered unmarked (${JSON.stringify(res.extras)})`);
  check(res.all === '＋ take all in (1)', `take all in leaves the best front out (${res.all})`);

  // Mission Control's card still takes it in: then it is shown as any front, typed
  const shown = await until(async () => {
    await page.evaluate(t => document.getElementById('mcf').contentWindow.postMessage({ mcAs: 1, token: t, type: 'stage', front: true, replace: false }, location.origin), TOKEN);
    return frame.evaluate(() => {
      const x = window.__asTest.mc.model().find(i => i._tag === 'd1'), c = document.querySelector(`.as-card[data-id="${x.id}"]`);
      return !x._del && c ? { label: !!c.querySelector('.as-mcdup'), type: (c.querySelector('.as-foot-type') || {}).textContent || '' } : null;
    });
  });
  check(shown && !shown.label && /Front/.test(shown.type), `taken in, it shows as a front (${JSON.stringify(shown)})`);
});
