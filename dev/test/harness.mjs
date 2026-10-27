// Shared Playwright Test harness for every userscript's specs (#625).
//
//   import { test, expect, check } from '../../../dev/test/harness.mjs';
//   test('what it proves', { tag: '@sandbox' }, async ({ page, inject }) => { … });
//
// Each test gets:
//   context / page — the shared logged-in profile (.pw-profile), or a throwaway
//                    one with test.use({ profile: 'fresh' }).
//   inject(name)   — loads userscripts/<name>/<name>.user.js into the page.
//                    <NAME>_SRC=<file> runs the spec against another build: that
//                    is how a regression test is shown to fail on the broken one.
//                    Options: waitFor (a window global), target (another page),
//                    atStart, transform (code => code, e.g. a default flipped).
//   the GM shim    — GM_getValue/SetValue (in-memory, or gm.persist), GM_info,
//                    GM_xmlhttpRequest (made from Node like a manager's: no CORS; or gm.xhr: 'fetch' / 'none'),
//                    value-change listeners, GM_registerMenuCommand, unsafeWindow.
//   a production write guard, always on — see below.
//   page errors fail the test (test.use({ pageErrors: 'ignore' }) to opt out, or
//                    pageErrors: [regex sources] to let only those through).
//                    MusicBrainz's own React #418 always gets through: see mbNoise.
//
// The guard itself lives in guard.mjs; see there.
//
// Tags: @unit (no network: pure functions, stub pages), @prod (read-only on musicbrainz.org), @sandbox
// (test.musicbrainz.org, may write), @web (another live site, read-only: Bandcamp, Discogs…),
// @login (needs the logged-in profile), @critical (the quick run: pnpm test --grep @critical).
import { test as base, expect, chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync, appendFileSync } from 'node:fs';
import { gzipSync, gunzipSync, deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { installProdGuard, hostOf, withUa } from './guard.mjs';

export { expect };
export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
// PW_PROFILE=<dir> runs on a copy of the profile, beside a run on the real one (the suite skill's rechecks)
export const PROFILE = process.env.PW_PROFILE ? resolve(process.env.PW_PROFILE) : resolve(REPO, '.pw-profile');
export const PROD = 'https://musicbrainz.org';
export const SANDBOX = 'https://test.musicbrainz.org';

// A soft assertion with a readable message, so one failing check doesn't hide
// the rest (the ck() every old test carried).
export const check = (cond, msg) => expect.soft(!!cond, msg).toBe(true);

// Wait for what a check is about, never for a fixed time: a sleep long enough on one
// machine is too short on a slower one (CI). `read` returns the value the check looks
// at; it is polled until `ok(value)` holds or `timeout` passes, and returned either
// way, so a check that still fails reports what was there.
//   check(await until(() => page.evaluate(() => panel.style.display), v => v === 'flex'), '…')
export async function until(read, ok = Boolean, { timeout = 20_000, every = 100 } = {}) {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await read();
    if (ok(v) || Date.now() >= end) return v;
    await new Promise(r => setTimeout(r, every));
  }
}

// idle(), and first until the page's network has gone quiet: for MusicBrainz's release
// editor, which loads a medium's tracks when its tab opens and re-renders as they arrive.
export async function settled(page, { timeout = 30_000 } = {}) {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
  await idle(page, { timeout });
}

// Until the page has drawn `n` more frames: for what a script lays out on a later frame
// (a ResizeObserver, then requestAnimationFrame), where the state before the change would
// satisfy the check too, so waiting for the check's condition proves nothing.
export const frames = (page, n = 3) => page.evaluate(n => new Promise(r => { const f = k => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); }), n);

// Until the page has finished starting: its scripts have run and its main thread has
// nothing queued (MusicBrainz's React is hydrated). Where a spec used to sleep after
// loading a page before putting a script in, so as not to meet React #418.
export async function idle(page, { timeout = 30_000 } = {}) {
  await page.waitForLoadState('load', { timeout }).catch(() => {});
  await page.evaluate(t => new Promise(r => {
    const frames = () => requestAnimationFrame(() => requestAnimationFrame(() => r()));
    (window.requestIdleCallback || (f => setTimeout(f, 0)))(frames, { timeout: t });
  }), timeout).catch(() => {});
}

