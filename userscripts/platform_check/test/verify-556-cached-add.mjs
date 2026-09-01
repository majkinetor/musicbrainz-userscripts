// #556 — "Adding all links in the background randomly fails": the tab opens,
// nothing is inserted, no notes.
//
// Root cause: two exact string comparisons against a URL MusicBrainz had
// rewritten on insert (locale segment, www., trailing slash, stripped query).
//
//   1. the cache-upgrade check `existing[p] === cached.url` missed links that
//      ARE on the release, so a cached reload kept showing an un-circled ✓ and
//      the + button re-queued a duplicate — a no-op in the editor;
//   2. `matchRowByUrl`'s `h === url` missed rows MusicBrainz had created
//      perfectly well, reporting "URL row never appeared".
//
// Made unrecoverable by a third defect: `injected++` counted a dispatched
// keystroke rather than a confirmed row, so `if (injected > 0) removeItem(key)`
// consumed the queue even when nothing landed — which is why it never self-healed
// and why chaban saw ↻ fix it but a plain reload not.
//
// Read-only: every POST is aborted and asserted zero. Nothing is submitted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'platform_check.user.js'), 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 1000 }, bypassCSP: true });
await ctx.exposeBinding('__gmFetch', async (_s, o) => {
  try { const r = await ctx.request.fetch(o.url, { method: o.method || 'GET', headers: o.headers || {}, maxRedirects: 10 });
    return { status: r.status(), responseText: await r.text(), finalUrl: r.url(), responseHeaders: '' }; }
  catch (e) { return { status: 0, responseText: '', finalUrl: o.url, responseHeaders: '' }; }
});
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_listValues = () => [...store.keys()];
  window.GM_info = { script: { name: 'Platform Check', version: 't' } };
  window.unsafeWindow = window;
  window.GM_xmlhttpRequest = (o) => {
    window.__gmFetch({ method: o.method || 'GET', url: o.url, headers: o.headers || {}, data: o.data }).then(r => {
      o.onload && o.onload({ status: r.status, finalUrl: r.finalUrl, responseText: r.responseText, responseHeaders: r.responseHeaders });
    }).catch(() => o.onerror && o.onerror({ status: 0 }));
  };
  window.__opened = [];
  window.GM_openInTab = (url, opts) => { window.__opened.push({ url, opts }); return { closed: false, close() {} }; };
});
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
// The release editor and MusicBrainz's own page make POSTs of their own (Sentry
// telemetry, ws/js lookups). Only an /edit submission would be a real edit, and
// none may happen — every POST is aborted regardless, and classified for the log.
let posts = 0; const postUrls = [];
await page.route(() => true, r => {
  const req = r.request();
  if (req.method() === 'POST') {
    postUrls.push(req.url());
    if (/musicbrainz\.org\/release\/[0-9a-f-]{36}\/edit/.test(req.url())) posts++;
    return r.abort();
  }
  return r.continue();
});

