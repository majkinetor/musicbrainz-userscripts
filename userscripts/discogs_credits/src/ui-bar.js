// The "Import Discogs Credits" UI bar — inserted into the MB
// `/edit-relationships` page when a Discogs URL is linked to the
// release. Owns the bar styles (embedded so the userscript ships
// self-contained), the option toggles, the "Import" button, and the
// orchestration that runs after click (`runImport`).
//
// Two pieces of module-private state are reused across re-runs of the
// bar's onclick handler:
//   _logs   — the <ul> the script appends per-line log messages to.
//   _summary — the <p> shown above the log with the import summary.
// They're set when insertDiscogsBar mounts the bar; runImport
// reads them when populating the run output.
//
// One IIFE at the top cleans up stale `discogs-release-*` localStorage
// entries from old versions on every page load (cheap, idempotent).

import { DISCOGS_LOGO_URL, pageWindow }   from './constants.js';
import { writeIdbRecord }                 from './storage.js';
import {
    log,
    setLogContainer,
    setReviewContainer,
    onLogCounts,
    resetLogCounts,
}                                        from './log.js';
import { _showBar, _hideBar }             from './progress-bar.js';
import {
    parseDiscogsUrl,
    getDiscogsReleaseData,
}                                        from './api-discogs.js';
import {
    convertPotentialDJMixers,
    rolesFromDiscogsArtists,
    getAllArtistTracks,
    flattenTracklist,
    getArtistRoles,
}                                        from './mappers.js';
import {
    resolveAll,
    ARTIST_KIND,
    COMPANY_KIND,
}                                        from './preflight.js';
import { showReviewTable }               from './review-table.js';
import { dispatchAllRelationships }      from './dispatch.js';
import { buildEditNote }                 from './edit-note.js';
import { ENTITY_TYPE_MAP }                from './data/entity-map.js';

let _logs;
let _summary;
// Raw Discogs JSON of the current run, stashed by `runImport` so the "Copy
// Discogs" item in the Log ▾ menu can copy it (#118). Updated each import.
let _discogsJson = null;

