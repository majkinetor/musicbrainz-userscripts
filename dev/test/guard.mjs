// The production write guard (#625), installed by the test harness for every
// spec. No test may write to production
// MusicBrainz. Three layers:
//   1. in the page: fetch, XMLHttpRequest, form submits, sendBeacon and the GM
//      shim refuse any non-GET request to musicbrainz.org / beta.musicbrainz.org;
//   2. on the network: the write-only endpoints are routed and aborted. ONLY
//      those — routing a URL that production navigates to (even with fallback())
//      makes the page load as chrome-error, which silently tests nothing;
//   3. a monitor: any production write that still reached the network is
//      reported, so a hole in 1–2 can't go unnoticed.
export const PROD_HOST = /^(beta\.)?musicbrainz\.org$/i;
// GM_xmlhttpRequest made from Node carries the browser's user agent, as a manager's does — a
// desktop Chrome's, not headless Chromium's: some sites refuse "HeadlessChrome" (Amazon Music, #644)
export const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
export const withUa = h => (Object.keys(h || {}).some(k => /^user-agent$/i.test(k)) ? h : { ...(h || {}), 'User-Agent': BROWSER_UA });
export const hostOf = url => { try { return new URL(url).hostname; } catch { return ''; } };
export const isProd = url => PROD_HOST.test(hostOf(url));
export const WRITE_ONLY = /\/ws\/js\/edit\/|\/edit\/create\b|\/relationship-editor\b/i;
// POSTs that change nothing on production: seeding the release editor only renders
// the form; the release editor's own edit preview renders what WOULD be submitted;
// and /__meb_verify is MusicBrainz's "Verifying your browser" challenge, which the
// page's own script answers before it serves the real page.
export const SAFE_PROD_POSTS = ['/release/add\\b', '^/ws/js/edit/preview$', '^/__meb_verify$'];
const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Runs in every frame before the page's own scripts: the GM shim and guard layer 1.
export function pageInit(cfg) {
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
  let store = new Map(Object.entries(cfg.gm.values || {}));
  // gm.persist: the values survive a reload and same-tab navigation, as real GM storage
  // does. true: in the tab's sessionStorage, so per tab and per origin; gm.values seeds
  // each new tab once. 'tabs': in localStorage, shared by every tab of the origin, like
  // real GM storage across tabs. The profile keeps localStorage between runs, so each
  // test gets its own namespace and older ones are swept.
  if (cfg.gm.persist) try {
    const shared = cfg.gm.persist === 'tabs';
    const ss = shared ? window.localStorage : window.sessionStorage;
    const P = shared ? `__gm_${cfg.gm.run}__` : '__gm__', INIT = shared ? P + ':seeded' : '__gm_seeded__';
    if (shared) Object.keys(ss).filter(k => k.startsWith('__gm_') && !k.startsWith(P)).forEach(k => ss.removeItem(k));
    if (!ss.getItem(INIT)) { ss.setItem(INIT, '1'); for (const [k, v] of store) ss.setItem(P + k, JSON.stringify(v)); }
    store = {
      has: k => ss.getItem(P + k) !== null,
      get: k => { const v = ss.getItem(P + k); return v === null ? undefined : JSON.parse(v); },
      set: (k, v) => ss.setItem(P + k, JSON.stringify(v === undefined ? null : v)),
      delete: k => ss.removeItem(P + k),
      keys: () => Object.keys(ss).filter(k => k.startsWith(P) && k !== INIT).map(k => k.slice(P.length)),
    };
  } catch (e) { /* no storage here (about:blank): the values live in the page */ }
  // value-change listeners hear this page's own writes (remote = false)
  const listeners = new Map(); let nextListener = 1;
  const changed = (k, before, after) => listeners.forEach(l => { if (l.k === k) try { l.fn(k, before, after, false); } catch (e) { /* the script's own error */ } });
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => { const before = store.get(k); store.set(k, v); changed(k, before, v); };
  window.GM_deleteValue = k => { const before = store.get(k); store.delete(k); changed(k, before, undefined); };
  window.GM_listValues = () => [...store.keys()];
  window.GM_addValueChangeListener = (k, fn) => { const id = nextListener++; listeners.set(id, { k, fn }); return id; };
  window.GM_removeValueChangeListener = id => { listeners.delete(id); };
  window.GM_registerMenuCommand = () => 0;
  window.GM_info = { script: { name: cfg.gm.name || 'userscript', version: cfg.gm.version || 'test', homepageURL: '' }, scriptHandler: 'test harness' };
  window.GM_openInTab = () => null;
  window.GM_setClipboard = () => {};
  window.unsafeWindow = window;
  // GM_xmlhttpRequest over fetch: real requests with the real session. Only
  // same-origin calls carry cookies — credentials:'include' is illegal against
  // Access-Control-Allow-Origin:*, and the real GM call isn't CORS-bound at all.
  // GM_xmlhttpRequest as a manager does it by default ('node'): from outside the page, so
  // not bound by CORS, with the browser context's cookies. 'fetch' uses the page's own
  // fetch (same-origin cookies only, CORS applies); 'none' never answers.
  const response = (opts, r) => {
    let response = r.text;
    const rt = opts.responseType;
    if (rt === 'json') { try { response = JSON.parse(r.text); } catch (e) { response = null; } }
    else if (rt === 'arraybuffer') response = r.bytes.buffer;
    else if (rt === 'blob') response = new Blob([r.bytes], { type: (r.headers.match(/^content-type:\s*(.+)$/im) || [])[1] || '' });
    return { status: r.status, statusText: r.statusText, responseText: r.text, response, responseHeaders: r.headers, finalUrl: r.url, readyState: 4 };
  };
  const viaFetch = async (opts, method) => {
    const same = new URL(opts.url, location.href).origin === location.origin;
    const r = await origFetch(opts.url, { method, headers: opts.headers || {}, body: opts.data, redirect: 'follow', credentials: same ? 'include' : 'omit' });
    const bytes = new Uint8Array(await r.arrayBuffer());
    return { status: r.status, statusText: r.statusText, url: r.url, headers: [...r.headers].map(([k, v]) => k + ': ' + v).join('\r\n'), bytes, text: new TextDecoder().decode(bytes) };
  };
  const viaNode = async (opts, method) => {
    const r = await window.__harnessGmXhr({ url: new URL(opts.url, location.href).href, method, headers: opts.headers || {}, data: opts.data, timeout: opts.timeout || 0 });
    const bytes = Uint8Array.from(atob(r.b64), c => c.charCodeAt(0));
    return { ...r, bytes, text: new TextDecoder().decode(bytes) };
  };
  window.GM_xmlhttpRequest = cfg.gm.xhr === 'none' ? () => ({ abort() {} }) : (opts) => {
    const method = opts.method || 'GET';
    (async () => {
      try {
        if (refuse(method, opts.url, 'GM_xmlhttpRequest')) throw refusal();
        // a FormData or Blob body can't cross into Node: those go through the page
        const node = cfg.gm.xhr !== 'fetch' && (opts.data == null || typeof opts.data === 'string');
        const res = response(opts, node ? await viaNode(opts, method) : await viaFetch(opts, method));
        opts.onload && opts.onload(res);
        opts.onloadend && opts.onloadend(res);
      } catch (e) {
        const err = { status: 0, statusText: String(e && e.message || e), error: e, finalUrl: opts.url, readyState: 4 };
        opts.onerror && opts.onerror(err); opts.onloadend && opts.onloadend(err);
      }
    })();
    return { abort() {} };
  };
}