// ── 1. URL identity: the real MB-vs-search spellings ────────────────────────
// NB a RELEASE page, not the homepage: since #559 the script deliberately returns
// before mounting anything (and before the test hook) on any other page.
const REL = 'ec2449a8-3dc5-461c-80a1-e43d96345613';
await page.goto(`https://musicbrainz.org/release/${REL}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__pcTest556, { timeout: 8000 });
const idCases = await page.evaluate(() => {
  const { pcSameUrl } = window.__pcTest556;
  const C = [
    ['spotify intl segment',  'https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy', 'https://open.spotify.com/intl-de/album/4aawyAB9vmqN3uQ7FjRGTy', true],
    ['apple locale+slug',     'https://music.apple.com/us/album/some-slug/1440857781', 'https://music.apple.com/album/1440857781', true],
    ['apple ?i= track param', 'https://music.apple.com/us/album/x/1440857781?i=9',     'https://music.apple.com/de/album/y/1440857781', true],
    ['deezer locale',         'https://www.deezer.com/album/12345',                   'https://www.deezer.com/en/album/12345', true],
    ['tidal listen. host',    'https://tidal.com/album/77777',                        'https://listen.tidal.com/album/77777', true],
    ['tidal /browse/',        'https://tidal.com/browse/album/77777',                 'https://tidal.com/album/77777', true],
    ['qobuz locale',          'https://www.qobuz.com/us-en/album/foo/abc123',         'https://www.qobuz.com/album/foo/abc123', true],
    ['bandcamp trailing /',   'https://artist.bandcamp.com/album/x',                  'https://artist.bandcamp.com/album/x/', true],
    ['discogs locale',        'https://www.discogs.com/release/123',                  'https://www.discogs.com/de/release/123', true],
    ['different spotify ids', 'https://open.spotify.com/album/AAA',                   'https://open.spotify.com/album/BBB', false],
    ['different deezer ids',  'https://www.deezer.com/album/1',                       'https://www.deezer.com/album/2', false],
    ['different bandcamp',    'https://artist.bandcamp.com/album/x',                  'https://artist.bandcamp.com/album/y', false],
  ];
  return C.map(([n, a, b, want]) => ({ n, want, got: pcSameUrl(a, b) }));
});
idCases.forEach(c => ck(c.got === c.want, `URL identity — ${c.n} (${c.want ? 'same' : 'different'})`));
ck(idCases.filter(c => !c.want).length >= 3, 'and it is not just returning true for everything');

// ── 2. the reproduction: a cached ✓ for a link MB already has ───────────────
// A real release that carries a Spotify rel. We seed the cache with a DIFFERENT
// SPELLING of that same URL and source:'search' — exactly the state a cached
// reload is in after a previous successful add — then load the panel.
await page.goto(`https://musicbrainz.org/release/${REL}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
const seeded = await page.evaluate((rel) => {
  // what does MB actually have on this release?
  const hrefs = [...document.querySelectorAll('#sidebar a[href]')].map(a => a.href);
  const spotify = hrefs.find(u => /open\.spotify\.com\/(?:intl-[a-z-]+\/)?album\//i.test(u));
  const sc = hrefs.find(u => /soundcloud\.com\//i.test(u));
  const pick = spotify || sc;
  if (!pick) return { none: true };
  // a plausible alternative spelling of the same resource, as a provider search
  // would return it
  let variant = pick.replace(/^https:\/\/open\.spotify\.com\//, 'https://open.spotify.com/intl-de/');
  if (variant === pick) variant = pick.replace(/\/$/, '') + '/';
  const platform = spotify ? 'spotify' : 'soundcloud';
  for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k.startsWith('pc:')) localStorage.removeItem(k); }
  localStorage.setItem(`pc:cache:v2:${platform}:${rel}`, JSON.stringify({ url: variant, tracks: 10, source: 'search', year: 2020 }));
  return { none: false, platform, mbHas: pick, cached: variant, different: pick !== variant };
}, REL);
console.log('seed: ' + JSON.stringify(seeded));
ck(!seeded.none, 'fixture: the release carries a platform link to work with');
ck(!seeded.none && seeded.different, 'fixture: the cached spelling really differs from MB\'s (otherwise nothing is being tested)');

await page.addScriptTag({ content: code });
await page.waitForSelector('#mb-inject-btn', { timeout: 20000 });
await page.waitForTimeout(9000);
const after = await page.evaluate((s) => {
  const c = window.__pcTest556.cacheGet(location.pathname.split('/')[2], s.platform);
  return { source: c && c.source, url: c && c.url };
}, seeded);
console.log('cache after load: ' + JSON.stringify(after));
ck(after.source === 'MB rels', `#556: the cache upgrade now fires despite the different spelling (source=${after.source})`);

const queued = await page.evaluate(() => {
  window.__opened.length = 0;
  for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k.startsWith('pc:pending')) localStorage.removeItem(k); }
  document.getElementById('mb-inject-btn').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  const out = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('pc:pending')) out[k] = localStorage.getItem(k); }
  return { pending: out, opened: window.__opened.length };
});
console.log('right-click +: ' + JSON.stringify(queued));
const queuedUrls = Object.values(queued.pending).flatMap(v => { try { return Object.values(JSON.parse(v)); } catch (e) { return []; } });
ck(!queuedUrls.some(u => /spotify|soundcloud/i.test(u)), `#556: a link the release already has is NOT re-queued (queued: ${JSON.stringify(queuedUrls)})`);

