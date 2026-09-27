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
//
// The guard itself lives in guard.mjs; see there.
//
// Tags: @unit (no network: pure functions, stub pages), @prod (read-only on musicbrainz.org), @sandbox
// (test.musicbrainz.org, may write), @web (another live site, read-only: Bandcamp, Discogs…),
// @login (needs the logged-in profile), @critical (the quick run: pnpm test --grep @critical).
import { test as base, expect, chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { installProdGuard, hostOf } from './guard.mjs';

export { expect };
export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PROFILE = resolve(REPO, '.pw-profile');
export const PROD = 'https://musicbrainz.org';
export const SANDBOX = 'https://test.musicbrainz.org';

// A soft assertion with a readable message, so one failing check doesn't hide
// the rest (the ck() every old test carried).
export const check = (cond, msg) => expect.soft(!!cond, msg).toBe(true);

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

export const test = base.extend({
  // options — override per file with test.use({ … })
  profile: ['logged-in', { option: true }],   // 'logged-in' → .pw-profile · 'fresh' → a throwaway profile
  gm: [{}, { option: true }],                   // { name, version, values, persist, xhr: 'node' | 'fetch' | 'none' } · false = no GM shim
  prodWrites: ['fail', { option: true }],       // 'fail' · 'block' (refused silently; read the blockedWrites fixture)
  prodPostAllow: [[], { option: true }],        // extra production paths (regex sources) a POST may reach
  pageErrors: ['fail', { option: true }],       // 'fail' · 'ignore' · [regex sources]: fail on any other

  // every production write the guard refused (layer 1 or 2); a spec using 'block' reads it
  blockedWrites: async ({}, use) => { await use([]); },

  context: async ({ headless, viewport, deviceScaleFactor, profile, gm, prodWrites, prodPostAllow, pageErrors, blockedWrites: refused }, use, testInfo) => {
    const ctx = await chromium.launchPersistentContext(profile === 'fresh' ? '' : PROFILE, { headless, viewport, deviceScaleFactor });
    const errors = [];
    const guard = await installProdGuard(ctx, { allow: prodPostAllow, gm: gm === false ? null : gm, onRefused: w => refused.push(w) });
    const watch = p => p.on('pageerror', e => errors.push(e.message));
    ctx.pages().forEach(watch); ctx.on('page', watch);

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
    if (pageErrors !== 'ignore') expect(errors.filter(e => !letThrough.some(r => r.test(e))), 'page errors').toEqual([]);
  },
  page: async ({ context }, use) => { await use(context.pages()[0] || await context.newPage()); },

  inject: async ({ page }, use) => {
    await use(async (name, { waitFor, target = page, atStart = false, transform } = {}) => {
      const file = sourceOf(name);
      let code = await readFile(file, 'utf8');
      if (transform) code = transform(code);   // e.g. a default flipped for the test
      if (atStart) await target.addInitScript({ content: code });
      else await target.addScriptTag({ content: code });
      if (waitFor && !atStart) await target.waitForFunction(g => !!window[g], waitFor, { timeout: 20000 });
      return { file, version: (code.match(/@version\s+(\S+)/) || [])[1] || '' };
    });
  },
});

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
// RECORD_WS=1 records: each read is fetched from production (paced, throttling waited
// out) and the file is rewritten at done(). A read missing from the fixture is answered
// 503, as a throttled server would, and done() fails the test naming it. A fixture
// named *.gz is gzipped (a search for a common name can be 100 kB of JSON).
//
// `as: { <sandbox mbid>: <production mbid> }` answers a sandbox copy's reads with its
// production original's data (copy-to-sandbox.mjs makes such copies; sandboxAs() reads
// the map for one).
//
// `web: true` (or a RegExp of host names) replays the other sites a script asks through
// GM_xmlhttpRequest as well — Spotify, Discogs, a search engine — recorded once from the
// live site, so a spec about matching gets the same candidates every run. Access tokens
// in a recorded reply are replaced, and an HTML page is recorded without its styles, SVG
// and comments (never data, and most of a page's weight); `trim: (key, body) => body`
// cuts a reply further (a 3 MB script read for one id). A request the fixture lacks
// fails as a network error would, and done() names it.
export async function replayWs(page, file, { from = PROD, paths = /^\/ws\/2\//, as = {}, web = false, trim = null } = {}) {
  const record = !!process.env.RECORD_WS;
  const gz = String(file).endsWith('.gz');
  const store = record ? {} : JSON.parse(gz ? gunzipSync(await readFile(file)).toString('utf8') : await readFile(file, 'utf8'));
  const missing = [];
  let last = 0;
  const isMb = u => /(^|\.)musicbrainz\.org$/.test(u.hostname);
  const covers = u => paths.test(u.pathname) && isMb(u);
  const mapped = key => { for (const [copy, orig] of Object.entries(as)) key = key.split(copy).join(orig); return key; };
  // the answer for one read: recorded now, or from the fixture
  const answer = async u => {
    const key = mapped(u.pathname + u.search);
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
    const key = mapped((method === 'GET' ? '' : method + ' ') + url + (data ? ' ' + data : ''));
    const reply = a => ({ status: a.status, url: a.url, headers: 'content-type: ' + a.type, body: a.b64 ? Buffer.from(a.b64, 'base64') : a.body });
    if (record && !store[key]) {
      let live;
      try {
        const r = await context.request.fetch(url, { method, headers, data, maxRedirects: 20, failOnStatusCode: false, timeout: 60000 });
        const bytes = await r.body(), type = r.headers()['content-type'] || '';
        const text = !type || /json|text|xml|html|javascript/i.test(type);
        let body = text ? bytes.toString('utf8') : undefined;
        if (text && /html/i.test(type)) {
          body = body.replace(/<style[\s>][\s\S]*?<\/style>|<svg[\s>][\s\S]*?<\/svg>|<!--[\s\S]*?-->/gi, '');
          if (r.status() >= 400) body = body.slice(0, 2000);   // a refusal page: what it says is enough
        }
        if (text && trim) body = trim(key, body);
        live = { status: r.status(), type, ...(r.url() !== url ? { url: r.url() } : {}), ...(text ? { body } : { b64: bytes.toString('base64') }) };
        // the fixture keeps no working token; the script, still talking to the live site, gets the real one
        store[key] = text ? { ...live, body: body.replace(/"(access_token|refresh_token|id_token)"(\s*:\s*)"[^"]*"/g, '"$1"$2"recorded"') } : live;
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
  return {
    // the answer for a url, to build on: a spec's answerGm() that adjusts a replayed reply
    answer: url => (isMb(new URL(url)) ? answer(new URL(url)) : answerWeb({ url })),
    async done() {
      if (record) { const json = JSON.stringify(store, null, 1) + '\n'; await writeFile(file, gz ? gzipSync(json, { level: 9 }) : json); return; }
      expect(missing, 'reads the fixture has no answer for (RECORD_WS=1 to re-record)').toEqual([]);
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

// Skip (not fail) when the profile isn't logged in to the site the page is on.
export async function requireLogin(page) {
  const out = page.url().includes('/login') || await page.evaluate(() => !document.querySelector('a[href*="/logout"]'));
  test.skip(out, 'the test profile is not logged in to ' + hostOf(page.url()) + ' (node dev/test/login.mjs)');
}
