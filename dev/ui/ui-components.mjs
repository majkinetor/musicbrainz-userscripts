// Shared UI components for every userscript in this repo. #563
//
// THIS FILE IS THE SINGLE PLACE THE STANDARD WIDGETS ARE DEFINED. Change one
// here, run `node dev/ui/sync-ui.mjs` (the pre-commit hook does it for you), and
// every script carrying a `// <ST-UI>` marker picks it up.
//
// Companion to dev/tokens/design-tokens.mjs (#562): tokens say what things look like,
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
// The containers our windows live in. Some rules below have to reach plain
// elements (`input`, `select`) rather than our own classes, and a bare `input`
// rule would restyle MusicBrainz's forms — which are not ours to restyle. So
// those rules are scoped to this list. `.mbu-ui` is the opt-in hook for any
// container not named here, so a new window never needs this list edited.
//
// One list, used by every scoped rule: two copies drift, and a container missing
// from one of them is a window whose inputs are themed but whose placeholders
// are not.
const ROOTS = [
    // shared
    '.mbu-ov', '.mbu-ui', '#mbu-logpop', '.discogs-bar', '.discogs-review-panel-li',
    // art_station — #as-switch-wrap is the floating pill; its two buttons sit
    // OUTSIDE #as-root, so nothing scoped to that reached them
    '#as-root', '#as-setup', '.as-pop', '#as-switch-wrap',
    // the other floating launchers, for the same reason
    '#ii-btn', '.fs-launch',
    // apollo_editor
    '#tc-bar', '#tc-nav-bar', '#tc-settings', '#tc-anno-wrap', '.tc-panel', '.tc-toolcfg', '.tc-acpop',
    '.tc-recpop', '.tc-lppop', '.tc-tpppop', '.tc-tpp-mpop', '.tc-anno-help-pop',
    // …and the parts of Apollo that live ON MusicBrainz's page rather than in a
    // window of its own: the tracklist mirror and the two toolbars around it.
    '.tc-mirror', '.tc-addrow', '.tc-medopts', '.tc-tools', '#tc-recwrap', '#tc-ri-toolbar',
    // …and MusicBrainz's own format select, which Apollo repaints flat in OUR
    // colours (.tc-fmt-flat). Having adopted its appearance we own its theming.
    '.tc-fmt-flat',
    // group_therapy
    '.gt-toolbar', '.gt-cons', '.gt-menu', '.gt-pop', '.gt-cfg-pop', '.gt-wm-pop',
    // isrc_scout
    '#ii-modal', '#ii-sxpanel',
    // platform_check
    '#mb-pc-panel', '#mb-provider-modal-card',
    // fusion
    '.fs-cons', '#fs-settings', '.fs-overlay',
    // mammoth — .mmth-side is the note panel itself. NOT .mmth-wrap: that one
    // wraps MusicBrainz's own edit-note textarea, which belongs to the page.
    '.mmth-pop', '.mmth-cfg', '.mmth-side', '.mmth-pinbar',
    // …and the BABY-field UI, which is 'mmthf-' with an f — a different prefix
    // entirely, so none of it was covered by the 'mmth-' entries above
    '.mmthf-pop', '.mmthf-bar',
    // falcon
    '#falcon-panel', '#falcon-launcher', '#falcon-item-popup', '#falcon-add-page',
    '.falcon-bar', '.falcon-addmenu',
];
// `:where()` contributes NOTHING to specificity, so everything below lands as a
// DEFAULT: any existing per-script rule, however weakly selected, still wins.
// Written the obvious way (`#as-root input`) an id would outrank every class
// rule in every script and silently repaint controls that were already styled.
// Both halves are wrapped, so the whole thing weighs 0 and one selector covers
// the cross product instead of ROOTS.length selectors per rule.
const scoped = (inner) => `:where(${ROOTS.join(',')}) :where(${inner})`;
// …except for a pseudo-ELEMENT, which is not a valid argument to :where(). The
// list is forgiving, so it does not error — it silently drops the argument and
// leaves a rule that matches nothing at all. Those get the left side scoped only.
const scopedEl = (inner) => `:where(${ROOTS.join(',')}) ${inner}`;

// Single-quoted at generation time, so: no single quotes, no newlines.
// the camera glyph, as an SVG data URI in the given (url-encoded) fill
const VIDEO_GLYPH = (fill) => "data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2016%2016%27%20fill=%27" + fill + "%27%3E%3Crect%20x=%271%27%20y=%273.5%27%20width=%2710%27%20height=%279%27%20rx=%271.5%27/%3E%3Cpath%20d=%27M11.5%207L15%204.8v6.4L11.5%209z%27/%3E%3C/svg%3E";

