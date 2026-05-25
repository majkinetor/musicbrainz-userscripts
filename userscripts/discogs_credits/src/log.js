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

/**
 * @deprecated  Use `log.info` / `log.warn` / `log.error` instead.
 *
 * Old API where severity was encoded into the message string as inline
 * HTML (`<span style="color:orange">WARN ...</span>`). New callers
 * should use the severity-aware methods; existing callers will be
 * migrated incrementally and this re-export removed afterwards.
 */
export function addLogLine(message) {
    _emit(message, message);
}