// Where each userscript's built source lives (default: userscripts/<name>/<name>.user.js).
const SOURCES = {
  credit_hoarder: 'userscripts/credit_hoarder/dist/credit_hoarder.user.js',
  as_picker: 'userscripts/art_station/as_picker/as_picker.user.js',
};
// Older tests used these names for the source override; they keep working.
const LEGACY_SRC_ENV = { apollo_editor: 'APOLLO_SRC', group_therapy: 'GT_SRC', credit_hoarder: 'CH_SRC' };
export function sourceOf(name) {
  const env = process.env[name.toUpperCase() + '_SRC'] || (LEGACY_SRC_ENV[name] && process.env[LEGACY_SRC_ENV[name]]);
  return env ? resolve(env) : resolve(REPO, SOURCES[name] || `userscripts/${name}/${name}.user.js`);
}

// MusicBrainz's own noise, never a script's error. React #418: the page was still
// hydrating when the script went in (on a slow machine, or a script run at
// DOMContentLoaded as a manager's document-end does), and React recovered by rendering
// on the client. It turned up in a different spec on most full runs. A spec that
// collects page errors itself filters with this too.
export const mbNoise = msg => /Minified React error #418\b/.test(String(msg));

export const test = base.extend({
  // options — override per file with test.use({ … })
  profile: ['logged-in', { option: true }],   // 'logged-in' → .pw-profile · 'fresh' → a throwaway profile
  gm: [{}, { option: true }],                   // { name, version, values, persist, xhr: 'node' | 'fetch' | 'none' } · false = no GM shim
  prodWrites: ['fail', { option: true }],       // 'fail' · 'block' (refused silently; read the blockedWrites fixture)
  prodPostAllow: [[], { option: true }],        // extra production paths (regex sources) a POST may reach
  pageErrors: ['fail', { option: true }],       // 'fail' · 'ignore' · [regex sources]: fail on any other

  // A spec's console.log/info goes to its report (a "log" attachment), not the
  // terminal, so a run prints only pass/fail lines. TEST_LOG=1 prints it too.
  // Only the Node side is captured: code run in the page logs to the page.
  _log: [async ({}, use, testInfo) => {
    const lines = [], saved = { log: console.log, info: console.info };
    const keep = (...a) => {
      lines.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x, null, 1)).join(' '));
      if (process.env.TEST_LOG) saved.log(...a);
    };
    console.log = console.info = keep;
    try { await use(); }
    finally {
      Object.assign(console, saved);
      if (lines.length) await testInfo.attach('log', { body: lines.join('\n'), contentType: 'text/plain' });
    }
  }, { auto: true }],

  // every production write the guard refused (layer 1 or 2); a spec using 'block' reads it
  blockedWrites: async ({}, use) => { await use([]); },

  context: async ({ headless, viewport, deviceScaleFactor, isMobile, hasTouch, profile, gm, prodWrites, prodPostAllow, pageErrors, blockedWrites: refused }, use, testInfo) => {
    // the page's CSP stays on, as it does for a userscript manager: injection goes through evaluate, which CSP doesn't hold (MusicBrainz's /account pages block inline scripts and styles)
    const ctx = await chromium.launchPersistentContext(profile === 'fresh' ? '' : PROFILE, { headless, viewport, deviceScaleFactor, isMobile, hasTouch });
    const errors = [];
    const guard = await installProdGuard(ctx, { allow: prodPostAllow, gm: gm === false ? null : gm, onRefused: w => refused.push(w) });
    // the scripts build their test hooks (window.__falconTest, …) only on a page marked so (#623)
    await ctx.addInitScript(() => { window.__mbuTest = true; });
    const watch = p => p.on('pageerror', e => errors.push(e.message));
    ctx.pages().forEach(watch); ctx.on('page', watch);
    if (process.env.SANDBOX_WRITES) logSandboxWrites(ctx, testInfo, process.env.SANDBOX_WRITES);

    await use(ctx);

    const failed = testInfo.status !== testInfo.expectedStatus;
    if (failed) for (const p of ctx.pages()) {
      try { await testInfo.attach('page ' + p.url(), { body: await p.screenshot(), contentType: 'image/png' }); } catch (e) { /* page already gone */ }
    }
    await ctx.close();
    const leaked = guard.leaked();
    expect(leaked, 'writes that reached PRODUCTION MusicBrainz — the guard has a hole').toEqual([]);
    if (prodWrites === 'fail') expect(refused.map(w => `${w.method} ${w.url} (${w.via})`), 'the test tried to write to production MusicBrainz (refused)').toEqual([]);
    const letThrough = Array.isArray(pageErrors) ? pageErrors.map(r => new RegExp(r)) : [];
    if (pageErrors !== 'ignore') expect(errors.filter(e => !mbNoise(e) && !letThrough.some(r => r.test(e))), 'page errors').toEqual([]);
  },
  page: async ({ context }, use) => { await use(context.pages()[0] || await context.newPage()); },

  inject: async ({ page }, use) => {
    await use(async (name, { waitFor, target = page, atStart = false, transform } = {}) => {
      const file = sourceOf(name);
      let code = await readFile(file, 'utf8');
      if (transform) code = transform(code);   // e.g. a default flipped for the test
      if (atStart) await target.addInitScript({ content: code });
      else await target.evaluate(code);
      if (waitFor && !atStart) await target.waitForFunction(g => !!window[g], waitFor, { timeout: 20000 });
      return { file, version: (code.match(/@version\s+(\S+)/) || [])[1] || '' };
    });
  },
});

