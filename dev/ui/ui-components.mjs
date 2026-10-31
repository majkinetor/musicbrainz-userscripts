// Shared UI components for every userscript in this repo. #563

import { tipJs } from './tooltip.mjs';
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
    '.mbu-ov', '.mbu-ui', '#mbu-logpop', '.mbu-logemb', '.discogs-bar', '.discogs-review-panel-li',
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
    // An icon only, no frame or fill (maintainer, 2026-10-25): the tooltip says what it is.
    '.mbu-help{display:inline-grid;place-items:center;width:26px;height:26px;padding:0;border:0;border-radius:50%;background:none;',
    'color:var(--mbu-text-weak);text-decoration:none;line-height:1}.mbu-help svg{width:18px;height:18px;display:block}',
    '.mbu-help:hover{color:var(--mbu-accent-text,var(--mbu-accent));background:none;text-decoration:none}',
    // config headers are flex rows: the help link is the last thing on the line
    'h4>.mbu-help,.mbu-cfg-h>.mbu-help{margin-left:8px;flex:0 0 auto;font-weight:normal}',

    // Toast — one reused element, bottom-centre, fading. Duration and severity
    // are the contract; `at` moves it next to a click (Mammoth needs that for
    // its field-memory pin, and it was the only script doing it).
    // Above every modal (--mbu-z-tip): at --mbu-z-pop a toast fired from an open dialog was hidden behind it.
    '#mbu-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:var(--mbu-z-tip);',
    'background:var(--mbu-accent-deep);color:var(--mbu-text-on-accent);padding:10px 16px;border-radius:9px;',
    'font:13px/1.35 var(--mbu-font);box-shadow:var(--mbu-shadow-lg);opacity:0;transition:opacity .2s;',
    'pointer-events:none;max-width:80vw;text-align:center;white-space:pre-wrap}',
    '#mbu-toast.mbu-toast-on{opacity:1}',
    '#mbu-toast.mbu-toast-act{pointer-events:auto}',
    '#mbu-toast .mbu-toast-btn{width:auto;margin-left:10px;padding:2px 9px;border:1px solid currentColor;border-radius:5px;background:transparent;color:inherit;font:inherit;cursor:pointer}',
    '#mbu-toast .mbu-toast-btn:hover{background:rgba(255,255,255,.18)}',
    '#mbu-toast.mbu-toast-ok{background:var(--mbu-ok)}',
    '#mbu-toast.mbu-toast-warn{background:var(--mbu-warn)}',
    '#mbu-toast.mbu-toast-error{background:var(--mbu-error)}',

    // Config-window title bar — icon · name · version · [spacer] · Log · ? Help.
    // #563: those five live HERE and only here, never in a script main header.
    // Apollo's settings <h4> is the reference; the others were the same idea
    // spelled seven ways (an <h4>, an <h3>, two plain divs, and one inline-styled
    // block with an orange <h2> and no icon at all).
    '.mbu-cfg-drag .mbu-cfg-h{cursor:move;user-select:none}',   // mbuCfgDrag
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
    '.mbu-cfg-log{flex:0 0 auto;width:auto;font:400 12px var(--mbu-font);color:var(--mbu-accent-text);cursor:pointer;',
    'background:none;border:1px solid transparent;border-radius:var(--mbu-radius);padding:1px 8px;line-height:1.6}',
    '.mbu-cfg-log:hover{background:var(--mbu-bg-hover);border-color:var(--mbu-border)}',

    // Activity log — floating, draggable by its header, minimisable, with a
    // Copy that yields the Markdown <details> block for an issue. Art Station is
    // the reference the issue names; Apollo and Fusion had already grown the
    // identical structure under their own prefixes (tc-, as-, fs-), which is the
    // clearest possible argument for naming it once.
    '#mbu-logpop{position:fixed;top:74px;left:50%;transform:translateX(-50%);z-index:var(--mbu-z-modal);',
    'display:flex;flex-direction:column;width:min(860px,94vw);max-height:72vh;background:var(--mbu-bg);',
    'border:1px solid var(--mbu-border);border-radius:11px;box-shadow:var(--mbu-shadow-lg);',
    'font:13px var(--mbu-font);color:var(--mbu-text);overflow:hidden}',
    '.mbu-logpop-h{display:flex;align-items:center;gap:8px;padding:10px 13px;',
    'border-bottom:1px solid var(--mbu-border-soft);color:var(--mbu-accent-text);cursor:move;user-select:none}',
    '.mbu-logpop-sp{margin-left:auto}',
    '.mbu-logpop-hclear,.mbu-logpop-clear,.mbu-logpop-copy,.mbu-logpop-x,.mbu-logpop-min,.mbu-logpop-full{width:auto;font-size:12px;color:var(--mbu-accent-text);',
    'background:var(--mbu-bg-hover);border:1px solid var(--mbu-border);border-radius:5px;',
    'padding:2px 9px;cursor:pointer;font-family:inherit}',
    '.mbu-logpop-hclear:hover,.mbu-logpop-clear:hover,.mbu-logpop-copy:hover,.mbu-logpop-x:hover,.mbu-logpop-min:hover,.mbu-logpop-full:hover{background:var(--mbu-accent-soft)}',
    // minimised: just the header bar, so it can sit out of the way mid-run
    '#mbu-logpop.min .mbu-log-list,#mbu-logpop.min .mbu-log-f,#mbu-logpop.min .mbu-logpop-clear,#mbu-logpop.min .mbu-logpop-copy,#mbu-logpop.min .mbu-logpop-x,#mbu-logpop.min .mbu-logpop-full{display:none}',
    '#mbu-logpop.min{max-height:none;width:auto!important;height:auto!important}',
    // resized by its corner grip: the size is the user's, no cap
    '#mbu-logpop.sized{max-height:none}',
    '.mbu-logpop-grip{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;opacity:.6;',
    'background:linear-gradient(135deg,transparent 55%,var(--mbu-border-strong) 55%,var(--mbu-border-strong) 62%,transparent 62%,transparent 75%,var(--mbu-border-strong) 75%,var(--mbu-border-strong) 82%,transparent 82%)}',
    '.mbu-logpop-grip:hover{opacity:1}',
    '#mbu-logpop.min .mbu-logpop-grip,#mbu-logpop.full .mbu-logpop-grip{display:none}',
    // full screen: the whole viewport less a margin, whatever the window was
    '#mbu-logpop.full{top:12px!important;left:12px!important;right:12px!important;bottom:12px!important;',
    'width:auto!important;height:auto!important;max-height:none;transform:none!important}',
    '#mbu-logpop.full .mbu-logpop-h{cursor:default}',
    '#mbu-logpop.min .mbu-logpop-sp{display:none}',
    '.mbu-log-badge{color:var(--mbu-border-strong);font-size:11px}',
    // the viewer mounted in a script's own panel (#705): no window, it fills its host
    '.mbu-logemb{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--mbu-bg);font:13px var(--mbu-font);color:var(--mbu-text)}',
    '.mbu-logemb .mbu-logpop-h{cursor:default;padding:7px 10px}',
    '.mbu-logemb .mbu-logpop-h>.mbu-log-q{flex-basis:160px;margin-left:0}',
    '.mbu-logemb .mbu-logpop-h>.mbu-log-ses{flex-basis:240px}',
    // one row in either viewer: the title, counts and buttons never wrap inside
    // themselves; the filter and the session list give way first
    '.mbu-logpop-h{flex-wrap:nowrap}',
    '.mbu-logpop-h>*{flex-shrink:0;white-space:nowrap}',
    '.mbu-logpop-h>.mbu-log-q{flex-shrink:1;min-width:60px}',
    '.mbu-logpop-h>.mbu-log-ses{flex-shrink:1;min-width:90px}',
    '.mbu-logpop-h>.mbu-logpop-sp{flex:1 1 0;min-width:0}',
    // the session list (#705) and the past session it shows: read-only, so no Clear
    '.mbu-logpop .mbu-log-ses{flex:0 1 260px;min-width:120px;max-width:100%}',
    '.mbu-logpop-hclear:disabled{opacity:.5;cursor:default}',
    '.mbu-log-dbg{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--mbu-text);cursor:pointer;white-space:nowrap}',
    '.mbu-log-dbg input{margin:0}',
    '#mbu-logpop.min .mbu-log-dbg{display:none}',
    '.mbu-log-past .mbu-logpop-clear{display:none}',
    '#mbu-logpop.min .mbu-log-ses,#mbu-logpop.min .mbu-logpop-hclear{display:none}',
    // the text filter beside the counts: lines without the text are hidden
    '.mbu-logpop .mbu-log-q{flex:0 1 200px;min-width:80px;margin-left:6px;font:12px var(--mbu-font);padding:2px 8px;',
    'border:1px solid var(--mbu-border);border-radius:5px;cursor:text}',
    '#mbu-logpop.min .mbu-log-q{display:none}',
    '.mbu-logpop .mbu-log-li.mbu-log-nq{display:none}',
    '.mbu-log-list{flex:1 1 auto;overflow:auto;overscroll-behavior:contain;padding:9px 13px;',
    'display:flex;flex-direction:column;gap:3px}',
    '.mbu-log-li{display:flex;gap:9px;white-space:pre-wrap;word-break:break-word}',
    // a block kept as written (#705): a table, a dump. No scroller of its own: in the
    // category grid a scrolling cell is sized to one line; the list scrolls sideways instead
    '.mbu-log-pre .mbu-log-m{white-space:pre;font:12px/1.35 ui-monospace,Consolas,monospace;word-break:normal}',
    '.mbu-log-t{color:var(--mbu-text-weak);flex:0 0 auto;font-variant-numeric:tabular-nums}',
    // a line's category (#697): a quiet tag before the message
    '.mbu-log-c{color:var(--mbu-text-weak);flex:0 0 auto}',
    // with categories the list is a grid, so time, category and message each keep their column
    '.mbu-log-list:not(.mbu-log-cats) .mbu-log-c{display:none}',
    '.mbu-log-list.mbu-log-cats{display:grid;grid-template-columns:auto auto minmax(0,1fr);gap:3px 9px;align-content:start}',
    '.mbu-log-cats .mbu-log-li{display:contents}',
    '.mbu-log-cats .mbu-log-empty{grid-column:1/-1}',
    // the filter row: plain words, shown only when there is something to pick between
    '.mbu-log-f{display:flex;flex-wrap:wrap;align-items:center;gap:2px 4px;padding:5px 13px;',
    'border-bottom:1px solid var(--mbu-border-soft);font-size:11px}',
    '.mbu-log-f[hidden]{display:none}',
    '.mbu-log-fg{display:contents}',
    '.mbu-log-fs{width:1px;height:12px;background:var(--mbu-border);margin:0 6px}',
    '.mbu-logpop .mbu-log-fb{width:auto;font:inherit;color:var(--mbu-text-weak);background:none;border:1px solid transparent;',
    'border-radius:5px;padding:0 6px;line-height:1.6;cursor:pointer}',
    '.mbu-logpop .mbu-log-fb:hover{color:var(--mbu-text);border-color:var(--mbu-border)}',
    '.mbu-logpop .mbu-log-fb.on{color:var(--mbu-accent-text);background:var(--mbu-accent-soft);border-color:var(--mbu-border)}',
    // levels are words in their own colour; categories are tags, so the two never read as one list
    '.mbu-logpop .mbu-log-fb[data-sev=error]{color:var(--mbu-error)}',
    '.mbu-logpop .mbu-log-fb[data-sev=warn]{color:var(--mbu-warn)}',
    '.mbu-logpop .mbu-log-fb[data-sev=info]{color:var(--mbu-text-dim)}',
    '.mbu-logpop .mbu-log-fb[data-sev].on{background:var(--mbu-bg-hover);border-color:currentColor;font-weight:600}',
    '.mbu-logpop .mbu-log-fb[data-cat]{border-color:var(--mbu-border-soft);background:var(--mbu-bg-raised);border-radius:999px;padding:0 8px}',
    '.mbu-logpop .mbu-log-fb[data-cat].on{color:var(--mbu-accent-text);background:var(--mbu-accent-soft);border-color:var(--mbu-accent)}',
    '.mbu-log-m{flex:1 1 auto;color:var(--mbu-text-dim)}',
    '.mbu-logpop .mbu-log-m a{color:var(--mbu-accent-text)}',
    // severity, on the message only — the timestamp stays quiet
    '.mbu-log-ok .mbu-log-m{color:var(--mbu-ok)}',
    '.mbu-log-warn .mbu-log-m{color:var(--mbu-warn)}',
    '.mbu-log-error .mbu-log-m{color:var(--mbu-error)}',
    '.mbu-log-debug>*{opacity:.85}',
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
    '.mbu-ov-body{flex:1 1 auto;overflow:auto;scrollbar-gutter:stable;padding:14px 16px}',
    // one scrollbar look in every window: thin, a soft thumb on no track (Falcon's queue had it first);
    // :where keeps it at zero specificity, so a window's own scrollbar rule still wins
    ':where(' + ROOTS.join(',') + '),' + scoped('*') + '{scrollbar-width:thin;scrollbar-color:var(--mbu-border) transparent}',


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
    // Pill drop-down and − n + stepper, the settings' controls (mbuControls). A script's own rule for its
    // select or number field (an id and an element, often) would outrank a class, and these are adopted,
    // not defaults: :not(#mbu-0):not(#mbu-1) weighs two ids, so they win without !important.
    'select.mbu-select:not(#mbu-0):not(#mbu-1){-webkit-appearance:none;-moz-appearance:none;appearance:none;box-sizing:border-box;height:22px;max-width:100%;margin:0 2px;',
    'padding:0 26px 0 12px;border:1px solid var(--mbu-border);border-radius:20px;outline-offset:1px;background-color:transparent;',
    'background-image:linear-gradient(45deg,transparent 50%,var(--mbu-text-weak) 50%),linear-gradient(135deg,var(--mbu-text-weak) 50%,transparent 50%);',
    'background-position:calc(100% - 13px) 50%,calc(100% - 8px) 50%;background-size:5px 5px;background-repeat:no-repeat;',
    'color:var(--mbu-text);font:600 12px var(--mbu-font);line-height:20px;cursor:pointer;vertical-align:middle}',
    'select.mbu-select:not(#mbu-0):not(#mbu-1):hover{border-color:var(--mbu-accent)}',
    'select.mbu-select:not(#mbu-0):not(#mbu-1):disabled{opacity:.45;cursor:default;border-color:var(--mbu-border)}',
    'select.mbu-select:not(#mbu-0):not(#mbu-1) option{background:var(--mbu-bg);color:var(--mbu-text);font-weight:400}',
    '.mbu-step:not(#mbu-0):not(#mbu-1){display:inline-flex;align-items:center;box-sizing:border-box;height:22px;margin:0 2px;padding:0;',
    'border:1px solid var(--mbu-border);border-radius:20px;background:transparent;vertical-align:middle;white-space:nowrap;flex:0 0 auto}',
    '.mbu-step:not(#mbu-0):not(#mbu-1):hover,.mbu-step:not(#mbu-0):not(#mbu-1):focus-within{border-color:var(--mbu-accent)}',
    '.mbu-step:not(#mbu-0):not(#mbu-1)>button{all:unset;box-sizing:border-box;width:20px;height:20px;text-align:center;',
    'font:600 13px/20px var(--mbu-font);color:var(--mbu-text-weak);cursor:pointer;user-select:none}',
    '.mbu-step:not(#mbu-0):not(#mbu-1)>button:hover{color:var(--mbu-accent)}',
    '.mbu-step:not(#mbu-0):not(#mbu-1)>input{all:unset;box-sizing:content-box;min-width:2ch;height:20px;padding:0 1px;',
    'font:600 12px/20px var(--mbu-font);color:var(--mbu-text);text-align:center;-moz-appearance:textfield;appearance:textfield;cursor:text}',
    '.mbu-step:not(#mbu-0):not(#mbu-1)>input::-webkit-inner-spin-button,.mbu-step:not(#mbu-0):not(#mbu-1)>input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}',
    '.mbu-step:not(#mbu-0):not(#mbu-1):has(>input:disabled){opacity:.45;border-color:var(--mbu-border)}',
    '.mbu-step:not(#mbu-0):not(#mbu-1):has(>input:disabled)>button{cursor:default;color:var(--mbu-text-weak)}',
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
var MBU_HELP_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.6v.6"/><path d="M12 17h.01"/></svg>';
// the sort-name guess, A over Z with a down arrow, for every button that guesses a sort name
var MBU_SORT_ICON = '<svg viewBox="0 0 28 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3v18M1 17l4 4 4-4"/><path d="M13 11l3-8 3 8M14.1 8h3.8M13 14h6l-6 7h6"/></svg>';
// the edit pencil, for every button that opens an editor (#849)
var MBU_EDIT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
function mbuHelpHtml(name, label) {
    return '<a class="mbu-help" href="' + mbuHelpHref(name) + '" target="_blank" rel="noopener" aria-label="Help"'
        + ' data-tip="Help: open the README in a new tab">' + (label || MBU_HELP_ICON) + '</a>';
}
function mbuHelpEl(name, label) {
    var a = document.createElement('a');
    a.className = 'mbu-help';
    a.href = mbuHelpHref(name);
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', 'Help');
    a.dataset.tip = 'Help: open the README in a new tab';
    if (label) a.textContent = label; else a.innerHTML = MBU_HELP_ICON;
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
// On MusicBrainz it ends with the interface language, which changes what a script reads
// off the page: "· MusicBrainz in de".
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
    try {
        if (/(^|\\.)musicbrainz\\.(org|eu)$/i.test(location.hostname)) {
            // <html lang>, or MB's lang cookie when the page isn't parsed yet (document-start)
            var lang = (document.documentElement && document.documentElement.lang) || ((document.cookie.match(/(?:^|;\\s*)lang=([^;]+)/) || [])[1]) || 'en';
            line += ' · MusicBrainz in ' + lang;
        }
    } catch (e) { /* no document */ }
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
// A settings window moves by its .mbu-cfg-h header (#847). Wherever the window
// sits (fixed, absolute in a script's modal, or static in an overlay's flex), the
// first drag pins it where it is, then follows the pointer, kept on screen.
//   mbuCfgDrag(panel)
function mbuCfgDrag(el) {
    el.classList.add('mbu-cfg-drag');
    el.addEventListener('pointerdown', function (e) {
        var h = e.target.closest('.mbu-cfg-h');
        if (e.button || !h || !el.contains(h) || e.target.closest('button,a,input,select,label')) return;
        var b = el.getBoundingClientRect();
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
        el.style.transform = 'none'; el.style.right = 'auto'; el.style.bottom = 'auto';
        var cs = getComputedStyle(el), a = el.getBoundingClientRect();
        var l0 = (parseFloat(cs.left) || 0) + b.left - a.left, t0 = (parseFloat(cs.top) || 0) + b.top - a.top;
        el.style.left = l0 + 'px'; el.style.top = t0 + 'px';
        var x0 = e.clientX, y0 = e.clientY;
        var mv = function (ev) {
            var dx = Math.max(-b.left, Math.min(window.innerWidth - 80 - b.left, ev.clientX - x0));
            var dy = Math.max(-b.top, Math.min(window.innerHeight - 40 - b.top, ev.clientY - y0));
            el.style.left = (l0 + dx) + 'px'; el.style.top = (t0 + dy) + 'px';
        };
        var up = function () { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); e.preventDefault();
    });
}

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
    if (o.version) html += '<span class="mbu-cfg-ver" data-tip="The installed version">v' + esc(o.version) + '</span>';
    html += '<span class="mbu-cfg-sp"></span>';
    if (o.log) {
        html += '<button type="button" class="mbu-cfg-log' + (o.logClass ? ' ' + esc(o.logClass) : '') + '"'
            + (o.logId ? ' id="' + esc(o.logId) + '"' : '')
            + ' data-tip="Open the activity log">Log</button>';
    }
    html += mbuHelpHtml(o.script);
    return html + '</div>';
}

