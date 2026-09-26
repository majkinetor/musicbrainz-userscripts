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
//   the GM shim    — GM_getValue/SetValue (in-memory), GM_info, GM_xmlhttpRequest
//                    (fetch-backed, or a no-op with gm.xhr: 'none'), unsafeWindow.
//   a production write guard, always on — see below.
//   page errors fail the test (test.use({ pageErrors: 'ignore' }) to opt out).
//
// Tags: @unit (no network: pure functions, stub pages), @prod (read-only on musicbrainz.org), @sandbox
// (test.musicbrainz.org, may write), @login (needs the logged-in profile).
import { test as base, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export { expect };
export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PROFILE = resolve(REPO, '.pw-profile');
export const PROD = 'https://musicbrainz.org';
export const SANDBOX = 'https://test.musicbrainz.org';

// A soft assertion with a readable message, so one failing check doesn't hide
// the rest (the ck() every old test carried).
export const check = (cond, msg) => expect.soft(!!cond, msg).toBe(true);

/* ── the production write guard ───────────────────────────────────────────────
   No test may write to production MusicBrainz. Three layers:
   1. in the page: fetch, XMLHttpRequest, form submits, sendBeacon and the GM
      shim refuse any non-GET request to musicbrainz.org / beta.musicbrainz.org;
   2. on the network: the write-only endpoints are routed and aborted. ONLY
      those — routing a URL that production navigates to (even with fallback())
      makes the page load as chrome-error, which silently tests nothing;
   3. a monitor: any production write that still reached the network fails the
      test, so a hole in 1–2 can't go unnoticed.
   A refused write fails the test too, unless the spec says it expects one
   (test.use({ prodWrites: 'block' })) and then reads the `blockedWrites` fixture. */
const PROD_HOST = /^(beta\.)?musicbrainz\.org$/i;
const hostOf = url => { try { return new URL(url).hostname; } catch { return ''; } };
const isProd = url => PROD_HOST.test(hostOf(url));
const WRITE_ONLY = /\/ws\/js\/edit\/|\/edit\/create\b|\/relationship-editor\b/i;
// POSTs that change nothing on production: seeding the release editor only renders the form.
const SAFE_PROD_POSTS = ['/release/add\\b'];
const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

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

// Runs in every frame before the page's own scripts: the GM shim and guard layer 1.
function pageInit(cfg) {
  window.__MBU_TEST__ = true;   // test hooks that are gated on a debug flag look for this
  const allow = cfg.allow.map(s => new RegExp(s, 'i'));
  const refuse = (method, url, via) => {
    let u; try { u = new URL(url, location.href); } catch (e) { return false; }
    method = String(method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || !/^(beta\.)?musicbrainz\.org$/i.test(u.hostname) || allow.some(r => r.test(u.pathname))) return false;
    try { window.__harnessProdWrite({ method, url: u.href, via }); } catch (e) { /* binding not ready in this frame */ }
    return true;
  };
  const refusal = () => new TypeError('test harness: a write to production MusicBrainz was refused');

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = (typeof input === 'string' || input instanceof URL) ? String(input) : input && input.url;
    const method = (init && init.method) || (input && input.method) || 'GET';
    if (refuse(method, url, 'fetch')) return Promise.reject(refusal());
    return origFetch.apply(this, arguments);
  };
  const xOpen = XMLHttpRequest.prototype.open, xSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) { this.__harness = { method, url }; return xOpen.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    if (this.__harness && refuse(this.__harness.method, this.__harness.url, 'xhr')) throw refusal();
    return xSend.apply(this, arguments);
  };
  const fSubmit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function () { if (refuse(this.method, this.action, 'form')) return; return fSubmit.apply(this, arguments); };
  window.addEventListener('submit', e => {
    const form = e.target, by = e.submitter;
    const method = (by && by.hasAttribute('formmethod') && by.formMethod) || form.method;
    const action = (by && by.hasAttribute('formaction') && by.formAction) || form.action;
    if (refuse(method, action, 'form')) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  if (navigator.sendBeacon) {
    const beacon = navigator.sendBeacon;
    navigator.sendBeacon = function (url) { if (refuse('POST', url, 'beacon')) return false; return beacon.apply(navigator, arguments); };
  }

  if (!cfg.gm) return;
  const store = new Map(Object.entries(cfg.gm.values || {}));
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => { store.set(k, v); };
  window.GM_deleteValue = k => { store.delete(k); };
  window.GM_listValues = () => [...store.keys()];
  window.GM_info = { script: { name: cfg.gm.name || 'userscript', version: cfg.gm.version || 'test', homepageURL: '' }, scriptHandler: 'test harness' };
  window.GM_openInTab = () => null;
  window.GM_setClipboard = () => {};
  window.unsafeWindow = window;
  // GM_xmlhttpRequest over fetch: real requests with the real session. Only
  // same-origin calls carry cookies — credentials:'include' is illegal against
  // Access-Control-Allow-Origin:*, and the real GM call isn't CORS-bound at all.
  window.GM_xmlhttpRequest = cfg.gm.xhr === 'none' ? () => {} : (opts) => {
    const method = opts.method || 'GET';
    (async () => {
      try {
        if (refuse(method, opts.url, 'GM_xmlhttpRequest')) throw refusal();
        const same = new URL(opts.url, location.href).origin === location.origin;
        const r = await origFetch(opts.url, { method, headers: opts.headers || {}, body: opts.data, redirect: 'follow', credentials: same ? 'include' : 'omit' });
        const text = await r.text();
        const headers = [...r.headers].map(([k, v]) => k + ': ' + v).join('\r\n');
        let response = text;
        if (opts.responseType === 'json') { try { response = JSON.parse(text); } catch (e) { response = null; } }
        const res = { status: r.status, statusText: r.statusText, responseText: text, response, responseHeaders: headers, finalUrl: r.url, readyState: 4 };
        opts.onload && opts.onload(res);
        opts.onloadend && opts.onloadend(res);
      } catch (e) { opts.onerror && opts.onerror(e); opts.onloadend && opts.onloadend({ status: 0, error: e }); }
    })();
    return { abort() {} };
  };
}

export const test = base.extend({
  // options — override per file with test.use({ … })
  profile: ['logged-in', { option: true }],   // 'logged-in' → .pw-profile · 'fresh' → a throwaway profile
  gm: [{}, { option: true }],                   // { name, version, values, xhr: 'fetch' | 'none' } · false = no GM shim
  prodWrites: ['fail', { option: true }],       // 'fail' · 'block' (refused silently; read the blockedWrites fixture)
  prodPostAllow: [[], { option: true }],        // extra production paths (regex sources) a POST may reach
  pageErrors: ['fail', { option: true }],       // 'fail' · 'ignore'

  // every production write the guard refused (layer 1 or 2); a spec using 'block' reads it
  blockedWrites: async ({}, use) => { await use([]); },

  context: async ({ headless, viewport, deviceScaleFactor, profile, gm, prodWrites, prodPostAllow, pageErrors, blockedWrites: refused }, use, testInfo) => {
    const ctx = await chromium.launchPersistentContext(profile === 'fresh' ? '' : PROFILE, { headless, viewport, deviceScaleFactor });
    const allow = SAFE_PROD_POSTS.concat(prodPostAllow);
    const allowed = url => { const p = new URL(url).pathname; return allow.some(s => new RegExp(s, 'i').test(p)); };
    const routed = new Set(), sent = [], errors = [];
    await ctx.exposeBinding('__harnessProdWrite', (_src, w) => { refused.push(w); });
    await ctx.addInitScript(pageInit, { allow, gm: gm === false ? null : gm });
    await ctx.route(u => isProd(u.href) && WRITE_ONLY.test(u.pathname), async route => {
      const req = route.request();
      if (READS.has(req.method())) return route.fallback();
      routed.add(req); refused.push({ method: req.method(), url: req.url(), via: 'network' });
      return route.abort('blockedbyclient');
    });
    ctx.on('request', req => { if (isProd(req.url()) && !READS.has(req.method()) && !allowed(req.url())) sent.push(req); });
    // MusicBrainz pages report their errors to Sentry; errors a test provokes
    // (stub pages, blocked requests) are not theirs to triage.
    await ctx.route(u => /(^|\.)sentry\.io$/i.test(u.hostname), r => r.abort());
    const watch = p => p.on('pageerror', e => errors.push(e.message));
    ctx.pages().forEach(watch); ctx.on('page', watch);

    await use(ctx);

    const failed = testInfo.status !== testInfo.expectedStatus;
    if (failed) for (const p of ctx.pages()) {
      try { await testInfo.attach('page ' + p.url(), { body: await p.screenshot(), contentType: 'image/png' }); } catch (e) { /* page already gone */ }
    }
    await ctx.close();
    const leaked = sent.filter(r => !routed.has(r)).map(r => r.method() + ' ' + r.url());
    expect(leaked, 'writes that reached PRODUCTION MusicBrainz — the guard has a hole').toEqual([]);
    if (prodWrites === 'fail') expect(refused.map(w => `${w.method} ${w.url} (${w.via})`), 'the test tried to write to production MusicBrainz (refused)').toEqual([]);
    if (pageErrors === 'fail') expect(errors, 'page errors').toEqual([]);
  },
  page: async ({ context }, use) => { await use(context.pages()[0] || await context.newPage()); },

  inject: async ({ page }, use) => {
    await use(async (name, { waitFor, target = page, atStart = false } = {}) => {
      const file = sourceOf(name);
      const code = await readFile(file, 'utf8');
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

// Skip (not fail) when the profile isn't logged in to the site the page is on.
export async function requireLogin(page) {
  const out = page.url().includes('/login') || await page.evaluate(() => !document.querySelector('a[href*="/logout"]'));
  test.skip(out, 'the test profile is not logged in to ' + hostOf(page.url()) + ' (node dev/test/login.mjs)');
}
