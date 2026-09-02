// Shared UI components for every userscript in this repo. #563
//
// THIS FILE IS THE SINGLE PLACE THE STANDARD WIDGETS ARE DEFINED. Change one
// here, run `node dev/sync-ui.mjs` (the pre-commit hook does it for you), and
// every script carrying a `// <ST-UI>` marker picks it up.
//
// Companion to dev/design-tokens.mjs (#562): tokens say what things look like,
// this says what they ARE. Every colour below is a var(--mbu-*), so a script
// adopting a component inherits the token set automatically.
//
// Rules:
//
//  · ONE CLASS PREFIX — `mbu-`. A userstyle (or #564's theme switch) targets a
//    component once instead of once per script.
//  · INTERACTION IS PART OF THE CONTRACT, not just appearance. A component's
//    keyboard and mouse behaviour is defined here too, because "looks the same
//    but Esc doesn't work" is the drift this issue is about.
//  · The generated block uses string concatenation and no template literals, so
//    it can be inlined into any script regardless of how that script quotes.
//  · A component must degrade rather than throw when a script hasn't wired its
//    optional hooks (e.g. a toast with no log sink still shows).

// ── CSS ─────────────────────────────────────────────────────────────────────
// Single-quoted at generation time, so: no single quotes, no newlines.
const CSS = [
    // Help link — `? Help` opening the script's README in a new tab. Apollo and
    // Fusion already agreed on this shape; Art Station said "Help ↗" and Mammoth
    // carried no class at all. Apollo/Fusion win on numbers.
    '.mbu-help{font-size:12px;color:var(--mbu-accent);text-decoration:none;border:1px solid var(--mbu-border);',
    'border-radius:var(--mbu-radius);padding:2px 8px;white-space:nowrap;line-height:1.6;background:var(--mbu-bg)}',
    '.mbu-help:hover{background:var(--mbu-bg-hover);border-color:var(--mbu-accent);text-decoration:none}',
    // config headers are flex rows: the help link is the last thing on the line
    'h4>.mbu-help,.mbu-cfg-h>.mbu-help{margin-left:8px;flex:0 0 auto;font-weight:normal}',

    // Toast — one reused element, bottom-centre, fading. Duration and severity
    // are the contract; `at` moves it next to a click (Mammoth needs that for
    // its field-memory pin, and it was the only script doing it).
    '#mbu-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:var(--mbu-z-pop);',
    'background:var(--mbu-accent-deep);color:var(--mbu-text-on-accent);padding:10px 16px;border-radius:9px;',
    'font:13px/1.35 var(--mbu-font);box-shadow:var(--mbu-shadow-lg);opacity:0;transition:opacity .2s;',
    'pointer-events:none;max-width:80vw;text-align:center;white-space:pre-wrap}',
    '#mbu-toast.mbu-toast-on{opacity:1}',
    '#mbu-toast.mbu-toast-ok{background:var(--mbu-ok)}',
    '#mbu-toast.mbu-toast-warn{background:var(--mbu-warn)}',
    '#mbu-toast.mbu-toast-error{background:var(--mbu-error)}',

    // Config-window title bar — icon · name · version · [spacer] · Log · ? Help.
    // #563: those five live HERE and only here, never in a script main header.
    // Apollo's settings <h4> is the reference; the others were the same idea
    // spelled seven ways (an <h4>, an <h3>, two plain divs, and one inline-styled
    // block with an orange <h2> and no icon at all).
    '.mbu-cfg-h{display:flex;align-items:center;gap:8px;margin:0 0 10px;padding:0 0 9px;',
    'border-bottom:1px solid var(--mbu-border-soft);font:600 15px/1.3 var(--mbu-font);color:var(--mbu-text)}',
    '.mbu-cfg-ic{flex:0 0 auto;display:inline-flex;align-items:center;width:22px;height:22px}',
    '.mbu-cfg-ic img,.mbu-cfg-ic svg{width:22px;height:22px;object-fit:contain;display:block}',
    '.mbu-cfg-name{flex:0 0 auto;font-weight:700;color:var(--mbu-accent)}',
    // the version is deliberately quiet — it is reference information, not a heading
    '.mbu-cfg-ver{flex:0 0 auto;font:400 11px var(--mbu-font);color:var(--mbu-text-weak);white-space:nowrap}',
    '.mbu-cfg-sp{flex:1 1 auto;min-width:8px}',
    '.mbu-cfg-log{flex:0 0 auto;font:400 12px var(--mbu-font);color:var(--mbu-accent);cursor:pointer;',
    'background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);padding:2px 8px;line-height:1.6}',
    '.mbu-cfg-log:hover{background:var(--mbu-bg-hover);border-color:var(--mbu-accent)}',

    // Activity log — floating, draggable by its header, minimisable, with a
    // Copy that yields the Markdown <details> block for an issue. Art Station is
    // the reference the issue names; Apollo and Fusion had already grown the
    // identical structure under their own prefixes (tc-, as-, fs-), which is the
    // clearest possible argument for naming it once.
    '#mbu-logpop{position:fixed;top:74px;left:50%;transform:translateX(-50%);z-index:var(--mbu-z-modal);',
    'display:flex;flex-direction:column;width:min(720px,94vw);max-height:72vh;background:var(--mbu-bg);',
    'border:1px solid var(--mbu-border);border-radius:11px;box-shadow:var(--mbu-shadow-lg);',
    'font:13px var(--mbu-font);color:var(--mbu-text);overflow:hidden}',
    '.mbu-logpop-h{display:flex;align-items:center;gap:8px;padding:10px 13px;',
    'border-bottom:1px solid var(--mbu-border-soft);color:var(--mbu-accent-hover);cursor:move;user-select:none}',
    '.mbu-logpop-sp{margin-left:auto}',
    '.mbu-logpop-copy,.mbu-logpop-x,.mbu-logpop-min{font-size:12px;color:var(--mbu-accent);',
    'background:var(--mbu-bg-hover);border:1px solid var(--mbu-border);border-radius:5px;',
    'padding:2px 9px;cursor:pointer;font-family:inherit}',
    '.mbu-logpop-copy:hover,.mbu-logpop-x:hover,.mbu-logpop-min:hover{background:var(--mbu-accent-soft)}',
    // minimised: just the header bar, so it can sit out of the way mid-run
    '#mbu-logpop.min .mbu-log-list,#mbu-logpop.min .mbu-logpop-copy,#mbu-logpop.min .mbu-logpop-x{display:none}',
    '#mbu-logpop.min{max-height:none;width:auto}',
    '#mbu-logpop.min .mbu-logpop-sp{display:none}',
    '.mbu-log-badge{color:var(--mbu-border-strong);font-size:11px}',
    '.mbu-log-list{flex:1 1 auto;overflow:auto;overscroll-behavior:contain;padding:9px 13px;',
    'display:flex;flex-direction:column;gap:3px}',
    '.mbu-log-li{display:flex;gap:9px;white-space:pre-wrap;word-break:break-word}',
    '.mbu-log-t{color:var(--mbu-text-weak);flex:0 0 auto;font-variant-numeric:tabular-nums}',
    '.mbu-log-m{flex:1 1 auto;color:var(--mbu-text-dim)}',
    '#mbu-logpop .mbu-log-m a{color:var(--mbu-accent)}',
    // severity, on the message only — the timestamp stays quiet
    '.mbu-log-ok .mbu-log-m{color:var(--mbu-ok)}',
    '.mbu-log-warn .mbu-log-m{color:var(--mbu-warn)}',
    '.mbu-log-error .mbu-log-m{color:var(--mbu-error)}',
    '.mbu-log-debug{opacity:.72}',
    '.mbu-log-debug .mbu-log-m{color:var(--mbu-text-weak)}',
    '.mbu-log-empty{color:var(--mbu-text-weak)}',

    // Modal overlay — one backdrop, one stacking level. There were four:
    // rgba(0,0,0,.42) at z 999998, rgba(20,24,30,.44) at 2147483646,
    // rgba(15,12,28,.55) at 9998 and rgba(0,0,0,.35) at 2147483000. None of
    // those differences meant anything; they just happened at different times.
    '.mbu-ov{position:fixed;inset:0;z-index:var(--mbu-z-modal);background:rgba(15,12,28,.45);',
    'display:flex;align-items:center;justify-content:center;padding:24px}',
    '.mbu-ov-panel{background:var(--mbu-bg);color:var(--mbu-text);border-radius:var(--mbu-radius-lg);',
    'box-shadow:var(--mbu-shadow-lg);max-width:94vw;max-height:88vh;display:flex;flex-direction:column;overflow:hidden}',
    // the title row flexes so the close button pins right without a spacer div
    '.mbu-ov-h{display:flex;align-items:center;gap:10px;padding:12px 16px;',
    'border-bottom:1px solid var(--mbu-border-soft);font-weight:700}',
    '.mbu-ov-h .mbu-ov-title{flex:1 1 auto;min-width:0}',
    // #419: a dismiss control gets a real hit area, never a bare glyph
    '.mbu-ov-x{flex:0 0 auto;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;',
    'font-size:15px;line-height:1;cursor:pointer;color:var(--mbu-text-dim);background:none;border:none;border-radius:var(--mbu-radius)}',
    '.mbu-ov-x:hover{background:var(--mbu-bg-hover);color:var(--mbu-text)}',
    '.mbu-ov-body{flex:1 1 auto;overflow:auto;padding:14px 16px}',

    // Collapsing toolbar — icon+label buttons drop their labels when the bar
    // would otherwise wrap; the icon plus its tooltip carries the meaning.
    // Art Station is the reference implementation the issue names.
    '.mbu-compact .mbu-bt{display:none}',
].join('');

