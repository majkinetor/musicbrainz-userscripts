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
//   - but a 503 with X-RateLimit-Who: search-shed refuses searches only, so it holds only
//     searches (`scool`, stretched by `shot`): lookups and browses go on at their pace;
//   - an interactive request (a click, a picker search) is not queued behind background
//     work: it starts as soon as the hold allows, and still counts against the budget;
//   - a page drawing what its reader asked for (Event Horizon) takes the lead (#847): while it
//     holds it, every other background request, in any script or tab, waits to book its slot.
//
// Pacing is by request STARTS, not completions (#575): a slow search must not stall the
// ones behind it. Only /ws/2 is gated; /ws/js and the website's forms are not rate-limited
// the same way. The X-RateLimit-* headers MusicBrainz sends are server-wide budgets
// (global, search-shed), not this client's, so the gate doesn't steer by how much is left.
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
/** Shared schedule protocol; a legacy schedule without a version is version 1. */
export const MBN_VERSION = 1;
/** The Web Lock that serialises reading and writing it. */
export const MBN_LOCK = 'mbu-mb-gate';
/** The longest one throttle holds everyone. */
export const MBN_MAX_HOLD = 60000;
/** The longest one lead lasts without being renewed: a page that stops asking frees the queue. */
export const MBN_MAX_LEAD = 10000;
/** Gate events each tab keeps for String Theory's Gate log (mbnTrace). */
export const MBN_TRACE_MAX = 400;
/** Incs a merged read (mbnFetch) never adds to one without them: they need a login, or MusicBrainz
 *  answers them with fewer results or much more work. */
export const MBN_INC_ALONE = ['user-tags', 'user-genres', 'user-ratings', 'recordings', 'recording-level-rels', 'work-level-rels', 'release-group-level-rels', 'discids', 'isrcs'];

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
        if (s.version != null && s.version !== MBN_VERSION) throw new Error('Unsupported MusicBrainz gate version: ' + s.version);
        s.version = MBN_VERSION;
        // #938: no writer sets a hold past MBN_MAX_HOLD or a lead past MBN_MAX_LEAD, so a value
        // beyond them is broken (a bug, a clock that jumped): bring it back, for every tab after us
        const now = Date.now();
        if ((s.cool || 0) > now + MBN_MAX_HOLD) s.cool = now + MBN_MAX_HOLD;
        if ((s.scool || 0) > now + MBN_MAX_HOLD) s.scool = now + MBN_MAX_HOLD;
        if ((s.leadUntil || 0) > now + MBN_MAX_LEAD) s.leadUntil = now + MBN_MAX_LEAD;
        // nor a queue longer than a minute: slots that waits left behind (a closed tab) are dropped
        if ((s.tat || 0) > Math.max(now, s.cool || 0) + 60 * MBN_GAP) s.tat = Math.max(now, s.cool || 0) + 60 * MBN_GAP;
        if ((s.itat || 0) > Math.max(now, s.cool || 0) + 60 * MBN_GAP) s.itat = Math.max(now, s.cool || 0) + 60 * MBN_GAP;
        const out = fn(s);
        Object.assign(g, s);
        try { localStorage.setItem(MBN_KEY, JSON.stringify({ ...s, tat: s.tat || 0, cool: s.cool || 0, hot: s.hot || 0, lead: s.lead || '', leadUntil: s.leadUntil || 0 })); } catch (e) {}
        return out;
    };
    // The lock is held only for rw()'s synchronous moment, so a wait of seconds means it is
    // stuck (a frozen or sandboxed holder): give up on it and go unlocked rather than hang
    // every request behind it.
    let expired = false, settled = false;
    try {
        if (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) {
            const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
            const timeout = mbnSleep(3000, () => settled).then(() => {
                if (settled) return new Promise(() => {});   // the lock answered first
                expired = true;
                try { if (ctrl) ctrl.abort(); } catch (e) {}
                throw new Error('MusicBrainz gate lock timed out');
            });
            // Some userscript bridges never settle the request on abort. The timer
            // must release our wait itself; a late grant must not book twice.
            const locked = navigator.locks.request(MBN_LOCK, ctrl ? { signal: ctrl.signal } : {}, () => expired ? undefined : rw());
            return await Promise.race([locked, timeout]);
        }
    } catch (e) { /* no Web Locks here (an insecure or sandboxed context), or stuck: unlocked, like a lone script */ } finally { settled = true; }
    return rw();
}