// Settings controls: in root, every <select> becomes the pill drop-down and every number field the
// − n + stepper. The field stays the script's own (its value, min, max, step and listeners): − and +
// step it within them and fire input and change, as typing would. Call it once a window's markup is in;
// again after a re-render does no harm. Returns root.
function mbuControls(root) {
    if (!root || !root.querySelectorAll) return root;
    Array.prototype.forEach.call(root.querySelectorAll('select'), function (s) { s.classList.add('mbu-select'); });
    Array.prototype.forEach.call(root.querySelectorAll('input[type=number]'), function (inp) {
        var p = inp.parentNode;
        if (!p || (p.classList && p.classList.contains('mbu-step'))) return;
        var wrap = document.createElement('span');
        wrap.className = 'mbu-step';
        p.insertBefore(wrap, inp);
        var btn = function (down) {
            var b = document.createElement('button');
            b.type = 'button';
            b.tabIndex = -1;
            b.textContent = down ? '\u2212' : '+';
            b.setAttribute('aria-label', down ? 'Less' : 'More');
            b.addEventListener('click', function (e) {
                e.preventDefault();
                if (inp.disabled || inp.readOnly) return;
                var was = inp.value;
                try { if (down) inp.stepDown(); else inp.stepUp(); } catch (x) { return; }
                if (inp.value === was) return;
                inp.dispatchEvent(new Event('input', { bubbles: true }));
                inp.dispatchEvent(new Event('change', { bubbles: true }));
            });
            return b;
        };
        wrap.appendChild(btn(true));
        wrap.appendChild(inp);
        wrap.appendChild(btn(false));
        // as wide as its longest value; a width the script set for the old field would cut it
        inp.style.width = Math.max(2, String(inp.max || inp.value || '').length) + 0.5 + 'ch';
    });
    return root;
}

