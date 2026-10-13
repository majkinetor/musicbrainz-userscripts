// One MusicBrainz request gate for every script (#633).
//
// MusicBrainz limits /ws/2 per IP (about one request a second on average), and each
// script used to pace itself as if it had that budget alone. Under String Theory, or
// with two MusicBrainz tabs open, they spent it together and throttled each other.
// This gate is shared by every copy of it on the origin:
//
//   - the schedule lives in localStorage (one origin, so every script and tab reads it),
//     and is read and written under a Web Lock, so two callers never book the same slot;
//   - a start slot every MBN_GAP, with a burst of MBN_BURST (a GCRA: `tat` is the
//     theoretical arrival time of the next request);
//   - a 429/503 anywhere holds everyone: `cool` is the time nobody starts before, and
//     `hot` stretches it while the throttling goes on (Retry-After is a floor, since
//     MusicBrainz sends "Retry-After: 0");
//   - an interactive request (a click, a picker search) is not queued behind background
//     work: it starts as soon as the hold allows, and still counts against the budget.
//
// Pacing is by request STARTS, not completions (#575): a slow search must not stall the
// ones behind it. Only /ws/2 is gated; /ws/js and the website's forms are not rate-limited
// the same way. The X-RateLimit-* headers MusicBrainz sends are server-wide budgets
// (X-RateLimit-Who: search-shed), not this client's, so the gate doesn't steer by them.
//
// The website side has its own guard instead, the "Verifying your browser" check: mbnFetch
// passes it again when it answers a request (#733), so route every /ws/js call through it.
//
// Every function here is self-contained (it may call the others and use the MBN_ consts,
// nothing else): dev/net/sync-gate.mjs inlines them into the single-file scripts between
// `// <ST-NET>` markers; Credit Hoarder's esbuild build imports this module directly.
// Edit HERE, never in a generated block.

/** Between request starts, sustained: MusicBrainz's published guidance. */
export const MBN_GAP = 1000;
/** Requests that may start back to back after a quiet spell. */
export const MBN_BURST = 3;
/** The shared schedule, in the origin's localStorage. */
export const MBN_KEY = 'mbu:mb-gate';
/** The Web Lock that serialises reading and writing it. */
export const MBN_LOCK = 'mbu-mb-gate';
/** The longest one throttle holds everyone. */
export const MBN_MAX_HOLD = 60000;

/** True for a request the gate paces: MusicBrainz's /ws/2, relative or absolute. */
export function mbnGated(url) {
    const s = String(url || '');
    return /^\/ws\/2\//.test(s) || /^https?:\/\/([a-z0-9-]+\.)*musicbrainz\.org\/ws\/2\//i.test(s);
}

/** Read-modify-write the shared schedule. `fn(state)` may change `state`; its result is returned. */
export async function mbnState(fn) {
    const rw = () => {
        let s = null, stored = true;
        try { s = JSON.parse(localStorage.getItem(MBN_KEY) || 'null'); } catch (e) { stored = false; }
        const g = globalThis.__mbnGate || (globalThis.__mbnGate = { tat: 0, cool: 0, hot: 0 });
        if (!stored) s = g;                                                        // no storage: this page's copy only
        else if (!s || typeof s !== 'object') s = { tat: 0, cool: 0, hot: 0 };   // none yet (or cleared): a fresh schedule
        const out = fn(s);
        Object.assign(g, s);
        try { localStorage.setItem(MBN_KEY, JSON.stringify({ tat: s.tat || 0, cool: s.cool || 0, hot: s.hot || 0 })); } catch (e) {}
        return out;
    };
    // The lock is held only for rw()'s synchronous moment, so a wait of seconds means it is
    // stuck (a frozen or sandboxed holder): give up on it and go unlocked rather than hang
    // every request behind it.
    let timer = 0;
    try {
        if (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) {
            const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
            if (ctrl) timer = setTimeout(() => ctrl.abort(), 3000);
            return await navigator.locks.request(MBN_LOCK, ctrl ? { signal: ctrl.signal } : {}, rw);
        }
    } catch (e) { /* no Web Locks here (an insecure or sandboxed context), or stuck: unlocked, like a lone script */ } finally { clearTimeout(timer); }
    return rw();
}

/**
 * Wait for this request's start slot.
 *   o.background  queue behind the budget (default); false = interactive, start as soon as no hold
 *   o.cancelled   () => true stops the wait (a superseded search, a Stop): resolves { ok: false }
 *   o.log         (level, message) for waits worth mentioning (over a second)
 *   o.label       what the request is, for the log
 * Resolves { ok: true, waited } when the request may start.
 */