const CSS = [
    // Help link — `? Help` opening the script's README in a new tab. Apollo and
    // Fusion already agreed on this shape; Art Station said "Help ↗" and Mammoth
    // carried no class at all. Apollo/Fusion win on numbers.
    '.mbu-help{font-size:12px;color:var(--mbu-accent-text);text-decoration:none;border:1px solid var(--mbu-border);',
    'border-radius:var(--mbu-radius);padding:1px 8px;white-space:nowrap;line-height:1.6;background:none}',
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
    '#mbu-toast.mbu-toast-act{pointer-events:auto}',
    '#mbu-toast .mbu-toast-btn{margin-left:10px;padding:2px 9px;border:1px solid currentColor;border-radius:5px;background:transparent;color:inherit;font:inherit;cursor:pointer}',
    '#mbu-toast .mbu-toast-btn:hover{background:rgba(255,255,255,.18)}',
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
    '.mbu-cfg-name{flex:0 0 auto;font-weight:700;color:var(--mbu-accent-text)}',
    // the version is deliberately quiet — it is reference information, not a heading
    '.mbu-cfg-ver{flex:0 0 auto;font:400 11px var(--mbu-font);color:var(--mbu-text-weak);white-space:nowrap}',
    '.mbu-cfg-sp{flex:1 1 auto;min-width:8px}',
    // Log is a plain text link, NOT a button — that is how every script had it
    // (background:none, border:1px solid transparent, the border appearing only
    // on hover). I made it a bordered control and majkinetor rightly called it
    // out: the border is a hover affordance here, not chrome.
    '.mbu-cfg-log{flex:0 0 auto;font:400 12px var(--mbu-font);color:var(--mbu-accent-text);cursor:pointer;',
    'background:none;border:1px solid transparent;border-radius:var(--mbu-radius);padding:1px 8px;line-height:1.6}',
    '.mbu-cfg-log:hover{background:var(--mbu-bg-hover);border-color:var(--mbu-border)}',

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
    'border-bottom:1px solid var(--mbu-border-soft);color:var(--mbu-accent-text);cursor:move;user-select:none}',
    '.mbu-logpop-sp{margin-left:auto}',
    '.mbu-logpop-clear,.mbu-logpop-copy,.mbu-logpop-x,.mbu-logpop-min{font-size:12px;color:var(--mbu-accent-text);',
    'background:var(--mbu-bg-hover);border:1px solid var(--mbu-border);border-radius:5px;',
    'padding:2px 9px;cursor:pointer;font-family:inherit}',
    '.mbu-logpop-clear:hover,.mbu-logpop-copy:hover,.mbu-logpop-x:hover,.mbu-logpop-min:hover{background:var(--mbu-accent-soft)}',
    // minimised: just the header bar, so it can sit out of the way mid-run
    '#mbu-logpop.min .mbu-log-list,#mbu-logpop.min .mbu-logpop-clear,#mbu-logpop.min .mbu-logpop-copy,#mbu-logpop.min .mbu-logpop-x{display:none}',
    '#mbu-logpop.min{max-height:none;width:auto}',
    '#mbu-logpop.min .mbu-logpop-sp{display:none}',
    '.mbu-log-badge{color:var(--mbu-border-strong);font-size:11px}',
    '.mbu-log-list{flex:1 1 auto;overflow:auto;overscroll-behavior:contain;padding:9px 13px;',
    'display:flex;flex-direction:column;gap:3px}',
    '.mbu-log-li{display:flex;gap:9px;white-space:pre-wrap;word-break:break-word}',
    '.mbu-log-t{color:var(--mbu-text-weak);flex:0 0 auto;font-variant-numeric:tabular-nums}',
    '.mbu-log-m{flex:1 1 auto;color:var(--mbu-text-dim)}',
    '#mbu-logpop .mbu-log-m a{color:var(--mbu-accent-text)}',
    // severity, on the message only — the timestamp stays quiet
    '.mbu-log-ok .mbu-log-m{color:var(--mbu-ok)}',
    '.mbu-log-warn .mbu-log-m{color:var(--mbu-warn)}',
    '.mbu-log-error .mbu-log-m{color:var(--mbu-error)}',
    '.mbu-log-debug{opacity:.85}',
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


    // Placeholders — muted AND italic, so a hint can never be mistaken for typed
    // text. That confusion is the actual report (#563): a column-pattern hint in
    // Group Therapy's text parser read as a filled value. Colour alone was not
    // enough — the browser default is already a grey — so the slant carries it too,
    // and opacity is pinned because Firefox dims ::placeholder by default on top of
    // whatever colour you set.
    //
    // Scoped to our own containers (see ROOTS) rather than a bare `::placeholder`.
    scopedEl('::placeholder') + '{color:var(--mbu-text-weak);opacity:1;font-style:italic}',

    // Our windows carry their own foreground. Inheriting the page's is a bet
    // that the page agrees with us about the theme, and that is the bet this
    // issue keeps losing: Platform Check's provider names set no colour of
    // their own and came out black on a dark panel.
    ':where(' + ROOTS.join(',') + '){color:var(--mbu-text)}',

    // …and hold on to it against the userstyle's inline-background reset.
    // kellnerd's "Dark Side of MusicBrainz" carries, under the comment "keep
    // original text color for elements with inline CSS which affects the
    // background":
    //
    //     table[style*=background], td[…], th[…], div[…], span[…], label[…]
    //         { color: initial; }
    //
    // Reasonable for MusicBrainz's own inline-coloured cells. But `initial` is
    // BLACK, and plenty of our elements set their background inline — Platform
    // Check's provider rows among them — so the rule repainted our text black on
    // our own dark panel. Setting the colour on an ancestor cannot save it: that
    // rule targets the element itself, and inheritance always loses to a rule.
    //
    // Matched at the same shape so it weighs the same (0,1,1) and wins on order,
    // our sheet being the later one. Deliberately not stronger than that: a
    // per-script rule with real weight should still be able to override us.
    scopedEl(':is(table,td,th,div,span,label)[style*=background]'),
    '{color:var(--mbu-text)}',

    // Form controls — the theme has to reach INSIDE the windows too. #564:
    // "Some edit boxes do not follow theme (white rectangles)". A control with no
    // background of its own takes the UA default, which is white in every theme,
    // so a dark window grew white rectangles wherever a script had left an input
    // unstyled. There is no per-script fix for that: an unstyled control is
    // exactly the case nobody remembered, so the default itself has to be ours.
    //
    // Deliberately NOT checkbox/radio/range/color: those paint their own widget
    // from the UA theme and a background here squares them off. They get
    // accent-color instead, which is the supported way to tint them.
    // The weight here is deliberate and load-bearing. MusicBrainz's own sheet
    // carries `input{background:#fff}` — specificity 0,0,1 — so a rule of 0,0,0
    // loses to it and the field stays white however dark the panel is (that is
    // what the first version of this did). So the element part is left OUTSIDE
    // :where() to weigh its natural 0,0,1, and the type exclusions go INSIDE a
    // :where() so they add nothing. 0,0,1 ties MusicBrainz and wins on order —
    // our stylesheet is injected after theirs — while still losing to every
    // per-script rule, which is the point: this is a default, not an override.
    scopedEl('input:not(:where([type=checkbox],[type=radio],[type=range],[type=color],[type=file])),'),
    scopedEl('textarea,') + scopedEl('select'),
    '{background:var(--mbu-bg-sunken);color:var(--mbu-text);',
    // border-color only — width and style stay whatever the control had, so a
    // script that drew a deliberate 2px ring keeps it.
    'border-color:var(--mbu-border)}',
    scopedEl('input:focus-visible,') + scopedEl('textarea:focus-visible,') + scopedEl('select:focus-visible'),
    '{outline:2px solid var(--mbu-accent);outline-offset:1px}',
    // Widgets that paint themselves: tint rather than repaint.
    scoped('input[type=checkbox],input[type=radio],input[type=range]'),
    '{accent-color:var(--mbu-accent)}',
    // …and tell the UA which way round the world is, which is the ONE thing a
    // custom property cannot do. accent-color tints the checked state; the empty
    // box is still painted by the browser, white in Chrome and black in Firefox
    // (#564), and only color-scheme moves it. Scoped to our own containers and
    // gated on the detected theme, so MusicBrainz's own controls are untouched.
    ':root[data-mbu-theme=dark] ' + ':where(' + ROOTS.join(',') + ')',
    '{color-scheme:dark',

    // OPT OUT OF THE USERSTYLE'S INVERSION. kellnerd's "Dark Side of
    // MusicBrainz" carries, under the comment "invert all non-text inputs and
    // buttons":
    //
    //     input[type=number], …, select, button, .buttons a
    //         { filter: var(--invert-value); }     /* invert(.9) hue-rotate(180deg) */
    //
    // Sound for MusicBrainz's own controls, which are authored light — inverting
    // makes them dark. Ours are authored DARK, so the same filter makes them
    // light grey. That is majkinetor's "all still have gray background", and it
    // is also why his experiment inverted: setting #000 rendered light, #fff
    // rendered dark. Nothing in our cascade could cause that, because it happens
    // after the cascade.
    //
    // We cancel it by redefining the userstyle's OWN variable inside our
    // containers rather than by fighting for `filter`. Custom properties
    // inherit, so `filter: var(--invert-value)` resolves to `none` for anything
    // in our windows — no specificity war, no !important, and our own deliberate
    // filters (the grayscale on dead favicons and unmatched platform icons) are
    // left completely alone. On a page without that userstyle these two
    // declarations are inert.
    //
    // Gated on the dark theme for the same reason as color-scheme: it is only
    // right to refuse the inversion once our controls are actually dark.
    ';--invert-value:none;--invert:none}',
    // A button nobody styled is the same failure as an input nobody styled: the
    // UA paints it light grey with black text, which is invisible-adjacent on a
    // dark panel. Colours only, no border/radius shorthand — a script that drew a
    // borderless button keeps it borderless, and nothing here moves a pixel.
    scopedEl('button'),
    '{background-color:var(--mbu-bg-raised);color:var(--mbu-text);border-color:var(--mbu-border)}',
    // Collapsing toolbar — icon+label buttons drop their labels when the bar
    // would otherwise wrap; the icon plus its tooltip carries the meaning.
    // Art Station is the reference implementation the issue names.
    '.mbu-compact .mbu-bt{display:none}',
    // Video toggle (#663): a checkbox drawn as a camera glyph, faint when off and a
    // filled accent chip when on. Falcon puts .mbu-video on its own checkbox; Apollo
    // styles MB's external-links video checkbox, which it can't add a class to.
    ':is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input){-webkit-appearance:none;-moz-appearance:none;appearance:none;width:18px;height:18px;margin:0;border:none;border-radius:3px;cursor:pointer;background:transparent url("' + VIDEO_GLYPH('%23888') + '") center/13px no-repeat;opacity:.45;box-shadow:none;flex:0 0 auto;vertical-align:middle}',
    ':is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):hover{opacity:1}',
    ':is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):checked{opacity:1;background-color:var(--mbu-accent);background-image:url("' + VIDEO_GLYPH('%23fff') + '")}',
    ':is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):focus-visible{outline:1px solid var(--mbu-accent);outline-offset:1px}',
    ':is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):disabled{cursor:default;opacity:.3}',
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

// The config (settings) icon every script's settings button shows: the gear in text
// presentation (U+FE0E), so it takes the button's colour instead of an emoji's. #650
var MBU_CFG_ICON = '\\u2699\\uFE0E';

// HTML for an innerHTML on a page that enforces Trusted Types (YouTube Music, #650): there a
// plain string is refused ("This document requires 'TrustedHTML' assignment"). The policy
// passes the string through; the markup is the script's own. Elsewhere it is the string.
var _mbuTT;
function mbuHtml(s) {
    if (_mbuTT === undefined) {
        _mbuTT = null;
        try {
            var tt = (typeof window !== 'undefined' && window.trustedTypes) || null;
            if (tt && tt.createPolicy) _mbuTT = tt.createPolicy('mbu-' + Math.random().toString(36).slice(2, 8), { createHTML: function (x) { return x; } });
        } catch (e) { /* the page allows no new policy: plain strings, as before */ }
    }
    return _mbuTT ? _mbuTT.createHTML(String(s)) : String(s);
}

// The first line of every script's log: the script, its version, and what runs it, so a
// pasted log says which manager and browser it came from (#282 started it in Art Station):
//   Log.info(mbuStartupInfo('Fusion'));
//   -> Fusion v2026.10.1 · Violentmonkey 2.31.0 · firefox 143.0 (win)
// Inside String Theory GM_info describes the bundle, so the line names it:
//   -> Fusion (String Theory v2026.10.1) · Tampermonkey 5.3.3 · chrome 140.0 (win)
function mbuStartupInfo(name) {
    var g = null;
    try { g = (typeof GM_info !== 'undefined' && GM_info) || null; } catch (e) { /* no GM_info */ }
    var s = (g && g.script) || {}, p = (g && g.platform) || {};
    var host = String(s.name || '').replace(/\\*$/, ''), ver = s.version || '?';
    var line = !name ? (host || 'Script') + ' v' + ver
        : (host && host !== name) ? name + ' (' + host + ' v' + ver + ')'
        : name + ' v' + ver;
    if (g) line += ' · ' + (g.scriptHandler || 'unknown manager') + (g.version ? ' ' + g.version : '');
    if (p.browserName) line += ' · ' + p.browserName + (p.browserVersion ? ' ' + p.browserVersion : '') + (p.os ? ' (' + p.os + ')' : '');
    else { try { line += ' · ' + navigator.userAgent; } catch (e) { /* no navigator */ } }
    return line;
}

// One copy per page (#653). With String Theory and a standalone install of the same script
// both on, two copies build the same element ids and fight over them: each settings window
// fills in the other's checkboxes, rows flip between two rule sets. So one copy runs, the
// one with the higher version, and the other stays off without a word; only the running
// copy notes it in its log (majkinetor: "disable copy that has lower version without any
// info (except in log of active copy)"):
//   if (!mbuClaim('platform_check', 'Platform Check')) return;   // first line of the script
// The claim is a data- attribute on <html>, which every copy sees whatever its sandbox.
// It is decided at once, so no script starts late. The copy that starts first takes the
// page. When it is the older one, the newer copy stays off for this page and leaves a note
// in localStorage, and from the next page load the older copy finds the note and steps
// aside. A note whose copy has gone (uninstalled) is cleared by the older copy after the
// page loads, so it runs again from the load after.
function mbuClaimVer(v) {
    return String(v || '').split('.').map(function (n) { return parseInt(n, 10) || 0; });
}
function mbuClaimCmp(a, b) {
    var x = mbuClaimVer(a), y = mbuClaimVer(b);
    for (var i = 0; i < Math.max(x.length, y.length); i++) { var d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; }
    return 0;
}
function mbuClaim(key, label) {
    var info = (typeof GM_info !== 'undefined' && GM_info && GM_info.script) || {};
    var name = String(info.name || label || key), ver = String(info.version || '0');
    var mine = (name.slice(-1) === '*' ? 'String Theory' : 'standalone') + ' v' + ver;
    var root = document.documentElement, attr = 'data-mbu-run-' + key, ev = 'mbu-claim-' + key, noteKey = 'mbu-newer-' + key;
    var log = function (msg) { try { if (typeof mbuLog !== 'undefined' && mbuLog.active) mbuLog.active.info(msg); else if (typeof mbuToast !== 'undefined' && typeof mbuToast.log === 'function') mbuToast.log('info', msg); else console.info('[' + (label || key) + '] ' + msg); } catch (e) { /* no log */ } };
    var note = null;
    try { note = JSON.parse(localStorage.getItem(noteKey) || 'null'); } catch (e) { /* storage blocked */ }
    // A note older than this copy is spent. This copy's own note stays: it is what keeps the
    // older copy aside on every later load, not only the next one (#671).
    var noteCmp = note ? mbuClaimCmp(note.ver, ver) : 1;
    if (noteCmp < 0) { try { localStorage.removeItem(noteKey); } catch (e) { /* storage blocked */ } }
    if (noteCmp <= 0) note = null;
    var held = root && root.getAttribute(attr);
    var off = function (why) {
        // tell the running copy (any sandbox hears a DOM event), or the copy that runs after
        // this one (it reads the attribute), and stay quiet
        try { if (root) root.setAttribute(attr + '-off', JSON.stringify({ mine: mine, why: why })); } catch (e) { /* no attribute */ }
        try { document.dispatchEvent(new CustomEvent(ev, { detail: JSON.stringify({ mine: mine, ver: ver, why: why }) })); } catch (e) { /* no event */ }
        return false;
    };
    if (held) {
        var heldVer = (root.getAttribute(attr + '-ver') || '0');
        if (mbuClaimCmp(ver, heldVer) > 0) {
            try { localStorage.setItem(noteKey, JSON.stringify({ ver: ver, mine: mine, at: Date.now() })); } catch (e) { /* storage blocked */ }
            return off('newer, from the next page load');
        }
        return off('older or the same');
    }
    if (note) {
        // a newer copy said it is installed: leave the page to it, unless it never shows up
        var watch = function () {
            setTimeout(function () {
                if (root.getAttribute(attr)) return;
                try { localStorage.removeItem(noteKey); } catch (e) { /* storage blocked */ }
                try { console.info('[' + (label || key) + '] the newer copy (' + note.mine + ') did not start: this copy runs again from the next page load'); } catch (e) { /* no console */ }
            }, 3000);
        };
        if (document.readyState === 'complete') watch(); else window.addEventListener('load', watch, { once: true });
        return off('older: a newer copy runs');
    }
    if (root) { root.setAttribute(attr, mine); root.setAttribute(attr + '-ver', ver); }
    var told = function (o) {
        log((label || key) + ' is installed twice: ' + mine + ' runs, ' + (o.mine || 'another copy') + ' is switched off'
            + (o.why === 'newer, from the next page load' ? ' for this page (it is newer and runs from the next page load)' : '') + '.');
    };
    document.addEventListener(ev, function (e) { var o = {}; try { o = JSON.parse(e.detail); } catch (x) { /* not ours */ } told(o); });
    // a copy that stepped aside before this one started (it found a note): log it once the script's log is up
    var before = root && root.getAttribute(attr + '-off');
    if (before) setTimeout(function () { var o = {}; try { o = JSON.parse(before); } catch (x) { /* not ours */ } told(o); }, 0);
    return true;
}

// Toast. mbuToast(msg) or mbuToast(msg, { ms, kind, at:{x,y}, action:{ label, onClick } }).
//
// An action adds one button to the toast (e.g. "Copy log"): the toast is then clickable,
// stays up longer (12 s unless ms says otherwise), and closes when the button is used.
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
    el.className = 'mbu-toast-on' + (kind !== 'info' ? ' mbu-toast-' + kind : '') + (opts.action ? ' mbu-toast-act' : '');
    el.textContent = s;
    if (opts.action) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'mbu-toast-btn'; b.textContent = opts.action.label || 'OK';
        b.onclick = function () {
            try { if (opts.action.onClick) opts.action.onClick(b); } catch (e) { /* the toast still closes */ }
            clearTimeout(_mbuToastT); _mbuToastT = setTimeout(function () { el.className = ''; }, 900);
        };
        el.appendChild(b);
    }
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
    _mbuToastT = setTimeout(function () { el.className = ''; }, opts.ms || (opts.action ? 12000 : 2600));
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

