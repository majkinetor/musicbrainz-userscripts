// #772: Mission Control's Execute with only the stores' other images taken in (front: false) said "entered 1 more
// image" while nothing was. The frame now answers what it did: nothing taken in is "nothing to enter", not ok,
// and an add MusicBrainz didn't save (it shows the form again, a 200 without the redirect to the cover-art page) is
// a failure. #784: the image taken in on its card in the gallery goes after the covers already there.
//
// The frame is a real cover-art page in an iframe of the release page, its "stores' images" drawn and given a
// store by the test hook, as in 772-mc-extras. The upload (the sandbox's goes to its own /ssssss/) is answered 200, the add with
// the form again; every other POST is aborted (nothing is uploaded or edited).
import { test, check, until, requireLogin, idle, SANDBOX } from '../../../dev/test/harness.mjs';
import { RELEASE } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

const TOKEN = 'mc772u';
// one attempt, no auto-repeat window
const quick = code => code
  .replace('function arDelayMs(attempt) {', 'function arDelayMs(attempt) { return 300;')
  .replace('const arTimes = () =>', 'const arTimes = () => 1 || ');

test('#772: extras alone: nothing found is not ok, an add MusicBrainz didn\'t save is a failure', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  test.setTimeout(180_000);
  const posts = [];
  await page.route(() => true, route => {
    const r = route.request(), u = new URL(r.url());
    if (r.method() !== 'POST' || /\/__meb_verify$/.test(u.pathname)) return route.fallback();
    posts.push(u.hostname + u.pathname);
    if (/archive\.org$/.test(u.hostname) || /^\/ssssss\//.test(u.pathname)) return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': r.headers().origin || '*', 'access-control-allow-credentials': 'true' }, body: '' });
    if (/\/add-cover-art$/.test(u.pathname)) return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body><div id="page"><form><ul class="errors"><li>Test: the form again</li></ul></form></div></body></html>' });
    return route.abort();
  });
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

  // Discogs 1 (the best front) and Discogs 2, as a store gives them
  const offered = await frame.evaluate(async () => {
    const draw = (seed, w) => new Promise(res => {
      const c = document.createElement('canvas'); c.width = w; c.height = w;
      const g = c.getContext('2d');
      for (let i = 0; i < 9; i++) { const v = (seed * 97 + i * 53 + (i * i * seed) % 41) % 256; g.fillStyle = `rgb(${v},${(v * 3) % 256},${255 - v})`; g.fillRect(Math.floor(i * w / 9), 0, Math.ceil(w / 9), w); }
      c.toBlob(b => res(b), 'image/png');
    });
    const dt = new DataTransfer();
    for (const [n, seed] of [['d1', 1], ['d2', 2]]) dt.items.add(new File([await draw(seed, 500)], `x${n}.png`, { type: 'image/png' }));
    const before = new Set(window.__asTest.mc.model().map(x => x.id));
    window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    let fresh = [];
    for (let i = 0; i < 100; i++) {
      await new Promise(r => setTimeout(r, 100));
      fresh = window.__asTest.mc.model().filter(x => !before.has(x.id));
      if (fresh.length === 2 && fresh.every(x => x.w > 0)) break;
    }
    fresh.sort((a, b) => a._seq - b._seq);
    fresh.forEach((x, i) => { x._provider = 'Discogs'; x._provUrl = 'https://discogs.test/release/1'; x.types = []; x._tag = 'd' + (i + 1); });
    return (await window.__asTest.mc.offer(fresh[0], fresh.slice(1))).map(e => e.key);
  });
  check(JSON.stringify(offered) === '["Discogs#2"]', `Discogs 2 is offered (${offered})`);
  const post = o => page.evaluate(([t, x]) => { window.__got = []; document.getElementById('mcf').contentWindow.postMessage(Object.assign({ mcAs: 1, token: t }, x), location.origin); }, [TOKEN, o]);
  const enter = () => post({ type: 'enter', front: false, note: 'Via Mission Control vtest: x' });
  const entered = () => until(() => page.evaluate(() => window.__got.find(m => m.type === 'entered') || null), Boolean, { timeout: 120_000 });

  // the best front left out on MC's card, nothing taken in: nothing to enter, and the frame says so
  await post({ type: 'stage', front: false, replace: false });
  await enter();
  let m = await entered();
  console.log(JSON.stringify(m));
  check(m && m.ok === false && /nothing to enter/.test(m.error) && m.extrasIn === 0 && !m.front, `nothing taken in is not ok (${JSON.stringify(m)})`);

  // Discogs 2 alone, after the covers already there; MusicBrainz shows the form again
  const id = await frame.evaluate(() => { const x = window.__asTest.mc.model().find(m => m._tag === 'd2'); x.types = ['Back']; return x.id; });
  await frame.click(`.as-card[data-id="${id}"] .as-undo`);
  await enter();
  const order = await until(() => frame.evaluate(() => { const s = window.__asTest.mc.model().filter(x => !x._del).sort((a, b) => a.order - b.order); return s.length ? s.map(x => x._tag || 'old').join() : null; }), v => /d2/.test(v || ''));
  check(/^(old,)+d2$/.test(order || '') && !/d1/.test(order), `the best front is left out, Discogs 2 follows the covers there (${order})`);
  m = await entered();
  console.log(JSON.stringify(m), JSON.stringify(posts));
  check(posts.some(p => /archive\.org|\/ssssss\//.test(p)) && posts.some(p => /\/add-cover-art$/.test(p)), `it was uploaded and the add sent (${posts})`);
  check(m && m.ok === false && /didn't save the edit/.test(m.error) && /the form again/.test(m.error), `the add MusicBrainz didn't save is a failure, with its error (${JSON.stringify(m)})`);
});