// Test hooks. A script puts its test hook on window only when the test harness has
// marked the page (dev/test/harness.mjs sets window.__mbuTest before any script runs):
//   if (mbuTestHooks()) window.__fooTest = { … };
// On a user's page the hooks are never built. (#623)
function mbuTestHooks() {
    try { return typeof window !== 'undefined' && window.__mbuTest === true; } catch (e) { return false; }
}

// Shared settings: the few that belong to all the scripts at once, not to one (the corner
// launchers' layout). GM storage is private to each script, so these live in the page's
// localStorage on MusicBrainz's origin, as JSON under 'mbu.<key>'; every script, bundled or
// standalone, reads the same value. One argument reads (undefined when unset or blocked), two
// write, and null removes. Per-origin: musicbrainz.org, beta and test each keep their own.
// Every key is listed in DEVELOP.md → Shared storage.
function mbuShared(key, value) {
    var k = 'mbu.' + key;
    try {
        if (arguments.length < 2) { var v = localStorage.getItem(k); return v == null ? undefined : JSON.parse(v); }
        if (value == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(value));
    } catch (e) { /* storage blocked */ }
    return value;
}

// Corner slots (#468). Every floating launcher (Apollo Editor, Art Station, Falcon,
// Fusion, Scribe) tags its element with data-mb-corner (which screen corner: 'br',
// 'bl', 'tr', 'tl') and data-mb-corner-order (lower sits closer to the corner), and
// calls mbRestackCorner(corner) right after it shows, hides, creates or removes it.
// That recomputes every element in the corner, whichever script owns it and
// whatever order they loaded in, so two launchers never land on the same pixel.
// Orders in use, all bottom-right: Apollo and Art Station 10 (never on the same page), Scribe 15
// (above Apollo on the edit page), Falcon 20, Fusion 30, Mission Control 40. Scribe is not on the shared block and keeps a copy of this.
// The stack is a column; the shared setting cornerFlow = 'row' (mbuShared, set from String
// Theory's menu) lines it up along the bottom/top edge instead, the lowest order still nearest the corner.
// The shared setting cornerSide = 'left' (also from the menu) mirrors every corner across the screen: a
// launcher tagged 'br' sits bottom-left. Its other side is set to auto, so a CSS left/right can't stretch it.
// On a phone MusicBrainz's page is wider than the screen, so the browser widens the layout
// viewport, which position:fixed measures from, to the page: the corner was off screen, a scroll
// right and down away. Each edge is offset by the gap between it and the visual viewport (what is
// on screen), kept up as that scrolls and resizes; on a desktop the gap is 0.
//
// The dock (#847): while the page sets data-mbu-dock on <html> (Event Horizon, while it shows),
// the bottom-right launchers fold behind one String Theory button. A click unrolls them, each
// with its name (data-mb-corner-label) beside it. data-mb-corner-dock="no" keeps a launcher out
// of the dock (Event Horizon's own switch); "hide" hides it while docked (Art Station and Apollo,
// whose pages Event Horizon replaces). data-mb-corner-paths, a regular expression, names the paths a
// launcher belongs on: Event Horizon moves to another page without loading it, and the dock hides
// a launcher that came along to a page its script doesn't run on.
var MBU_DOCK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"> <path d="M64 10 L66.4 10.2 L68.7 10.6 L70.9 11.4 L73.1 12.4 L75.2 13.7 L77.1 15.2 L78.8 17 L80.4 18.9 L81.8 21 L83.1 23.1 L84.1 25.4 L85 27.6 L85.7 29.9 L86.3 32.1 L86.8 34.3 L87.1 36.4 L87.4 38.4 L87.7 40.3 L87.9 42.1 L88.2 43.7 L88.5 45.2 L88.9 46.6 L89.4 47.8 L90 49 L90.7 50.1 L91.6 51.1 L92.6 52.2 L93.7 53.2 L95 54.2 L96.4 55.3 L97.9 56.5 L99.5 57.7 L101.1 59.1 L102.7 60.6 L104.4 62.2 L106 64 L107.5 65.9 L108.9 67.9 L110.2 70.1 L111.3 72.3 L112.1 74.7 L112.8 77.1 L113.1 79.5 L113.2 81.9 L113 84.3 L112.6 86.6 L111.8 88.9 L110.8 91 L109.5 93 L107.9 94.7 L106.1 96.3 L104.1 97.7 L102 98.8 L99.7 99.7 L97.3 100.4 L94.9 100.8 L92.4 101 L89.9 100.9 L87.4 100.7 L85 100.4 L82.7 99.9 L80.4 99.3 L78.3 98.6 L76.3 97.8 L74.4 97.1 L72.7 96.4 L71 95.7 L69.5 95.1 L68 94.6 L66.7 94.3 L65.3 94.1 L64 94 L62.7 94.1 L61.3 94.3 L60 94.6 L58.5 95.1 L57 95.7 L55.3 96.4 L53.6 97.1 L51.7 97.8 L49.7 98.6 L47.6 99.3 L45.3 99.9 L43 100.4 L40.6 100.7 L38.1 100.9 L35.6 101 L33.1 100.8 L30.7 100.4 L28.3 99.7 L26 98.8 L23.9 97.7 L21.9 96.3 L20.1 94.7 L18.5 93 L17.2 91 L16.2 88.9 L15.4 86.6 L15 84.3 L14.8 81.9 L14.9 79.5 L15.2 77.1 L15.9 74.7 L16.7 72.3 L17.8 70.1 L19.1 67.9 L20.5 65.9 L22 64 L23.6 62.2 L25.3 60.6 L26.9 59.1 L28.5 57.7 L30.1 56.5 L31.6 55.3 L33 54.2 L34.3 53.2 L35.4 52.2 L36.4 51.1 L37.3 50.1 L38 49 L38.6 47.8 L39.1 46.6 L39.5 45.2 L39.8 43.7 L40.1 42.1 L40.3 40.3 L40.6 38.4 L40.9 36.4 L41.2 34.3 L41.7 32.1 L42.3 29.9 L43 27.6 L43.9 25.4 L44.9 23.1 L46.2 21 L47.6 18.9 L49.2 17 L50.9 15.2 L52.8 13.7 L54.9 12.4 L57.1 11.4 L59.3 10.6 L61.6 10.2Z" fill="none" stroke="#9c86ea" stroke-width="10" stroke-linejoin="round"/> <path d="M64 34 L65.3 33.9 L66.7 33.7 L68 33.4 L69.5 32.9 L71 32.3 L72.7 31.6 L74.4 30.9 L76.3 30.2 L78.3 29.4 L80.4 28.7 L82.7 28.1 L85 27.6 L87.4 27.3 L89.9 27.1 L92.4 27 L94.9 27.2 L97.3 27.6 L99.7 28.3 L102 29.2 L104.1 30.3 L106.1 31.7 L107.9 33.3 L109.5 35 L110.8 37 L111.8 39.1 L112.6 41.4 L113 43.7 L113.2 46.1 L113.1 48.5 L112.8 50.9 L112.1 53.3 L111.3 55.7 L110.2 57.9 L108.9 60.1 L107.5 62.1 L106 64 L104.4 65.8 L102.7 67.4 L101.1 68.9 L99.5 70.3 L97.9 71.5 L96.4 72.7 L95 73.8 L93.7 74.8 L92.6 75.8 L91.6 76.9 L90.7 77.9 L90 79 L89.4 80.2 L88.9 81.4 L88.5 82.8 L88.2 84.3 L87.9 85.9 L87.7 87.7 L87.4 89.6 L87.1 91.6 L86.8 93.7 L86.3 95.9 L85.7 98.1 L85 100.4 L84.1 102.6 L83.1 104.9 L81.8 107 L80.4 109.1 L78.8 111 L77.1 112.8 L75.2 114.3 L73.1 115.6 L70.9 116.6 L68.7 117.4 L66.4 117.8 L64 118 L61.6 117.8 L59.3 117.4 L57.1 116.6 L54.9 115.6 L52.8 114.3 L50.9 112.8 L49.2 111 L47.6 109.1 L46.2 107 L44.9 104.9 L43.9 102.6 L43 100.4 L42.3 98.1 L41.7 95.9 L41.2 93.7 L40.9 91.6 L40.6 89.6 L40.3 87.7 L40.1 85.9 L39.8 84.3 L39.5 82.8 L39.1 81.4 L38.6 80.2 L38 79 L37.3 77.9 L36.4 76.9 L35.4 75.8 L34.3 74.8 L33 73.8 L31.6 72.7 L30.1 71.5 L28.5 70.3 L26.9 68.9 L25.3 67.4 L23.6 65.8 L22 64 L20.5 62.1 L19.1 60.1 L17.8 57.9 L16.7 55.7 L15.9 53.3 L15.2 50.9 L14.9 48.5 L14.8 46.1 L15 43.7 L15.4 41.4 L16.2 39.1 L17.2 37 L18.5 35 L20.1 33.3 L21.9 31.7 L23.9 30.3 L26 29.2 L28.3 28.3 L30.7 27.6 L33.1 27.2 L35.6 27 L38.1 27.1 L40.6 27.3 L43 27.6 L45.3 28.1 L47.6 28.7 L49.7 29.4 L51.7 30.2 L53.6 30.9 L55.3 31.6 L57 32.3 L58.5 32.9 L60 33.4 L61.3 33.7 L62.7 33.9Z" fill="none" stroke="#ffffff" stroke-width="20" stroke-linejoin="round"/> <path d="M64 34 L65.3 33.9 L66.7 33.7 L68 33.4 L69.5 32.9 L71 32.3 L72.7 31.6 L74.4 30.9 L76.3 30.2 L78.3 29.4 L80.4 28.7 L82.7 28.1 L85 27.6 L87.4 27.3 L89.9 27.1 L92.4 27 L94.9 27.2 L97.3 27.6 L99.7 28.3 L102 29.2 L104.1 30.3 L106.1 31.7 L107.9 33.3 L109.5 35 L110.8 37 L111.8 39.1 L112.6 41.4 L113 43.7 L113.2 46.1 L113.1 48.5 L112.8 50.9 L112.1 53.3 L111.3 55.7 L110.2 57.9 L108.9 60.1 L107.5 62.1 L106 64 L104.4 65.8 L102.7 67.4 L101.1 68.9 L99.5 70.3 L97.9 71.5 L96.4 72.7 L95 73.8 L93.7 74.8 L92.6 75.8 L91.6 76.9 L90.7 77.9 L90 79 L89.4 80.2 L88.9 81.4 L88.5 82.8 L88.2 84.3 L87.9 85.9 L87.7 87.7 L87.4 89.6 L87.1 91.6 L86.8 93.7 L86.3 95.9 L85.7 98.1 L85 100.4 L84.1 102.6 L83.1 104.9 L81.8 107 L80.4 109.1 L78.8 111 L77.1 112.8 L75.2 114.3 L73.1 115.6 L70.9 116.6 L68.7 117.4 L66.4 117.8 L64 118 L61.6 117.8 L59.3 117.4 L57.1 116.6 L54.9 115.6 L52.8 114.3 L50.9 112.8 L49.2 111 L47.6 109.1 L46.2 107 L44.9 104.9 L43.9 102.6 L43 100.4 L42.3 98.1 L41.7 95.9 L41.2 93.7 L40.9 91.6 L40.6 89.6 L40.3 87.7 L40.1 85.9 L39.8 84.3 L39.5 82.8 L39.1 81.4 L38.6 80.2 L38 79 L37.3 77.9 L36.4 76.9 L35.4 75.8 L34.3 74.8 L33 73.8 L31.6 72.7 L30.1 71.5 L28.5 70.3 L26.9 68.9 L25.3 67.4 L23.6 65.8 L22 64 L20.5 62.1 L19.1 60.1 L17.8 57.9 L16.7 55.7 L15.9 53.3 L15.2 50.9 L14.9 48.5 L14.8 46.1 L15 43.7 L15.4 41.4 L16.2 39.1 L17.2 37 L18.5 35 L20.1 33.3 L21.9 31.7 L23.9 30.3 L26 29.2 L28.3 28.3 L30.7 27.6 L33.1 27.2 L35.6 27 L38.1 27.1 L40.6 27.3 L43 27.6 L45.3 28.1 L47.6 28.7 L49.7 29.4 L51.7 30.2 L53.6 30.9 L55.3 31.6 L57 32.3 L58.5 32.9 L60 33.4 L61.3 33.7 L62.7 33.9Z" fill="none" stroke="#6c47e0" stroke-width="13" stroke-linejoin="round"/> </svg>';   // String Theory's icon.svg
function mbuDock() {
    var root = document.documentElement, on = root.hasAttribute('data-mbu-dock');
    var btn = document.getElementById('mbu-dock');
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-mb-corner="br"]'))
        .filter(function (el) { return el.id !== 'mbu-dock' && el.dataset.mbCornerDock !== 'no'; });
    if (!document.getElementById('mbu-dock-css')) {
        var css = document.createElement('style'); css.id = 'mbu-dock-css';
        css.textContent = '[data-mbu-docked]{z-index:2147482990!important}[data-mbu-docked=hide],[data-mbu-docked=off],:root:not([data-mbu-dock]) [data-mb-corner-dock=only]{display:none!important}'
            + '.mbu-dock-item{position:fixed;z-index:2147482990;width:40px;height:40px;box-sizing:border-box;border:0;border-radius:50%;padding:3px;background:none;box-shadow:none;cursor:pointer;opacity:.85;transition:transform .12s,opacity .12s}'
            + '.mbu-dock-item:hover{opacity:1;transform:scale(1.08)}.mbu-dock-item img{width:34px;height:34px;display:block;pointer-events:none}'
            + '.mbu-dock-win{position:fixed;z-index:2147482995;right:62px;bottom:6px;width:max-content;max-width:calc(100vw - 90px);max-height:75vh;overflow:auto;box-sizing:border-box;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.35)}'
            + '.mbu-dock-win>*{margin:0!important}:root[data-mbu-flow=row] .mbu-dock-win{right:6px;bottom:60px}:root[data-mbu-side=left] .mbu-dock-win{right:auto;left:62px}:root[data-mbu-side=left][data-mbu-flow=row] .mbu-dock-win{left:6px}'
            + '#mbu-dock{position:fixed;z-index:2147482991;width:40px;height:40px;border-radius:50%;border:0;padding:0;cursor:pointer;background:none;box-shadow:none;opacity:.85;transition:transform .12s,opacity .12s}'
            + '#mbu-dock svg{width:34px;height:34px;display:block;margin:auto;pointer-events:none}'
            + '#mbu-dock:hover{opacity:1;transform:scale(1.08)}:root[data-mbu-dock-open] #mbu-dock{opacity:1}'
            + '#mbu-dock:focus-visible{outline:2px solid #ba478f;outline-offset:2px}'
            + '#mbu-dock b{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border:1.5px solid #e05aa5;border-radius:9px;background:#fde6f2;color:#c93d8c;font:700 11px/15px system-ui,sans-serif;text-align:center}'
            // no names, only a short state (a count) as a badge on the entry's top-right corner
            // No background, and no dark userstyle's inverting filter on it (kellnerd's inverts every button)
            + '.mbu-dock-item,#mbu-dock{filter:none!important}'
            // folded, an entry with something to do peeks beside the button, smaller
            + '[data-mbu-docked=peek]{transform:scale(.8)}[data-mbu-docked=peek]:hover{transform:scale(.9)}'
            + ':is([data-mbu-docked=show],[data-mbu-docked=peek])[data-mb-corner-status]::after{content:attr(data-mb-corner-status);position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border:1.5px solid #e05aa5;border-radius:9px;background:#fde6f2;color:#c93d8c;font:700 11px/15px system-ui,sans-serif;text-align:center;white-space:nowrap;text-shadow:none;-webkit-font-smoothing:antialiased;pointer-events:none}'
            + ':is([data-mbu-docked=show],[data-mbu-docked=peek]):hover::after{opacity:1}'
            + ':is([data-mbu-docked=show],[data-mbu-docked=peek])[data-mb-corner-status^="\u2713"]::after{content:"";top:0;right:0;min-width:0;width:10px;height:10px;padding:0;border:2px solid #fff;border-radius:50%;background:#4cbf7a}'   // all done: a quiet dot, so a count beside it stands out
            + ':is([data-mbu-docked=show],[data-mbu-docked=peek])[data-mb-corner-status^="0,"]:not([data-mb-corner-status*="/"])::after{border:1.5px dashed #999;background:#f0f0f0;color:#888}'   // "0,3": nothing to do, only held back
            + ':is([data-mbu-docked=show],[data-mbu-docked=peek])[data-mbu-busy]::after{background:#f3eff7;border-color:#d6cde2;color:#9a8fae;letter-spacing:1px;animation:mbu-dock-fade 1.2s ease-in-out infinite}'
            + '@keyframes mbu-dock-fade{50%{opacity:.25}}'
            // nothing counted yet: three small dots lighting in turn, no badge
            + ':is([data-mbu-docked=show],[data-mbu-docked=peek])[data-mbu-busy][data-mb-corner-status="···"]::after{content:none}'
            + '.mbu-dock-dots{display:none;position:absolute;top:0;right:-6px;gap:3px;pointer-events:none}:is([data-mbu-docked=show],[data-mbu-docked=peek])[data-mbu-busy][data-mb-corner-status="···"] .mbu-dock-dots{display:flex}'
            + '#mbu-dock[data-mbu-busy] .mbu-dock-dots{display:flex;top:-4px;right:auto;left:-5px}'
            + '.mbu-dock-dots i{width:5px;height:5px;border-radius:50%;background:#e05aa5;animation:mbu-dock-dot 1.2s ease-in-out infinite}.mbu-dock-dots i:nth-child(2){animation-delay:.2s}.mbu-dock-dots i:nth-child(3){animation-delay:.4s}'
            + '@keyframes mbu-dock-dot{0%,80%,100%{opacity:.25}40%{opacity:1}}'
            + '@media (prefers-reduced-motion:reduce){[data-mbu-busy]::after,.mbu-dock-dots i{animation:none!important}}';
        root.appendChild(css);
    }
    if (!on) {
        els.forEach(function (el) { el.removeAttribute('data-mbu-docked'); });
        if (btn) btn.remove();
        return;
    }
    if (!btn) {
        btn = document.createElement('button'); btn.type = 'button'; btn.id = 'mbu-dock';
        btn.setAttribute('aria-label', 'String Theory');
        btn.dataset.mbCorner = 'br'; btn.dataset.mbCornerOrder = '-1';   // nearest the corner
        btn.onclick = function () {
            // unrolled by hovering: the click keeps it open
            var open = root.hasAttribute('data-mbu-dock-hover') || !root.hasAttribute('data-mbu-dock-open');
            root.removeAttribute('data-mbu-dock-hover');
            root.toggleAttribute('data-mbu-dock-open', open);
            mbuShared('dockOpen', open || null);   // remembered for the next page
            mbRestackCorner('br');
        };
        // hovering the folded button unrolls the dock until the pointer leaves it, not remembered
        var leaveT = 0;
        var inDock = function (e) {
            if (e.target && e.target.closest && e.target.closest('#mbu-dock,[data-mbu-docked=show],.mbu-dock-win,#mbu-tip')) return true;
            var boxes = Array.prototype.slice.call(document.querySelectorAll('#mbu-dock,[data-mbu-docked=show]'))
                .map(function (el) { return el.getBoundingClientRect(); }).filter(function (r) { return r.width && r.height; });
            if (!boxes.length) return false;
            return e.clientX >= Math.min.apply(null, boxes.map(function (r) { return r.left; }))
                && e.clientX <= Math.max.apply(null, boxes.map(function (r) { return r.right; }))
                && e.clientY >= Math.min.apply(null, boxes.map(function (r) { return r.top; }))
                && e.clientY <= Math.max.apply(null, boxes.map(function (r) { return r.bottom; }));
        };
        btn.addEventListener('mouseenter', function () {
            clearTimeout(leaveT);
            if (root.hasAttribute('data-mbu-dock-open')) return;
            root.setAttribute('data-mbu-dock-hover', ''); root.setAttribute('data-mbu-dock-open', '');
            mbRestackCorner('br');
        });
        document.addEventListener('mousemove', function (e) {
            if (!root.hasAttribute('data-mbu-dock-hover')) return;
            clearTimeout(leaveT);
            if (inDock(e)) return;
            leaveT = setTimeout(function () {
                if (!root.hasAttribute('data-mbu-dock-hover')) return;
                root.removeAttribute('data-mbu-dock-hover'); root.removeAttribute('data-mbu-dock-open');
                mbRestackCorner('br');
            }, 400);
        }, true);
        root.appendChild(btn);   // outside the body, which Event Horizon swaps
        root.toggleAttribute('data-mbu-dock-open', !!mbuShared('dockOpen'));
    }
    var open = root.hasAttribute('data-mbu-dock-open'), n = 0, busy = false;
    if (mbuShared('cornerFlow') === 'row') root.setAttribute('data-mbu-flow', 'row'); else root.removeAttribute('data-mbu-flow');
    if (mbuShared('cornerSide') === 'left') root.setAttribute('data-mbu-side', 'left'); else root.removeAttribute('data-mbu-side');
    els.forEach(function (el) {
        if (el.dataset.mbCornerDock === 'hide' || (el.dataset.mbCornerPaths && !new RegExp(el.dataset.mbCornerPaths).test(location.pathname))) { el.setAttribute('data-mbu-docked', 'off'); return; }
        var was = el.getAttribute('data-mbu-docked');
        el.removeAttribute('data-mbu-docked');   // measured as its script left it
        var shown = getComputedStyle(el).display !== 'none';
        if (shown) { n++; if (el.hasAttribute('data-mbu-busy')) busy = true; }
        el.setAttribute('data-mbu-docked', !shown ? 'hide' : open ? 'show' : /^[+]?[1-9]/.test(el.dataset.mbCornerStatus || '') ? 'peek' : 'hide');
        // fades in only when it starts peeking: this runs on every restack, so a CSS animation would replay
        if (was !== 'peek' && el.getAttribute('data-mbu-docked') === 'peek' && el.animate) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: 'ease-out' });
    });
    btn.toggleAttribute('data-mbu-busy', busy);
    btn.innerHTML = MBU_DOCK_ICON + (n ? '<b>' + n + '</b>' : '') + '<span class="mbu-dock-dots"><i></i><i></i><i></i></span>';
}
// A script's entry that lives in the dock only (#847): for a script whose own controls sit in
// MusicBrainz's page, which Event Horizon replaces. o: id, label, icon (an image URL), order,
// paths (as data-mb-corner-paths), click. Outside the dock it is never shown. Returns the button,
// with .status(text) to show a short state (a count) beside it.
function mbuDockItem(o) {
    var b = document.getElementById(o.id);
    if (!b) {
        b = document.createElement('button'); b.type = 'button'; b.id = o.id; b.className = 'mbu-dock-item';
        b.dataset.mbCorner = 'br'; b.dataset.mbCornerOrder = String(o.order || 60); b.dataset.mbCornerDock = 'only';
        if (o.paths) b.dataset.mbCornerPaths = o.paths;
        var img = document.createElement('img'); img.src = o.icon; img.alt = ''; b.appendChild(img);
        var dots = document.createElement('span'); dots.className = 'mbu-dock-dots'; dots.innerHTML = '<i></i><i></i><i></i>'; b.appendChild(dots);   // while nothing is counted yet
        b.onclick = o.click;
        document.documentElement.appendChild(b);   // outside the body, which Event Horizon swaps
    }
    b.dataset.mbCornerLabel = o.label;
    // .status(t): the count beside it; .busy(on): while it works, a faint "···" where the count goes,
    // or the count so far, fading; .card(fn): a hover card, fn() → its HTML (mbuTipCard)
    var show = function () { var t = b.mbuSt || (b.hasAttribute('data-mbu-busy') ? '\u00b7\u00b7\u00b7' : ''); if (t) b.dataset.mbCornerStatus = t; else delete b.dataset.mbCornerStatus;
        var r = document.documentElement; if (r.hasAttribute('data-mbu-dock') && b.isConnected) mbRestackCorner('br'); };   // update the dock's loading state and any peek
    b.status = function (t) { b.mbuSt = t || ''; show(); };
    b.busy = function (on) { if (on) b.dataset.mbuBusy = ''; else delete b.dataset.mbuBusy; show(); };
    b.card = function (fn) { if (typeof mbuTip === 'function') mbuTip(b, fn || null, { card: true }); };
    // a bigger icon gets its size, whole pixels, not a transform: inside a folded entry's scale(.8) a second one
    // drew seams through the badge in Chrome
    if (o.scale) { var px = Math.round(17 * o.scale) * 2, m = (34 - px) / 2 + 'px'; Object.assign(b.querySelector('img').style, { width: px + 'px', height: px + 'px', maxWidth: 'none', margin: m }); }
    b.status('');
    mbRestackCorner('br');
    return b;
}
function mbRestackCorner(corner) {
    if (corner === 'br') mbuDock();
    var bottom = corner[0] === 'b', right = (corner[1] === 'r') !== (mbuShared('cornerSide') === 'left');
    var row = mbuShared('cornerFlow') === 'row';
    var vv = window.visualViewport, gapX = 0, gapY = 0;
    if (vv) {
        gapX = Math.max(0, right ? document.documentElement.clientWidth - vv.offsetLeft - vv.width : vv.offsetLeft);   // clientWidth, not innerWidth: a fixed element already sits inside the scrollbar
        gapY = Math.max(0, bottom ? window.innerHeight - vv.offsetTop - vv.height : vv.offsetTop);
        var root = document.documentElement;
        if (!root.hasAttribute('data-mb-corner-vv')) {   // one listener for every script's copy
            root.setAttribute('data-mb-corner-vv', '');
            var queued = false;
            var again = function () {
                if (queued) return;
                queued = true;
                requestAnimationFrame(function () { queued = false; ['br', 'bl', 'tr', 'tl'].forEach(function (c) { if (document.querySelector('[data-mb-corner="' + c + '"]')) mbRestackCorner(c); }); });
            };
            vv.addEventListener('resize', again);
            vv.addEventListener('scroll', again);
            // the layout viewport can change alone, with no event: a full-screen view pins the page's body
            // (780px → the screen's width); the body's size is what moves then
            window.addEventListener('resize', again);
            if (window.ResizeObserver && document.body) new window.ResizeObserver(again).observe(document.body);
        }
    }
    var edge = document.documentElement.hasAttribute('data-mbu-dock') ? 6 : 14;   // docked (Event Horizon), nearer the edge: the page keeps a column clear for them
    var peeks = [];
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-mb-corner="' + corner + '"]'))
        // offsetParent is always null for position:fixed, so it can't tell visibility here
        .filter(function (el) { return !el.hidden && getComputedStyle(el).display !== 'none'; })
        .filter(function (el) { if (el.getAttribute('data-mbu-docked') !== 'peek') return true; peeks.push(el); return false; })
        .sort(function (a, b) { return (Number(a.dataset.mbCornerOrder) || 0) - (Number(b.dataset.mbCornerOrder) || 0); });
    var pos = edge;
    els.forEach(function (el) {
        el.style[bottom ? 'bottom' : 'top'] = (gapY + (row ? edge : pos)) + 'px';
        el.style[right ? 'right' : 'left'] = (gapX + (row ? pos : edge)) + 'px';
        el.style[right ? 'left' : 'right'] = 'auto';
        pos += (row ? el.offsetWidth : el.offsetHeight) + 8;
    });
    // the folded dock's peeking entries: in a line from its button, along the stack's flow
    var side = edge + 40 + 4;
    peeks.sort(function (a, b) { return (Number(a.dataset.mbCornerOrder) || 0) - (Number(b.dataset.mbCornerOrder) || 0); }).forEach(function (el) {
        el.style[bottom ? 'bottom' : 'top'] = (gapY + (row ? edge : side)) + 'px';
        el.style[right ? 'right' : 'left'] = (gapX + (row ? side : edge)) + 'px';
        el.style[right ? 'left' : 'right'] = 'auto';
        side += 36;
    });
}

