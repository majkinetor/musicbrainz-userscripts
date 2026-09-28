// #556 ("Adding all links in the background randomly fails"): the helpers under the
// background add, one by one. The editor side as a whole is in inject.spec.mjs.
//
// URL identity: MusicBrainz rewrites a URL as it stores it (locale segment, www., a
//   trailing slash, the query); comparing spellings with === missed links that were on
//   the release. They compare by provider id, or by a normalised host and path, now.
// The inject path and the TDZ: injectInto runs only on /release/<mbid>/edit, which returns
//   early at the top of the script. A module-level const below that return is in its
//   temporal dead zone there — PC_URL_ID was, and threw out of the whole run.
// The wait: pcWaitFor polled on requestAnimationFrame, which a hidden (background) tab
//   never runs, while its wall-clock deadline kept going. It polls on a timer now.
// The browser check: MusicBrainz sometimes serves "Verifying your browser" instead of the
//   editor; the helper stands down there, leaving the queue alone.
import { readFileSync } from 'node:fs';
import { test, check, loadFunctions, functionSource, sourceOf } from '../../../dev/test/harness.mjs';

test('URL identity: the spellings MusicBrainz and the providers use', { tag: '@unit' }, async () => {
  const { pcSameUrl } = await loadFunctions('platform_check', ['pcUrlKey', 'pcSameUrl']);
  const cases = [
    ['a Spotify locale segment', 'https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy', 'https://open.spotify.com/intl-de/album/4aawyAB9vmqN3uQ7FjRGTy', true],
    ['an Apple locale and slug', 'https://music.apple.com/us/album/some-slug/1440857781', 'https://music.apple.com/album/1440857781', true],
    ["Apple's ?i= track parameter", 'https://music.apple.com/us/album/x/1440857781?i=9', 'https://music.apple.com/de/album/y/1440857781', true],
    ['a Deezer locale', 'https://www.deezer.com/album/12345', 'https://www.deezer.com/en/album/12345', true],
    ["Tidal's listen. host", 'https://tidal.com/album/77777', 'https://listen.tidal.com/album/77777', true],
    ["Tidal's /browse/", 'https://tidal.com/browse/album/77777', 'https://tidal.com/album/77777', true],
    ['a Qobuz locale', 'https://www.qobuz.com/us-en/album/foo/abc123', 'https://www.qobuz.com/album/foo/abc123', true],
    ['a Bandcamp trailing slash', 'https://artist.bandcamp.com/album/x', 'https://artist.bandcamp.com/album/x/', true],
    ['a Discogs locale', 'https://www.discogs.com/release/123', 'https://www.discogs.com/de/release/123', true],
    ['two Spotify albums', 'https://open.spotify.com/album/AAA', 'https://open.spotify.com/album/BBB', false],
    ['two Deezer albums', 'https://www.deezer.com/album/1', 'https://www.deezer.com/album/2', false],
    ['two Bandcamp albums', 'https://artist.bandcamp.com/album/x', 'https://artist.bandcamp.com/album/y', false],
  ];
  for (const [what, a, b, same] of cases) check(pcSameUrl(a, b) === same, `${what}: ${same ? 'the same link' : 'different links'}`);
});