// Installs all three layers on a browser context. onRefused(w) hears every write
// layers 1–2 stopped; leaked() lists production writes that got through anyway.
export async function installProdGuard(ctx, { allow = [], gm = null, onRefused = () => {} } = {}) {
  allow = SAFE_PROD_POSTS.concat(allow);
  const allowed = url => { const p = new URL(url).pathname; return allow.some(s => new RegExp(s, 'i').test(p)); };
  const routed = new Set(), sent = [];
  await ctx.exposeBinding('__harnessProdWrite', (_src, w) => onRefused(w));
  // a namespace for gm.persist: 'tabs', one per context
  if (gm) gm = { ...gm, run: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) };
  // the GM_xmlhttpRequest bridge: the request is made by Node, through the context
  if (gm && gm.xhr !== 'fetch' && gm.xhr !== 'none') {
    await ctx.exposeBinding('__harnessGmXhr', async (_src, o) => {
      if (isProd(o.url) && !READS.has(String(o.method).toUpperCase()) && !allowed(o.url)) {
        onRefused({ method: o.method, url: o.url, via: 'GM_xmlhttpRequest (node)' });
        throw new Error('test harness: a write to production MusicBrainz was refused');
      }
      // page routes don't see a request made from Node; answerGm() and replayWs() register
      // here: ({ url, method, headers, data }) => { status, body, headers? } or nothing.
      // The latest registration is asked first, as page routes are.
      for (const answer of [...(ctx.__harnessGmAnswers || [])].reverse()) {
        const a = await answer({ ...o, method: String(o.method).toUpperCase() });
        if (a) return { status: a.status || 200, statusText: a.statusText || '', url: a.url || o.url, headers: a.headers || 'content-type: application/json', b64: Buffer.from(a.body == null ? '' : a.body).toString('base64') };
      }
      const r = await ctx.request.fetch(o.url, { method: o.method, headers: withUa(o.headers), data: o.data, maxRedirects: 20, failOnStatusCode: false, timeout: o.timeout || 60000 });
      const body = await r.body();
      return { status: r.status(), statusText: r.statusText(), url: r.url(), headers: r.headersArray().map(h => h.name + ': ' + h.value).join('\r\n'), b64: body.toString('base64') };
    });
  }
  await ctx.addInitScript(pageInit, { allow, gm });
  await ctx.route(u => isProd(u.href) && WRITE_ONLY.test(u.pathname), async route => {
    const req = route.request();
    if (READS.has(req.method()) || allowed(req.url())) return route.fallback();
    routed.add(req); onRefused({ method: req.method(), url: req.url(), via: 'network' });
    return route.abort('blockedbyclient');
  });
  ctx.on('request', req => { if (isProd(req.url()) && !READS.has(req.method()) && !allowed(req.url())) sent.push(req); });
  // MusicBrainz pages report their errors to Sentry; errors a test provokes
  // (stub pages, blocked requests) are not theirs to triage.
  await ctx.route(u => /(^|\.)sentry\.io$/i.test(u.hostname), r => r.abort());
  return { leaked: () => sent.filter(r => !routed.has(r)).map(r => r.method() + ' ' + r.url()) };
}