// Activity log: the session's log lines plus the viewers that show them
// (#283's viewer, shared since X12 of #623). A script makes its log once:
//
//   var LOG = mbuLog({ name: 'Fusion', version: VERSION, key: 'fusion.logwin' });
//   LOG.info('…'); LOG.warn(…); LOG.err(…) (or .error); LOG.ok(…); LOG.debug(…)
//   LOG.open(); LOG.close(); LOG.reopen()   // reopen: only if it was left open
//   LOG.markdown(); LOG.copy(btn); LOG.clear(); LOG.lines(); LOG.messages(); LOG.counts()
//   LOG.cat('Spotify').info(…)        // the same calls, each line tagged with a category
//   LOG.pre(text)                     // a block kept as written: line breaks, spacing, monospace (#705)
//   LOG.mount(el, { tools })          // the viewer inside the script's own panel (#705)
//
// Categories (#697) are optional. A tagged line shows its category before the
// message and in the Markdown ("WARN [Spotify] …"). The viewer grows a row of
// filters only when there is a choice: the levels once two of them have lines
// (ok counts as info), the categories once there are two. Click one to see only
// those lines, click it again to see all; Copy always takes everything.
//
// The floating window (open) and a mounted viewer (mount) are the same viewer;
// mount draws it into an element of the script's, without the title bar's
// window buttons, and o.tools (an element) sits in its toolbar before Clear.
// Every viewer has a debug switch: off, LOG.debug() lines are not recorded at all
// (remembered per script under o.key; LOG.debugOn(), LOG.setDebug(v)).
//
// o.name / o.version  the Markdown summary's title (version may be a function)
// o.subtitle          optional function; its text follows the title (e.g. the release)
// o.header            the window's title (default 'Activity log')
// o.key               storage key for the window's open/minimised/position state
// o.load / o.save     that storage (default GM_getValue / GM_setValue)
// o.before            called before the window opens (e.g. to inject the script's CSS)
// o.max               lines kept (default 20000: about 4 MB; 2000 dropped a long session's start)
// o.history           opt-in history of past sessions (#705), below
//
// A long run keeps only the last o.max lines, and the Markdown says how many went
// before them; the copies this replaced grew for the whole session. An open
// viewer appends each new line and drops the oldest row past the cap; the copies
// rebuilt the whole list with innerHTML on every line, which is quadratic over a
// long matching run.
//
// History (#705, Falcon's run logs of #512 made shared). Off unless o.history is given:
//
//   o.history = { prefix: 'falcon:session:', lines: 400, head: 140,
//                 parse: s => entry, nameOf: entries => name, store }
//
// A session starts with the page, or with LOG.session(reason) (Falcon: each run).
// Only a session the script marks with LOG.keep() is stored, so a page that did
// nothing worth reading back leaves nothing behind; LOG.name(text) names it (the
// first name stays). It is stored in the page's localStorage under prefix + id,
// within 100 ms of each line and at once on LOG.flush(), so a crashed tab keeps
// its log; a session longer than \`lines\` keeps its first \`head\` lines and its
// end, and says how many went between. The newest 10 sessions are kept, not configurable
// (#811); each script's prefix is its own, and Clear history clears only that script's.
// Leaving the page (a script's reload after its operation, #811) flushes at once.
// prefix + 'current' holds the last kept session's id (LOG.last()), so LOG.resume(id)
// can carry on a session across a navigation. The viewer gets a session list and Clear history.
//   LOG.sessionId(); LOG.last(); LOG.isKept(); LOG.refresh(); LOG.sessions(); LOG.load(id); LOG.forget(id); LOG.clearHistory(); LOG.flush()
// parse reads a stored line that is a string (an older format); nameOf names a
// session stored without a name; store ({ get, set, del, keys }) replaces localStorage.
function mbuLog(o) {
    o = o || {};
    var max = o.max || 20000, buf = [], dropped = 0, warn = 0, error = 0, views = [], bound = {};
    var LEVELS = ['error', 'warn', 'info', 'debug'];
    var group = function (sev) { return sev === 'ok' ? 'info' : sev; };
    var pad = function (n, w) { return String(n).padStart(w || 2, '0'); };
    var ts = function (d) { return d ? pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '.' + pad(d.getMilliseconds(), 3) : '--:--:--.---'; };
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
    // debug lines are recorded only while the viewer's debug switch is on (default off: majkinetor, #705), per script
    var dbgOn = null;
    var debugOn = function () { if (dbgOn === null) dbgOn = state().debug === true; return dbgOn; };
    var setDebug = function (v) { dbgOn = !!v; remember({ debug: dbgOn }); views.forEach(function (w) { if (w.dbg) w.dbg.checked = dbgOn; }); };
    var tally = function (e, d) { if (e.sev === 'warn') warn += d; else if (e.sev === 'error') error += d; };
    var PRE = { info: '', ok: 'OK   ', warn: 'WARN ', error: 'ERR  ', debug: 'DBG  ' };
    var line = function (e) { return ts(e.t) + '  ' + (PRE[e.sev] || '') + (e.cat ? '[' + e.cat + '] ' : '') + (e.pre ? '\\n' : '') + e.msg; };
    var countOf = function (list) {
        var c = { warn: 0, error: 0 };
        list.forEach(function (e) { if (e.sev === 'warn') c.warn++; else if (e.sev === 'error') c.error++; });
        return c;
    };

    // ── history (#705) ──
    var H = o.history || null, hp = H && (H.prefix || ((o.key || 'mbu') + ':session:'));
    var ID_RE = /^\\d{14}-\\d+$/, sid = '', kept = false, sname = '', savedName = '', seq = 0, pTimer = 0, lastSaved = '';
    var store = H && (H.store || {
        get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* full or blocked: the session just isn't kept */ } },
        del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* nothing to do */ } },
        // one call for all the keys: a userscript reaches localStorage through Firefox's
        // Xray wrapper, where each call costs, and the page may hold hundreds of keys
        keys: function () {
            try { var all = Object.keys(localStorage); if (all.length === localStorage.length) return all; } catch (e) { /* the loop below */ }
            var out = []; try { for (var i = 0; i < localStorage.length; i++) out.push(localStorage.key(i)); } catch (e) { /* none */ } return out;
        },
    });
    var keepN = function () { return 10; };   // #811: the last 10 sessions, not configurable
    var newId = function () { return new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14) + '-' + (++seq); };
    // the id is the session's start in UTC: YYYYMMDDHHMMSS-n
    var idDate = function (id) {
        var m = /^(\\d{4})(\\d\\d)(\\d\\d)(\\d\\d)(\\d\\d)(\\d\\d)/.exec(id || '');
        return m ? new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
    };
    function ids() {
        if (!H) return [];
        return store.keys().filter(function (k) { return k && k.indexOf(hp) === 0 && ID_RE.test(k.slice(hp.length)); })
            .map(function (k) { return k.slice(hp.length); }).sort();   // the id's own timestamp sorts as a string
    }
    // a stored line: [time ms | null, sev, cat | 0, msg, pre 1/0]; a string is an older format, read by H.parse
    function fromStored(x, id) {
        if (typeof x === 'string') {
            var p = null;
            try { p = H.parse ? H.parse(x, idDate(id)) : null; } catch (e) { /* unreadable: kept as text */ }
            return p ? { t: p.t || null, sev: p.sev || 'info', cat: p.cat || '', msg: String(p.msg == null ? x : p.msg), pre: !!p.pre } : { t: null, sev: 'info', msg: x };
        }
        if (!Array.isArray(x)) return null;
        var e = { t: x[0] != null ? new Date(x[0]) : null, sev: x[1] || 'info', msg: String(x[3] == null ? '' : x[3]) };
        if (x[2]) e.cat = String(x[2]);
        if (x[4]) e.pre = true;
        return e;
    }
    function loadSession(id) {
        if (!H || !id) return null;
        var raw = store.get(hp + id);
        if (raw == null) return null;
        try { return (JSON.parse(raw) || []).map(function (x) { return fromStored(x, id); }).filter(Boolean); } catch (e) { return null; }
    }
    // a past session's name doesn't change, so it is read (or mined from its lines) once
    var names = {};
    function nameOf(id, entries) {
        if (id in names) return names[id];
        var n = store.get(hp + id + ':name');
        if (!n) { try { n = H.nameOf ? H.nameOf(entries || loadSession(id) || []) || '' : ''; } catch (e) { n = ''; } }
        return (names[id] = n || '');
    }
    // the first \`head\` lines and the end, and a line saying how many went between
    function storedWindow() {
        var cap = H.lines || 400, head = Math.min(H.head || 140, cap - 2);
        var pack = function (e) { return [e.t ? e.t.getTime() : null, e.sev, e.cat || 0, e.msg, e.pre ? 1 : 0]; };
        if (buf.length <= cap) return buf.map(pack);
        var tail = cap - head - 1, cut = buf.length - head - tail;
        return buf.slice(0, head).map(pack)
            .concat([[null, 'info', 0, '——— ' + cut + ' line(s) from the middle of this session were dropped to fit the stored-log budget; its start and end are kept in full ———', 0]])
            .concat(buf.slice(-tail).map(pack));
    }
    function flush() {
        clearTimeout(pTimer); pTimer = 0;
        if (!H || !sid || !kept) return;
        try {
            var payload = JSON.stringify(storedWindow());
            if (payload === lastSaved) return;
            lastSaved = payload;
            store.set(hp + sid, payload);
            if (sname && savedName !== sname) { store.set(hp + sid + ':name', sname); savedName = sname; }
        } catch (e) { /* not stored */ }
    }
    var persist = function () { if (H && kept && !pTimer) pTimer = setTimeout(flush, 100); };
    function forget(id) { if (H && id) { store.del(hp + id); store.del(hp + id + ':name'); delete names[id]; } }
    function prune() {
        var all = ids().filter(function (id) { return id !== sid; });
        var excess = all.length + (kept ? 1 : 0) - keepN();
        if (excess > 0) all.slice(0, excess).forEach(forget);
    }
    // past sessions, newest first, without the current one
    function sessions() {
        return ids().filter(function (id) { return id !== sid; }).reverse()
            .map(function (id) { return { id: id, date: idDate(id), name: nameOf(id) }; });
    }
    var sessionLabel = function (s) {
        var d = s.date, when = d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) : s.id;
        return when + (s.name ? ' — ' + s.name : '');
    };
    function startSession() {
        flush();
        sid = newId(); kept = false; sname = ''; savedName = ''; lastSaved = '';
        reset();
    }
    function resume(id) {
        var entries = loadSession(id);
        if (!entries) return false;
        flush();
        reset();
        sid = id; kept = true; sname = savedName = store.get(hp + id + ':name') || '';
        lastSaved = store.get(hp + id) || '';
        store.set(hp + 'current', sid);
        entries.forEach(function (e) { push(e); });
        return true;
    }

    // ── the live lines ──
    function reset() {
        buf = []; dropped = 0; warn = 0; error = 0;
        views.forEach(function (v) { if (!v.past) v.show(null); v.sessions(); });
    }
    function push(e) {
        buf.push(e); tally(e, 1);
        // trim in chunks, not one shift per line
        if (buf.length > max + Math.ceil(max / 10)) {
            var gone = buf.splice(0, buf.length - max);
            gone.forEach(function (g) { tally(g, -1); });
            dropped += gone.length;
        }
        views = views.filter(function (v) { return v.el.isConnected; });
        views.forEach(function (v) { if (!v.past) v.append(e); });
    }
    function add(sev, args, cat, pre) {
        var msg = Array.prototype.map.call(args, str).join(' ');
        msg = pre ? msg.replace(/\\s+$/, '') : msg.replace(/\\s+/g, ' ').trim();
        if (!msg) return;
        var e = { t: new Date(), sev: sev === 'err' ? 'error' : sev, msg: msg };
        if (e.sev === 'debug' && !debugOn()) return;
        if (cat) e.cat = String(cat);
        if (pre) e.pre = true;
        push(e);
        persist();
    }
    function title(bare) {
        var v = typeof o.version === 'function' ? (function () { try { return o.version(); } catch (e) { return ''; } })() : o.version;
        var t = (o.name || 'Log') + (v ? ' v' + v : '');
        try { var s = !bare && o.subtitle && o.subtitle(); if (s) t += ' — ' + s; } catch (e) { /* no subtitle */ }
        return t;
    }
    // past: { id, entries } to copy a stored session instead of this one
    function markdown(past) {
        var list = past ? past.entries : buf, c = past ? countOf(list) : { warn: warn, error: error };
        var body = list.length ? list.map(line).join('\\n') : '(no activity logged)';
        if (!past && dropped) body = '(' + dropped + ' earlier line' + (dropped === 1 ? '' : 's') + ' not kept)\\n' + body;
        var n = (c.warn || c.error) ? ' (' + c.warn + ' warning' + (c.warn === 1 ? '' : 's') + ', ' + c.error + ' error' + (c.error === 1 ? '' : 's') + ')' : '';
        var what = past ? 'log of ' + sessionLabel({ id: past.id, date: idDate(past.id), name: nameOf(past.id, list) }) : 'session log';
        var fence = String.fromCharCode(96, 96, 96);
        return '<details><summary>' + title(!!past) + ' — ' + what + n + '</summary>\\n\\n' + fence + 'log\\n' + body + '\\n' + fence + '\\n\\n</details>';
    }
    function copy(btn, past) {
        var md = markdown(past);
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

    // ── a viewer: the floating window or one mounted in the script's panel ──
    var vseq = 0;
    function view(root, floating, tools) {
        var vid = String(++vseq);
        root.classList.add('mbu-logpop');
        root.dataset.mbuLv = vid;
        root.innerHTML = mbuHtml('<div class="mbu-logpop-h">' + (floating ? '<b>' + esc(o.header || 'Activity log') + '</b> ' : '') + '<span class="mbu-log-badge"></span>'
            + '<input class="mbu-log-q" type="search" placeholder="Filter" data-tip="Show only the lines with this text\\nEsc: empty the box" autocomplete="off">'
            + (H ? '<select class="mbu-log-ses mbu-select" data-tip="The session shown\\nThis one, or a past one kept in this browser"></select>' : '')
            + '<span class="mbu-logpop-sp"></span>'
            + (H ? '<button class="mbu-logpop-hclear" type="button" data-tip="Delete every past session\\nThis one stays">Clear history</button>' : '')
            + '<label class="mbu-log-dbg" data-tip="Record each step in detail\\nLeave it on when reporting a problem"><input type="checkbox"> debug</label>'
            + '<button class="mbu-logpop-clear" type="button" data-tip="Clear the log\\nThe lines so far are gone">Clear</button>'
            + '<button class="mbu-logpop-copy" type="button" data-tip="Copy the whole log as Markdown\\nReady to paste into a GitHub issue">⧉ Copy</button>'
            + (floating ? '<button class="mbu-logpop-full" type="button" data-tip="Full screen\\nDouble-click: the title bar does the same">⛶</button>'
                + '<button class="mbu-logpop-min" type="button" data-tip="Minimize">–</button>'
                + '<button class="mbu-logpop-x" type="button" data-tip="Close">✕</button>' : '') + '</div>'
            + '<div class="mbu-log-f" hidden></div><style class="mbu-log-fcss"></style>'
            + '<div class="mbu-log-list"></div>' + (floating ? '<div class="mbu-logpop-grip" data-tip="Resize"></div>' : ''));
        if (tools) root.querySelector('.mbu-logpop-clear').before(tools);
        var list = root.querySelector('.mbu-log-list'), badge = root.querySelector('.mbu-log-badge');
        var qEl = root.querySelector('.mbu-log-q'), q = '', sel = root.querySelector('.mbu-log-ses');
        var fRow = root.querySelector('.mbu-log-f'), fCss = root.querySelector('.mbu-log-fcss');
        // what this viewer shows: the live lines, or a past session (read-only)
        var past = null, src = buf, cats = [], catIx = {}, sevs = {}, fSev = null, fCat = null;
        var scope = '.mbu-logpop[data-mbu-lv="' + vid + '"] ';
        var miss = function (e) { return !!q && ((e.cat || '') + ' ' + e.msg).toLowerCase().indexOf(q) < 0; };
        // note a line's level and category; true when the filter row must change
        var note = function (e) {
            var grew = false;
            if (e.cat && !(e.cat in catIx)) { catIx[e.cat] = cats.length; cats.push(e.cat); grew = true; }
            if (!sevs[group(e.sev)]) { sevs[group(e.sev)] = true; grew = true; }
            return grew;
        };
        var row = function (e) {
            var d = document.createElement('div');
            d._e = e;
            d.className = 'mbu-log-li mbu-log-' + e.sev + (e.pre ? ' mbu-log-pre' : '');
            if (miss(e)) d.classList.add('mbu-log-nq');
            d.dataset.s = group(e.sev);
            if (e.cat) d.dataset.c = catIx[e.cat];
            d.innerHTML = mbuHtml('<span class="mbu-log-t">' + ts(e.t) + '</span>'
                + '<span class="mbu-log-c">' + esc(e.cat || '') + '</span>'
                + '<span class="mbu-log-m">' + linkify(e.msg) + '</span>');
            return d;
        };
        // the filter row, redrawn when a level or category first appears; hiding is one
        // rule in the viewer's own <style>, not a walk over the rows
        var filters = function () {
            var lv = LEVELS.filter(function (l) { return sevs[l]; });
            var showL = lv.length > 1, showC = cats.length > 1;
            if (fSev && !sevs[fSev]) fSev = null;
            if (fCat != null && !(fCat in catIx)) fCat = null;
            var b = function (kind, v, on) {
                return '<button type="button" class="mbu-log-fb' + (on ? ' on' : '') + '" data-' + kind + '="' + esc(v) + '">' + esc(v) + '</button>';
            };
            fRow.innerHTML = mbuHtml((showL ? '<span class="mbu-log-fg">' + lv.map(function (l) { return b('sev', l, fSev === l); }).join('') + '</span>' : '')
                + (showL && showC ? '<span class="mbu-log-fs"></span>' : '')
                + (showC ? '<span class="mbu-log-fg">' + cats.map(function (c) { return b('cat', c, fCat === c); }).join('') + '</span>' : ''));
            fRow.hidden = !showL && !showC;
            list.classList.toggle('mbu-log-cats', cats.length > 0);
            fCss.textContent = (fSev ? scope + '.mbu-log-li:not([data-s="' + fSev + '"]){display:none}' : '')
                + (fCat != null ? scope + '.mbu-log-li:not([data-c="' + catIx[fCat] + '"]){display:none}' : '');
        };
        var showBadge = function () {
            var c = past ? countOf(src) : { warn: warn, error: error };
            badge.textContent = '(' + src.length + ')' + (c.warn || c.error ? ' · ' + c.warn + '⚠ ' + c.error + '✖' : '');
        };
        var empty = function () { return '<div class="mbu-log-empty">' + (past ? 'Nothing was kept of this session.' : 'No activity yet.') + '</div>'; };
        var queued = false, follow = true;
        var paint = function () { queued = false; showBadge(); if (follow) list.scrollTop = list.scrollHeight; };
        // all rows at once: on opening, and when the session shown changes
        var draw = function () {
            cats = []; catIx = {}; sevs = {};
            src.forEach(note);
            var frag = document.createDocumentFragment();
            src.forEach(function (e) { frag.appendChild(row(e)); });
            list.innerHTML = mbuHtml(src.length ? '' : empty());
            if (src.length) list.appendChild(frag);
            filters(); showBadge();
            follow = true; list.scrollTop = list.scrollHeight;
            root.classList.toggle('mbu-log-past', !!past);
        };
        list.addEventListener('scroll', function () { follow = list.scrollHeight - list.scrollTop - list.clientHeight < 40; });
        var qTimer = 0;
        var refilter = function () {
            q = qEl.value.trim().toLowerCase();
            for (var d = list.firstElementChild; d; d = d.nextElementSibling) if (d._e) d.classList.toggle('mbu-log-nq', miss(d._e));
            follow = true; list.scrollTop = list.scrollHeight;
        };
        qEl.addEventListener('input', function () { clearTimeout(qTimer); qTimer = setTimeout(refilter, 120); });
        fRow.addEventListener('click', function (ev) {
            var t = ev.target.closest('.mbu-log-fb'); if (!t) return;
            if (t.dataset.sev) fSev = fSev === t.dataset.sev ? null : t.dataset.sev;
            else fCat = fCat === t.dataset.cat ? null : t.dataset.cat;
            filters();
            follow = true; list.scrollTop = list.scrollHeight;
        });
        var v = {
            el: root, floating: floating, past: null, q: qEl,
            append: function (e) {
                var em = list.querySelector('.mbu-log-empty'); if (em) em.remove();
                if (note(e)) filters();
                list.appendChild(row(e));
                while (list.childElementCount > buf.length) list.firstElementChild.remove();
                if (!queued) { queued = true; requestAnimationFrame(paint); }
            },
            // null: the live lines; an id: that past session
            show: function (id) {
                var entries = id ? loadSession(id) : null;
                if (id && !entries) entries = [{ t: null, sev: 'warn', msg: 'This session could not be read (it may have been deleted in another tab).' }];
                past = id && entries ? id : null; v.past = past;
                src = past ? entries : buf;
                if (sel && sel.value !== (past || '')) sel.value = past || '';
                draw();
            },
            // the session list, refreshed when it is opened and when a session starts
            sessions: function () {
                if (!sel) return;
                var all = sessions(), sig = all.map(function (x) { return x.id + '=' + x.name; }).join('|');
                if (sig === v.sig && !(past && !all.some(function (x) { return x.id === past; }))) return;
                v.sig = sig;
                if (past && !all.some(function (s) { return s.id === past; })) { past = null; v.past = null; src = buf; draw(); }
                sel.innerHTML = mbuHtml('<option value="">Current session</option>' + all.map(function (s) {
                    return '<option value="' + esc(s.id) + '">' + esc(sessionLabel(s)) + '</option>';
                }).join(''));
                sel.value = past || '';
                var hc = root.querySelector('.mbu-logpop-hclear'); if (hc) hc.disabled = !all.length;
            },
            filters: filters,
        };
        if (sel) {
            sel.addEventListener('change', function () { v.show(sel.value || null); });
            root.querySelector('.mbu-logpop-hclear').onclick = function () { clearHistory(); };
        }
        root.querySelector('.mbu-logpop-clear').onclick = function () { clear(); };
        v.dbg = root.querySelector('.mbu-log-dbg input');
        v.dbg.checked = debugOn();
        v.dbg.onchange = function () { setDebug(v.dbg.checked); };
        root.querySelector('.mbu-logpop-copy').onclick = function () {
            copy(root.querySelector('.mbu-logpop-copy'), past ? { id: past, entries: src } : null);
        };
        v.sessions();
        draw();
        views.push(v);
        return v;
    }

    var win = null;
    function open() {
        close(true);
        if (typeof o.before === 'function') { try { o.before(); } catch (e) { /* the window still opens */ } }
        remember({ open: true });
        var st = state();
        var pop = document.createElement('div'); pop.id = 'mbu-logpop';
        document.body.appendChild(pop);
        var v = view(pop, true);
        if (st.left != null) { pop.style.left = st.left; pop.style.top = st.top; pop.style.right = 'auto'; pop.style.transform = 'none'; }
        var restore = { left: pop.style.left, top: pop.style.top, right: pop.style.right, bottom: pop.style.bottom, transform: pop.style.transform };
        // Escape in a filled filter empties it; anywhere else it closes the window. Only the log:
        // it listens first (capture, on window) and keeps the key, so the script's own window under
        // it (ISRC Scout's closes on Escape too) stays open
        var onKey = function (e) {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            if (e.target === v.q && v.q.value) { v.q.value = ''; v.q.dispatchEvent(new Event('input')); return; }
            close();
        };
        win = { el: pop, v: v, off: function () { window.removeEventListener('keydown', onKey, true); } };
        var minBtn = pop.querySelector('.mbu-logpop-min');
        var setMin = function (m) {
            minBtn.textContent = m ? '▢' : '–'; minBtn.dataset.tip = m ? 'Restore' : 'Minimize';
            if (m) { pop.style.left = '14px'; pop.style.bottom = '14px'; pop.style.top = 'auto'; pop.style.right = 'auto'; pop.style.transform = 'none'; }   // dock to the bottom
            else Object.assign(pop.style, restore);
        };
        var fullBtn = pop.querySelector('.mbu-logpop-full');
        var setFull = function (f) {
            pop.classList.toggle('full', f);
            fullBtn.textContent = f ? '❐' : '⛶'; fullBtn.dataset.tip = (f ? 'Restore the size' : 'Full screen') + '\\nDouble-click: the title bar does the same';
        };
        minBtn.onclick = function () {
            var m = pop.classList.toggle('min');
            if (m && pop.classList.contains('full')) { setFull(false); remember({ full: false }); }   // minimising leaves full screen
            setMin(m); remember({ min: m });
        };
        fullBtn.onclick = function () { var f = !pop.classList.contains('full'); setFull(f); remember({ full: f }); };
        pop.querySelector('.mbu-logpop-h').addEventListener('dblclick', function (e) {
            if (!e.target.closest('button, input, select') && !pop.classList.contains('min')) fullBtn.click();
        });
        // a size the user gave it, from the corner grip
        if (st.w && st.h) { pop.style.width = st.w; pop.style.height = st.h; pop.classList.add('sized'); }
        if (st.min) { pop.classList.add('min'); setMin(true); }
        else if (st.full) setFull(true);
        pop.querySelector('.mbu-logpop-grip').addEventListener('mousedown', function (e) {
            e.preventDefault(); e.stopPropagation();
            var r = pop.getBoundingClientRect();
            // pin the top-left corner, so only the right and bottom edges move
            pop.style.left = r.left + 'px'; pop.style.top = r.top + 'px'; pop.style.right = 'auto'; pop.style.bottom = ''; pop.style.transform = 'none';
            pop.classList.add('sized');
            var x0 = e.clientX, y0 = e.clientY;
            var mv = function (ev) {
                pop.style.width = Math.max(320, Math.min(window.innerWidth - r.left, r.width + ev.clientX - x0)) + 'px';
                pop.style.height = Math.max(120, Math.min(window.innerHeight - r.top, r.height + ev.clientY - y0)) + 'px';
            };
            var up = function () {
                document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
                restore = { left: pop.style.left, top: pop.style.top, right: 'auto', bottom: '', transform: 'none' };
                remember({ left: pop.style.left, top: pop.style.top, w: pop.style.width, h: pop.style.height });
            };
            document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
        });
        pop.querySelector('.mbu-logpop-x').onclick = function () { close(); };
        // floating and non-modal: dragged by its header
        pop.querySelector('.mbu-logpop-h').addEventListener('mousedown', function (e) {
            if (e.target.closest('button, input, select') || pop.classList.contains('full')) return;
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
        window.addEventListener('keydown', onKey, true);
        return pop;
    }
    // the viewer inside an element of the script's; a second mount there replaces the first
    function mount(host, opts) {
        if (!host) return null;
        views = views.filter(function (v) { if (v.el.parentNode === host) { v.el.remove(); return false; } return true; });
        var el = document.createElement('div'); el.className = 'mbu-logemb';
        host.appendChild(el);
        return view(el, false, opts && opts.tools).el;
    }
    // empty the live log: the lines, the counts and the "earlier lines not kept" note
    function clear() {
        buf = []; dropped = 0; warn = 0; error = 0;
        if (H && sid) { store.del(hp + sid); lastSaved = ''; }
        views.forEach(function (v) { if (!v.past) v.show(null); });
    }
    function clearHistory() {
        if (!H) return;
        ids().forEach(function (id) { if (id !== sid) forget(id); });
        views.forEach(function (v) { v.sessions(); });
    }
    // quiet: closing to reopen, so the remembered "open" stays as it is
    function close(quiet) {
        var stray = document.getElementById('mbu-logpop');
        if (win) {
            win.off(); win.el.remove();
            views = views.filter(function (v) { return v !== win.v; });
            win = null; if (!quiet) remember({ open: false });
        }
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
        // the debug switch: are debug lines recorded?
        debugOn: function () { return debugOn(); },
        setDebug: setDebug,
        pre: function () { add('info', arguments, null, true); },
        // a logger whose lines carry this category; the same object for the same name
        cat: function (name) {
            if (!name) return api;
            if (!bound[name]) bound[name] = {
                info: function () { add('info', arguments, name); },
                warn: function () { add('warn', arguments, name); },
                err: function () { add('error', arguments, name); },
                error: function () { add('error', arguments, name); },
                ok: function () { add('ok', arguments, name); },
                debug: function () { add('debug', arguments, name); },
                add: function (sev) { add(sev, Array.prototype.slice.call(arguments, 1), name); },
                pre: function () { add('info', arguments, name, true); },
            };
            return bound[name];
        },
        open: open,
        mount: mount,
        close: function () { close(); },
        reopen: function () { if (state().open) open(); },
        isOpen: function () { return !!win; },
        markdown: function () { return markdown(); },
        copy: function (btn) { copy(btn); },
        clear: clear,
        lines: function () { return buf.map(line); },
        entries: function () { return buf.slice(); },
        messages: function () { return buf.map(function (e) { return e.msg; }); },
        counts: function () { return { warn: warn, error: error }; },
        // history (#705); harmless without o.history
        session: function () { if (H) startSession(); return sid; },
        resume: function (id) { return H ? resume(id) : false; },
        keep: function () { if (H && sid && !kept) { kept = true; store.set(hp + 'current', sid); flush(); prune(); views.forEach(function (v) { v.sessions(); }); } },
        name: function (text) { if (H && text && !sname) { sname = String(text); if (kept) store.set(hp + sid + ':name', sname); } },
        sessionId: function () { return sid; },
        last: function () { return H ? store.get(hp + 'current') : null; },
        isKept: function () { return kept; },
        sessions: function () { return H ? sessions() : []; },
        load: function (id) { return loadSession(id); },
        forget: function (id) { forget(id); views.forEach(function (v) { v.sessions(); }); },
        clearHistory: clearHistory,
        // redraw the session lists (a script showing its mounted viewer again); only a changed list is redrawn
        refresh: function () { views.forEach(function (v) { v.sessions(); }); },
        flush: flush,
    };
    if (H) {
        sid = newId();
        // #811: a script reloads the page right after its operation; write the kept session
        // now rather than trusting the 100 ms timer to beat the unload
        try { window.addEventListener('pagehide', flush); } catch (e) { /* no window */ }
    }
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
    if (!_mbuNs.MBU.tip) _mbuNs.MBU.tip = mbuTip;
} catch (e) { /* a locked-down page must not stop the script loading */ }
`.trim();

// The tooltip (dev/ui/tooltip.mjs) rides in every ST-UI block; Scribe and Bandcamp Player
// Enhanced, off this block, carry it alone in an ST-TIP block.
export const TIP_JS = tipJs(ROOTS);
export const UI_CSS = CSS;
export const UI_JS = JS + '\n\n' + TIP_JS;
