// #772: in Mission Control's hidden frame, the stores' other images (Discogs and Amazon give every image of a
// release) are kept aside for MC's card, each with a preview and its place in its store's list (Amazon#2), and
// marked when it is the same picture as the best front or as a larger one. On 'enter', the ones MC took in go
// in after the front with the types and comment set there (a type MusicBrainz doesn't have is dropped).
//
// The frame is a real cover-art page in an iframe of the release page. The "stores' images" are drawn stripe
// patterns, dropped in and given a store by the test hook; the same pattern at another size is the same picture.
// Every POST is aborted at the network (nothing is uploaded).
import { test, check, until, requireLogin, idle, SANDBOX } from '../../../dev/test/harness.mjs';
import { RELEASE, blockPosts } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

const TOKEN = 'mc772';
const quick = code => code
  .replace('function arDelayMs(attempt) {', 'function arDelayMs(attempt) { return 300;')
  .replace('const arTimes = () =>', 'const arTimes = () => 1 || ');

test('#772: the frame offers the stores\' other images and enters the ones taken in, typed', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  test.setTimeout(180_000);
  await blockPosts(page);
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await page.evaluate(t => {
    window.__got = [];
    window.addEventListener('message', e => { if (e.data && e.data.mcAs === 1 && e.data.token === t) window.__got.push(e.data); });
    const f = document.createElement('iframe'); f.id = 'mcf'; f.style.cssText = 'width:1200px;height:900px';
    f.src = `/release/${location.pathname.split('/')[2]}/cover-art?mc_frame=${t}`;
    document.body.appendChild(f);
  }, TOKEN);
  const frame = await until(async () => { const h = await page.$('#mcf'); const f = h && await h.contentFrame(); return f && /cover-art/.test(f.url()) ? f : null; });
  await frame.waitForLoadState('domcontentloaded');
  await idle(frame);
  await inject('art_station', { target: frame, transform: quick });
  await frame.waitForSelector('#as-root', { timeout: 20000 });

  // five images, in the order the stores gave them: Amazon 1 (the best front), Amazon 2; Discogs 1 (Amazon 1's
  // picture, smaller), Discogs 2 (Amazon 2's, smaller), Discogs 3 (a picture of its own)
  const offered = await frame.evaluate(async () => {
    const draw = (seed, w, h) => new Promise(res => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d');
      for (let i = 0; i < 9; i++) { const v = (seed * 97 + i * 53 + (i * i * seed) % 41) % 256; g.fillStyle = `rgb(${v},${(v * 3) % 256},${255 - v})`; g.fillRect(Math.floor(i * w / 9), 0, Math.ceil(w / 9), h); }
      c.toBlob(b => res(b), 'image/png');
    });
    const spec = [['a1', 1, 600, 'Amazon'], ['a2', 2, 500, 'Amazon'], ['d1', 1, 300, 'Discogs'], ['d2', 2, 400, 'Discogs'], ['d3', 3, 350, 'Discogs']];
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
    const extras = await window.__asTest.mc.offer(fresh[0], fresh.slice(1));
    return extras.map(e => ({ key: e.key, of: e.of, w: e.w, dup: e.dup || '', thumb: /^data:image\/jpeg/.test(e.thumb) }));
  });
  console.log(JSON.stringify(offered));
  check(JSON.stringify(offered.map(e => e.key)) === '["Amazon#2","Discogs#1","Discogs#2","Discogs#3"]', `every image but the best front, by store, the store with the larger images first (${offered.map(e => e.key)})`);
  const by = k => offered.find(e => e.key === k) || {};
  check(by('Discogs#1').dup === '= Amazon 1', `Discogs 1 is the best front's picture (${by('Discogs#1').dup})`);
  check(by('Discogs#2').dup === '= Amazon 2', `Discogs 2 is Amazon 2's picture, smaller (${by('Discogs#2').dup})`);
  check(!by('Amazon#2').dup && !by('Discogs#3').dup, 'a picture of its own is not marked');
  check(offered.every(e => e.thumb) && by('Amazon#2').of === 2 && by('Discogs#3').of === 3, 'each comes with a preview and its store\'s count');
  check(await frame.evaluate(() => window.__asTest.mc.model().filter(x => x._tag).map(x => x._tag).join()) === 'a1', 'the gallery keeps only the best front');

  await page.evaluate(t => document.getElementById('mcf').contentWindow.postMessage({ mcAs: 1, token: t, type: 'enter', front: true, note: 'Via Mission Control vtest: x',
    extras: [{ key: 'Amazon#2', types: ['Back'], comment: 'back scan' }, { key: 'Discogs#3', types: ['Medium', 'Bogus'], comment: '' }, { key: 'Discogs#9', types: ['Back'] }] }, location.origin), TOKEN);
  const staged = await until(() => frame.evaluate(() => window.__asTest.mc.model().filter(x => x._tag).sort((a, b) => a.order - b.order).map(x => ({ t: x._tag, types: x.types.join('+'), c: x.comment }))), v => v.length === 3);
  console.log(JSON.stringify(staged));
  check(JSON.stringify(staged.map(x => x.t)) === '["a1","a2","d3"]', `the two taken in follow the front (${staged.map(x => x.t)})`);
  check(staged[1] && staged[1].types === 'Back' && staged[1].c === 'back scan', `Amazon 2 typed Back, with its comment (${JSON.stringify(staged[1])})`);
  check(staged[2] && staged[2].types === 'Medium', `Discogs 3 typed Medium, the unknown type dropped (${JSON.stringify(staged[2])})`);
  const done = await until(() => page.evaluate(() => window.__got.find(m => m.type === 'entered') || null), Boolean, { timeout: 120_000 });
  check(!!done, 'the frame answers the enter (the upload itself is blocked)');
});