export async function mbnSlot(o) {
    o = o || {};
    const t0 = Date.now(), background = o.background !== false;
    const booked = await mbnState(s => {
        const now = Date.now(), cool = s.cool || 0, tat = s.tat || 0;
        let at = background ? Math.max(now, tat - (MBN_BURST - 1) * MBN_GAP) : now;
        at = Math.max(at, cool);
        s.tat = Math.max(tat, at) + MBN_GAP;
        return { at, why: cool > now && cool >= at ? 'MusicBrainz asked everyone to wait' : 'pacing, one request a second' };
    });
    let told = false;
    for (;;) {
        if (o.cancelled && o.cancelled()) return { ok: false, waited: Date.now() - t0 };
        let cool = 0;
        try { cool = (JSON.parse(localStorage.getItem(MBN_KEY) || 'null') || {}).cool || 0; } catch (e) { cool = (globalThis.__mbnGate || {}).cool || 0; }
        const until = Math.max(booked.at, cool), left = until - Date.now();   // a hold that appeared while we queued
        if (left <= 0) break;
        if (!told && until - t0 > 1000 && o.log) { told = true; o.log('info', 'MusicBrainz gate: ' + (o.label || 'request') + ' waits ' + Math.round((until - t0) / 100) / 10 + 's (' + (cool > booked.at ? 'MusicBrainz asked everyone to wait' : booked.why) + ')'); }
        await new Promise(r => setTimeout(r, Math.min(left, 250)));   // in slices, so a cancel lands promptly
    }
    return { ok: true, waited: Date.now() - t0 };
}

/**
 * Tell the gate how MusicBrainz answered. `header(name)` returns a response header or null.
 * A 429/503 holds every caller on the origin; a clean answer earns some room back.
 * Resolves { throttled, hold } — hold is how long everyone now waits, in ms.
 */
export async function mbnAnswer(status, header, o) {
    o = o || {};
    if (status === 429 || status === 503) {
        const raw = header ? header('Retry-After') : null;
        const secs = Number(raw), date = raw ? Date.parse(raw) : NaN;
        const ra = Number.isFinite(secs) ? secs * 1000 : Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
        const hold = await mbnState(s => {
            const now = Date.now();
            // One throttle, one step: the requests already in flight when it began all answer
            // 503 too, and each must not stretch the hold again. A throttle long gone doesn't
            // count at all: `hot` is shared and persists, and would otherwise slow every later
            // page for good.
            if (now > (s.cool || 0) + 30000) s.hot = 0;
            if (now >= (s.cool || 0)) s.hot = Math.min((s.hot || 0) + 1, 6);
            const ms = Math.min(Math.max(1000, ra) * Math.max(1, s.hot), MBN_MAX_HOLD);
            s.cool = Math.max(s.cool || 0, Date.now() + ms);
            return s.cool - Date.now();
        });
        if (o.log) o.log('warn', 'MusicBrainz gate: HTTP ' + status + (raw != null ? ' (Retry-After: ' + raw + ')' : '') + ' — every script holds ' + Math.round(hold / 100) / 10 + 's');
        return { throttled: true, hold };
    }
    if (status >= 200 && status < 500) await mbnState(s => { if (s.hot) s.hot = Date.now() > (s.cool || 0) + 30000 ? 0 : s.hot - 1; });
    return { throttled: false, hold: 0 };
}

/**
 * fetch() through the gate: waits for a slot, reports the answer, retries a 429/503
 * (the retry waits out the shared hold, so it needs no sleep of its own).
 * Other requests aren't paced; one to MusicBrainz's website side (/ws/js, pages, forms) that
 * gets the browser check instead passes it once and is retried (#733, mbnReverify below).
 * Resolves the Response, or null when cancelled.
 *   o.tries   attempts on 429/503 (default 4); the last answer is returned as it is
 *   o.log, o.notify  see mbnReverify
 */
export async function mbnFetch(url, init, o) {
    o = o || {};
    if (!mbnGated(url)) {
        const r = await fetch(url, init);
        if (!mbnWebsite(url) || !(await mbnIsCheck(r))) return r;
        // #733: MusicBrainz's browser check answered instead: nothing was done (a POST is safe
        // to repeat), so pass the check and ask again
        return (await mbnReverify(url, init, o)) ? fetch(url, init) : r;
    }
    const tries = o.tries || 4;
    for (let attempt = 1; ; attempt++) {
        const slot = await mbnSlot(o);
        if (!slot.ok) return null;
        const r = await fetch(url, init);
        const a = await mbnAnswer(r.status, n => r.headers.get(n), o);
        if (!a.throttled || attempt >= tries) return r;
    }
}

/** How throttled MusicBrainz is right now (0: not at all), for a caller that narrows its own
 *  concurrency while it is — Apollo probes with a single request until a clean answer (#575). */
export function mbnHot() {
    let s;
    try { s = JSON.parse(localStorage.getItem(MBN_KEY) || 'null') || {}; } catch (e) { s = globalThis.__mbnGate || {}; }
    return Date.now() > (s.cool || 0) + 30000 ? 0 : (s.hot || 0);   // a throttle long gone is over
}

/** One header out of a GM_xmlhttpRequest response's raw `responseHeaders` text, or null. */
export function mbnRawHeader(raw, name) {
    const want = String(name).toLowerCase();
    for (const line of String(raw || '').split(/\r?\n/)) {
        const i = line.indexOf(':');
        if (i > 0 && line.slice(0, i).trim().toLowerCase() === want) return line.slice(i + 1).trim();
    }
    return null;
}

