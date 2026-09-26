// The production write guard (#625), shared by the test harness (every spec) and
// baseline.mjs (the old standalone scripts). No test may write to production
// MusicBrainz. Three layers:
//   1. in the page: fetch, XMLHttpRequest, form submits, sendBeacon and the GM
//      shim refuse any non-GET request to musicbrainz.org / beta.musicbrainz.org;
//   2. on the network: the write-only endpoints are routed and aborted. ONLY
//      those — routing a URL that production navigates to (even with fallback())
//      makes the page load as chrome-error, which silently tests nothing;
//   3. a monitor: any production write that still reached the network is
//      reported, so a hole in 1–2 can't go unnoticed.
export const PROD_HOST = /^(beta\.)?musicbrainz\.org$/i;
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

// Installs all three layers on a browser context. onRefused(w) hears every write
// layers 1–2 stopped; leaked() lists production writes that got through anyway.
export async function installProdGuard(ctx, { allow = [], gm = null, onRefused = () => {} } = {}) {
  allow = SAFE_PROD_POSTS.concat(allow);
  const allowed = url => { const p = new URL(url).pathname; return allow.some(s => new RegExp(s, 'i').test(p)); };
  const routed = new Set(), sent = [];
  await ctx.exposeBinding('__harnessProdWrite', (_src, w) => onRefused(w));
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
