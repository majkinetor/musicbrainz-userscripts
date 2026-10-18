// #772/#784: in Mission Control's frame, the stores' other images (Discogs and Amazon give every image of a release)
// wait in the gallery, left out in a section of their own, each with its place in its store's list (Amazon#2) and
// marked when it is the same picture as the best front or as a larger one. The embedded gallery shows without
// MusicBrainz's page and tells the release page its plan. On 'enter', what the gallery holds goes in: the best front
// typed Front, and the images taken in there, in the gallery's order, with the types set there.
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

test('#784: the stores\' other images wait left out in the gallery, and the ones taken in go in, in its order', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  test.setTimeout(180_000);
  await blockPosts(page);
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await page.evaluate(t => {
    window.__got = [];
    window.addEventListener('message', e => { if (e.data && e.data.mcAs === 1 && e.data.token === t) window.__got.push(e.data); });
    const f = document.createElement('iframe'); f.id = 'mcf'; f.style.cssText = 'width:1200px;height:900px';
    f.src = `/release/${location.pathname.split('/')[2]}/cover-art?mc_frame=${t}&mc_embed=1`;
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
    return extras.map(e => ({ key: e.key, of: e.of, w: e.w, dup: e.dup || '' }));
  });
  console.log(JSON.stringify(offered));
  check(JSON.stringify(offered.map(e => e.key)) === '["Amazon#2","Discogs#1","Discogs#2","Discogs#3"]', `every image but the best front, by store, the store with the larger images first (${offered.map(e => e.key)})`);
  const by = k => offered.find(e => e.key === k) || {};
  check(by('Discogs#1').dup === '= Amazon 1', `Discogs 1 is the best front's picture (${by('Discogs#1').dup})`);
  check(by('Discogs#2').dup === '= Amazon 2', `Discogs 2 is Amazon 2's picture, smaller (${by('Discogs#2').dup})`);
  check(!by('Amazon#2').dup && !by('Discogs#3').dup, 'a picture of its own is not marked');
  // the gallery: the best front in it, the others left out in their own section, the dups on their cards
  const shown = await frame.evaluate(() => ({
    out: window.__asTest.mc.model().filter(x => x._tag && x._del && x._mcPool).map(x => x._tag).sort().join(),
    more: document.querySelectorAll('.as-sec-more + .as-grid .as-card').length,
    dups: [...document.querySelectorAll('.as-sec-more + .as-grid .as-mcdup')].map(x => x.textContent).sort().join(),
    bare: [...document.querySelectorAll('.as-sec-more + .as-grid .as-card')].filter(c => c.querySelector('.as-mcdup')).every(c => !c.querySelector('.as-undo, .as-foot-type')),
    all: [...document.querySelectorAll('.as-more-all')].map(b => b.textContent.trim()).join('|'),
    embed: document.documentElement.classList.contains('as-embed'),
    header: !!(document.querySelector('.header, #header') || {}).offsetParent,
    enter: !!(document.querySelector('#as-root .as-commit') || {}).offsetParent,
  }));
  console.log(JSON.stringify(shown));
  check(shown.out === 'a2,d1,d2,d3' && shown.more === 4, `the four wait left out in their own section (${shown.out}, ${shown.more} cards)`);
  check(shown.dups === '= Amazon 1,= Amazon 2', `the dups show on their cards (${shown.dups})`);
  // #784: a duplicate is never taken in: no take in and no type on its card, and take all in leaves it out
  check(shown.bare, 'a dup has no take in and no type');
  check(shown.all === '＋ take all in|＋ take all in (1)', `Discogs' take all in takes only its one picture of its own (${shown.all})`);
  check(shown.embed && !shown.header && !shown.enter, `the gallery alone, without MusicBrainz's header or Enter edit (${JSON.stringify(shown)})`);

  // MC's card takes the best front's source in; Amazon 2 and Discogs 3 are taken in on their cards, Discogs 3
  // dragged before Amazon 2, and typed
  await page.evaluate(t => document.getElementById('mcf').contentWindow.postMessage({ mcAs: 1, token: t, type: 'stage', front: true, replace: false }, location.origin), TOKEN);
  for (const tag of ['a2', 'd3']) {
    const id = await frame.evaluate(t => window.__asTest.mc.model().find(x => x._tag === t).id, tag);
    await frame.click(`.as-card[data-id="${id}"] .as-undo`);
  }
  await frame.evaluate(() => {
    const m = window.__asTest.mc.model(), x = t => m.find(i => i._tag === t);
    x('a2').types = ['Back']; x('a2').comment = 'back scan'; x('d3').types = ['Medium'];
    const seq = m.slice().sort((a, b) => a.order - b.order).filter(i => i !== x('d3'));
    seq.splice(seq.indexOf(x('a2')), 0, x('d3')); seq.forEach((i, n) => i.order = n);
  });
  const plan = await until(() => page.evaluate(() => window.__got.filter(m => m.type === 'plan').pop() || null), p => p && p.ops.filter(o => o.kind === 'add').length === 3);
  console.log(JSON.stringify(plan));
  check(plan && plan.more >= 2 && plan.ops.filter(o => o.kind === 'add').length === 3, `the plan reaches the release page: three uploads, two beyond the best front (${JSON.stringify(plan)})`);

  await page.evaluate(t => document.getElementById('mcf').contentWindow.postMessage({ mcAs: 1, token: t, type: 'enter', front: true, note: 'Via Mission Control vtest: x' }, location.origin), TOKEN);
  const staged = await until(() => frame.evaluate(() => window.__asTest.mc.model().filter(x => x._tag && !x._del).sort((a, b) => a.order - b.order).map(x => ({ t: x._tag, types: x.types.join('+'), c: x.comment }))), v => v.length === 3);
  console.log(JSON.stringify(staged));
  check(JSON.stringify(staged.map(x => x.t)) === '["a1","d3","a2"]', `the front, then the two taken in, in the gallery's order (${staged.map(x => x.t)})`);
  check(staged[0] && /(^|\+)Front(\+|$)/.test(staged[0].types), `the best front typed Front (${JSON.stringify(staged[0])})`);
  check(staged[2] && staged[2].types === 'Back' && staged[2].c === 'back scan', `Amazon 2 typed Back, with its comment (${JSON.stringify(staged[2])})`);
  const done = await until(() => page.evaluate(() => window.__got.find(m => m.type === 'entered') || null), Boolean, { timeout: 120_000 });
  check(done && done.front && done.extrasIn === 2, `the frame answers the enter: the front and two more (${JSON.stringify(done)})`);
});