/**
 * Sleep `ms`, or less once `cancelled()` turns true. #999: on a MusicBrainz page (Firefox,
 * Violentmonkey) plain timers were seen held back for minutes while the page went on, and every
 * gate wait hung with them: "waits 1.4s (pacing…)" and nothing more until a Stop. So the sleep
 * also wakes on a worker's timer (animation frames where no worker can start), and
 * checks the clock each time. Resolves with how long past `ms` it woke.
 * A timer found more than 2s overdue is noted in globalThis.__mbnWake1.stall (at most once a
 * minute) for a caller to log: { ms, state, hidden, told }.
 */
export function mbnSleep(ms, cancelled) {
    const end = Date.now() + Math.max(0, +ms || 0);
    const w = globalThis.__mbnWake1 || (globalThis.__mbnWake1 = { all: new Set(), due: new Map(), raf: 0, mo: null, worker: null, stall: null });
    const note = () => {   // a timer overdue by 2s: note it once a minute, for the log
        const now = Date.now();
        if (w.stall && now - w.stall.at < 60000) return;
        for (const d of w.due.values()) {
            if (now - d <= 2000) continue;
            let state = '', hidden = false;
            try { state = document.readyState; hidden = !!document.hidden; } catch (e) {}
            w.stall = { ms: now - d, at: now, state, hidden, told: false };
            return;
        }
    };
    const wake = () => { note(); for (const f of Array.from(w.all)) f(); };
    return new Promise(resolve => {
        let done = false;
        const tok = {};
        const me = () => {
            if (done) return;
            let stop = false;
            try { stop = !!(cancelled && cancelled()); } catch (e) {}
            const now = Date.now();
            if (!stop && now < end) return;
            done = true;
            w.all.delete(me);
            if (!w.all.size) {   // the last sleeper: the wakers rest
                try { if (w.raf) cancelAnimationFrame(w.raf); } catch (e) {}
                w.raf = 0;
                try { if (w.mo) w.mo.disconnect(); } catch (e) {}
                w.mo = null;
                try { if (w.worker && w.ticking) w.worker.postMessage(0); } catch (e) {}
                w.ticking = false;
            }
            resolve(Math.max(0, now - end));
        };
        // the plain timer, left to fire after another waker ended the sleep: when it fires late, it says so
        // with a cancel check it runs in 250ms slices, so a cancel lands where nothing else wakes it (no page)
        const tick = () => {
            if (Date.now() - (w.due.get(tok) || Infinity) > 2000) note();
            w.due.delete(tok);
            me();
            if (!done) arm();
        };
        const arm = () => {
            const d = Math.max(1, Math.min(cancelled ? 250 : 2147483647, end - Date.now()));
            if (w.due.size < 500) w.due.set(tok, Date.now() + d);
            setTimeout(tick, d);
        };
        me();
        if (done) return;
        w.all.add(me);
        arm();
        try {   // a worker's timers run apart from the page's; a page that forbids blob workers falls back to frames
            if (w.worker === null && typeof Worker === 'function' && typeof Blob === 'function' && typeof URL !== 'undefined' && URL.createObjectURL) {
                w.worker = false;
                const wk = new Worker(URL.createObjectURL(new Blob(['let t=0;onmessage=e=>{clearInterval(t);t=0;if(e.data>0)t=setInterval(()=>postMessage(1),e.data)}'], { type: 'text/javascript' })));
                wk.onmessage = () => { const x = globalThis.__mbnWake1; if (x) { x.wake && x.wake(); } };
                wk.onerror = () => { w.worker = false; };
                w.worker = wk;
            }
            w.wake = wake;
            if (w.worker && !w.ticking) { w.ticking = true; w.worker.postMessage(100); }
        } catch (e) { w.worker = false; }
        // no DOM watch: on a busy page (Mission Control's) every change ran the wake, and the lag was felt
        try {   // frames only without a worker: a frame loop runs the wake 60 times a second
            if (!w.worker && !w.raf && typeof requestAnimationFrame === 'function') {
                const frame = () => { w.raf = 0; wake(); if (w.all.size && !w.worker) w.raf = requestAnimationFrame(frame); };
                w.raf = requestAnimationFrame(frame);
            }
        } catch (e) {}
    });
}

