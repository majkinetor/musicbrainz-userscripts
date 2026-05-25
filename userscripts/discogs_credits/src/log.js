// Userscript-side logger. Renders one `<li>` per call into the `<ul>` the
// UI bar creates, and pipes a plain-text summary into the progress ticker.
//
// The log container is set lazily via `setLogContainer(el)` because the
// `<ul>` is constructed inside the UI bar's insertion routine. Until then,
// `addLogLine` is a silent no-op rather than throwing (pre-UI-bar callers
// would crash today; they shouldn't, but if any slip through they now fail
// quietly rather than blowing up the whole import).

let _logs = null;

/** Wire the logger to its <ul> container. Called by ui-bar.js at insertion time. */
export function setLogContainer(el) {
    _logs = el;
}

/** Current log container — read-only access for callers that need it (rare). */
export function getLogContainer() {
    return _logs;
}

/**
 * Append a log line. `message` is interpreted as HTML (legacy — many callers
 * embed `<span style="color:...">` for severity colouring). Prepended with
 * a muted-monospace `HH:MM:SS` timestamp.
 *
 * Also pipes a plain-text version of the message into the progress ticker
 * span (`.discogs-bar`'s `_setProgress`) so the UI bar status line shows
 * the most-recent log content.
 */
export function addLogLine(message) {
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
    li.innerHTML = `<span style="color:#999;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:0.82em;">${stamp}</span> ${message}`;
    _logs.insertAdjacentElement('beforeend', li);
    // Feed progress ticker (strip HTML tags for plain-text display)
    const bar = document.querySelector('.discogs-bar');
    if (bar?._setProgress) {
        bar._setProgress(null, message.replace(/<[^>]*>/g, '').trim().substring(0, 120));
    }
}