// SANDBOX_WRITES=<file>: every request but a read that reaches the sandbox (or the Internet
// Archive, where cover art goes) is appended to <file>, one JSON line each, with the spec that
// made it: how a spec writing to a shared entity is found (#795). A page route that answered
// it is marked `faked` (no server address); GM_xmlhttpRequest calls are logged as they leave.
const SANDBOX_HOSTS = /(^|\.)(test\.musicbrainz\.org|archive\.org)$/i;
function logSandboxWrites(ctx, testInfo, file) {
  const spec = testInfo.file.replace(/\\/g, '/').replace(/^.*?userscripts\//, '') + ' > ' + testInfo.title;
  const put = (method, url, via, faked) => appendFileSync(file, JSON.stringify({ spec, method, url, via, ...(faked ? { faked } : {}) }) + '\n');
  const write = (method, url) => !['GET', 'HEAD', 'OPTIONS'].includes(String(method).toUpperCase()) && SANDBOX_HOSTS.test(new URL(url).hostname);
  ctx.on('response', async r => {
    const q = r.request();
    if (!write(q.method(), q.url())) return;
    put(q.method(), q.url(), 'page', !(await r.serverAddr().catch(() => null)));
  });
  ctx.on('requestfailed', q => { if (write(q.method(), q.url())) put(q.method(), q.url(), 'page', 'failed'); });
  // asked last: only a call nothing else answered goes out
  answerGm(ctx, o => { if (write(o.method, o.url)) put(o.method, o.url, 'GM_xmlhttpRequest'); return null; });
}

// A MusicBrainz web-service read from Node (fixture lookups): sends a User-Agent
// (MB answers 403 without one) and waits out throttling (503/429, honouring
// Retry-After) instead of failing the test on the next line.
export async function mbJson(url, { tries = 6 } = {}) {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'mb-userscripts-tests/1.0 ( https://github.com/majkinetor/musicbrainz-userscripts )' } });
    if (r.ok) return r.json();
    if ((r.status !== 503 && r.status !== 429) || i >= tries - 1) throw new Error(`${r.status} from ${url}`);
    const after = Number(r.headers.get('retry-after')) || 0;
    await new Promise(z => setTimeout(z, Math.max(after * 1000, 1000 * 2 ** i)));
  }
}

// Production releases copied to the sandbox (dev/test/copy-to-sandbox.mjs).
const COPIES = JSON.parse(readFileSync(resolve(REPO, 'dev/test/sandbox-copies.json'), 'utf8'));
// The sandbox page for a production release: its copy, or the release itself when the
// sandbox has it already (test.musicbrainz.org's data is an older copy of production's).
export const onSandbox = mbid => (COPIES[mbid] && COPIES[mbid].sandbox) || mbid;
// replayWs's `as` for a release: its copy's MBIDs (the release, and its release group
// when known) → production's.
export function sandboxAs(mbid) {
  const c = COPIES[mbid];
  if (!c || !c.sandbox) return {};
  return { [c.sandbox]: mbid, ...(c.rg && c.prodRg ? { [c.rg]: c.prodRg } : {}) };
}