/**
 * Note one gate event for String Theory's Gate log, to tell MusicBrainz's own load apart from
 * ours. Each tab keeps its last MBN_TRACE_MAX events under MBN_KEY + '-trace:' + its id (per tab,
 * so tabs never overwrite each other's); a tab's trace idle for an hour is dropped by the next.
 * `ev.e` is the kind: lead, book, cancel, start, answer, error, lead+, lead-, check.
 */
export function mbnTrace(ev) {
    try {
        const g = globalThis.__mbnTrace || (globalThis.__mbnTrace = { tab: '', swept: 0 });
        if (!g.tab) {
            try { g.tab = sessionStorage.getItem(MBN_KEY + '-tab') || ''; } catch (e) {}
            if (!g.tab) { g.tab = Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 5); try { sessionStorage.setItem(MBN_KEY + '-tab', g.tab); } catch (e) {} }
        }
        // the name is read per call, never kept in the shared object: in String Theory's bundle every
        // member runs its own copy of the gate with its own GM_info, but globalThis is the bundle's one
        let script = '';
        try { script = String(GM_info.script.name || ''); } catch (e) {}
        const pre = MBN_KEY + '-trace:', key = pre + g.tab, now = Date.now();
        let list = [];
        try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
        if (!Array.isArray(list)) list = [];
        list.push(Object.assign({ t: now, s: script }, ev));
        if (list.length > MBN_TRACE_MAX) list = list.slice(-MBN_TRACE_MAX);
        localStorage.setItem(key, JSON.stringify(list));
        if (now - g.swept > 60000) {   // once a minute: drop the traces of tabs gone quiet for an hour
            g.swept = now;
            // one pass over the names: in Firefox each localStorage.key(i) walks the store from its start
            for (const k of Object.keys(localStorage)) {
                if (k.indexOf(pre) !== 0 || k === key) continue;
                let last = 0;
                try { const l = JSON.parse(localStorage.getItem(k) || '[]'); last = (l[l.length - 1] || {}).t || 0; } catch (e) {}
                if (now - last > 3600000) localStorage.removeItem(k);
            }
        }
    } catch (e) { /* no storage: no trace */ }
}

/**
 * Wait for this request's start slot.
 *   o.background  queue behind the budget (default); false = interactive: its own line, ahead of
 *                 the background queue (a burst of MBN_BURST, then one a second), after any hold
 *   o.lead        the lead's token (mbnLead): this request is the leader's, and doesn't wait for it
 *   o.cancelled   () => true stops the wait (a superseded search, a Stop): resolves { ok: false }
 *   o.log         (level, message) for waits worth mentioning (over a second)
 *   o.label       what the request is, for the log
 *   o.search      a search (?query=): it also waits out a search-shed hold (mbnFetch sets it)
 * Resolves { ok: true, waited } when the request may start.
 */