// ── 4. the browser-check interstitial guard (hook lives on release pages) ──
const guard = await page.evaluate(() => {
  const { pcIsVerifyInterstitial } = window.__pcTest556;
  const real = pcIsVerifyInterstitial();
  const fake = document.implementation.createHTMLDocument('Verifying your browser');
  const fake2 = document.implementation.createHTMLDocument('Edit release');
  fake2.body.innerHTML = '<noscript>JavaScript is required to access this page</noscript>';
  return { real, byTitle: pcIsVerifyInterstitial(fake), byNoscript: pcIsVerifyInterstitial(fake2) };
});
console.log('interstitial guard: ' + JSON.stringify(guard));
ck(guard.byTitle, '#556: the "Verifying your browser" challenge is detected by title');
ck(guard.byNoscript, 'and by its noscript marker');
ck(!guard.real, 'and a real release page is not mistaken for it');

// ── 3. a run that lands nothing must not eat the payload ───────────────────
// Driven through the REAL path rather than the test hook: the edit page returns
// early (into runInjectHelper) before the hook is defined, so seeding the payload
// and loading the editor is both the only way in and the more honest test.
//
// The fixture is "MusicBrainz never gives us an add-link input" — which is the
// failure injectInto's `break` exists for. It used to be "a URL MB can't
// resolve", on the assumption that MB would then create no row; it does create
// one (for any URL at all, then asks for a link type), so that fixture was only
// passing because of a crash — the PC_URL_ID temporal-dead-zone ReferenceError
// fixed alongside this, which aborted the run before it could touch the payload.
// A test that passes because of the bug it is meant to be blind to is worse than
// no test, so it is now the input that is withheld, not the URL that is bogus.
//
// On the SANDBOX, because this one actually drives MB's editor into creating
// rows. Nothing is submitted either way (every POST is aborted, asserted below),
// but a run that types into the production editor has no business doing so.
const SANDBOX = 'https://test.musicbrainz.org/release/3a37a35f-1e06-457f-9b2a-46155c5c03ce';
await page.goto(SANDBOX, { waitUntil: 'domcontentloaded' });
const SREL = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
await page.evaluate((rel) => localStorage.setItem(`pc:pending:${rel}`, JSON.stringify({ bogus: 'https://example.invalid/not-a-provider-url' })), SREL);
await page.goto(`${SANDBOX}/edit`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
// keep the "Add another link" input out of reach for the whole run
await page.evaluate(() => {
  const RE = /^(?:add (?:another )?link|add another url)$/i;
  const strip = () => document.querySelectorAll('input').forEach(i => {
    if (RE.test((i.placeholder || '').trim())) i.setAttribute('placeholder', 'withheld by the test');
  });
  new MutationObserver(strip).observe(document.documentElement, { childList: true, subtree: true });
  strip();
});
await page.addScriptTag({ content: code });
await page.waitForTimeout(16000);   // past injectInto's 10s input wait + 5s row wait
const preserved = await page.evaluate((rel) => ({ still: localStorage.getItem(`pc:pending:${rel}`), rows: document.querySelectorAll('tr.external-link-item a[href]').length }), SREL);
console.log('after a landing-nothing run: ' + JSON.stringify(preserved));
ck(!!preserved.still, '#556: the pending payload survives a run where no row was confirmed — so it can retry');
await page.evaluate((rel) => localStorage.removeItem(`pc:pending:${rel}`), SREL);

console.log('POSTs seen (all aborted): ' + JSON.stringify([...new Set(postUrls.map(u => u.replace(/\?.*/, '')))]));
ck(posts === 0, `no edit was submitted (${posts} edit POSTs out of ${postUrls.length}, all aborted)`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