// Test hooks. A script puts its test hook on window only when the test harness has
// marked the page (dev/test/harness.mjs sets window.__mbuTest before any script runs):
//   if (mbuTestHooks()) window.__fooTest = { … };
// On a user's page the hooks are never built. (#623)
function mbuTestHooks() {
    try { return typeof window !== 'undefined' && window.__mbuTest === true; } catch (e) { return false; }
}

// Corner slots (#468). Every floating launcher (Apollo Editor, Art Station, Falcon,
// Fusion, Scribe) tags its element with data-mb-corner (which screen corner: 'br',
// 'bl', 'tr', 'tl') and data-mb-corner-order (lower sits closer to the corner), and
// calls mbRestackCorner(corner) right after it shows, hides, creates or removes it.
// That recomputes every element in the corner, whichever script owns it and
// whatever order they loaded in, so two launchers never land on the same pixel.
// Orders in use: Apollo and Art Station 10 (never on the same page), Falcon 20,
// Fusion above Falcon. Scribe is not on the shared block and keeps a copy of this.
function mbRestackCorner(corner) {
    var bottom = corner[0] === 'b', right = corner[1] === 'r';
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-mb-corner="' + corner + '"]'))
        // offsetParent is always null for position:fixed, so it can't tell visibility here
        .filter(function (el) { return getComputedStyle(el).display !== 'none'; })
        .sort(function (a, b) { return (Number(a.dataset.mbCornerOrder) || 0) - (Number(b.dataset.mbCornerOrder) || 0); });
    var pos = 14;
    els.forEach(function (el) {
        el.style[bottom ? 'bottom' : 'top'] = pos + 'px';
        el.style[right ? 'right' : 'left'] = '14px';
        pos += el.getBoundingClientRect().height + 8;
    });
}