test("nothing the inject path uses is a const below the edit page's early return", { tag: '@unit' }, async () => {
  const code = readFileSync(sourceOf('platform_check'), 'utf8').replace(/\r\n/g, '\n');
  const cut = code.search(/runInjectHelper\('release'\);/);
  check(cut > 0, 'the early return for the release editor is found');
  const below = new Set([...code.slice(cut).matchAll(/^(?:const|let) ([A-Za-z_$][\w$]*)\s*=/gm)].map(m => m[1]));
  // every top-level function the editor's helper can call, however deep
  const declared = new Set([...code.matchAll(/^(?:async )?function ([A-Za-z_$][\w$]*)\s*\(/gm)].map(m => m[1]));
  const seen = new Set(), queue = ['runInjectHelper'];
  let body = '';
  while (queue.length) {
    const n = queue.shift();
    if (seen.has(n)) continue;
    seen.add(n);
    const src = await functionSource('platform_check', [n]);
    body += src + '\n';
    for (const m of src.matchAll(/\b([A-Za-z_$][\w$]*)\s*[(.]/g)) if (declared.has(m[1]) && !seen.has(m[1])) queue.push(m[1]);
  }
  // a name those functions declare for themselves (a local, a parameter) is theirs
  const own = new Set([...body.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]));
  for (const m of body.matchAll(/function\s*[\w$]*\s*\(([^)]*)\)|\(([^()]*)\)\s*=>|\b([A-Za-z_$][\w$]*)\s*=>/g)) {
    (m[1] ?? m[2] ?? m[3]).split(',').forEach(p => own.add(p.replace(/[{}[\]]|=.*$/g, '').trim()));
  }
  const reached = [...below].filter(n => !own.has(n) && new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b').test(body));
  check(seen.size > 5, `the editor's helper and what it calls are read (${seen.size} functions)`);
  check(reached.length === 0, `a TDZ ReferenceError there would end the whole run (reached: ${reached.join(', ') || 'none'})`);
});

test('the wait sees the element in a hidden tab, and still gives up on time', { tag: '@unit' }, async ({ page }) => {
  const src = await functionSource('platform_check', ['pcWaitFor']);
  const r = await page.evaluate(async src => {
    const shipped = new Function(src + '; return pcWaitFor;')();
    // a wait that never settles fails here, not at the test's timeout
    const pcWaitFor = (p, ms) => Promise.race([shipped(p, ms), new Promise(r => setTimeout(() => r('NEVER SETTLED'), ms + 5000))]);
    const realRaf = window.requestAnimationFrame;
    let rafCalls = 0;
    // a background tab: hidden, and animation frames never delivered
    window.requestAnimationFrame = () => { rafCalls++; return 0; };
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    let ready = false;
    setTimeout(() => { ready = true; }, 1200);   // no DOM change: only a poll can see it
    let t0 = Date.now();
    const got = await pcWaitFor(() => (ready ? 'FOUND' : null), 3000);
    const foundMs = Date.now() - t0;
    t0 = Date.now();
    const never = await pcWaitFor(() => null, 1200);
    const giveUpMs = Date.now() - t0;
    delete document.hidden; window.requestAnimationFrame = realRaf;
    t0 = Date.now();
    const visible = await pcWaitFor(() => null, 800);
    return { got, foundMs, rafCalls, never, giveUpMs, visible, visibleMs: Date.now() - t0 };
  }, src);
  check(r.got === 'FOUND' && r.foundMs < 3000, `hidden: it resolves when the element is there, not at the deadline (${r.got}, ${r.foundMs} ms)`);
  check(r.rafCalls === 0, `hidden: it never waits on an animation frame (${r.rafCalls} asked)`);
  check(r.never === null && r.giveUpMs >= 1200 && r.giveUpMs < 6000, `hidden: with nothing to find, it gives up near its budget (${r.giveUpMs} ms for 1200)`);
  check(r.visible === null && r.visibleMs >= 800 && r.visibleMs < 4000, `visible: it still times out on schedule (${r.visibleMs} ms for 800)`);
});

test('the browser-check page is recognised; a real page is not', { tag: '@unit' }, async ({ page }) => {
  const src = await functionSource('platform_check', ['pcIsVerifyInterstitial']);
  const r = await page.evaluate(src => {
    const is = new Function(src + '; return pcIsVerifyInterstitial;')();
    const byTitle = document.implementation.createHTMLDocument('Verifying your browser');
    const byNoscript = document.implementation.createHTMLDocument('Edit release');
    byNoscript.body.innerHTML = '<noscript>JavaScript is required to access this page</noscript>';
    const real = document.implementation.createHTMLDocument('Edit release');
    real.body.innerHTML = '<div id="release-editor"></div>';
    return { byTitle: is(byTitle), byNoscript: is(byNoscript), real: is(real) };
  }, src);
  check(r.byTitle, 'by its title');
  check(r.byNoscript, 'by its noscript note');
  check(!r.real, 'a release editor is not taken for it');
});