export async function mbnSlot(o) {
    o = o || {};
    const t0 = Date.now(), background = o.background !== false;
    const tr = (e, x) => mbnTrace(Object.assign({ e, l: o.label || '', b: background ? 1 : 0 }, x));
    // someone else's lead: a background request books its slot only once it ends or lapses
    // #938: a cap counted from each new `now` moves with it and never caps; count it from when
    // this wait first saw the value, so a broken one holds at most the longest real one
    const seen = (v, cap) => { if (v !== seen[cap + 'v']) { seen[cap + 'v'] = v; seen[cap + 't'] = Date.now(); } return Math.min(v, seen[cap + 't'] + cap); };
    for (let told = false; background;) {
        let s = null;
        try { s = JSON.parse(localStorage.getItem(MBN_KEY) || 'null'); } catch (e) { s = globalThis.__mbnGate; }
        const left = s && s.lead && s.lead !== o.lead ? seen(s.leadUntil || 0, MBN_MAX_LEAD) - Date.now() : 0;
        if (left <= 0) break;
        if (o.cancelled && o.cancelled()) { tr('cancel', { w: Date.now() - t0 }); return { ok: false, waited: Date.now() - t0 }; }
        if (!told) tr('lead', { w: left, by: String(s.lead).slice(0, 12) });
        if (!told && o.log) { told = true; o.log('info', 'MusicBrainz gate: ' + (o.label || 'request') + ' waits for a page being drawn'); }
        told = true;
        await mbnSleep(Math.min(left, 250), o.cancelled);
    }
    // a hold that appears while we queue ends for every waiter at once: each waiter then books
    // again, so they leave one a second instead of all together into a fresh 503
    let booked = null, rebooked = false;
    const book = () => mbnState(s => {
        const now = Date.now(), cool = s.cool || 0, tat = s.tat || 0;
        // an interactive request (the page's own) never queues behind the background budget: it
        // has its own line (itat), a burst then one a second, so a page's handful of lookups don't
        // all leave at once into a 503 (and while MusicBrainz is throttling, no burst at all)
        let at;
        if (!background) {
            const itat = s.itat || 0, hot = s.hot && now <= cool + 30000;
            at = Math.max(now, rebooked ? itat : itat - (hot ? 0 : (MBN_BURST - 1) * MBN_GAP), cool);
            s.itat = Math.max(itat, at) + MBN_GAP;
        } else at = Math.max(rebooked ? Math.max(now, tat) : Math.max(now, tat - (MBN_BURST - 1) * MBN_GAP), cool);
        s.tat = Math.max(tat, at) + MBN_GAP;
        const why = cool > now && cool >= at ? 'MusicBrainz asked everyone to wait' : 'pacing, one request a second';
        if (at > now) tr('book', { w: at - now, why: cool > now && cool >= at ? 'hold' : 'pace', re: rebooked ? 1 : 0, q: Math.round(Math.max(0, (background ? s.tat : s.itat) - now) / MBN_GAP) });
        return { at, why };
    });
    booked = await book();
    // a cancelled wait hands its slot back when it is still the last one booked, so a page that
    // drops a queue of lookups (a Stop, a new page) does not leave every later request behind it
    const giveBack = () => mbnState(s => {
        if (booked.at <= Date.now()) return;
        if (s.tat === booked.at + MBN_GAP) s.tat -= MBN_GAP;
        if (!background && s.itat === booked.at + MBN_GAP) s.itat -= MBN_GAP;
    });
    // #999: the wait logs again whenever its end moves later (a hold another tab or script set
    // while we queued) and every 10s it goes on, so a long wait is never silent
    let toldUntil = 0, toldAt = 0;
    for (;;) {
        if (o.cancelled && o.cancelled()) { await giveBack(); tr('cancel', { w: Date.now() - t0 }); return { ok: false, waited: Date.now() - t0 }; }
        let cool = 0, scool = 0;
        try { const g = JSON.parse(localStorage.getItem(MBN_KEY) || 'null') || {}; cool = g.cool || 0; scool = g.scool || 0; } catch (e) { const g = globalThis.__mbnGate || {}; cool = g.cool || 0; scool = g.scool || 0; }
        // a search also waits out the hold MusicBrainz set for searches
        const shed = !!o.search && scool > cool;
        if (o.search) cool = Math.max(cool, scool);
        const now = Date.now();
        cool = seen(cool, MBN_MAX_HOLD);   // a hold is never longer than the longest one the gate sets
        const until = Math.max(booked.at, cool), left = until - now;   // a hold that appeared while we queued
        if (left <= 0) {
            if (cool > booked.at && !rebooked) { rebooked = true; booked = await book(); continue; }
            break;
        }
        if (o.log && until - t0 > 1000 && (!toldAt || until > toldUntil + 1000 || now - toldAt >= 10000)) {
            const why = cool > booked.at ? (shed ? 'MusicBrainz asked searches to wait' : 'MusicBrainz asked everyone to wait') : booked.why;
            o.log('info', 'MusicBrainz gate: ' + (o.label || 'request') + (toldAt ? ' still waits, ' + Math.round(left / 100) / 10 + 's to go' : ' waits ' + Math.round((until - t0) / 100) / 10 + 's') + ' (' + why + ')');
            toldUntil = until; toldAt = now;
        }
        await mbnSleep(Math.min(left, 250), o.cancelled);   // in slices, so a cancel lands promptly
        const st = globalThis.__mbnWake1 && globalThis.__mbnWake1.stall;
        if (st && !st.told && o.log) {
            st.told = true;
            o.log('info', 'MusicBrainz gate: this page\'s timer fired ' + Math.round(st.ms / 100) / 10 + 's late (page ' + (st.state || '?') + (st.hidden ? ', hidden' : '') + '); waits wake on page activity too');
        }
    }
    tr('start', { w: Date.now() - t0 });
    return { ok: true, waited: Date.now() - t0 };
}

