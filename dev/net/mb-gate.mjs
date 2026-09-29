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
        let s = null;
        try { s = JSON.parse(localStorage.getItem(MBN_KEY) || 'null'); } catch (e) { s = null; }
        const g = globalThis.__mbnGate || (globalThis.__mbnGate = { tat: 0, cool: 0, hot: 0 });
        if (!s || typeof s !== 'object') s = g;   // no storage: this page's copy only
        const out = fn(s);
        Object.assign(g, s);
        try { localStorage.setItem(MBN_KEY, JSON.stringify({ tat: s.tat || 0, cool: s.cool || 0, hot: s.hot || 0 })); } catch (e) {}
        return out;
    };
    try {
        if (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) return await navigator.locks.request(MBN_LOCK, rw);
    } catch (e) { /* no Web Locks here (an insecure or sandboxed context): unlocked, like a lone script */ }
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
            s.hot = Math.min((s.hot || 0) + 1, 6);
            const ms = Math.min(Math.max(1000, ra) * s.hot, MBN_MAX_HOLD);
            s.cool = Math.max(s.cool || 0, Date.now() + ms);
            return s.cool - Date.now();
        });
        if (o.log) o.log('warn', 'MusicBrainz gate: HTTP ' + status + (raw != null ? ' (Retry-After: ' + raw + ')' : '') + ' — every script holds ' + Math.round(hold / 100) / 10 + 's');
        return { throttled: true, hold };
    }
    if (status >= 200 && status < 500) await mbnState(s => { if (s.hot) s.hot--; });
    return { throttled: false, hold: 0 };
}

/**
 * fetch() through the gate: waits for a slot, reports the answer, retries a 429/503
 * (the retry waits out the shared hold, so it needs no sleep of its own).
 * Other requests pass straight through. Resolves the Response, or null when cancelled.
 *   o.tries  attempts on 429/503 (default 4); the last answer is returned as it is
 */
export async function mbnFetch(url, init, o) {
    o = o || {};
    if (!mbnGated(url)) return fetch(url, init);
    const tries = o.tries || 4;
    for (let attempt = 1; ; attempt++) {
        const slot = await mbnSlot(o);
        if (!slot.ok) return null;
        const r = await fetch(url, init);
        const a = await mbnAnswer(r.status, n => r.headers.get(n), o);
        if (!a.throttled || attempt >= tries) return r;
    }
}

/** What sync-gate.mjs inlines, in order. */
export const MBN_INLINE = {
    consts: { MBN_GAP, MBN_BURST, MBN_KEY, MBN_LOCK, MBN_MAX_HOLD },
    fns: [mbnGated, mbnState, mbnSlot, mbnAnswer, mbnFetch],
};