// Activity log: the session's log lines plus the floating window that shows them
// (#283's viewer, shared since X12 of #623). A script makes its log once:
//
//   var LOG = mbuLog({ name: 'Fusion', version: VERSION, key: 'fusion.logwin' });
//   LOG.info('…'); LOG.warn(…); LOG.err(…) (or .error); LOG.ok(…); LOG.debug(…)
//   LOG.open(); LOG.close(); LOG.reopen()   // reopen: only if it was left open
//   LOG.markdown(); LOG.copy(btn); LOG.clear(); LOG.lines(); LOG.messages(); LOG.counts()
//
// o.name / o.version  the Markdown summary's title (version may be a function)
// o.subtitle          optional function; its text follows the title (e.g. the release)
// o.header            the window's title (default 'Activity log')
// o.key               storage key for the window's open/minimised/position state
// o.load / o.save     that storage (default GM_getValue / GM_setValue)
// o.before            called before the window opens (e.g. to inject the script's CSS)
// o.max               lines kept (default 20000: about 4 MB; 2000 dropped a long session's start)
//
// A long run keeps only the last o.max lines, and the Markdown says how many went
// before them; the copies this replaced grew for the whole session. An open
// window appends each new line and drops the oldest row past the cap; the copies
// rebuilt the whole list with innerHTML on every line, which is quadratic over a
// long matching run.
function mbuLog(o) {
    o = o || {};
    var max = o.max || 20000, buf = [], dropped = 0, warn = 0, error = 0, win = null;
    var pad = function (n, w) { return String(n).padStart(w || 2, '0'); };
    var ts = function (d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '.' + pad(d.getMilliseconds(), 3); };
    var str = function (v) {
        if (typeof v === 'string') return v;
        if (v instanceof Error) return v.message || String(v);
        if (v && v.nodeType) return '<' + (v.tagName || 'node').toLowerCase() + '>';
        try { return typeof v === 'object' ? JSON.stringify(v) : String(v); } catch (e) { return String(v); }
    };
    var esc = function (s) {
        return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    };
    // escape, then make http(s) URLs clickable, keeping trailing punctuation out of them
    var linkify = function (s) {
        return esc(s).replace(/(https?:\\/\\/[^\\s<]+)/g, function (m) {
            var t = (m.match(/[.,;:!?)\\]]+$/) || [''])[0];
            var url = m.slice(0, m.length - t.length);
            return '<a href="' + url + '" target="_blank" rel="noopener">' + url + '</a>' + t;
        });
    };
    var load = o.load || function (k) { try { return GM_getValue(k, undefined); } catch (e) { return undefined; } };
    var save = o.save || function (k, v) { try { GM_setValue(k, v); } catch (e) { /* no storage: the window just forgets */ } };
    var state = function () { try { return JSON.parse(load(o.key) || '{}') || {}; } catch (e) { return {}; } };
    var remember = function (patch) { try { save(o.key, JSON.stringify(Object.assign(state(), patch))); } catch (e) { /* see save */ } };
    var tally = function (e, d) { if (e.sev === 'warn') warn += d; else if (e.sev === 'error') error += d; };
    var PRE = { info: '', ok: 'OK   ', warn: 'WARN ', error: 'ERR  ', debug: 'DBG  ' };
    var line = function (e) { return ts(e.t) + '  ' + (PRE[e.sev] || '') + e.msg; };

    function add(sev, args) {
        var msg = Array.prototype.map.call(args, str).join(' ').replace(/\\s+/g, ' ').trim();
        if (!msg) return;
        var e = { t: new Date(), sev: sev === 'err' ? 'error' : sev, msg: msg };
        buf.push(e); tally(e, 1);
        // trim in chunks, not one shift per line
        if (buf.length > max + Math.ceil(max / 10)) {
            var gone = buf.splice(0, buf.length - max);
            gone.forEach(function (g) { tally(g, -1); });
            dropped += gone.length;
        }
        if (win) win.append(e);
    }
    function title() {
        var v = typeof o.version === 'function' ? (function () { try { return o.version(); } catch (e) { return ''; } })() : o.version;
        var t = (o.name || 'Log') + (v ? ' v' + v : '');
        try { var s = o.subtitle && o.subtitle(); if (s) t += ' — ' + s; } catch (e) { /* no subtitle */ }
        return t;
    }
    function markdown() {
        var body = buf.length ? buf.map(line).join('\\n') : '(no activity logged)';
        if (dropped) body = '(' + dropped + ' earlier line' + (dropped === 1 ? '' : 's') + ' not kept)\\n' + body;
        var n = (warn || error) ? ' (' + warn + ' warning' + (warn === 1 ? '' : 's') + ', ' + error + ' error' + (error === 1 ? '' : 's') + ')' : '';
        var fence = String.fromCharCode(96, 96, 96);
        return '<details><summary>' + title() + ' — session log' + n + '</summary>\\n\\n' + fence + 'log\\n' + body + '\\n' + fence + '\\n\\n</details>';
    }
    function copy(btn) {
        var md = markdown();
        var done = function (ok) {
            if (!btn) return;
            var was = btn.dataset.lbl || btn.textContent; btn.dataset.lbl = was;
            btn.textContent = ok ? 'Copied ✓' : 'Copy failed';
            setTimeout(function () { btn.textContent = was; }, 1500);
        };
        var fallback = function () {
            var ok = false;
            try {
                var ta = document.createElement('textarea'); ta.value = md; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
            } catch (x) { /* nothing left to try */ }
            done(ok);
        };
        try { navigator.clipboard.writeText(md).then(function () { done(true); }, fallback); } catch (e) { fallback(); }
    }
    function open() {
        close(true);
        if (typeof o.before === 'function') { try { o.before(); } catch (e) { /* the window still opens */ } }
        remember({ open: true });
        var st = state();
        var pop = document.createElement('div'); pop.id = 'mbu-logpop'; pop.className = 'mbu-logpop';
        pop.innerHTML = mbuHtml('<div class="mbu-logpop-h"><b>' + esc(o.header || 'Activity log') + '</b> <span class="mbu-log-badge"></span><span class="mbu-logpop-sp"></span>'
            + '<button class="mbu-logpop-clear" type="button" title="Clear the log (the lines so far are gone)">Clear</button>'
            + '<button class="mbu-logpop-copy" type="button" title="Copy as Markdown (paste into a GitHub issue)">⧉ Copy</button>'
            + '<button class="mbu-logpop-min" type="button" title="Minimize">–</button>'
            + '<button class="mbu-logpop-x" type="button" title="Close">✕</button></div>'
            + '<div class="mbu-log-list"></div>');
        document.body.appendChild(pop);
        if (st.left != null) { pop.style.left = st.left; pop.style.top = st.top; pop.style.right = 'auto'; pop.style.transform = 'none'; }
        var restore = { left: pop.style.left, top: pop.style.top, right: pop.style.right, bottom: pop.style.bottom, transform: pop.style.transform };
        var list = pop.querySelector('.mbu-log-list'), badge = pop.querySelector('.mbu-log-badge');
        var row = function (e) {
            var d = document.createElement('div');
            d.className = 'mbu-log-li mbu-log-' + e.sev;
            d.innerHTML = mbuHtml('<span class="mbu-log-t">' + ts(e.t) + '</span><span class="mbu-log-m">' + linkify(e.msg) + '</span>');
            return d;
        };
        var showBadge = function () { badge.textContent = '(' + buf.length + ')' + (warn || error ? ' · ' + warn + '⚠ ' + error + '✖' : ''); };
        // the rows, once; later lines are appended one by one
        var frag = document.createDocumentFragment();
        buf.forEach(function (e) { frag.appendChild(row(e)); });
        if (buf.length) list.appendChild(frag);
        else list.innerHTML = mbuHtml('<div class="mbu-log-empty">No activity yet.</div>');
        showBadge();
        list.scrollTop = list.scrollHeight;
        // badge and scroll once per frame, however many lines arrive in it
        var queued = false, follow = true;
        list.addEventListener('scroll', function () { follow = list.scrollHeight - list.scrollTop - list.clientHeight < 40; });
        var paint = function () { queued = false; showBadge(); if (follow) list.scrollTop = list.scrollHeight; };
        var onKey = function (e) { if (e.key === 'Escape') close(); };
        win = {
            el: pop,
            append: function (e) {
                var empty = list.querySelector('.mbu-log-empty'); if (empty) empty.remove();
                list.appendChild(row(e));
                while (list.childElementCount > buf.length) list.firstElementChild.remove();
                if (!queued) { queued = true; requestAnimationFrame(paint); }
            },
            off: function () { document.removeEventListener('keydown', onKey); },
            cleared: function () { list.innerHTML = mbuHtml('<div class="mbu-log-empty">No activity yet.</div>'); showBadge(); },
        };
        pop.querySelector('.mbu-logpop-clear').onclick = function () { clear(); };
        pop.querySelector('.mbu-logpop-copy').onclick = function () { copy(pop.querySelector('.mbu-logpop-copy')); };
        var minBtn = pop.querySelector('.mbu-logpop-min');
        var setMin = function (m) {
            minBtn.textContent = m ? '▢' : '–'; minBtn.title = m ? 'Restore' : 'Minimize';
            if (m) { pop.style.left = '14px'; pop.style.bottom = '14px'; pop.style.top = 'auto'; pop.style.right = 'auto'; pop.style.transform = 'none'; }   // dock to the bottom
            else Object.assign(pop.style, restore);
        };
        minBtn.onclick = function () { var m = pop.classList.toggle('min'); setMin(m); remember({ min: m }); };
        if (st.min) { pop.classList.add('min'); setMin(true); }
        pop.querySelector('.mbu-logpop-x').onclick = function () { close(); };
        // floating and non-modal: dragged by its header
        pop.querySelector('.mbu-logpop-h').addEventListener('mousedown', function (e) {
            if (e.target.closest('button')) return;
            e.preventDefault();
            var r = pop.getBoundingClientRect();
            pop.style.left = r.left + 'px'; pop.style.top = r.top + 'px'; pop.style.right = 'auto'; pop.style.transform = 'none';
            var ox = e.clientX - r.left, oy = e.clientY - r.top;
            var mv = function (ev) {
                pop.style.left = Math.max(0, Math.min(window.innerWidth - pop.offsetWidth, ev.clientX - ox)) + 'px';
                pop.style.top = Math.max(0, Math.min(window.innerHeight - 36, ev.clientY - oy)) + 'px';
            };
            var up = function () {
                document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
                if (!pop.classList.contains('min')) {
                    restore = { left: pop.style.left, top: pop.style.top, right: 'auto', bottom: '', transform: 'none' };
                    remember({ left: pop.style.left, top: pop.style.top });
                }
            };
            document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
        });
        document.addEventListener('keydown', onKey);
        return pop;
    }
    // empty the log: the lines, the counts and the "earlier lines not kept" note
    function clear() {
        buf = []; dropped = 0; warn = 0; error = 0;
        if (win) win.cleared();
    }
    // quiet: closing to reopen, so the remembered "open" stays as it is
    function close(quiet) {
        var stray = document.getElementById('mbu-logpop');
        if (win) { win.off(); win.el.remove(); win = null; if (!quiet) remember({ open: false }); }
        if (stray) stray.remove();   // another script's window: one log window at a time
    }
    var api = {
        info: function () { add('info', arguments); },
        warn: function () { add('warn', arguments); },
        err: function () { add('error', arguments); },
        error: function () { add('error', arguments); },
        ok: function () { add('ok', arguments); },
        debug: function () { add('debug', arguments); },
        add: function (sev) { add(sev, Array.prototype.slice.call(arguments, 1)); },
        open: open,
        close: function () { close(); },
        reopen: function () { if (state().open) open(); },
        isOpen: function () { return !!win; },
        markdown: markdown,
        copy: copy,
        clear: clear,
        lines: function () { return buf.map(line); },
        messages: function () { return buf.map(function (e) { return e.msg; }); },
        counts: function () { return { warn: warn, error: error }; },
    };
    mbuLog.active = api;   // the script's own log, for helpers that note things in it (mbuClaim)
    return api;
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
// Theme recognition. #564: "we don't have to conform to Stylus vars, we could
// probably use them as a recognition signal to enable our own dark theme."
//
// That is the right way round. Reading --background/--text and hoping every
// derived colour lands somewhere readable is guesswork that fails one token at a
// time; knowing WHICH theme we are in lets the token set say so outright, and
// lets us hand the browser the one thing CSS variables cannot express —
// color-scheme, which is what actually paints a checkbox dark instead of leaving
// a white (Firefox: black) box on a dark panel.
//
// The signal is the rendered page, not a particular userstyle's variable names:
// whatever painted the body, we measure its luminance. So this works for Stylus,
// for a browser extension, for MusicBrainz shipping its own dark mode one day,
// and for a user who just set --background by hand.
//
//   · an explicit --mbu-theme (light|dark) always wins — the escape hatch;
//   · otherwise the page background decides;
//   · re-checked when stylesheets arrive, because Stylus often lands after us.
function mbuThemeOf(bg) {
    var m = /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?/.exec(bg || '');
    if (!m) return null;
    if (m[4] !== undefined && +m[4] < 0.5) return null;      // transparent tells us nothing
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    var L = 0.2126 * f(+m[1]) + 0.7152 * f(+m[2]) + 0.0722 * f(+m[3]);
    return L < 0.35 ? 'dark' : 'light';
}
// #569 (chaban-mb) — write only when the value actually changes.
//
// The DOM does not do this for you. classList.add of a token already present,
// classList.toggle to the state it is already in, setAttribute with the value it
// already has: each one re-sets the attribute and dispatches a mutation record.
// Harmless once; these run from 2Hz heartbeats and from observers that react to
// each other, and the measured idle cost on the release editor was 66 records a
// second, of which 93% came from writes that changed nothing (see
// dev/ui/measure-569-idle-mutations.mjs).
//
// Semantically these are exact no-ops: they skip a write ONLY when the value is
// already the one being written, so nothing that reads the DOM afterwards can
// tell the difference. That is the whole reason they are safe to sprinkle around
// a 2Hz loop.
function mbuCls(el, token, on) {
    if (!el || !el.classList) return;
    if (el.classList.contains(token) !== !!on) el.classList.toggle(token, !!on);
}
function mbuAttr(el, name, value) {
    if (!el) return;
    if (value === null || value === undefined || value === false) {
        if (el.hasAttribute(name)) el.removeAttribute(name);
    } else if (el.getAttribute(name) !== String(value)) {
        el.setAttribute(name, String(value));
    }
}
// For IDL properties (disabled, title, textContent, style.display …). Reading
// them is cheap; writing them is not, and textContent in particular replaces
// every child node.
//
// ⚠ textContent is the one to think twice about: its getter concatenates the
// text of ALL descendants, so on an element with child ELEMENTS the comparison
// can match while the DOM shape is wrong, and the guard then skips a write that
// would have flattened it. Only use it where the target holds text and nothing
// else.
function mbuProp(obj, prop, value) {
    if (!obj) return;
    if (obj[prop] !== value) obj[prop] = value;
}

