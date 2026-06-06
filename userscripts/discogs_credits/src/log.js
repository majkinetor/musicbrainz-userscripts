// Userscript-side logger. Renders one `<li>` per call into the `<ul>` the
// UI bar creates, and pipes a plain-text summary into the progress ticker.
//
// Public API:
//
//   log.info(msg)   plain line
//   log.warn(msg)   orange "WARN <msg>"
//   log.error(msg)  red "ERR <msg>"
//
// Callers pass plain text; the logger handles colouring and severity
// prefixing. Severity is at the call site, not encoded into the message
// string — `log.warn('Attribute "co" not found')` instead of
// `addLogLine('<span style="color:orange">WARN Attribute "co" not found</span>')`.
//
// Module init order: the log container (a `<ul>`) is created inside the
// UI bar's mount routine, so calls made before `setLogContainer(el)` is
// invoked silently no-op (pre-UI-bar callers would otherwise crash here).

let _logs = null;

/** Wire the logger to its <ul> container. Called by ui-bar.js at insertion time. */
export function setLogContainer(el) {
    _logs = el;
}

/** Current log container — read-only access for callers that need it (rare). */
export function getLogContainer() {
    return _logs;
}

// The review-table panel mounts here instead of inside the (collapsible) log,
// so collapsing the log never hides the review UI (#142). Falls back to the log
// container when unset.
let _review = null;
export function setReviewContainer(el) { _review = el; }
export function getReviewContainer() { return _review || _logs; }

function _emit(html, plainText) {
    if (!_logs) return;
    const li = document.createElement('li');
    // HH:MM:SS prefix so per-step timings are visible. Styled muted/monospace so
    // it doesn't fight with the actual content for attention.
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    // Real space character after the timestamp span — `margin-right` on the span
    // renders fine in the browser but disappears when log content is copied as
    // text (CSS spacing isn't part of textContent).
    li.innerHTML = `<span style="color:#999;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:0.82em;">${stamp}</span> ${html}`;
    _logs.insertAdjacentElement('beforeend', li);
    // Feed progress ticker (strip HTML tags for plain-text display)
    const bar = document.querySelector('.discogs-bar');
    if (bar?._setProgress) {
        bar._setProgress(null, plainText.replace(/<[^>]*>/g, '').trim().substring(0, 120));
    }
}

/**
 * Severity-aware logger. Each method appends one styled `<li>` to the
 * shared log container plus pipes a plain-text summary into the
 * progress ticker.
 *
 *   - `log.info(msg)`   plain (no prefix, no colour).
 *   - `log.warn(msg)`   orange `WARN ${msg}`.
 *   - `log.error(msg)`  red `ERR ${msg}`.
 *
 * `msg` may contain inline HTML (callers sometimes embed `<a>` links or
 * `<strong>`) — only the severity prefix and colour wrapper are added
 * by the logger.
 */
export const log = {
    info:  msg => _emit(msg, msg),
    warn:  msg => _emit(`<span style="color:orange">WARN ${msg}</span>`, `WARN ${msg}`),
    error: msg => _emit(`<span style="color:red">ERR ${msg}</span>`,     `ERR ${msg}`),
};

// ── Debug log (issue #87) ───────────────────────────────────────────────────
// Diagnostic per-worker / per-request log used by `mbThrottle` and
// `preflight` to surface "why is this slow?" data WITHOUT hijacking
// the main log. Rendered into a lazy-created `<details>` block titled
// "Preflight diagnostics" appended to the same `<ul>` container the
// main log uses, but inside a single `<li>` so it stays out of the
// way unless the user expands it.
//
// Output shape: one `<div>` per line, monospace, muted color,
// timestamped relative to the first `logDebug` call this session so
// you can read "this worker waited 230ms before its first request"
// at a glance.

let _debugUl     = null;
let _debugStartT = null;

function _ensureDebugUl() {
    if (_debugUl) return _debugUl;
    if (!_logs) return null;
    const details = document.createElement('details');
    details.style.cssText = 'margin:0.3rem 0;';
    const summary = document.createElement('summary');
    summary.textContent = 'Preflight diagnostics';
    summary.style.cssText = 'cursor:pointer;font-size:0.8rem;color:#888;user-select:none;';
    details.appendChild(summary);
    const ul = document.createElement('ul');
    ul.style.cssText = 'list-style:none;margin:0.3rem 0;padding:0.4rem 0.6rem;'
                     + 'background:#f7f7f7;border-radius:0.25rem;'
                     + 'font-family:ui-monospace,Menlo,Consolas,monospace;font-size:0.72rem;'
                     + 'color:#444;max-height:24rem;overflow-y:auto;';
    details.appendChild(ul);
    const li = document.createElement('li');
    li.style.listStyle = 'none';
    li.appendChild(details);
    _logs.appendChild(li);
    _debugUl     = ul;
    _debugStartT = performance.now();
    return _debugUl;
}

/**
 * Append one diagnostic line to the collapsed "Preflight diagnostics"
 * section. Safe to call before the log container exists — silent no-op.
 *
 * Lines are timestamped relative to the first `logDebug` call:
 *
 *   [+0ms]    worker#0 starting
 *   [+1ms]    req#1 GET https://musicbrainz.org/ws/2/artist?query=…
 *   [+312ms]  req#1 ← 200 OK in 311ms
 *   [+312ms]  worker#0 resolved "Jamie Saft" via name in 312ms
 *
 * Use for high-volume / noisy info — the user has to opt in by
 * expanding the `<details>`, so we can be verbose without drowning
 * the main log.
 */
export function logDebug(line) {
    const ul = _ensureDebugUl();
    if (!ul) return;
    const t = Math.round(performance.now() - _debugStartT);
    const row = document.createElement('div');
    row.textContent = `[+${t}ms] ${line}`;
    ul.appendChild(row);
}