/* ── MusicBrainz's browser check (#733) ──
 * Since 2026-09 musicbrainz.org's website side, /ws/js included (ws/2 not), answers with a
 * "Verifying your browser" page (HTTP 200, HTML) until the browser has solved its
 * proof-of-work, which sets a __meb_verified cookie: 24 h, bound to the IP. A page that stays
 * open (the release editor) outlives it, or the IP changes, and every request from then on
 * gets the check instead of its answer. mbnFetch passes it again in one hidden frame, where
 * MusicBrainz's own script solves it and renews the cookie for the whole browser, then retries.
 * The page is recognised by its <title> and <noscript> text, never by "/__meb_verify": ordinary
 * pages carry a beacon posting there too (Falcon #551). */

/** True for a request to MusicBrainz's website side (not ws/2), which the browser check guards. */
export function mbnWebsite(url) {
    const s = String(url || '');
    if (mbnGated(s)) return false;
    if (/^https?:\/\/([a-z0-9-]+\.)*musicbrainz\.org(\/|$)/i.test(s)) return true;
    return /^\/(?!\/)/.test(s) && typeof location !== 'undefined' && /(^|\.)musicbrainz\.org$/i.test(location.hostname);
}

/** Whether a Response is the browser check. Reads a clone, so `r` stays whole (body, url). */
export async function mbnIsCheck(r) {
    try {
        if (!r || !/text\/html/i.test((r.headers && r.headers.get('content-type')) || '')) return false;
        const head = (await r.clone().text()).slice(0, 3000);
        return /<title>\s*Verifying your browser\s*<\/title>|JavaScript is required to access this page/i.test(head);
    } catch (e) { return false; }
}

/**
 * Pass the browser check again: one fresh hidden frame at a MusicBrainz URL on this page's own
 * host (the cookie is per host; a frame from another site wouldn't get it). Requests that hit the
 * check together share the frame. Resolves true once the frame has left the check.
 *   o.log     (level, message)
 *   o.notify  (message) when it fails, for a toast: the user can pass it in another tab
 */
export function mbnReverify(url, init, o) {
    o = o || {};
    const log = (lvl, m) => { try { if (o.log) o.log(lvl, m); else (lvl === 'warn' ? console.warn : console.info)('[MusicBrainz gate] ' + m); } catch (e) {} };
    const g = globalThis.__mbnCheck || (globalThis.__mbnCheck = { busy: null, failedAt: 0 });
    if (g.busy) return g.busy;
    let target;
    try { target = new URL(String(url), location.href); } catch (e) { return Promise.resolve(false); }
    if (target.host !== location.host || typeof document === 'undefined') { log('warn', 'MusicBrainz asked to verify the browser — open any MusicBrainz page, then retry'); return Promise.resolve(false); }
    if (Date.now() - g.failedAt < 60000) return Promise.resolve(false);   // just failed: don't loop
    // a POST's URL can't be loaded: the check is per browser, so any light GET passes it
    const method = String((init && init.method) || 'GET').toUpperCase();
    const src = method === 'GET' ? target.href : location.origin + '/ws/js/entity/89ad4ac3-39f7-470e-963a-56509c546377';
    const t0 = Date.now();
    log('warn', 'MusicBrainz asked to verify the browser again ("Verifying your browser") — passing it in a hidden frame');
    g.busy = new Promise(resolve => {
        const fr = document.createElement('iframe');   // fresh each time, never re-navigated
        fr.setAttribute('aria-hidden', 'true'); fr.setAttribute('data-mbn-check', ''); fr.tabIndex = -1;
        fr.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:0;border:0;opacity:0;pointer-events:none';
        let loads = 0, done = false, timer = 0;
        const finish = ok => {
            if (done) return; done = true; clearTimeout(timer); fr.remove(); g.busy = null;
            if (ok) log('info', 'browser check passed in ' + (Date.now() - t0) + ' ms — retrying');
            else {
                g.failedAt = Date.now();
                const m = 'MusicBrainz wants to verify your browser — open any MusicBrainz page in another tab, then retry';
                log('warn', m + ' (the hidden frame did not clear it in 20 s)');
                try { if (o.notify) o.notify(m); } catch (e) {}
            }
            resolve(ok);
        };
        // the first load is the check; it posts its answer and is redirected to the real URL
        fr.onload = () => {
            loads++;
            let still;
            try { const d = fr.contentDocument; still = !d || /<title>\s*Verifying your browser\s*<\/title>|JavaScript is required to access this page/i.test(d.documentElement ? d.documentElement.outerHTML.slice(0, 3000) : ''); }
            catch (e) { still = loads < 2; }
            if (!still) finish(true);
        };
        timer = setTimeout(() => finish(false), 20000);
        fr.src = src;
        (document.body || document.documentElement).appendChild(fr);
    });
    return g.busy;
}

/** What sync-gate.mjs inlines, in order. */
export const MBN_INLINE = {
    consts: { MBN_GAP, MBN_BURST, MBN_KEY, MBN_LOCK, MBN_MAX_HOLD },
    fns: [mbnGated, mbnState, mbnSlot, mbnAnswer, mbnFetch, mbnHot, mbnRawHeader, mbnWebsite, mbnIsCheck, mbnReverify],
};