/**
 * Take the lead (#847), or renew it, for `ms` (at most MBN_MAX_LEAD); `ms` 0 ends it, if it's
 * still this token's. While it holds, background requests not passing o.lead = token wait.
 */
export async function mbnLead(token, ms) {
    return mbnState(s => {
        if (ms > 0) {
            if (s.lead !== token || (s.leadUntil || 0) < Date.now()) mbnTrace({ e: 'lead+', by: String(token).slice(0, 12), w: Math.min(ms, MBN_MAX_LEAD) });
            s.lead = token; s.leadUntil = Date.now() + Math.min(ms, MBN_MAX_LEAD);
        } else if (s.lead === token) { s.lead = ''; s.leadUntil = 0; mbnTrace({ e: 'lead-', by: String(token).slice(0, 12) }); }
    });
}

/**
 * Tell the gate how MusicBrainz answered. `header(name)` returns a response header or null.
 * A 429/503 holds every caller on the origin; a clean answer earns some room back.
 * A 503 with X-RateLimit-Who: search-shed holds only searches (o.search marks one).
 * Resolves { throttled, hold } — hold is how long everyone now waits, in ms.
 */
export async function mbnAnswer(status, header, o) {
    o = o || {};
    // for the Gate log: MusicBrainz's own rate-limit headers, which say whose budget ran out
    const rl = {};
    for (const [k, n] of [['lim', 'X-RateLimit-Limit'], ['rem', 'X-RateLimit-Remaining'], ['rst', 'X-RateLimit-Reset'], ['who', 'X-RateLimit-Who']]) {
        try { const v = header ? header(n) : null; if (v != null && v !== '') rl[k] = String(v).slice(0, 40); } catch (e) {}
    }
    const tr = (x, s) => mbnTrace(Object.assign({ e: 'answer', st: status, l: o.label || '', b: o.background === false ? 0 : 1, hot: s ? s.hot || 0 : undefined }, rl, x));
    if (status === 429 || status === 503) {
        const raw = header ? header('Retry-After') : null;
        const secs = Number(raw), date = raw ? Date.parse(raw) : NaN;
        const ra = Number.isFinite(secs) ? secs * 1000 : Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
        // MusicBrainz shed searches, not this client: only searches wait, and the shared hot is untouched
        if (status === 503 && /^search-shed$/i.test(String(rl.who || '').trim())) {
            const hold = await mbnState(s => {
                const now = Date.now();
                if (now > (s.scool || 0) + 30000) s.shot = 0;
                if (now >= (s.scool || 0)) s.shot = Math.min((s.shot || 0) + 1, 6);
                const ms = Math.min(Math.max(1000, ra) * Math.max(1, s.shot), MBN_MAX_HOLD);
                s.scool = Math.max(s.scool || 0, now + ms);
                tr({ ra: raw == null ? undefined : String(raw).slice(0, 40), shold: s.scool - now, shot: s.shot }, s);
                return s.scool - now;
            });
            if (o.log) o.log('warn', 'MusicBrainz gate: HTTP 503 (search-shed) — searches hold ' + Math.round(hold / 100) / 10 + 's');
            return { throttled: true, hold };
        }
        const hold = await mbnState(s => {
            const now = Date.now();
            // One throttle, one step: the requests already in flight when it began all answer
            // 503 too, and each must not stretch the hold again. A throttle long gone doesn't
            // count at all: `hot` is shared and persists, and would otherwise slow every later
            // page for good.
            if (now > (s.cool || 0) + 30000) s.hot = 0;
            if (now >= (s.cool || 0)) s.hot = Math.min((s.hot || 0) + 1, 6);
            // the hold grows with each throttle in a row, a Retry-After included, so a long busy
            // spell gets fewer and fewer requests from us
            const ms = Math.min(Math.max(1000, ra) * Math.max(1, s.hot), MBN_MAX_HOLD);
            s.cool = Math.max(s.cool || 0, Date.now() + ms);
            tr({ ra: raw == null ? undefined : String(raw).slice(0, 40), hold: s.cool - Date.now() }, s);
            return s.cool - Date.now();
        });
        if (o.log) o.log('warn', 'MusicBrainz gate: HTTP ' + status + (raw != null ? ' (Retry-After: ' + raw + ')' : '') + ' — every script holds ' + Math.round(hold / 100) / 10 + 's');
        return { throttled: true, hold };
    }
    if (status >= 200 && status < 500) await mbnState(s => {
        if (s.hot) s.hot = Date.now() > (s.cool || 0) + 30000 ? 0 : s.hot - 1;
        if (o.search && s.shot) s.shot = Date.now() > (s.scool || 0) + 30000 ? 0 : s.shot - 1;
        tr({}, s);
    });
    else tr({});
    return { throttled: false, hold: 0 };
}