// ── JS ──────────────────────────────────────────────────────────────────────
// Emitted verbatim. Keep it dependency-free and defensive: these run inside ten
// different scripts on pages none of them control.
const JS = `
// Help link markup. Every script's help link is this, pointing at its own README.
// \`name\` is the userscript folder, e.g. mbuHelpHref('art_station').
function mbuHelpHref(name) {
    return 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/' + name + '/README.md';
}
function mbuHelpHtml(name, label) {
    return '<a class="mbu-help" href="' + mbuHelpHref(name) + '" target="_blank" rel="noopener"'
        + ' title="open the README in a new tab">' + (label || '? Help') + '</a>';
}
function mbuHelpEl(name, label) {
    var a = document.createElement('a');
    a.className = 'mbu-help';
    a.href = mbuHelpHref(name);
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = 'open the README in a new tab';
    a.textContent = label || '? Help';
    return a;
}

// Toast. mbuToast(msg) or mbuToast(msg, { ms, kind, at:{x,y} }).
//
// Severity is inferred from a leading warning/tick glyph when not given — Art
// Station already did that and it is why its toasts reached its log with the
// right level. Set mbuToast.log = function (level, message) {...} once at
// startup and every toast mirrors into that script's own log; leave it unset
// and the toast still shows.
var _mbuToastT = null;
function mbuToast(msg, opts) {
    opts = opts || {};
    var s = String(msg);
    var kind = opts.kind || (/^\\s*[⚠✗×]/.test(s) ? 'warn' : /[✓✅]/.test(s) ? 'ok' : 'info');
    try {
        if (typeof mbuToast.log === 'function') mbuToast.log(kind, s.replace(/^\\s*[⚠✗×✓✅]\\s*/, ''));
    } catch (e) { /* a broken log sink must never swallow the toast */ }
    var el = document.getElementById('mbu-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'mbu-toast';
        (document.body || document.documentElement).appendChild(el);
    }
    el.className = 'mbu-toast-on' + (kind !== 'info' ? ' mbu-toast-' + kind : '');
    el.textContent = s;
    // Anchor above a click point when asked, clamped into the viewport; otherwise
    // fall back to the centred default by clearing the inline placement.
    if (opts.at) {
        var w = el.offsetWidth, h = el.offsetHeight;
        el.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, opts.at.x - w / 2)) + 'px';
        el.style.top = Math.max(6, Math.min(window.innerHeight - h - 6, opts.at.y - h - 10)) + 'px';
        el.style.bottom = 'auto';
        el.style.transform = 'none';
    } else {
        el.style.left = ''; el.style.top = ''; el.style.bottom = ''; el.style.transform = '';
    }
    clearTimeout(_mbuToastT);
    _mbuToastT = setTimeout(function () { el.className = ''; }, opts.ms || 2600);
    return el;
}

// Config-window title bar.
//
//   mbuCfgHeader({ script:'art_station', name:'Art Station', version:'2026.9.2',
//                  icon:'<svg…>' | '<img…>', log:true, logClass:'as-setup-logbtn' })
//
// Returns the markup for the whole bar. 'log' adds the Log button; a script with
// no log window leaves it out rather than shipping a dead control. logClass /
// logId are carried through IN ADDITION to the shared class so a script's
// existing click handler keeps working — adopting the component must not mean
// rewiring every listener at the same time.
function mbuCfgHeader(o) {
    o = o || {};
    var esc = function (s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    };
    var html = '<div class="mbu-cfg-h">';
    if (o.icon) html += '<span class="mbu-cfg-ic">' + o.icon + '</span>';
    html += '<span class="mbu-cfg-name">' + esc(o.name) + '</span>';
    if (o.version) html += '<span class="mbu-cfg-ver" title="installed script version">v' + esc(o.version) + '</span>';
    html += '<span class="mbu-cfg-sp"></span>';
    if (o.log) {
        html += '<button type="button" class="mbu-cfg-log' + (o.logClass ? ' ' + esc(o.logClass) : '') + '"'
            + (o.logId ? ' id="' + esc(o.logId) + '"' : '')
            + ' title="Open the activity log">Log</button>';
    }
    html += mbuHelpHtml(o.script);
    return html + '</div>';
}

// Dismiss-on-outside-click, with the trailing click SWALLOWED.
//
//   var off = mbuDismissOn(popoverEl, close);   // off() to detach early
//
// #305: a popover torn down on mousedown removes what was under the cursor, so
// the click that follows lands on whatever the page reflowed into that spot and
// activates it. Tearing down on click instead just moves the problem. So: close
// on outside mousedown, then eat exactly one click in the capture phase. This is
// the single most repeated interaction bug in these scripts and it belongs in
// one place — it is why #563 says interaction is part of the contract.
//
// Esc closes too, innermost first: the handler is registered in capture and stops
// propagation, so a popover inside a modal does not close the modal as well.
function mbuDismissOn(el, close, opts) {
    opts = opts || {};
    var closed = false;
    var onDown = function (e) {
        if (closed || !el || el.contains(e.target)) return;
        if (opts.ignore && e.target.closest && e.target.closest(opts.ignore)) return;
        finish();
        // swallow the click this mousedown will produce, once
        var eat = function (ev) { ev.stopPropagation(); ev.preventDefault(); document.removeEventListener('click', eat, true); };
        document.addEventListener('click', eat, true);
        setTimeout(function () { document.removeEventListener('click', eat, true); }, 400);
    };
    var onKey = function (e) {
        if (closed || e.key !== 'Escape') return;
        e.stopPropagation();
        finish();
    };
    function finish() {
        if (closed) return;
        closed = true;
        document.removeEventListener('mousedown', onDown, true);
        document.removeEventListener('keydown', onKey, true);
        try { close(); } catch (err) { /* a throwing closer must not leave listeners behind */ }
    }
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return finish;
}

// Collapse a toolbar to icon-only when its buttons would wrap.
//
//   mbuFitToolbar(barEl)            // call on build, and on resize
//
// Measured by SUMMING child widths rather than reading scrollWidth or comparing
// offsetTop: a bar with flex:1 spacers never overflows its own scroll box, so
// both of those report "fits" right up until it visibly wraps. Art Station
// learned that the hard way (#234) and it is the only reason this is a helper
// rather than one CSS rule.
//
// opts.gap    inter-item gap in px (default 11)
// opts.pad    horizontal padding to leave (default 24)
// opts.spacer selector for flexible spacers, which must not count (default .mbu-sp)
function mbuFitToolbar(bar, opts) {
    if (!bar) return false;
    opts = opts || {};
    var gap = opts.gap == null ? 11 : opts.gap;
    var pad = opts.pad == null ? 24 : opts.pad;
    var spacer = opts.spacer || '.mbu-sp';
    bar.classList.remove('mbu-compact');            // measure at full labels
    var kids = [].slice.call(bar.children);
    var need = gap * Math.max(0, kids.length - 1);
    for (var i = 0; i < kids.length; i++) {
        if (kids[i].matches && kids[i].matches(spacer)) continue;
        need += kids[i].offsetWidth;
    }
    var compact = need > bar.clientWidth - pad;
    bar.classList.toggle('mbu-compact', compact);
    return compact;
}

// Publish the components on a shared namespace. Three reasons, in order:
//
//  1. it is the cross-userscript contract #563 is about — another script (or a
//     future one) gets the standard widgets without copying them, the same way
//     Mammoth already exposes its field-memory through a documented convention;
//  2. it makes the components testable from outside, which is the only way to
//     assert the *behaviour* half of the contract rather than just the markup;
//  3. it costs nothing when several scripts do it — the definitions are
//     byte-identical, so first writer wins and the rest are no-ops.
//
// Guarded per key, never clobbering: a script that loaded first keeps its copy,
// and a page that defines an unrelated window.MBU is left alone.
try {
    var _mbuNs = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
    if (!_mbuNs.MBU) _mbuNs.MBU = {};
    if (!_mbuNs.MBU.helpHref) _mbuNs.MBU.helpHref = mbuHelpHref;
    if (!_mbuNs.MBU.helpHtml) _mbuNs.MBU.helpHtml = mbuHelpHtml;
    if (!_mbuNs.MBU.helpEl) _mbuNs.MBU.helpEl = mbuHelpEl;
    if (!_mbuNs.MBU.toast) _mbuNs.MBU.toast = mbuToast;
    if (!_mbuNs.MBU.cfgHeader) _mbuNs.MBU.cfgHeader = mbuCfgHeader;
    if (!_mbuNs.MBU.dismissOn) _mbuNs.MBU.dismissOn = mbuDismissOn;
    if (!_mbuNs.MBU.fitToolbar) _mbuNs.MBU.fitToolbar = mbuFitToolbar;
} catch (e) { /* a locked-down page must not stop the script loading */ }
`.trim();

export const UI_CSS = CSS;
export const UI_JS = JS;