// #569: the one element mbuTheme resolves --background through. Looked up by id
// rather than kept in a variable, so the seven scripts of a bundle share ONE
// probe instead of adding seven, and so it heals itself if anything removes it.
// It lives in <body>: a permanent stray node under <html>, outside head and
// body, is the sort of thing another script's document scan trips over.
function mbuProbe() {
    var p = document.getElementById('mbu-theme-probe');
    if (p) return p;
    if (!document.body) return null;
    p = document.createElement('span');
    p.id = 'mbu-theme-probe';
    p.setAttribute('aria-hidden', 'true');
    p.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:1px;pointer-events:none;background:var(--background)';
    document.body.appendChild(p);
    return p;
}
function mbuTheme() {
    var root = document.documentElement;
    try {
        var cs = getComputedStyle(root);
        var forced = (cs.getPropertyValue('--mbu-theme') || '').trim();
        var t = (forced === 'dark' || forced === 'light') ? forced
            : (mbuThemeOf(getComputedStyle(document.body).backgroundColor)
                || mbuThemeOf(cs.backgroundColor)
                || mbuThemeOf(cs.getPropertyValue('--mbu-bg'))
                || 'light');
        if (root.getAttribute('data-mbu-theme') !== t) root.setAttribute('data-mbu-theme', t);

        // Should we adopt the userstyle's OWN shades, or use our own palette?
        // Only if its --background actually agrees with the theme we detected.
        // A userstyle can paint the page dark with ordinary rules and still leave
        // --background at a light value for its own purposes; taking that on
        // trust hands us a light surface under a correct dark theme, which is
        // indistinguishable from the bug it looks like. Measured, not assumed.
        var seed = null;
        var raw = (cs.getPropertyValue('--background') || '').trim();
        if (raw) {
            // Resolved through a real element, because --background may itself be
            // a var(), a named colour, or anything else CSS accepts.
            //
            // #569 (chaban-mb): this used to CREATE and REMOVE that element on
            // every call, as a direct child of <html>. mbuTheme re-runs whenever
            // the root or body class changes, Mammoth watches the whole document
            // for childList changes and reacts by toggling classes on <html>, and
            // those class changes wake mbuTheme again — a self-feeding loop,
            // measured at 12 root-node mutations a second on an idle page, which
            // is what makes DevTools blink.
            //
            // One element, created once and left in place, breaks it: the value
            // is still resolved LIVE on every call (a cached reading would freeze
            // the theme at whatever it was before Stylus injected, which is the
            // bug this whole function exists to avoid) but nothing is added to or
            // removed from the DOM to read it.
            var probe = mbuProbe();
            var got = null;
            if (probe) {
                got = mbuThemeOf(getComputedStyle(probe).backgroundColor);
            } else {
                // No <body> yet — document-start. Fall back to the transient
                // element for these first one or two calls; the idle loop this
                // avoids cannot exist before the page has a body anyway.
                var tmp = document.createElement('span');
                tmp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;background:var(--background)';
                document.documentElement.appendChild(tmp);
                got = mbuThemeOf(getComputedStyle(tmp).backgroundColor);
                tmp.remove();
            }
            if (got === t) seed = 'theme';
        }
        // guarded: setAttribute dispatches a mutation record even when the value
        // is unchanged, and this runs several times a second
        if (seed) { if (root.getAttribute('data-mbu-seed') !== seed) root.setAttribute('data-mbu-seed', seed); }
        else if (root.hasAttribute('data-mbu-seed')) root.removeAttribute('data-mbu-seed');
        return t;
    } catch (e) { return 'light'; }
}
// A document-start script runs before the document is parsed: documentElement can
// still be null, and <head> and <body> don't exist. Observing a null root threw, the
// catch below swallowed it, and nothing (the watches, the re-checks) was ever set up,
// so such a script never read the theme at all (#625). It starts on the parsed page.
function mbuThemeStart() { try {
    mbuTheme();
    // Stylus and friends inject after us often enough that a one-shot read is
    // wrong about half the time. Watch for stylesheets ARRIVING — head childList
    // plus the root's own attributes — and never the whole subtree: this runs on
    // the release editor, where a subtree observer calling getComputedStyle is a
    // layout thrash on every keystroke.
    var _mbuThemeT = 0;
    var _mbuThemeSoon = function () {
        clearTimeout(_mbuThemeT);
        _mbuThemeT = setTimeout(mbuTheme, 150);
    };
    var _mbuThemeObs = new MutationObserver(_mbuThemeSoon);
    _mbuThemeObs.observe(document.documentElement, { attributeFilter: ['style', 'class'] });
    // ⚠ #569: characterData, not just childList. Until the idle thrash was fixed
    // this function ran several times a second whether or not anything had
    // changed — Apollo re-added a body class at 2Hz, which woke this observer,
    // which is how a theme change was ever noticed. That accidental polling was
    // LOAD-BEARING: with the thrash gone and only head-childList watched, a
    // userstyle that REWRITES ITSELF (Stylus editing it live, or one switching
    // palette) adds and removes no nodes, so nothing woke us and the theme went
    // stale. Caught by verify-569-theme-still-tracks.mjs, which passes on the
    // pre-fix build and failed on the first version of this one.
    if (document.head) _mbuThemeObs.observe(document.head, { childList: true, subtree: true, characterData: true });
    if (document.body) _mbuThemeObs.observe(document.body, { attributeFilter: ['style', 'class'] });
    // …and the case that produces no DOM mutation at all: the OS flipping to dark
    // under a userstyle with a prefers-color-scheme query. Nothing above can see
    // that, and nothing did before either — it was simply never noticed while the
    // page was re-checking itself several times a second.
    try {
        var _mbuMq = matchMedia('(prefers-color-scheme: dark)');
        if (_mbuMq.addEventListener) _mbuMq.addEventListener('change', _mbuThemeSoon);
        else if (_mbuMq.addListener) _mbuMq.addListener(_mbuThemeSoon);
    } catch (e) {}
    setTimeout(mbuTheme, 400);
    setTimeout(mbuTheme, 2000);
} catch (e) { /* no observer, no theme switching — the light defaults still apply */ } }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mbuThemeStart, { once: true });
else mbuThemeStart();

try {
    var _mbuNs = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
    if (!_mbuNs.MBU) _mbuNs.MBU = {};
    if (!_mbuNs.MBU.theme) _mbuNs.MBU.theme = mbuTheme;
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