/**
 * fetch() through the gate: waits for a slot, reports the answer, retries a 429/503
 * (the retry waits out the shared hold, so it needs no sleep of its own).
 * Other requests aren't paced; one to MusicBrainz's website side (/ws/js, pages, forms) that
 * gets the browser check instead passes it once and is retried (#733, mbnReverify below).
 * Resolves the Response, or null when cancelled.
 *   o.tries   attempts on 429/503 (default 4; an interactive request, o.background false, keeps
 *             trying for 45s instead, so a page isn't lost to a short throttle); the last answer
 *             is returned as it is
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
    const t0 = Date.now(), give = attempt => o.tries ? attempt >= o.tries : o.background === false ? Date.now() - t0 > 45000 : attempt >= 4;
    if (!o.label) {   // the Gate log names a request by what it asks for
        let p = String(url);
        try { const u = new URL(p, location.href); p = u.pathname.replace(/^\/ws\/2\//, '') + u.search.replace(/[?&]fmt=json\b/, '').replace(/^&/, '?'); } catch (e) {}
        o = Object.assign({}, o, { label: p.slice(0, 120) });
    }
    if (o.search === undefined) {   // a search (?query=) waits out a search-shed hold, nothing else does
        let q = false;
        try { q = new URL(String(url), location.href).searchParams.has('query'); } catch (e) {}
        o = Object.assign({}, o, { search: q });
    }
    // `at` gives the URL at the moment the request leaves: a queued read's inc list can still grow
    const go = async at => {
        for (let attempt = 1; ; attempt++) {
            const slot = await mbnSlot(o);
            if (!slot.ok) return null;
            let r;
            try { r = await mbnWsFetch(at ? at() : url, init); }
            catch (e) { mbnTrace({ e: 'error', l: o.label, b: o.background === false ? 0 : 1, err: String((e && (e.name === 'AbortError' ? 'aborted' : e.message)) || e).slice(0, 80) }); throw e; }
            const a = await mbnAnswer(r.status, n => r.headers.get(n), o);
            if (!a.throttled || give(attempt)) return r;
        }
    };
    // Reads of the same thing share one fetch, and each caller gets its own clone of the answer.
    // Two members of String Theory's bundle, or one page drawn twice, otherwise send it twice.
    //   join   a read whose inc list the running or queued one already covers waits for its answer
    //   merge  a read that differs only in inc joins one still queued: that one then leaves
    //          asking for both inc lists (one page's scripts all ask for its entity at load)
    // A write (POST, a body) always goes on its own. MBN_INC_ALONE incs change what an answer
    // costs or needs (a login, a smaller page), so they are never added to a read that lacks them.
    const m = String((init && init.method) || 'GET').toUpperCase();
    let key = '', want = null, base = null;
    if ((m === 'GET' || m === 'HEAD') && !(init && init.body)) {
        try {
            base = new URL(String(url), location.href);
            // with fmt=json, an Accept: application/json header changes nothing: one script sends it, another doesn't
            const h = init && init.headers, json = base.searchParams.get('fmt') === 'json';
            const he = h ? (typeof h.entries === 'function' ? Array.from(h.entries()) : Array.isArray(h) ? h : Object.entries(h)).filter(([k, v]) => !(json && /^accept$/i.test(k) && /^application\/json$/i.test(String(v).trim()))) : [];
            const hs = he.length ? JSON.stringify(he) : '';
            want = new Set((base.searchParams.get('inc') || '').split(/[\s+]+/).filter(Boolean));
            const rest = Array.from(base.searchParams.entries()).filter(([k]) => k !== 'inc').sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1);
            key = m + ' ' + base.origin + base.pathname + '?' + new URLSearchParams(rest) + ' ' + hs;
        } catch (e) { key = ''; }
    }
    if (!key) return go();
    const live = globalThis.__mbnLive || (globalThis.__mbnLive = new Map());
    const sig = init && init.signal;
    const mine = () => !(o.cancelled && o.cancelled()) && !(sig && sig.aborted);
    const covers = run => { for (const i of want) if (!run.inc.has(i)) return false; return true; };
    // a background read may share a page's read; a page's read shares a background one only once it is sent
    const bg = o.background !== false, ahead = run => run.sent || !run.bg || bg;
    const fits = run => { for (const i of MBN_INC_ALONE) if (run.inc.has(i) !== want.has(i)) return false; return true; };
    for (;;) {
        const runs = live.get(key) || [];
        let run = runs.find(x => covers(x) && fits(x) && ahead(x)), how = 'join';
        if (!run) { run = runs.find(x => !x.sent && fits(x) && ahead(x)); how = 'merge'; }
        if (!run) break;
        const add = how === 'merge' ? Array.from(want).filter(i => !run.inc.has(i)) : [];
        for (const i of add) run.inc.add(i);
        mbnTrace({ e: how, l: o.label, b: o.background === false ? 0 : 1, with: run.label, add: add.join(' ') || undefined });
        const p = run.p;
        // this caller's own Stop or abort still ends its wait, whatever the first caller does
        const stop = new Promise(res => {
            if (sig) sig.addEventListener('abort', () => res('stop'), { once: true });
            if (o.cancelled) { const t = setInterval(() => { if (o.cancelled()) { clearInterval(t); res('stop'); } }, 250); p.then(() => clearInterval(t), () => clearInterval(t)); }
        });
        let r;
        try { r = await Promise.race([p, stop]); } catch (e) { if (!mine()) throw e; r = null; }
        if (r === 'stop') {
            if (sig && sig.aborted) throw (sig.reason instanceof Error ? sig.reason : new DOMException('The operation was aborted.', 'AbortError'));
            return null;
        }
        // a wider read MusicBrainz refused (a 400 for an inc it won't take here) might not refuse
        // this one's own: it asks alone
        if (r && !r.ok && r.status !== 404 && run.inc.size !== want.size) return go();
        if (r) return r.clone();
        if (!mine()) return null;
        // the first caller was cancelled or aborted, this one wasn't: it asks for itself
    }
    const run = { inc: new Set(want), sent: false, bg, label: o.label, p: null };
    run.p = go(() => {
        run.sent = true;
        if (run.inc.size === want.size) return url;   // nothing merged: as asked
        const u = new URL(base.href);
        u.searchParams.set('inc', Array.from(run.inc).join(' '));
        return u.href;
    });
    const runs = live.get(key) || [];
    runs.push(run);
    live.set(key, runs);
    try {
        const r = await run.p;
        if (r && !r.ok && r.status !== 404 && run.inc.size !== want.size) return go();   // as for a joiner, above
        return r ? r.clone() : r;
    } finally {
        const l = live.get(key) || [], i = l.indexOf(run);
        if (i >= 0) l.splice(i, 1);
        if (!l.length) live.delete(key);
    }
}

/** How throttled MusicBrainz is right now (0: not at all), for a caller that narrows its own
 *  concurrency while it is — Apollo probes with a single request until a clean answer (#575). */