// Answers the page's MusicBrainz web-service reads (/ws/2/ GETs) from a fixture
// recorded once from production, so a spec that depends on MusicBrainz's data (names,
// aliases, who is related to whom) gets the same answers every run, and is never
// throttled. The page itself can be any server; requests are keyed by path. /ws/js/
// (MusicBrainz's own UI data) comes from the page's server unless `paths` says so.
//
//   const ws = await replayWs(page, new URL('./fixtures/ws-613.json.gz', import.meta.url));
//   … the test …
//   await ws.done();   // saves when recording; reports reads the fixture didn't have
//
// RECORD_WS=1 records: each read the fixture lacks is fetched from production (paced,
// throttling waited out) and the file is rewritten at done() (RECORD_WS=fresh: all of them). A read missing from the fixture is answered
// 503, as a throttled server would, and done() fails the test naming it. A fixture
// named *.gz is gzipped (a search for a common name can be 100 kB of JSON).
//
// `as: { <sandbox mbid>: <production mbid> }` answers a sandbox copy's reads with its
// production original's data (copy-to-sandbox.mjs makes such copies; sandboxAs() reads
// the map for one).
//
// `web: true` (or a RegExp of host names) replays the other sites a script asks, through
// GM_xmlhttpRequest (and, for a RegExp, the page's own requests) — Spotify, Discogs, a search engine — recorded once from the
// live site, so a spec about matching gets the same candidates every run. Access tokens
// in a recorded reply are replaced, and an HTML page is recorded without its styles, SVG
// and comments (never data, and most of a page's weight); `trim: (key, body) => body`
// cuts a reply further (a 3 MB script read for one id). A request the fixture lacks
// fails as a network error would, and done() names it.
export async function replayWs(page, file, { from = PROD, paths = /^\/ws\/2\//, as = {}, web = false, trim = null } = {}) {
  const record = !!process.env.RECORD_WS;
  const gz = String(file).endsWith('.gz');
  // RECORD_WS=1 adds what is missing to the recording (a read that happens on some runs
  // only is collected over a few); RECORD_WS=fresh starts it over
  const load = async () => JSON.parse(gz ? gunzipSync(await readFile(file)).toString('utf8') : await readFile(file, 'utf8'));
  const store = record ? (process.env.RECORD_WS === 'fresh' ? {} : await load().catch(() => ({}))) : await load();
  const missing = [];
  let last = 0;
  const isMb = u => /(^|\.)musicbrainz\.org$/.test(u.hostname);
  const covers = u => paths.test(u.pathname) && isMb(u);
  const mapped = key => { for (const [copy, orig] of Object.entries(as)) key = key.split(copy).join(orig); return key; };
  // a search whose terms are OR-ed in whatever order the script gathered them is one
  // search: keyed with its terms sorted
  // So is a /ws/2/url lookup of several resources, in whatever order the scans found them (#671)
  const canon = key => key.replace(/([?&]query=)([^&]*%20OR%20[^&]*)/, (m, p, q) => p + q.split('%20OR%20').sort().join('%20OR%20'))
    .replace(/^(\/ws\/2\/url\?)((?:resource=[^&]*&)+)/, (m, p, rs) => p + rs.split('&').filter(Boolean).sort().join('&') + '&');
  for (const k of Object.keys(store)) if (canon(k) !== k && !store[canon(k)]) store[canon(k)] = store[k];   // recordings made before keys were sorted
  // the answer for one read: recorded now, or from the fixture
  const answer = async u => {
    const path = mapped(u.pathname + u.search), key = canon(path);
    if (record && !store[key]) {
      const wait = last + 1100 - Date.now();   // one request a second, as MusicBrainz asks
      if (wait > 0) await new Promise(z => setTimeout(z, wait));
      last = Date.now();
      let r;
      for (let i = 0; i < 6; i++) {
        r = await fetch(from + key, { headers: { Accept: 'application/json', 'User-Agent': 'mb-userscripts-tests/1.0 ( https://github.com/majkinetor/musicbrainz-userscripts )' } });
        if (r.status !== 503 && r.status !== 429) break;
        await new Promise(z => setTimeout(z, 1000 * 2 ** i));
      }
      store[key] = { status: r.status, body: await r.text() };
    }
    if (store[key]) return store[key];
    missing.push(key);
    return { status: 503, body: '{"error":"not in the fixture"}' };
  };
  await page.route(covers, async route => {
    if (route.request().method() !== 'GET') return route.fallback();
    const a = await answer(new URL(route.request().url()));
    return route.fulfill({ status: a.status, contentType: 'application/json', body: a.body }).catch(() => {});
  });
  // another site, asked through GM_xmlhttpRequest: keyed by method, url and body
  const context = page.context();
  const coversWeb = u => !!web && !isMb(u) && (web === true || web.test(u.hostname));
  const answerWeb = async ({ url, method = 'GET', headers, data }) => {
    // Amazon Music's web-player API (#644) carries its guest session, a request id and the time in
    // the body's "headers" string: a request is keyed without it, or no two runs would match
    const stable = d => (/\.a2z\.com\//.test(url) && d ? String(d).replace(/,"headers":"(?:[^"\\]|\\.)*"/, '') : d);
    // Audiomack's signed API (#664) puts a nonce, the time and a signature over them in the URL:
    // a request is keyed without them, for the same reason
    const signed = u => (/^https:\/\/api\.audiomack\.com\//.test(u) ? u.replace(/[?&]oauth_(?:nonce|timestamp|signature)=[^&]*/g, '').replace(/^([^?]*)&/, '$1?') : u);
    const key = mapped((method === 'GET' ? '' : method + ' ') + signed(url) + (data ? ' ' + stable(data) : ''));
    const reply = a => ({ status: a.status, url: a.url, headers: 'content-type: ' + a.type, body: a.b64 ? Buffer.from(a.b64, 'base64') : a.body });
    if (record && !store[key]) {
      let live;
      try {
        const r = await context.request.fetch(url, { method, headers: withUa(headers), data, maxRedirects: 20, failOnStatusCode: false, timeout: 60000 });
        const bytes = await r.body(), type = r.headers()['content-type'] || '';
        const text = !type || /json|text|xml|html|javascript/i.test(type);
        let body = text ? bytes.toString('utf8') : undefined;
        if (text && /html/i.test(type)) {
          body = body.replace(/<style[\s>][\s\S]*?<\/style>|<svg[\s>][\s\S]*?<\/svg>|<!--[\s\S]*?-->/gi, '');
          if (r.status() >= 400) body = body.slice(0, 2000);   // a refusal page: what it says is enough
        }
        live = { status: r.status(), type, ...(r.url() !== url ? { url: r.url() } : {}), ...(text ? { body } : { b64: bytes.toString('base64') }) };
        // the fixture keeps no working token, and only what trim() keeps; the script, still
        // talking to the live site, gets the whole reply (an access token it goes on to use, #627)
        const kept = text && trim ? trim(key, body) : body;
        store[key] = text ? { ...live, body: kept.replace(/"(access_token|refresh_token|id_token)"(\s*:\s*)"[^"]*"/g, '"$1"$2"recorded"') } : live;
      } catch (e) { store[key] = { error: String(e.message || e).split('\n')[0] }; throw new Error(store[key].error); }
      return reply(live);
    }
    const a = store[key];
    if (!a) { missing.push(key); throw new Error('not in the fixture: ' + key); }
    if (a.error) throw new Error(a.error);
    return reply(a);
  };
  // GM_xmlhttpRequest is made from Node and never meets a page route
  answerGm(context, o => {
    const u = new URL(o.url);
    if (o.method === 'GET' && covers(u)) return answer(u);
    return coversWeb(u) ? answerWeb(o) : null;
  });
  // …and the page's own requests to the hosts named (a fetch to api.discogs.com), the same
  // way. Only for named hosts: with web: true the page's images and fonts would be caught too.
  if (web instanceof RegExp) await page.route(coversWeb, async route => {
    const q = route.request();
    try {
      const a = await answerWeb({ url: q.url(), method: q.method(), data: q.postData() || undefined });
      return await route.fulfill({ status: a.status, headers: { 'content-type': a.headers.replace(/^content-type: /, ''), 'access-control-allow-origin': '*' }, body: a.body });
    } catch (e) { return route.abort('failed').catch(() => {}); }
  });
  return {
    // the answer for a url, to build on: a spec's answerGm() that adjusts a replayed reply
    answer: url => (isMb(new URL(url)) ? answer(new URL(url)) : answerWeb({ url })),
    async done() {
      if (record) { const json = JSON.stringify(store, null, 1) + '\n'; await writeFile(file, gz ? gzipSync(json, { level: 9 }) : json); return; }
      expect(missing, 'reads the fixture has no answer for (RECORD_WS=1 to add them)').toEqual([]);
    },
  };
}

// Answers GM_xmlhttpRequest calls in place of the network, as page.route() does for the
// page's own requests (which GM_xmlhttpRequest, made from Node, never meets). The handler
// gets { url, method, headers, data } and returns { status, body, headers? } to answer,
// or nothing to let the request through. The latest one registered is asked first.
//   answerGm(context, ({ url }) => /soundexchange/.test(url) ? { status: 202, body: '{"searchCaptcha":true}' } : null);
export function answerGm(context, handler) {
  (context.__harnessGmAnswers = context.__harnessGmAnswers || []).push(handler);
}

// A script's pure helpers, evaluated in Node — for @unit specs of functions that
// need no page. Each name must be a `function name(…) { … }` declaration, or a
// `const name = …;` in the script; they are evaluated together, so one may call
// another. Anything they use beyond each other and the JS built-ins isn't available,
// and evaluating fails.
//   const { normName } = await loadFunctions('fusion', ['normName']);
export async function loadFunctions(name, names) {
  return new Function(await functionSource(name, names) + `\nreturn { ${names.join(', ')} };`)();
}

// The same declarations as source text, for a helper that needs a page (the DOM, timers):
//   const src = await functionSource('platform_check', ['pcWaitFor']);
//   await page.evaluate(src => new Function(src + '; return pcWaitFor;')()(…), src);
export async function functionSource(name, names) {
  const code = (await readFile(sourceOf(name), 'utf8')).replace(/\r\n/g, '\n');
  return names.map(n => {
    let at = code.search(new RegExp('(^|\\n)[ \\t]*(async[ \\t]+)?function ' + n + '\\s*\\('));
    if (at < 0) {
      at = code.search(new RegExp('(^|\\n)[ \\t]*const ' + n + '\\s*='));
      if (at < 0) throw new Error(`functionSource: no "function ${n}(" or "const ${n} =" in ${name}`);
      // to the end of the statement: a ; or line end outside any bracket
      let depth = 0, i = code.indexOf('=', at) + 1;
      for (; i < code.length; i++) {
        const ch = code[i];
        if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--;
        else if (depth === 0 && (ch === ';' || ch === '\n')) break;
      }
      return code.slice(at, i).replace(/^\n/, '') + ';';
    }
    const open = code.indexOf('{', code.indexOf(')', at));
    let depth = 0, i = open;
    for (; i < code.length; i++) { if (code[i] === '{') depth++; else if (code[i] === '}' && --depth === 0) break; }
    return code.slice(at, i + 1).replace(/^\n/, '');
  }).join('\n');
}

// A screenshot of a page or locator, attached to the test's report. Never fails the
// test: the element may be gone by the time it's taken.
export async function attachShot(testInfo, target, name) {
  try { await testInfo.attach(name, { body: await target.screenshot(), contentType: 'image/png' }); } catch (e) { /* nothing to show */ }
}

// A new, minimal entity on the sandbox, made for this run alone (maintainer, 2026-10-20): a spec
// that changes something works on one of these, never on an entity other specs, or people, use
// too. Every field gets a safe default (a unique name among them); pass only the ones the spec
// needs a given value of. `fields` are the create form's names without their `edit-<kind>.`
// prefix (a release's are /release/add's seed names). Leaves `page` on the new entity and
// returns { mbid, name }; a release also gives its release group's MBID and its recordings'.
// A recording or a release group comes with a new release of its own (their create forms
// don't take a seeded artist credit), so its `fields` are the release's and it also gives
// `release`. A 'standalone-recording' is one with no release (its fields are the recording
// form's, and `artist` an artist's MBID to credit). Instruments and areas can't be made: the
// sandbox account isn't allowed to. A release or a standalone recording credits an artist made
// for the run (once, shared by the run's entities) unless `fields` names one: nothing it stands
// on is sandbox-only data, or another spec's. A release has one track unless `tracks: n` asks
// for more ("Track 1", "Track 2"…, 3:00, 3:01…); a seed field given for a track overrides it.
//   const { mbid } = await pristine(page, 'release');
//   const { recordings } = await pristine(page, 'release', { tracks: 8 });
//   const { mbid: band } = await pristine(page, 'artist', { type_id: '2' });   // a group
//   const { mbid: rec } = await pristine(page, 'standalone-recording', { length: '201000' });
let pristineArtist = null;
export async function pristine(page, kind, fields = {}) {
  if (kind === 'instrument' || kind === 'area') throw new Error(`pristine: the sandbox account can't create ${kind}s`);
  if (kind === 'recording' || kind === 'release-group') {
    const r = await pristine(page, 'release', fields);
    return { mbid: kind === 'recording' ? r.recordings[0] : r.releaseGroup, name: r.name, release: r.mbid, releaseGroup: r.releaseGroup, recordings: r.recordings };
  }
  let credit = null;
  if (kind === 'release' && !Object.keys(fields).some(k => k.startsWith('artist_credit.'))) {
    pristineArtist = pristineArtist || (await pristine(page, 'artist')).mbid;
    fields = { 'artist_credit.names.0.mbid': pristineArtist, ...fields };
  }
  if (kind === 'standalone-recording') {
    ({ artist: credit, ...fields } = fields);
    credit = credit || (pristineArtist = pristineArtist || (await pristine(page, 'artist')).mbid);
  }
  const form = kind === 'standalone-recording' ? 'recording' : kind;
  const name = `Pristine ${kind} ${new Date().toISOString().slice(0, 19)} ${Math.random().toString(36).slice(2, 6)}`;
  const note = 'A test entity, made for one spec run (mb-userscripts)';
  await page.goto(SANDBOX + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await requireLogin(page);
  if (kind === 'release') {
    const { tracks = 1, ...given } = fields;
    const seed = { name, status: 'official', 'mediums.0.format': 'Digital Media', edit_note: note };
    for (let i = 0; i < tracks; i++) Object.assign(seed, { [`mediums.0.track.${i}.name`]: `Track ${i + 1}`, [`mediums.0.track.${i}.length`]: String(180000 + i * 1000) });
    Object.assign(seed, given);
    await page.evaluate(seed => {
      const f = document.createElement('form'); f.method = 'POST'; f.action = '/release/add'; f.style.display = 'none';
      for (const [k, v] of Object.entries(seed)) for (const x of [].concat(v)) { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = x; f.appendChild(i); }
      document.body.appendChild(f); f.submit();
    }, seed);
    await page.waitForURL(/\/release\/add/, { timeout: 60000 });
    await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
    await idle(page);
    // MB won't let a newly added release be submitted until the Tracklist tab has been
    // visited (addingWithoutVisitingTracklist): jumping straight to the edit note leaves
    // #enter-edit disabled. Visit the tracklist first, then wait for submission to be allowed.
    await page.locator('a[href="#tracklist"]').first().click();
    await page.locator('a[href="#edit-note"]').first().click();
    await page.waitForFunction(() => { try { return window.MB.releaseEditor.allowsSubmission(); } catch (e) { return false; } }, null, { timeout: 60000 });
    await page.locator('#enter-edit').click();
  } else {
    const defaults = { name, edit_note: note, ...(kind === 'artist' ? { sort_name: name, comment: 'test' } : {}), ...(kind === 'series' ? { type_id: '2' } : {}) };
    const pre = 'edit-' + form.replace('-', '_') + '.';
    const q = new URLSearchParams(Object.entries({ ...defaults, ...fields }).map(([k, v]) => [pre + k, v]));
    await page.goto(`${SANDBOX}/${form}/create?${q}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await idle(page);
    if (credit) {
      // the form takes no seeded artist credit; its artist field looks up an MBID typed in
      const looked = page.waitForResponse(r => r.url().includes('/ws/js/entity/' + credit), { timeout: 60000 });
      await page.locator('#ac-source-single-artist').fill(credit);
      await looked;
      await page.waitForFunction(() => /^\d+$/.test(document.querySelector('input[name$="artist_credit.names.0.artist.id"]')?.value || ''), null, { timeout: 30000 });
    }
    await page.locator('button.submit.positive').click();
  }
  const at = new RegExp('^/' + form + '/[0-9a-f-]{36}$');
  await page.waitForURL(u => at.test(u.pathname), { timeout: 90000 });
  const out = { mbid: new URL(page.url()).pathname.split('/')[2], name: fields.name || name };
  if (kind === 'release') {
    // read in the page: under load the sandbox answered Node's reads 503 for a minute while the
    // page's went through
    const j = await page.evaluate(async r => {
      for (let a = 0; ; a++) {
        const x = await fetch(`/ws/2/release/${r}?inc=recordings+release-groups&fmt=json`, { cache: 'no-store' }).then(x => x.json()).catch(() => ({}));
        if (x.id === r) return x;
        if (a >= 15) throw new Error('pristine: the web service gave no release: ' + JSON.stringify(x).slice(0, 200));
        await new Promise(z => setTimeout(z, 2000 * Math.min(a + 1, 5)));
      }
    }, out.mbid);
    out.releaseGroup = j['release-group'].id;
    out.recordings = j.media.flatMap(m => m.tracks.map(t => t.recording.id));
  }
  return out;
}

// A cover on a pristine release, through MusicBrainz's own add-cover-art form: a plain PNG of
// one colour, typed and commented as asked. Only one upload per release: after a release's first,
// signing the next answers 500 for a long while ("a temporary delay ... from the Internet
// Archive"). Leaves `page` on the release's cover-art page, once the web service counts it.
//   await pristineCover(page, mbid, { types: ['Back'], comment: 'the back' });
export async function pristineCover(page, release, { types = ['Front'], comment = '', rgb = [40, 60, 200] } = {}) {
  await page.goto(`${SANDBOX}/release/${release}/add-cover-art`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await requireLogin(page);
  await idle(page);
  await page.setInputFiles('input[name="files[]"]', { name: 'cover.png', mimeType: 'image/png', buffer: pngImage(300, 300, rgb) });
  for (const t of types) await page.locator('label', { hasText: new RegExp('^\\s*' + t + '\\s*$') }).locator('input[type=checkbox]').first().check();
  if (comment) await page.fill('input[name="add-cover-art.comment"]', comment);
  await page.fill('textarea[name="add-cover-art.edit_note"]', 'A test cover, made for one spec run (mb-userscripts)');
  await page.click('#add-cover-art-submit');
  await page.waitForURL(u => /\/cover-art$/.test(u.pathname), { timeout: 120000 });
  await until(() => page.evaluate(r => fetch(`/ws/2/release/${r}?fmt=json`, { cache: 'no-store' }).then(x => x.json()).then(j => j['cover-art-archive'].count).catch(() => 0), release), n => n > 0, { timeout: 60000, every: 3000 });
}

// A PNG of one colour, w × h (a stand-in image a spec can upload or serve).
export function pngImage(w, h, rgb) {
  const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let x = 0xffffffff; for (const v of b) x = table[(x ^ v) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]), sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;   // 8-bit RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w * 3 }, (_, i) => rgb[i % 3]))]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(Array(h).fill(row)))), chunk('IEND', Buffer.alloc(0))]);
}

// Skip (not fail) when the profile isn't logged in to the site the page is on.
export async function requireLogin(page) {
  const out = page.url().includes('/login') || await page.evaluate(() => !document.querySelector('a[href*="/logout"]'));
  test.skip(out, 'the test profile is not logged in to ' + hostOf(page.url()) + ' (node dev/test/login.mjs)');
}