export function insertDiscogsBar(discogsUrl) {
    // Inject styles
    const style = document.createElement('style');
    style.innerText = `
        .discogs-bar {
            font-family: inherit;
            background: #fff;
            border: 1px solid #e0c88a;
            border-left: 4px solid #e8771d;
            border-radius: 0.35rem;
            margin-bottom: 1rem;
            overflow: hidden;
        }
        .discogs-bar-row1 {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            row-gap: 0.4rem;
            flex-wrap: wrap;
            padding: 0.5rem 0.75rem;
            background: #fdf8f0;
            border-bottom: 1px solid #eeddb0;
        }
        /* inline options strip in the single bar (#139) */
        .discogs-bar-opts { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
        .discogs-bar-opts .discogs-opts-label { font-size: 0.75rem; color: #999; text-transform: uppercase; letter-spacing: 0.05em; flex-shrink: 0; }
        .discogs-opts-btn { font-size: 0.8rem; color: #555; background: #fffdf7; border: 1px solid #d8c8a0; border-radius: 2rem; padding: 0.15rem 0.6rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.25rem; }
        .discogs-opts-btn:hover { border-color: #e8771d; color: #333; }
        .discogs-opts-caret { color: #999; font-size: 0.7rem; }
        /* "Options ▾" popover (Dedup toggles) */
        .discogs-opts-panel { position: fixed; z-index: 100002; display: none; flex-direction: column; gap: 0.4rem; background: #fff; border: 1px solid #d8c8a0; border-radius: 0.4rem; box-shadow: 0 6px 22px rgba(40,20,80,0.18); padding: 0.55rem 0.6rem; font-family: inherit; }
        .discogs-opts-panel.open { display: flex; }
        .discogs-opts-panel .discogs-opts-panel-hd { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: #999; font-weight: 600; }
        /* "Copy log ▾" dropdown in the right group */
        .discogs-copylog-caret { color: #999; font-size: 0.7rem; }
        /* "Log ▾" header toggle button (#142) */
        .discogs-logtoggle-btn { font-size: 0.78rem; color: #555; background: #fff; border: 1px solid #cfcfcf; border-radius: 0.25rem; padding: 0.15rem 0.5rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.25rem; white-space: nowrap; }
        .discogs-logtoggle-btn:hover { border-color: #999; }
        .discogs-logtoggle-btn.active { background: #f0ecfa; border-color: #b9a4e0; color: #5a3e94; }
        /* "Log ▾" dropdown menu (#118): show/hide + the three copy actions. */
        .discogs-log-menu { position: fixed; z-index: 100002; display: none; flex-direction: column; min-width: 11rem; background: #fff; border: 1px solid #cfcfcf; border-radius: 0.4rem; box-shadow: 0 6px 22px rgba(40,20,80,0.18); padding: 0.3rem; font-family: inherit; }
        .discogs-log-menu.open { display: flex; }
        .discogs-log-menu button { text-align: left; font-size: 0.82rem; color: #444; background: none; border: none; border-radius: 0.25rem; padding: 0.3rem 0.5rem; cursor: pointer; white-space: nowrap; }
        .discogs-log-menu button:hover { background: #f0ecfa; color: #333; }
        .discogs-log-menu .discogs-log-menu-sep { height: 1px; background: #eee; margin: 0.25rem 0.2rem; padding: 0; }
        /* log panel toolbar: severity filter + copy buttons */
        .discogs-log-toolbar { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; padding: 0.3rem 0 0.45rem; }
        .discogs-log-filter { display: inline-flex; border: 1px solid #ddd; border-radius: 0.3rem; overflow: hidden; }
        .discogs-log-filterbtn { font-size: 0.75rem; color: #666; background: #fff; border: none; border-right: 1px solid #eee; padding: 0.15rem 0.55rem; cursor: pointer; }
        .discogs-log-filterbtn:last-child { border-right: none; }
        .discogs-log-filterbtn:hover { background: #f6f3fc; }
        .discogs-log-filterbtn.active { background: #5f3ec0; color: #fff; }
        .discogs-log-copyslot { display: inline-flex; gap: 0.4rem; margin-left: auto; }
        .discogs-log-copybtn { font-size: 0.78rem; color: #555; background: #fff; border: 1px solid #cfcfcf; border-radius: 0.25rem; padding: 0.15rem 0.5rem; cursor: pointer; white-space: nowrap; }
        .discogs-log-copybtn:hover { border-color: #999; }
        .discogs-bar img.discogs-logo {
            height: 20px;
            width: auto;
            flex-shrink: 0;
            opacity: 0.85;
        }
        .discogs-bar .discogs-source-icon { display: inline-flex; align-items: center; flex-shrink: 0; }
        .discogs-bar .discogs-source-icon:hover .discogs-logo { opacity: 1; }
        .discogs-bar .discogs-source {
            flex: 0 1 auto;
            max-width: 20rem;
            font-size: 0.82rem;
            color: #555;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        /* Slot in the always-visible header that hosts the review "Start import"
           button + unresolved message (#139). Content-sized; the right cluster's
           margin-left:auto does the pushing so the link/help stay right even when
           this slot is empty (initial state). */
        .discogs-bar-action {
            flex: 0 1 auto;
            min-width: 0;
            display: flex;
            align-items: center;
            gap: 0.6rem;
        }
        .discogs-bar-action:empty { display: none; }
        /* Reserved message area (#118): badge + transient status, right-aligned
           just left of the Discogs/Help/Log cluster. margin-left:auto pushes
           it (and the right cluster after it) to the edge, leaving the gap up to
           the "Options" button free for these messages. Collapses to nothing
           when empty (hidden children don't count as flex items, so the gap
           contributes no width). */
        /* #139: grow to fill the gap between "Options" and the right cluster so the
           status message can use that whole width (right-aligned next to the cluster).
           flex:1 also keeps the right cluster pinned to the edge whether this is empty
           or not — replacing the old margin-left:auto. Basis 0 (not auto) is essential:
           with an auto basis a very long message's content width is used for row1's
           wrap calculation and bumps the whole slot to a second row; basis 0 keeps it
           on the line and the status just ellipsises inside it. */
        .discogs-bar-msgs {
            flex: 1 1 0;
            justify-content: flex-end;
            display: flex;
            align-items: center;
            gap: 0.4rem;
            min-width: 0;
        }
        /* #139: no fixed cap — the message takes the available space up to "Options"
           and only ellipsises when it genuinely doesn't fit (flex-shrink + min-width:0). */
        .discogs-bar-status {
            font-size: 0.8rem;
            color: #888;
            flex: 0 1 auto;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            min-width: 0;
        }
        /* Count badges. Buttons so they can focus/open the log; styled as pills.
           Borderless + a touch larger per #139; the (deepened) fill carries them. */
        .discogs-badge {
            flex-shrink: 0;
            font-size: 0.9rem;
            font-weight: 600;
            line-height: 1.2;
            padding: 0.2rem 0.7rem;
            border-radius: 2rem;
            border: none;
            cursor: pointer;
            white-space: nowrap;
        }
        .discogs-badge-warn      { color: #8a4b00; background: #ffe1a8; }
        .discogs-badge-warn:hover{ background: #ffd68a; }
        .discogs-badge-err       { color: #9c1b1b; background: #f9c9c9; }
        .discogs-badge-err:hover { background: #f5b4b4; }
        .discogs-badge-unresolved{ color: #6a4a86; background: #e3d8f5; }
        .discogs-badge-unresolved:hover { background: #d6c6f0; }
        /* Discogs logo + Help + Log — pinned to the right edge (the msgs slot's
           margin-left:auto does the pushing). */
        .discogs-bar-right {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            gap: 0.6rem;
            min-width: 0;
        }
        /* During the review wait the import isn't running, so the "Importing…"
           button + percentage are redundant — hide them; they reappear while a
           real import phase (preflight / dispatch) is active (#139). */
        .discogs-bar.is-reviewing .discogs-import-btn,
        .discogs-bar.is-reviewing #discogs-progress-pct { display: none !important; }   /* !important: the % span carries an inline display set by JS */
        .discogs-bar-action .discogs-issue-note {
            font-size: 0.85rem;
            color: #7a5c00;
            min-width: 7.5rem;   /* reserve space so the bar doesn't reflow as the count appears / changes (#139) */
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .discogs-bar-action .discogs-issue-note.clickable {
            cursor: pointer;
            text-decoration: underline dotted;
        }
        .discogs-bar-action .discogs-issue-note.clickable:hover { color: #a06000; }
        .discogs-bar .discogs-source a {
            color: #e8771d;
            text-decoration: none;
            font-weight: bold;
        }
        .discogs-bar .discogs-source a:hover { text-decoration: underline; }
        .discogs-import-btn {
            flex-shrink: 0;
            padding: 0.3rem 1rem;
            background: #e8771d;
            color: #fff;
            border: none;
            border-radius: 0.25rem;
            cursor: pointer;
            font-size: 0.88rem;
            font-weight: bold;
            letter-spacing: 0.01em;
        }
        .discogs-import-btn:hover { background: #cf6618; }
        .discogs-import-btn:disabled { background: #c8a070; cursor: default; }
        .discogs-bar-row2 {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.35rem 0.75rem;
            flex-wrap: wrap;
        }
        .discogs-bar-row2 .discogs-opts-label {
            font-size: 0.75rem;
            color: #999;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-right: 0.2rem;
            flex-shrink: 0;
        }
        /* Borderless toggles (#118): no pill outline/background — the dot alone
           signals on/off, matching the maintainer's mockup. */
        .discogs-toggle {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            padding: 0.15rem 0.4rem 0.15rem 0.2rem;
            border: none;
            border-radius: 2rem;
            background: transparent;
            cursor: pointer;
            font-size: 0.8rem;
            color: #555;
            user-select: none;
            transition: color 0.12s;
        }
        .discogs-toggle:hover { color: #222; }
        .discogs-toggle input[type=checkbox] { display: none; }
        .discogs-toggle .discogs-toggle-dot {
            width: 14px; height: 14px;
            border-radius: 50%;
            border: 2px solid #bbb;
            background: #fff;
            flex-shrink: 0;
            transition: border-color 0.12s, background 0.12s;
        }
        .discogs-toggle.active {
            color: #333;
        }
        .discogs-toggle.active .discogs-toggle-dot {
            border-color: #e8771d;
            background: #e8771d;
        }
        .discogs-output { padding: 0.5rem 0.75rem 0.25rem; }
        .discogs-output.empty { display: none; }   /* no log yet → hide the whole section (#142) */
        .discogs-output .summary { margin: 0 0 0.25rem; font-size: 0.88rem; color: #555; }
        .discogs-output .logs { margin: 0; padding-left: 1.2rem; font-size: 0.83rem; }
        /* log panel hides behind the header "Log ▾" button (#142); the review
           panel sits in .discogs-review-slot OUTSIDE the panel, always visible. */
        .discogs-log-panel { display: none; }
        .discogs-output.log-open .discogs-log-panel { display: block; }
        .discogs-review-slot:not(:empty) { margin: 0.2rem 0; }
        /* severity filter: Warnings shows only warn lines, Errors only error
           lines — each view matches its header badge count. "skip" lines
           (unresolved-entity skips, #118) and info lines show only under
           "All"; errors are NOT lumped into the Warnings view. */
        .discogs-output[data-logfilter="warn"] .discogs-log-body .logs > li:not([data-sev="warn"]) { display: none; }
        .discogs-output[data-logfilter="error"] .discogs-log-body .logs > li:not([data-sev="error"]) { display: none; }
        /* ── Progress / sticky bar ── */
        /* Pinned during import (is-importing) AND kept pinned afterwards
           (is-pinned, #118) so the WARN/ERR badge stays visible on top while the
           user scrolls the staged edits below. overflow:hidden on .discogs-bar
           rules out position:sticky, so we use fixed + an in-flow spacer that
           reserves row1's height (see .discogs-sticky-spacer). */
        .discogs-bar.is-importing .discogs-bar-row1,
        .discogs-bar.is-pinned .discogs-bar-row1 {
            position: fixed;
            top: 0; left: 0; right: 0;
            z-index: 9000;
            background: #fdf8f0;
            border-bottom: 1px solid #eeddb0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        /* Occupies row1's height in the flow while row1 is fixed, so the page
           content below the bar doesn't jump up under it. Height set by JS. */
        .discogs-sticky-spacer { display: none; }
        .discogs-bar.is-importing .discogs-sticky-spacer,
        .discogs-bar.is-pinned .discogs-sticky-spacer { display: block; }
        .discogs-progress-track {
            height: 5px;
            background: #eeddb0;
            border-radius: 3px;
            overflow: hidden;
        }
        .discogs-progress-fill {
            height: 100%;
            width: 0%;
            background: #e8771d;
            border-radius: 3px;
            transition: width 0.3s ease;
        }
        .discogs-progress-fill.indeterminate {
            width: 40%;
            animation: discogs-slide 1.4s ease-in-out infinite;
        }
        @keyframes discogs-slide {
            0%   { margin-left: -40%; }
            100% { margin-left: 100%; }
        }
        .discogs-progress-status {
            font-size: 0.8rem;
            color: #7a5000;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .discogs-recent-logs {
            font-size: 0.78rem;
            color: #888;
            max-height: 3.2rem;
            overflow: hidden;
            line-height: 1.4;
        }
        .discogs-recent-logs span {
            display: block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .discogs-toggle { position: relative; }
        /* position:fixed so the tooltip escapes .discogs-bar's
           overflow:hidden (needed there to clip child backgrounds to
           the bar's rounded corners). Per-hover JS in makeCheckbox
           sets top/left from the toggle's viewport rect, so the
           tooltip renders outside any overflow-clipping ancestor.
           Issue #89. */
        .discogs-tooltip {
            display: none;
            position: fixed;
            background: #333;
            color: #fff;
            font-size: 0.78rem;
            line-height: 1.45;
            padding: 0.45rem 0.65rem;
            border-radius: 0.3rem;
            white-space: normal;
            width: 220px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            pointer-events: none;
            z-index: 9999;
            text-align: left;
        }
        .discogs-tooltip::after {
            content: '';
            position: absolute;
            top: 100%;
            left: var(--arrow-x, 50%);
            transform: translateX(-50%);
            border: 5px solid transparent;
            border-top-color: #333;
        }
        /* When the tooltip flipped below the toggle (no room above),
           flip the arrow to point up from the tooltip's top edge. */
        .discogs-tooltip.below::after {
            top: auto;
            bottom: 100%;
            border-top-color: transparent;
            border-bottom-color: #333;
        }
        /* Tooltip shown by JS adding .discogs-tooltip-visible after a
           hover-intent delay (see makeCheckbox). Native browser title=
           tooltips have a ~1s delay by convention; the custom tooltips
           used to fire instantly and felt jumpy when sweeping across
           toggles. */
        .discogs-tooltip.discogs-tooltip-visible { display: block; }
    `;
    document.head.appendChild(style);

    // Build the bar
    const bar = document.createElement('div');
    bar.className = 'discogs-bar';

    // ── Row 1: import button + logo + source URL (Proposal C of #77) ───
    // Maintainer asked for the Import button on the LEFT so the eye
    // doesn't have to travel the full width of the bar. Layout:
    //
    //   [ Import from Discogs ]  [Discogs logo]  https://www.discogs…
    //
    const row1 = document.createElement('div');
    row1.className = 'discogs-bar-row1';

    const importBtn = document.createElement('button');
    importBtn.className = 'discogs-import-btn';
    importBtn.textContent = 'Import from Discogs';
    const progressPct = document.createElement('span');
    progressPct.id = 'discogs-progress-pct';
    progressPct.style.cssText = 'display:none; margin-left:0.5rem; font-size:0.85rem; color:#e8771d; font-weight:bold; min-width:3.5rem;';
    row1.appendChild(importBtn);
    row1.appendChild(progressPct);

    // Action slot — the review "Start import" button + unresolved message get
    // mounted here (by showReviewTable) so they live in the always-visible
    // header instead of below the table where you must scroll to reach them
    // (#139). Empty (and hidden) until a review is in progress.
    const actionSlot = document.createElement('div');
    actionSlot.className = 'discogs-bar-action';
    row1.appendChild(actionSlot);

    // Inline options live in the single bar now (#139). The option toggles +
    // "Create works" go straight in here; the secondary Dedup toggles fold into
    // an "Options ▾" popover built below. `_optsHost` is the current append
    // target for makeCheckbox/makeSelect (defaults to this strip).
    const optsWrap = document.createElement('div');
    optsWrap.className = 'discogs-bar-opts';
    row1.appendChild(optsWrap);
    let _optsHost = optsWrap;

    // Reserved message area (#118). Sits between the "Options ▾" button and the
    // right cluster (its `margin-left:auto` does the pushing). Holds the WARN/ERR
    // + unresolved badge ("Log messages") and a transient status line ("System
    // messages") shown while an import is running. Content-sized; collapses to
    // zero width when empty so the right cluster stays pinned to the edge.
    const msgSlot = document.createElement('div');
    msgSlot.className = 'discogs-bar-msgs';

    // System-message line: latest log line, shown only while importing.
    const statusEl = document.createElement('span');
    statusEl.className = 'discogs-bar-status';
    statusEl.style.display = 'none';

    // Badge pills. WARN (orange) and ERR (red) are tallied from the log; the
    // "unresolved" pill is kept deliberately separate (amber, distinct glyph) so
    // skipped-entity counts don't read as ordinary warnings (#118).
    const warnPill = document.createElement('button');
    warnPill.type = 'button';
    warnPill.className = 'discogs-badge discogs-badge-warn';
    warnPill.style.display = 'none';
    warnPill.title = 'Show warnings in the log';
    const errPill = document.createElement('button');
    errPill.type = 'button';
    errPill.className = 'discogs-badge discogs-badge-err';
    errPill.style.display = 'none';
    errPill.title = 'Show errors in the log';
    const unresolvedPill = document.createElement('button');
    unresolvedPill.type = 'button';
    unresolvedPill.className = 'discogs-badge discogs-badge-unresolved';
    unresolvedPill.style.display = 'none';
    unresolvedPill.title = 'Entities not matched on MusicBrainz — skipped on import';

    msgSlot.append(statusEl, warnPill, errPill, unresolvedPill);
    row1.appendChild(msgSlot);

    // Right-aligned cluster. Order (#118): "Log ▾" first, then the Discogs logo,
    // then "? Help" — i.e. Log, Discogs, ? Help (per maintainer).
    const rightGroup = document.createElement('div');
    rightGroup.className = 'discogs-bar-right';

    // "Log ▾" toggle. Shows/hides the log panel below the bar (copy buttons +
    // severity filter, #142). Hidden until the first import (no log to show yet).
    const logToggleBtn = document.createElement('button');
    logToggleBtn.type = 'button';
    logToggleBtn.className = 'discogs-logtoggle-btn';
    logToggleBtn.innerHTML = 'Log <span class="discogs-copylog-caret">▾</span>';
    logToggleBtn.title = 'Show / hide the import log';
    logToggleBtn.style.display = 'none';

    const logoLink = document.createElement('a');
    logoLink.href = discogsUrl;
    logoLink.target = '_blank';
    logoLink.rel = 'noopener noreferrer nofollow';
    logoLink.className = 'discogs-source-icon';
    logoLink.title = discogsUrl;   // hover shows the full Discogs URL
    const logo = document.createElement('img');
    logo.src = DISCOGS_LOGO_URL;
    logo.className = 'discogs-logo';
    logo.alt = 'Discogs';
    logoLink.appendChild(logo);

    // Documentation link (#90). URL falls back the same way `buildEditNote`
    // resolves it: the manager-injected `@homepageURL`, then `@homepage`, then a
    // hard-coded README.md link so it works even if the manager strips metadata.
    const docsHref = (typeof GM_info !== 'undefined' && (
        GM_info?.script?.homepageURL || GM_info?.script?.homepage
    )) || 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/discogs_credits/README.md';
    const docsLink = document.createElement('a');
    docsLink.href = docsHref;
    docsLink.target = '_blank';
    docsLink.rel = 'noopener noreferrer nofollow';
    docsLink.textContent = '? Help';   // consistent with the other userscripts (#139)
    docsLink.title = 'Open the script\'s README in a new tab';
    docsLink.style.cssText = 'flex-shrink:0;font-size:0.82rem;color:#7a5000;text-decoration:none;padding:0.1rem 0.45rem;border:1px solid #d4b800;border-radius:0.25rem;background:#fff8e6;';

    rightGroup.append(logToggleBtn, logoLink, docsLink);

    row1.appendChild(rightGroup);

    bar.appendChild(row1);

    // Sticky spacer (#118). While row1 is position:fixed (during/after import)
    // it leaves the document flow; this in-flow placeholder holds its height so
    // the page content below the bar doesn't jump up under it. Height is set by
    // `bar._pin()`, which also re-measures on resize and after the import (the
    // header grows once the badge appears). Sits between row1 and the output.
    const stickySpacer = document.createElement('div');
    stickySpacer.className = 'discogs-sticky-spacer';
    bar.appendChild(stickySpacer);
    bar._pin = () => {
        const h = row1.getBoundingClientRect().height;
        if (h) stickySpacer.style.height = h + 'px';
    };
    window.addEventListener('resize', () => { if (bar.classList.contains('is-pinned')) bar._pin(); });

    // ── Options (inline in the single bar — #139). No "Options:" label: the
    //    toggles are self-evident and the "Options ▾" popover already names itself.

    function makeCheckbox(labelText, checkedByDefault, tooltipText) {
        const lbl = document.createElement('label');
        lbl.className = 'discogs-toggle' + (checkedByDefault ? ' active' : '');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = checkedByDefault;
        const dot = document.createElement('span');
        dot.className = 'discogs-toggle-dot';
        lbl.appendChild(cb);
        lbl.appendChild(dot);
        lbl.appendChild(document.createTextNode(labelText));
        if (tooltipText) {
            const tip = document.createElement('span');
            tip.className = 'discogs-tooltip';
            tip.textContent = tooltipText;
            lbl.appendChild(tip);
            // Position on hover. Tooltip is `position: fixed` (escapes the
            // bar's `overflow: hidden`), so we set top/left from the
            // toggle's viewport rect each hover. Defaults to "above the
            // toggle, centred"; if there's not enough room above we flip
            // below, and the horizontal position is clamped to the viewport
            // with the arrow re-aimed at the toggle's centre.
            const TIP_W = 220, TIP_MARGIN = 6, EDGE_PAD = 8;
            // Match the native browser title= delay (~1s) so sweeping the
            // mouse across the toggle row doesn't fire a stack of tooltips.
            // The other option on this bar — "Create works" — uses native
            // title= via makeSelect, which is what the user sees as the
            // baseline.
            const HOVER_DELAY_MS = 1000;
            let _showTimer, _hideTimer;
            lbl.addEventListener('mouseenter', () => {
                clearTimeout(_showTimer);
                _showTimer = setTimeout(() => {
                    const r = lbl.getBoundingClientRect();
                    const centerX = r.left + r.width / 2;
                    let x = centerX - TIP_W / 2;
                    x = Math.max(EDGE_PAD, Math.min(x, window.innerWidth - TIP_W - EDGE_PAD));
                    tip.style.left = `${x}px`;
                    // Show off-screen first so we can measure the rendered height
                    // before deciding above-vs-below.
                    tip.style.top = '-9999px';
                    tip.classList.add('discogs-tooltip-visible');
                    const h = tip.offsetHeight;
                    const above = r.top - TIP_MARGIN - h;
                    const fitsAbove = above >= EDGE_PAD;
                    tip.style.top = fitsAbove ? `${above}px` : `${r.bottom + TIP_MARGIN}px`;
                    tip.classList.toggle('below', !fitsAbove);
                    // Aim the arrow at the toggle's actual centre, not the
                    // tooltip's centre (they diverge once edge-clamping kicks in).
                    tip.style.setProperty('--arrow-x', `${centerX - x}px`);
                    // Safety net: a `position:fixed` tooltip can get orphaned if the
                    // bar re-renders or another element covers the toggle so `mouseleave`
                    // never fires — leaving it stuck on screen. Always auto-hide it.
                    clearTimeout(_hideTimer);
                    _hideTimer = setTimeout(() => tip.classList.remove('discogs-tooltip-visible'), 4000);
                }, HOVER_DELAY_MS);
            });
            lbl.addEventListener('mouseleave', () => {
                clearTimeout(_showTimer);
                clearTimeout(_hideTimer);
                tip.classList.remove('discogs-tooltip-visible');
            });
        }
        lbl.addEventListener('click', (e) => {
            e.preventDefault();
            cb.checked = !cb.checked;
            lbl.classList.toggle('active', cb.checked);
            document.querySelectorAll('.discogs-tooltip-visible').forEach(t => t.classList.remove('discogs-tooltip-visible'));   // clicking dismisses any lingering tooltip
        });
        _optsHost.appendChild(lbl);
        return cb;
    }

    // Inline label + native `<select>` for binary/enum option picks (#94).
    // Read the chosen value via the returned element's `.value`. The wrapping
    // `<span>` carries the tooltip and a class for hover/persist hooks; the
    // returned element IS the `<select>` so callers don't have to drill into
    // the wrapper.
    function makeSelect(labelText, initialValue, options, tooltipText) {
        const wrap = document.createElement('span');
        wrap.className = 'discogs-select-wrap';
        // Borderless to match the toggles (#118).
        wrap.style.cssText = 'display:inline-flex;align-items:center;gap:0.3rem;font-size:0.8rem;color:#555;padding:0.15rem 0.2rem;border:none;background:transparent;';
        const lbl = document.createElement('span');
        lbl.textContent = labelText + ':';
        wrap.appendChild(lbl);
        const sel = document.createElement('select');
        sel.style.cssText = 'font-size:0.8rem;padding:0.05rem 0.2rem;border:none;background:transparent;cursor:pointer;color:#333;font-weight:600;';
        options.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.label;
            if (opt.value === initialValue) o.selected = true;
            sel.appendChild(o);
        });
        if (tooltipText) wrap.title = tooltipText;
        wrap.appendChild(sel);
        _optsHost.appendChild(wrap);
        return sel;
    }

    const OPTS_KEY = 'discogs-importer-opts';
    let savedOpts = {};
    try { savedOpts = JSON.parse(localStorage.getItem(OPTS_KEY) || '{}'); } catch(e) {}
    // #421 one-time reset: work duplicates were being created by careless "create works"
    // use, so THIS version starts everyone at 'never' regardless of what was saved — the
    // duplicate-works warning popup is then guaranteed to be seen when re-enabling.
    // (The key is shared with Credit Hoarder, so one reset covers both scripts.)
    if (!savedOpts.createWorksReset421) {
        savedOpts.createWorksMode = 'never';
        savedOpts.createWorksReset421 = true;
        delete savedOpts.createWorks;   // pre-#94 legacy key, superseded by the reset
        try { localStorage.setItem(OPTS_KEY, JSON.stringify(savedOpts)); } catch(e) {}
    }
    const bv = (k, d) => k in savedOpts ? savedOpts[k] : d;

    const tracklistCb    = makeCheckbox('Per-track credits',              bv('tracklist', true),
        'Import per-track artist credits from Discogs.');
    const applyTracksCb  = makeCheckbox('Move release credits to tracks', bv('applyTracks', false),
        'Move performance credits from the release down to every recording.');
    // "Create works" mode picker (#94; 'when-missing' — a work for EVERY recording —
    // removed in #421: it was a work-duplicate factory; dispatch still understands the
    // value defensively but the UI no longer offers it):
    //   never (default since #421): create no works at all. Work-only credits that
    //                               need a work that doesn't exist are logged and skipped.
    //   when-needed:                create a work only when there's a
    //                               composer/lyricist/writer credit to attach.
    const _initialCreateWorksMode = bv('createWorksMode', 'never') === 'when-needed' ? 'when-needed' : 'never';
    const createWorksMode = makeSelect('Create works', _initialCreateWorksMode, [
        { value: 'never',        label: 'never'        },
        { value: 'when-needed',  label: 'when needed'  },
    ], 'never: do not create works — work-only credits with no existing work are logged and skipped. when needed: create a work only when there is a composer/lyricist/writer credit to attach — match recordings to EXISTING works first (Group Therapy) or you will create duplicates.');
    // #421: choosing to create works must confront the duplicate-works responsibility.
    function showCreateWorksWarning() {
        const ov = document.createElement('div');
        ov.className = 'discogs-cw-warn-ov';
        ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(20,10,10,.45);display:flex;align-items:center;justify-content:center;';
        const box = document.createElement('div');
        box.style.cssText = 'max-width:460px;margin:16px;background:#fff;border-radius:8px;border-top:4px solid #c0392b;padding:16px 20px 14px;box-shadow:0 14px 44px rgba(0,0,0,.4);font-size:13px;line-height:1.55;color:#333;';
        box.innerHTML =
            '<div style="font-weight:800;color:#c0392b;font-size:15px;margin-bottom:8px;">⚠️ WARNING: Avoid creating work duplicates!</div>' +
            '<p style="margin:0 0 8px;">Make sure that you <strong>matched works</strong> prior to using this option. You are responsible for matching recordings to existing works.</p>' +
            '<p style="margin:0 0 12px;"><a href="https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/group_therapy/README.md" target="_blank" rel="noopener noreferrer">Group Therapy</a> userscript makes work matching faster and can start it as soon as you enter the relationship editor so you don’t forget.</p>' +
            '<div style="text-align:right;"><button type="button" style="padding:5px 18px;font-size:13px;font-weight:600;color:#fff;background:#c0392b;border:none;border-radius:5px;cursor:pointer;">I understand</button></div>';
        const close = () => ov.remove();
        box.querySelector('button').addEventListener('click', close);
        ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
        ov.appendChild(box);
        document.body.appendChild(ov);
        box.querySelector('button').focus();
    }
    createWorksMode.addEventListener('change', () => { if (createWorksMode.value === 'when-needed') showCreateWorksWarning(); });

    // ── Deduplication section (issue #62) ─────────────────────────────────
    // Two toggles that change how the dispatcher decides "this rel is
    // already there" against MB's pre-existing state. The third part of
    // #62 — editable "Credited as" per entity — lives in the review
    // table, not as a checkbox.
    // The secondary Dedup toggles fold into an "Options ▾" popover to keep the
    // single bar compact (#139).
    const optsBtn = document.createElement('button');
    optsBtn.type = 'button';
    optsBtn.className = 'discogs-opts-btn';
    optsBtn.innerHTML = 'Options <span class="discogs-opts-caret">▾</span>';
    optsBtn.title = 'Deduplication options';
    const optsPanel = document.createElement('div');
    optsPanel.className = 'discogs-opts-panel';
    const dedupHd = document.createElement('div');
    dedupHd.className = 'discogs-opts-panel-hd';
    dedupHd.textContent = 'Deduplication';
    optsPanel.appendChild(dedupHd);
    _optsHost = optsPanel;   // the next two toggles land inside the popover
    const dedupeEqCb  = makeCheckbox('Equivalence sets',  bv('dedupeEquivalenceSets', true),
        'Skip a role when an equivalent role already exists on the target (writer ≡ composer).');
    const dedupeDupCb = makeCheckbox('Duplicate roles',   bv('dedupeDuplicateRoles', true),
        'Skip adding a role when the target already has the same role (regardless of task / dates / attributes).');
    _optsHost = optsWrap;    // back to the inline strip
    optsWrap.appendChild(optsBtn);
    document.body.appendChild(optsPanel);   // floating; positioned when opened
    optsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = optsPanel.classList.toggle('open');
        if (!open) return;
        const r = optsBtn.getBoundingClientRect();
        optsPanel.style.left = Math.max(8, Math.min(r.left, window.innerWidth - optsPanel.offsetWidth - 8)) + 'px';
        optsPanel.style.top = (r.bottom + 4) + 'px';
        const off = ev => { if (!optsPanel.contains(ev.target) && ev.target !== optsBtn && !optsBtn.contains(ev.target)) { optsPanel.classList.remove('open'); document.removeEventListener('mousedown', off); } };
        setTimeout(() => document.addEventListener('mousedown', off), 0);
    });

    const saveOpts = () => {
        try { localStorage.setItem(OPTS_KEY, JSON.stringify({
            tracklist: tracklistCb.checked, applyTracks: applyTracksCb.checked,
            createWorksMode: createWorksMode.value,
            createWorksReset421: true,   // #421 one-time reset already applied — must survive every save
            dedupeEquivalenceSets: dedupeEqCb.checked,
            dedupeDuplicateRoles:  dedupeDupCb.checked,
        })); } catch(e) {}
    };
    [tracklistCb, applyTracksCb, dedupeEqCb, dedupeDupCb].forEach(cb =>
        cb.closest('label').addEventListener('click', () => setTimeout(saveOpts, 0)));
    createWorksMode.addEventListener('change', saveOpts);

    // ── Progress bar ──────────────────────────────────────────────────────────
    // `_showBar` / `_hideBar` (module-level, imported from progress-bar.js)
    // own the actual marquee element. The legacy `progressBar` /
    // `progressFill` / `progressStatus` / `recentLogsEl` shim objects were
    // removed — their writes hit dummy objects that never made it into the
    // DOM, so the lines were dead.

    // Output area
    const outputDiv = document.createElement('div');
    outputDiv.className = 'discogs-output empty';   // hidden until the first import writes a log
    // Log lives behind the header "Log ▾" button (#142). The review-table panel
    // sits in its own slot — ALWAYS visible, outside the toggled log panel — so
    // hiding the log never hides the review UI.
    const LOG_OPEN_KEY = 'discogs-importer-log-open';
    const reviewSlot = document.createElement('div');
    reviewSlot.className = 'discogs-review-slot';
    setReviewContainer(reviewSlot);

    const logPanel = document.createElement('div');
    logPanel.className = 'discogs-log-panel';
    // toolbar: severity filter (left) + copy buttons (right, populated on first import)
    const logToolbar = document.createElement('div');
    logToolbar.className = 'discogs-log-toolbar';
    const logFilter = document.createElement('div');
    logFilter.className = 'discogs-log-filter';
    [['all', 'All'], ['warn', '⚠ Warnings'], ['error', '⛔ Errors']].forEach(([f, label]) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'discogs-log-filterbtn' + (f === 'all' ? ' active' : ''); b.dataset.f = f; b.textContent = label;
        b.addEventListener('click', () => { outputDiv.dataset.logfilter = f; logFilter.querySelectorAll('button').forEach(x => x.classList.toggle('active', x.dataset.f === f)); });
        logFilter.appendChild(b);
    });
    // Copy buttons moved into the Log ▾ dropdown menu (#118); the toolbar keeps
    // just the severity filter.
    logToolbar.append(logFilter);
    const logBody = document.createElement('div');
    logBody.className = 'discogs-log-body';
    logPanel.append(logToolbar, logBody);
    outputDiv.append(reviewSlot, logPanel);
    outputDiv.dataset.logfilter = 'all';

    const applyLogOpen = () => { const open = localStorage.getItem(LOG_OPEN_KEY) === '1'; outputDiv.classList.toggle('log-open', open); logToggleBtn.classList.toggle('active', open); };
    try { applyLogOpen(); } catch (e) {}
    const setLogOpen = (open) => {
        outputDiv.classList.toggle('log-open', open);
        logToggleBtn.classList.toggle('active', open);
        try { localStorage.setItem(LOG_OPEN_KEY, open ? '1' : '0'); } catch (e) {}
    };

    // ── "Log ▾" dropdown menu (#118) ────────────────────────────────────────
    // The caret now opens a small menu: show/hide the in-page log, plus the
    // three copy actions (full log / log without JSON / raw Discogs JSON), which
    // used to live as buttons inside the log toolbar.
    const logMenu = document.createElement('div');
    logMenu.className = 'discogs-log-menu';
    const logMenuToggle = document.createElement('button');
    logMenuToggle.type = 'button';
    logMenuToggle.className = 'discogs-log-menu-toggle';
    const logMenuSep = document.createElement('div');
    logMenuSep.className = 'discogs-log-menu-sep';
    const mkMenuItem = (label, title, fn) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = label; b.title = title;
        b.addEventListener('click', () => fn(b, label));
        return b;
    };
    const copyLogItem     = mkMenuItem('Copy log',          'Copy the full import log (incl. raw Discogs JSON)',                  (b, l) => bar._copy?.log(b, l));
    const copyNoJsonItem  = mkMenuItem('Copy without JSON', 'Copy the log without the raw Discogs JSON block — fits in a GitHub issue', (b, l) => bar._copy?.noJson(b, l));
    const copyDiscogsItem = mkMenuItem('Copy Discogs',      'Copy the raw Discogs JSON for this release',                          (b, l) => bar._copy?.discogs(b, l));
    logMenu.append(logMenuToggle, logMenuSep, copyLogItem, copyNoJsonItem, copyDiscogsItem);
    document.body.appendChild(logMenu);

    logMenuToggle.addEventListener('click', () => {
        setLogOpen(!outputDiv.classList.contains('log-open'));
        logMenu.classList.remove('open');
    });

    logToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = logMenu.classList.toggle('open');
        if (!open) return;
        logMenuToggle.textContent = outputDiv.classList.contains('log-open') ? 'Hide log' : 'Show log in page';
        const r = logToggleBtn.getBoundingClientRect();
        logMenu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - logMenu.offsetWidth - 8)) + 'px';
        logMenu.style.top = (r.bottom + 4) + 'px';
        const off = ev => { if (!logMenu.contains(ev.target) && ev.target !== logToggleBtn && !logToggleBtn.contains(ev.target)) { logMenu.classList.remove('open'); document.removeEventListener('mousedown', off); } };
        setTimeout(() => document.addEventListener('mousedown', off), 0);
    });

    // ── Header badge wiring (#118) ──────────────────────────────────────────
    // A badge click opens the log if it's collapsed, switches to the matching
    // severity filter, and scrolls to the first line of that severity. The
    // scroll offsets for the pinned (position:fixed) toolbar so the target line
    // lands just below it instead of hidden behind it — `block:'nearest'` used
    // to leave it under the fixed header, which read as "nothing happened".
    function openLog(filter, scrollSel) {
        const f = filter || 'all';
        outputDiv.classList.add('log-open');          // switch the log open if it wasn't
        logToggleBtn.classList.add('active');
        try { localStorage.setItem(LOG_OPEN_KEY, '1'); } catch (e) {}
        outputDiv.dataset.logfilter = f;              // select the right filter…
        logFilter.querySelectorAll('button').forEach(x => x.classList.toggle('active', x.dataset.f === f));
        // …then position the view on the first matching line (rAF so the now-
        // visible panel has laid out before we measure).
        requestAnimationFrame(() => {
            const target = (scrollSel && logBody.querySelector(scrollSel)) || logPanel;
            const headerH = bar.classList.contains('is-pinned') ? row1.getBoundingClientRect().height + 6 : 0;
            const top = target.getBoundingClientRect().top + window.scrollY - headerH - 10;
            window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        });
    }
    warnPill.addEventListener('click', () => openLog('warn',  'li[data-sev="warn"]'));
    errPill.addEventListener('click', () => openLog('error', 'li[data-sev="error"]'));
    unresolvedPill.addEventListener('click', () => openLog('all', 'li[data-sev="skip"]'));

    // Live WARN/ERR tallies from the logger (#118). Pills hide at zero.
    onLogCounts((w, e) => {
        warnPill.textContent = `⚠ ${w}`;
        warnPill.style.display = w > 0 ? '' : 'none';
        errPill.textContent = `⛔ ${e}`;
        errPill.style.display = e > 0 ? '' : 'none';
    });
    // Unresolved count is set once dispatch starts (runImport reads it off the
    // confirmed map). Kept visually separate from the WARN pill (#118).
    bar._setUnresolved = (n) => {
        unresolvedPill.textContent = `⊘ ${n} unresolved`;
        unresolvedPill.style.display = n > 0 ? '' : 'none';
    };

    importBtn.addEventListener('click', () => {
        importBtn.disabled = true;
        importBtn.textContent = 'Importing…';
        progressPct.style.display = 'inline';
        progressPct.textContent = '0%';

        // Pin the toolbar for the import AND keep it pinned afterwards (#118).
        bar.classList.add('is-importing', 'is-pinned');
        bar._pin();
        _showBar();
        bar.scrollIntoView({ behavior: 'smooth', block: 'start' });
        bar._showProgress = () => { _showBar(); };
        requestAnimationFrame(bar._showProgress);

        // Fresh run → zero the badge tallies + clear any prior status line (#118).
        resetLogCounts();
        bar._setUnresolved(0);
        statusEl.textContent = '';
        statusEl.style.display = 'none';

        // Fresh log/summary elements each run
        _logs = document.createElement('ul');
        _logs.className = 'logs';
        setLogContainer(_logs);
        _summary = document.createElement('p');
        _summary.className = 'summary';
        logBody.innerHTML = '';
        logBody.appendChild(_summary);
        logBody.appendChild(_logs);
        outputDiv.classList.remove('empty');   // there's a log now → reveal the section + the header Log button
        logToggleBtn.style.display = '';

        // Two "Copy log" variants:
        //   - "Copy log"           — full output, includes the raw Discogs JSON block
        //   - "Copy log (no JSON)" — skips the JSON block so the paste fits in a
        //                            GitHub issue (the JSON alone is often >50 kB)
        //
        // Both wrap the output in `<details><summary>{releaseName}</summary>…
        // </details>` so a forum / issue paste collapses by default and shows
        // just the release name as the click-to-expand summary. (Issue #46.)
        function buildCopyText({ skipDiscogsJson }) {
            function htmlToMd(el) {
                function nodeToMd(node) {
                    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
                    const tag = node.tagName?.toLowerCase();
                    const inner = [...node.childNodes].map(nodeToMd).join('');
                    if (tag === 'strong' || tag === 'b') return `**${inner}**`;
                    if (tag === 'em' || tag === 'i') return `_${inner}_`;
                    if (tag === 'a') return `[${inner}](${node.href})`;
                    if (tag === 'br') return '\n';
                    if (tag === 'pre') {
                        // Raw JSON block — wrap in fenced code
                        return '\n```json\n' + node.textContent + '\n```\n';
                    }
                    if (tag === 'details') {
                        const sum = node.querySelector('summary');
                        // Plain-text summary only. Markdown inside `<details><summary>`
                        // is not rendered by GitHub, and interactive elements like
                        // `<button>` (e.g. "Copy JSON") don't belong in the copy. So
                        // skip `<button>`/`<input>` entirely and strip markdown
                        // wrappers like `<strong>` to their text content. (Nitpick
                        // #1 from majkinetor on #87: previously the summary read
                        // `**...** Copy JSON`.)
                        const sumText = sum ? [...sum.childNodes].map(n => {
                            if (n.nodeType === Node.TEXT_NODE) return n.textContent;
                            const t = n.tagName?.toLowerCase();
                            if (t === 'button' || t === 'input') return '';
                            return n.textContent;
                        }).join('').trim() : '';
                        // The raw-Discogs-JSON block is itself a `<details>`
                        // whose summary contains "raw Discogs JSON" — skip the
                        // whole thing (including the summary) when the user
                        // chose the no-JSON variant.
                        if (skipDiscogsJson && /raw Discogs JSON/i.test(sumText)) {
                            return '';
                        }
                        // Get non-summary children
                        const body = [...node.childNodes].filter(n => n !== sum).map(nodeToMd).join('');
                        // Surround the block with blank lines so GitHub treats it
                        // as its own paragraph. Without them, neighbouring log
                        // lines collapse into the HTML block and lose their
                        // markdown line breaks (nitpick #3).
                        return '\n\n<details><summary>' + sumText + '</summary>\n\n' + body + '\n</details>\n\n';
                    }
                    if (tag === 'summary') return ''; // handled by details
                    if (tag === 'span') return inner;
                    if (tag === 'div') return inner + '\n';
                    if (tag === 'ul') return inner;
                    if (tag === 'li' && el !== node) return '- ' + inner + '\n';
                    if (tag === 'table') {
                        const rows = [...node.querySelectorAll('tr')];
                        if (!rows.length) return '';
                        const cells = rows.map(r => [...r.querySelectorAll('th,td')].map(c => c.innerText.trim().replace(/\|/g,'\\|')));
                        const widths = cells[0]?.map((_, i) => Math.max(...cells.map(r => (r[i]||'').length), 3));
                        const pad = (s, w) => s + ' '.repeat(Math.max(0, w - s.length));
                        const mdRows = cells.map(row => '| ' + row.map((c,i) => pad(c, widths[i])).join(' | ') + ' |');
                        if (mdRows.length > 1) mdRows.splice(1, 0, '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |');
                        return '\n\n' + mdRows.join('\n') + '\n\n';
                    }
                    return inner;
                }
                const _md = nodeToMd(el); return _md.startsWith('\n\n') || _md.endsWith('\n\n') ? _md : _md.replace(/^\n/, '').replace(/\n$/, '');
            }
            // The review panel now lives outside the log (#142); include it so a
            // mid-review copy still substitutes its static table (nitpick #2 on #87).
            const _panel = document.querySelector('.discogs-review-slot .discogs-review-panel-li');
            const lines = [...(_panel ? [_panel] : []), ..._logs.querySelectorAll('li')].map(li => {
                // Swap the interactive review-panel `<li>` for the static
                // markdown-table form when copying mid-review (nitpick #2 on
                // #87). `review-table.js` stashes a `_buildStaticTableLi`
                // closure on the panel `<li>`; calling it returns a fresh
                // `<li>` containing the table with the user's current picks,
                // which we feed through `htmlToMd` instead of the panel.
                // Post-import the panel is gone and the static table lives
                // in the log on its own, so this branch never fires then.
                if (li.classList?.contains('discogs-review-panel-li') && typeof li._buildStaticTableLi === 'function') {
                    return htmlToMd(li._buildStaticTableLi());
                }
                const md = htmlToMd(li);
                if (!md) return ''; // skipped details emit empty — drop the line
                // Add trailing two-spaces for markdown line breaks, except tables/details
                if (md.startsWith('\n\n|') || md.startsWith('<details>')) return md;
                return md + '  ';
            }).filter(Boolean).join('\n');
            // Release-name summary — MB's editor state is the canonical source;
            // fall back to the document title if the editor state isn't mounted
            // (shouldn't happen on a release-edit page, but defensive).
            const releaseName = pageWindow?.MB?.relationshipEditor?.state?.entity?.name
                             || document.title.replace(/ - MusicBrainz.*/, '').trim()
                             || 'Import log';
            return `<details><summary>${releaseName}</summary>\n\n${lines}\n\n</details>`;
        }

        function copyToClipboard(text, btn, restoreText) {
            const restore = () => {
                btn.textContent = 'Copied!';
                setTimeout(() => { btn.textContent = restoreText; }, 1500);
            };
            const fallback = () => {
                const ta = Object.assign(document.createElement('textarea'), { value: text });
                document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
                restore();
            };
            if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(text).then(restore, fallback);
            } else {
                fallback();
            }
        }

        // Expose the copy actions for the Log ▾ dropdown menu (#118). The menu is
        // built at mount but only reachable after the first import (the Log button
        // is hidden until then), so wiring the closures here is enough. `_discogsJson`
        // is a module var set by `runImport`, read at click time.
        bar._copy = {
            log:     (item, label) => copyToClipboard(buildCopyText({ skipDiscogsJson: false }), item, label),
            noJson:  (item, label) => copyToClipboard(buildCopyText({ skipDiscogsJson: true  }), item, label),
            discogs: (item, label) => { if (_discogsJson) copyToClipboard(JSON.stringify(_discogsJson, null, 2), item, label); },
        };

        // Expose progress update hook. `dispatchAllRelationships` pushes the
        // percentage; the logger (`log.js`) pushes the latest plain-text line,
        // which we surface in the header status slot so it's obvious work is
        // happening in the background while the log is collapsed (#118 pt 5).
        bar._setProgress = (pct, text) => {
            if (pct !== null && pct >= 100) _hideBar();
            if (text && bar.classList.contains('is-importing')) {
                statusEl.textContent = text;
                statusEl.style.display = '';
            }
        };

        // Re-show progress bar
        requestAnimationFrame(_showBar);

        // Options getter — read current control state on demand. `runImport`
        // calls it once at preflight start and AGAIN right before dispatch,
        // so toggling any option during the review-table phase (#94 follow-up
        // from majkinetor) takes effect at dispatch time. Previously the
        // values were captured at click time and frozen.
        const getOpts = () => ({
            processTracklist:        tracklistCb.checked,
            applyToTracks:           applyTracksCb.checked,
            createWorksMode:         createWorksMode.value,
            dedupeEquivalenceSets:   dedupeEqCb.checked,
            dedupeDuplicateRoles:    dedupeDupCb.checked,
        });
        const _click = getOpts();
        const opts = `per-track:${_click.processTracklist?'on':'off'}, move-to-tracks:${_click.applyToTracks?'on':'off'}, create-works:${_click.createWorksMode}`;
        const editNote = buildEditNote(discogsUrl, opts);
        editNote.split('\n').forEach(line => {
            if (!line.trim()) return;
            // Make URLs clickable in the log
            const html = line.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer nofollow">$1</a>');
            log.info(html);
        });
        runImport(discogsUrl, getOpts).finally(() => {
            importBtn.disabled = false;
            importBtn.textContent = 'Import from Discogs';
            progressPct.textContent = '100%';
            setTimeout(() => { progressPct.style.display = 'none'; }, 2000);
            bar.classList.remove('is-reviewing');   // #139: safety — clear if the flow ended during review
            setTimeout(() => {
                // Keep `is-pinned` — the toolbar stays on top after the import so
                // the WARN/ERR badge remains visible (#118). Only the import-phase
                // marquee + status line go away.
                bar.classList.remove('is-importing');
                _hideBar();
                // (no clear here) — leave the last status line in place so the
                // "Done: N added…" summary stays visible in the toolbar after import.
                bar._pin();   // re-measure the spacer for the badge-bearing header height
            }, 2000);
            delete bar._setProgress;
        });
    });

    bar.appendChild(outputDiv);

    // Insert the bar at the very top of the page content area.
    // The MB edit-relationships page wraps everything in #content > .release-rel-editor
    // (or similar). We want to be the very first thing inside that wrapper,
    // above any other userscript toolbars (e.g. loujine batch tools).
    function insertBar() {
        // Try the most specific anchor first: the inner content div of the rel editor
        const anchor =
            document.querySelector('.release-rel-editor') ||   // MB React wrapper
            document.querySelector('#content > div') ||        // generic first content div
            document.querySelector('#content');                 // fallback: content root
        if (!anchor) return setTimeout(insertBar, 300);
        anchor.insertBefore(bar, anchor.firstChild);
    }
    insertBar();
}
(function cleanupLocalStorage() {
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k) continue;
            // Remove old full-JSON Discogs release caches
            if (k.startsWith('discogs-release-')) keysToRemove.push(k);
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch(e) {}
})();
function runImport(discogsUrl, getOpts) {
    // Initial snapshot — used for the preflight phase (per-track decision is
    // baked in here because it controls which entities are resolved). The
    // OTHER options (move-to-tracks, create-works, dedup) are re-read just
    // before dispatch so users can flip them during the review phase
    // (#94 follow-up).
    const initial = getOpts();
    const { processTracklist } = initial;
    return getDiscogsReleaseData(discogsUrl)
        .then(json => {
            _discogsJson = json;   // #118: stash for the Log ▾ "Copy Discogs" item
            let artistRoles = rolesFromDiscogsArtists(json.extraartists?.filter(artist => !artist.tracks));
            // ── Raw Discogs JSON (collapsible, once per log session) ─────────────────
            if (!_logs._releaseInfoAdded) {
                _logs._releaseInfoAdded = true;
                // Flatten so index-style tracklists (classical / multi-movement
                // releases that nest tracks under `sub_tracks`) count their
                // real tracks instead of reporting 0 (#112 follow-up).
                const trackCount = flattenTracklist(json.tracklist).filter(t => t.type_ === 'track').length;
                const summary = `${json.title || ''}${json.year ? ' \u00b7 ' + json.year : ''} \u00b7 ${trackCount} tracks`;
                const li = document.createElement('li');
                const pre = document.createElement('pre');
                pre.style.cssText = 'max-height:400px;overflow:auto;font-size:0.72rem;background:#f8f8f8;padding:0.5rem;border:1px solid #ddd;border-radius:3px;margin:0.3rem 0 0 0;white-space:pre-wrap;word-break:break-all;';
                pre.textContent = JSON.stringify(json, null, 2);
                // "Copy JSON" button removed — copying the raw Discogs JSON moved
                // to the Log ▾ menu's "Copy Discogs" item (#118).
                li.innerHTML = `<details><summary style="cursor:pointer;user-select:none;"><strong>${summary} — raw Discogs JSON</strong></summary></details>`;
                li.querySelector('details').appendChild(pre);
                _logs.appendChild(li);
            }
            log.info(`Found ${json.companies.length + artistRoles.length} release relationships`);
            // handle potential dj mixes - if the tracks are the full medium then assign it to the release/medium else leave it as individual tracks
            artistRoles = artistRoles.concat(convertPotentialDJMixers(json));
            let tracklistRels = [];
            if (processTracklist) {
                // #112: classical / multi-movement releases store tracks
                // under `index` parents in `sub_tracks`. Flatten first or
                // every per-track credit gets dropped.
                tracklistRels = flattenTracklist(json.tracklist)
                    .filter(track => track.type_ === 'track')
                    .reduce((map, track) => {
                        if (!track.extraartists || !Array.isArray(track.extraartists)) {
                            return map;
                        }
                        return map.concat(
                            rolesFromDiscogsArtists(track.extraartists).map(rel => {
                                return Object.assign({}, rel, {
                                    track: track,
                                });
                            })
                        );
                    }, []);
                const releaseLevelTracklistRels = json.extraartists?.filter(artist => artist.tracks && artist.tracks !== '') || [];
                if (releaseLevelTracklistRels.length > 0) {
                    tracklistRels = tracklistRels.concat(
                        releaseLevelTracklistRels.reduce((array, artist) => {
                            return array.concat(
                                getAllArtistTracks(json.tracklist, artist.tracks).reduce((array, track) => {
                                    return array.concat(
                                        getArtistRoles(artist).map(rel => {
                                            return Object.assign({}, rel, {
                                                artist: artist,
                                                track: track,
                                            });
                                        })
                                    );
                                }, [])
                            );
                        }, [])
                    );
                }
                log.info(`Found ${tracklistRels.length} tracklist relationships`);
            }

            // Collect all unique artist entities referenced across release-level and tracklist roles
            const allArtistRoles = artistRoles.concat(tracklistRels);
            const uniqueArtists = [];
            const seenResourceUrls = new Set();
            // rolesMap: resource_url → [{linkType, trackPos, trackTitle}]
            const rolesMap = new Map();
            allArtistRoles.forEach(role => {
                const url = role.artist?.resource_url || `_nourl_${role.artist?.name || role.artist?.id}`;
                if (!rolesMap.has(url)) rolesMap.set(url, []);
                // Build display label: instrument/vocal name > linkType
                let displayLabel = role.linkType;
                if (role.attributes && role.attributes.length > 0) {
                    const attr = role.attributes[0];
                    if (attr._type === 'instrument' && attr.value) displayLabel = attr.value;
                    else if (attr._type === 'vocal' && attr.value) displayLabel = attr.value;
                    else if (typeof attr === 'string') displayLabel = `${role.linkType} [${attr}]`;
                }
                rolesMap.get(url).push({
                    linkType: role.linkType,
                    displayLabel,
                    trackPos: role.track?.position || '',
                    trackTitle: role.track?.title || '',
                });
                if (!seenResourceUrls.has(url)) {
                    seenResourceUrls.add(url);
                    // (was: `getDiscogsLinkKey(role.artist.resource_url)` for
                    //  side-effect-populating the link_infos global; the
                    //  preflight code now calls parseDiscogsUrl itself, so no
                    //  pre-population needed.)
                    // Attach synthetic key for artists with no Discogs URL
                    if (!role.artist?.resource_url && role.artist) role.artist._syntheticKey = url;
                    uniqueArtists.push(role.artist);
                }
            });
            // Also add company roles to a companiesRolesMap
            const companiesRolesMap = new Map();
            json.companies.forEach(c => {
                if (!c.resource_url) return;
                if (!companiesRolesMap.has(c.resource_url)) companiesRolesMap.set(c.resource_url, []);
                companiesRolesMap.get(c.resource_url).push({ linkType: c.entity_type_name || '' });
            });

            // Pre-flight: check artists and companies, show unified review table.
            const uniqueCompanies = [];
            const seenCompanyUrls = new Set();
            json.companies.forEach(c => {
                if (c.resource_url && !seenCompanyUrls.has(c.resource_url) && ENTITY_TYPE_MAP[c.entity_type_name]) {
                    seenCompanyUrls.add(c.resource_url);
                    uniqueCompanies.push(c);
                }
            });

            // ── Pre-flight ───────────────────────────────────────────────
            // No release-level cache layer: the IDB `entity_cache` (per-entity
            // Discogs-id → MBID, written by `resolveEntity` and on user confirm)
            // already short-circuits the slow MB API calls for entities we've
            // ever resolved. Walking 80–150 IDB rows on every page open is
            // cheap; carrying a second cache that snapshots whole-release
            // review-table state was net-negative once the entity layer
            // existed (stale-shape footguns > the marginal speedup on
            // same-release re-opens, which are rare).
            // `bypassIdb` forces a fresh MB lookup per entity even when the
            // IDB `entity_cache` already has it — wired to the review-table's
            // "🔄 Refresh from MB" button so the user can re-resolve when a
            // cached entry is stale (entity got merged, renamed, etc.).
            function runPreflight(bypassIdb = false) {
                log.info(`Starting preflight: ${uniqueArtists.length} artist(s), ${uniqueCompanies.length} label(s)/place(s).`);

                const artistProgressLi = document.createElement('li');
                artistProgressLi.textContent = `Checking ${uniqueArtists.length} artist(s) against MusicBrainz…`;
                _logs.appendChild(artistProgressLi);

                const companyProgressLi = document.createElement('li');
                companyProgressLi.textContent = `Checking ${uniqueCompanies.length} label(s)/place(s) against MusicBrainz…`;
                _logs.appendChild(companyProgressLi);

                // Sequential, not parallel. Both `resolveAll` calls share
                // the same `mbThrottle` (one chokepoint, one MB server), so
                // running them in parallel just doubles the worker count
                // competing for the throttle's 4 slots and bursts harder
                // at startup — exactly what tripped MB's rate limiter in
                // #87 (a stream of 503s with `Retry-After: 9`). Serialised,
                // the total time is the same (throttle-bound) but the
                // request rate is smooth and burst-free.
                const t0 = performance.now();
                return (async () => {
                    const artistResults  = await resolveAll(uniqueArtists, {
                        progressLi:    artistProgressLi,
                        progressLabel: 'Checking artists against MusicBrainz',
                        kindOf:        ARTIST_KIND,
                        bypassIdb,
                    });
                    const companyResults = await resolveAll(uniqueCompanies, {
                        progressLi:    companyProgressLi,
                        progressLabel: 'Checking labels/places against MusicBrainz',
                        kindOf:        COMPANY_KIND,
                        bypassIdb,
                    });
                    const elapsed = (performance.now() - t0) / 1000;
                    log.info(`Preflight done in ${elapsed.toFixed(1)}s.`);
                    return [...artistResults.allResults, ...companyResults.allResults].filter(Boolean);
                })();
            }

            // Annotate each result with its Discogs roles. Used both on the
            // initial run and on the refresh-from-MB pass below.
            function annotateRoles(allResults) {
                allResults.forEach(r => {
                    if (!r) return;
                    const url = r.entity?.resource_url || r.entity?._syntheticKey;
                    if (url) r._roles = rolesMap.get(url) || companiesRolesMap.get(url) || [];
                });
            }

            let capturedResults = null; // shared across promise chain
            let capturedConfirmedMap = null;

            return runPreflight().then(allResults => {
                annotateRoles(allResults);
                capturedResults = allResults;
                // #139: the review wait isn't an active import phase — hide the
                // "Importing…" button + percentage while the user reviews.
                document.querySelector('.discogs-bar')?.classList.add('is-reviewing');
                return showReviewTable(capturedResults, rolesMap, companiesRolesMap, {
                    // Mount the Start-import button + unresolved message in the
                    // always-visible header rather than below the table (#139).
                    // Resolved via the DOM (there's one bar) — `runImport` is a
                    // separate function from the bar builder that owns the slot.
                    headerSlot: document.querySelector('.discogs-bar-action'),
                    // "🔄 Refresh from MB" — bypass the IDB cache and re-resolve
                    // every entity via MB API. Used when a cached MBID is stale.
                    onRefresh: () => runPreflight(true).then(freshResults => {
                        annotateRoles(freshResults);
                        capturedResults = freshResults;
                        return freshResults;
                    }),
                });
            })
                .then(confirmedMap => {
                    capturedConfirmedMap = confirmedMap;
                    // #139: dispatch is starting — a real import phase again, so
                    // restore the "Importing…" button + percentage.
                    document.querySelector('.discogs-bar')?.classList.remove('is-reviewing');
                    // Surface the count of entities the user left unresolved in
                    // the header badge — kept separate from the WARN tally (#118).
                    document.querySelector('.discogs-bar')?._setUnresolved?.(confirmedMap.unresolvedCount || 0);
                    // Bulk-write confirmed entries to IDB. Inline writes in
                    // `setRowResolved` (review-table) and `resolveEntity`
                    // (preflight) already persist as each entity resolves
                    // (issue #23), so this is a final correctness sweep.
                    // `writeIdbRecord` merges, so name/disambiguation set by
                    // the inline writes survive.
                    const cachePromises = [];
                    confirmedMap.forEach((mbUrl, resourceUrl) => {
                        const key = parseDiscogsUrl(resourceUrl)?.key;
                        if (!key) return;
                        // mbUrl is `//musicbrainz.org/<entityType>/<mbid>` —
                        // extract both halves so the new schema's `mbid` and
                        // `entityType` fields stay populated.
                        const m = mbUrl.match(/\/(artist|label|place)\/([a-f0-9-]+)/);
                        if (!m) return;
                        cachePromises.push(writeIdbRecord(key, {
                            mbid:       m[2],
                            entityType: m[1],
                            // No resolvedVia change — the inline write owns it.
                        }));
                    });
                    return Promise.all(cachePromises);
                })
                .then(() => {
                    // Build resolved entity type map from preflight results
                    const resolvedEntityTypes = new Map();
                    (capturedResults || []).forEach(r => {
                        if (r.entity?.resource_url && r.mbUrl && r.entityType) {
                            resolvedEntityTypes.set(r.entity.resource_url, r.entityType);
                        }
                    });
                    // Re-read options at dispatch time so toggles changed
                    // during the review phase take effect (#94 follow-up).
                    // `processTracklist` is the one exception — it controls
                    // which entities got preflighted, so we honor the
                    // initial value (changing it mid-flight can't
                    // retroactively add or skip preflight work).
                    const live = getOpts();
                    if (live.processTracklist !== processTracklist) {
                        log.warn(`"Per-track credits" toggled during review (preflight ran with "${processTracklist?'on':'off'}", import will follow preflight). To change, restart the import.`);
                    }
                    // Bundle the dedup options + the Credited-as override
                    // map (the review table stashes it on confirmedMap as
                    // `creditOverrides`). `dispatchAllRelationships` reads
                    // them from a trailing opts arg per #62.
                    const dedupOpts = {
                        dedupeEquivalenceSets: live.dedupeEquivalenceSets,
                        dedupeDuplicateRoles:  live.dedupeDuplicateRoles,
                        creditOverrides: capturedConfirmedMap?.creditOverrides,
                    };
                    return dispatchAllRelationships(json.companies, artistRoles, tracklistRels, live.applyToTracks, live.createWorksMode, json.tracklist, processTracklist, resolvedEntityTypes, capturedConfirmedMap, discogsUrl, dedupOpts);
                });
        })
        .then(() => { });
}