export function mbnHot() {
    let s;
    try { s = JSON.parse(localStorage.getItem(MBN_KEY) || 'null') || {}; } catch (e) { s = globalThis.__mbnGate || {}; }
    return Date.now() > (s.cool || 0) + 30000 ? 0 : (s.hot || 0);   // a throttle long gone is over
}

/** The User-Agent MusicBrainz asks API clients for (#932): the running script's name and version. */
export function mbnUA() {
    let n = 'mb-userscripts', v = '';
    try { const i = GM_info.script; n = String(i.name || n).replace(/\s+/g, ''); v = i.version || ''; } catch (e) {}
    return n + (v ? '/' + v : '') + ' ( https://github.com/majkinetor/musicbrainz-userscripts )';
}

/**
 * fetch() for /ws/2 that MusicBrainz can tell apart (#932): a page fetch() carries the browser's
 * User-Agent (Chrome ignores a User-Agent header there), so where the script may use
 * GM_xmlhttpRequest the request goes through it with mbnUA(). Takes fetch's (url, init) —
 * method, headers, body, signal — and resolves a Response; rejects like fetch on a network
 * error or an abort. Without GM, or for a credentialed same-origin request (#997), it is plain
 * fetch(). Paces nothing: take mbnSlot first.
 */
export function mbnWsFetch(url, init) {
    init = init || {};
    const gm = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest
        : (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function' ? GM.xmlHttpRequest : null);
    const abs = new URL(String(url), typeof location !== 'undefined' ? location.href : 'https://musicbrainz.org/').href;
    // #997: a request that asks for the login (credentials 'include' / 'same-origin') on this
    // page's own origin goes through the page's fetch(): a manager's GM request carries the
    // cookie only if the browser lets the extension send it (Safari's tracking prevention does
    // not), and MusicBrainz then answers 401. The User-Agent is the browser's then.
    const own = typeof location !== 'undefined' && (() => { try { return new URL(abs).origin === location.origin; } catch (e) { return false; } })();
    if (!gm || (own && (init.credentials === 'include' || init.credentials === 'same-origin'))) return fetch(url, init);
    const headers = {};
    try { new Headers(init.headers || {}).forEach((v, k) => { headers[k] = v; }); } catch (e) {}
    headers['User-Agent'] = mbnUA();
    return new Promise((resolve, reject) => {
        const sig = init.signal;
        if (sig && sig.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
        let req = null, done = false;
        const onAbort = () => { if (done) return; done = true; try { req && req.abort && req.abort(); } catch (e) {} reject(new DOMException('Aborted', 'AbortError')); };
        const fail = m => () => { if (done) return; done = true; if (sig) sig.removeEventListener('abort', onAbort); reject(new TypeError(m)); };
        // A request the manager never answers, not even with its own timeout (seen in
        // Violentmonkey on Firefox): give up on it here, or whoever awaits it, a matching
        // pass that was told to stop included, waits forever. MusicBrainz answers a search in
        // seconds even on a slow day; one that took a minute held every lane behind it while
        // the shared throttle allowed a single one, so the gate stops waiting after half that.
        // #999 mbnSleep, not a plain timer: with this page's timers held back, a stuck request was never given up on
        mbnSleep(35000, () => done).then(() => { if (done) return; fail('no answer in 35s')(); try { req && req.abort && req.abort(); } catch (e) {} });
        if (sig) sig.addEventListener('abort', onAbort);
        const res = gm({
            method: String(init.method || 'GET').toUpperCase(), url: abs, headers, data: init.body,
            timeout: 30000,
            onload: x => {
                if (done) return; done = true; if (sig) sig.removeEventListener('abort', onAbort);
                const h = new Headers();
                for (const line of String(x.responseHeaders || '').split(/\r?\n/)) { const i = line.indexOf(':'); if (i > 0) try { h.append(line.slice(0, i).trim(), line.slice(i + 1).trim()); } catch (e) {} }
                const st = x.status || 0;
                if (st < 200 || st > 599) { reject(new TypeError('network error (status ' + st + ')')); return; }
                const r = new Response(st === 204 || st === 304 ? null : (x.responseText != null ? x.responseText : ''), { status: st, statusText: x.statusText || '', headers: h });
                try { Object.defineProperty(r, 'url', { value: x.finalUrl || abs }); } catch (e) {}
                resolve(r);
            },
            onerror: fail('network error'), ontimeout: fail('timed out'), onabort: fail('aborted'),
        });
        req = res && typeof res.then === 'function' ? null : res;   // GM.xmlHttpRequest returns a promise in some managers
    });
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
        let loads = 0, done = false;
        const finish = ok => {
            if (done) return; done = true; fr.remove(); g.busy = null;
            mbnTrace({ e: 'check', ok: ok ? 1 : 0, w: Date.now() - t0 });
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
        mbnSleep(20000, () => done).then(() => finish(false));   // #999 wakes even with this page's timers held back
        fr.src = src;
        (document.body || document.documentElement).appendChild(fr);
    });
    return g.busy;
}

/** What sync-gate.mjs inlines, in order. */
export const MBN_INLINE = {
    consts: { MBN_GAP, MBN_BURST, MBN_KEY, MBN_VERSION, MBN_LOCK, MBN_MAX_HOLD, MBN_MAX_LEAD, MBN_TRACE_MAX, MBN_INC_ALONE },
    fns: [mbnGated, mbnState, mbnSleep, mbnTrace, mbnSlot, mbnLead, mbnAnswer, mbnFetch, mbnHot, mbnUA, mbnWsFetch, mbnRawHeader, mbnWebsite, mbnIsCheck, mbnReverify],
};
