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
            padding: 0.5rem 0.75rem;
            background: #fdf8f0;
            border-bottom: 1px solid #eeddb0;
        }
        .discogs-bar img.discogs-logo {
            height: 20px;
            width: auto;
            flex-shrink: 0;
            opacity: 0.85;
        }
        .discogs-bar .discogs-source {
            flex: 1;
            font-size: 0.82rem;
            color: #555;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
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
        .discogs-toggle {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            padding: 0.15rem 0.55rem 0.15rem 0.35rem;
            border: 1px solid #d8c8a0;
            border-radius: 2rem;
            background: #fffdf7;
            cursor: pointer;
            font-size: 0.8rem;
            color: #555;
            user-select: none;
            transition: background 0.12s, border-color 0.12s;
        }
        .discogs-toggle:hover { border-color: #e8771d; color: #333; }
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
            background: #fff8ee;
            border-color: #e8771d;
            color: #333;
        }
        .discogs-toggle.active .discogs-toggle-dot {
            border-color: #e8771d;
            background: #e8771d;
        }
        .discogs-output { padding: 0.5rem 0.75rem 0.25rem; }
        .discogs-output .summary { margin: 0 0 0.25rem; font-size: 0.88rem; color: #555; }
        .discogs-output .logs { margin: 0; padding-left: 1.2rem; font-size: 0.83rem; }
        /* ── Progress / sticky bar ── */
        .discogs-bar.is-importing .discogs-bar-row1 {
            position: fixed;
            top: 0; left: 0; right: 0;
            z-index: 9000;
            background: #fdf8f0;
            border-bottom: 1px solid #eeddb0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
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

    const logo = document.createElement('img');
    logo.src = DISCOGS_LOGO_URL;
    logo.className = 'discogs-logo';
    logo.alt = 'Discogs';
    row1.appendChild(logo);

    const sourceSpan = document.createElement('span');
    sourceSpan.className = 'discogs-source';
    sourceSpan.innerHTML = `<a href="${discogsUrl}" target="_blank" rel="noopener noreferrer nofollow">${discogsUrl}</a>`;
    row1.appendChild(sourceSpan);

    // Documentation link on the far-right side of row1 (#90). URL falls
    // back the same way `buildEditNote` resolves it: the manager-injected
    // `@homepageURL`, then `@homepage`, then a hard-coded README.md link
    // so the link works even if the userscript manager strips metadata.
    const docsHref = (typeof GM_info !== 'undefined' && (
        GM_info?.script?.homepageURL || GM_info?.script?.homepage
    )) || 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/discogs_credits/README.md';
    const docsLink = document.createElement('a');
    docsLink.href = docsHref;
    docsLink.target = '_blank';
    docsLink.rel = 'noopener noreferrer nofollow';
    docsLink.textContent = '📖 Documentation';
    docsLink.title = 'Open the script\'s README in a new tab';
    docsLink.style.cssText = 'flex-shrink:0;font-size:0.82rem;color:#7a5000;text-decoration:none;padding:0.1rem 0.45rem;border:1px solid #d4b800;border-radius:0.25rem;background:#fff8e6;';
    row1.appendChild(docsLink);

    bar.appendChild(row1);

    // ── Row 2: option toggles ─────────────────────────────────────────────────
    const row2 = document.createElement('div');
    row2.className = 'discogs-bar-row2';

    const optsLabel = document.createElement('span');
    optsLabel.className = 'discogs-opts-label';
    optsLabel.textContent = 'Options:';
    row2.appendChild(optsLabel);

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
            let _showTimer;
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
                }, HOVER_DELAY_MS);
            });
            lbl.addEventListener('mouseleave', () => {
                clearTimeout(_showTimer);
                tip.classList.remove('discogs-tooltip-visible');
            });
        }
        lbl.addEventListener('click', (e) => {
            e.preventDefault();
            cb.checked = !cb.checked;
            lbl.classList.toggle('active', cb.checked);
        });
        row2.appendChild(lbl);
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
        wrap.style.cssText = 'display:inline-flex;align-items:center;gap:0.3rem;font-size:0.8rem;color:#555;padding:0.15rem 0.2rem 0.15rem 0.55rem;border:1px solid #d8c8a0;border-radius:2rem;background:#fffdf7;';
        const lbl = document.createElement('span');
        lbl.textContent = labelText + ':';
        wrap.appendChild(lbl);
        const sel = document.createElement('select');
        sel.style.cssText = 'font-size:0.8rem;padding:0.05rem 0.3rem;border:1px solid #d8c8a0;border-radius:1rem;background:#fff8ee;cursor:pointer;color:#333;font-weight:600;';
        options.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.label;
            if (opt.value === initialValue) o.selected = true;
            sel.appendChild(o);
        });
        if (tooltipText) wrap.title = tooltipText;
        wrap.appendChild(sel);
        row2.appendChild(wrap);
        return sel;
    }

    const OPTS_KEY = 'discogs-importer-opts';
    let savedOpts = {};
    try { savedOpts = JSON.parse(localStorage.getItem(OPTS_KEY) || '{}'); } catch(e) {}
    const bv = (k, d) => k in savedOpts ? savedOpts[k] : d;

    const tracklistCb    = makeCheckbox('Per-track credits',              bv('tracklist', true),
        'Import per-track artist credits from Discogs.');
    const applyTracksCb  = makeCheckbox('Move release credits to tracks', bv('applyTracks', false),
        'Move performance credits from the release down to every recording.');
    // "Create works" mode picker (#94, "never" option restored later):
    //   when-needed (default): create a work only when there's a
    //                           composer/lyricist/writer credit to attach.
    //   when-missing:          create a work for EVERY recording without one,
    //                           credits or no credits (old `createWorks=true`).
    //   never:                  create no works at all (old `createWorks=false`).
    //                           Work-only credits that need a work that doesn't
    //                           exist are logged and skipped.
    // Migration: legacy `createWorks: true` → 'when-missing'; `createWorks: false`
    // → 'never' (the explicit opt-out path the #94 picker lost); otherwise
    // 'when-needed'.
    const _legacyCreateWorks = savedOpts.createWorks;
    const _initialCreateWorksMode = bv('createWorksMode',
        _legacyCreateWorks === true  ? 'when-missing' :
        _legacyCreateWorks === false ? 'never' :
                                       'when-needed');
    const createWorksMode = makeSelect('Create works', _initialCreateWorksMode, [
        { value: 'when-needed',  label: 'when needed'  },
        { value: 'when-missing', label: 'when missing' },
        { value: 'never',        label: 'never'        },
    ], 'when needed: create a work only when there is a composer/lyricist/writer credit to attach. when missing: create a work for every recording without one. never: do not create works — work-only credits with no existing work are logged and skipped.');

    // ── Deduplication section (issue #62) ─────────────────────────────────
    // Two toggles that change how the dispatcher decides "this rel is
    // already there" against MB's pre-existing state. The third part of
    // #62 — editable "Credited as" per entity — lives in the review
    // table, not as a checkbox.
    const dedupSep = document.createElement('span');
    dedupSep.textContent = 'Dedup:';
    dedupSep.style.cssText = 'margin:0 0.2rem 0 0.6rem;color:#888;font-size:0.85rem;font-weight:600;';
    row2.appendChild(dedupSep);
    const dedupeEqCb  = makeCheckbox('Equivalence sets',  bv('dedupeEquivalenceSets', true),
        'Skip a role when an equivalent role already exists on the target (writer ≡ composer).');
    const dedupeDupCb = makeCheckbox('Duplicate roles',   bv('dedupeDuplicateRoles', true),
        'Skip adding a role when the target already has the same role (regardless of task / dates / attributes).');

    const saveOpts = () => {
        try { localStorage.setItem(OPTS_KEY, JSON.stringify({
            tracklist: tracklistCb.checked, applyTracks: applyTracksCb.checked,
            createWorksMode: createWorksMode.value,
            dedupeEquivalenceSets: dedupeEqCb.checked,
            dedupeDuplicateRoles:  dedupeDupCb.checked,
        })); } catch(e) {}
    };
    [tracklistCb, applyTracksCb, dedupeEqCb, dedupeDupCb].forEach(cb =>
        cb.closest('label').addEventListener('click', () => setTimeout(saveOpts, 0)));
    createWorksMode.addEventListener('change', saveOpts);

    bar.appendChild(row2);

    // ── Progress bar ──────────────────────────────────────────────────────────
    // `_showBar` / `_hideBar` (module-level, imported from progress-bar.js)
    // own the actual marquee element. The legacy `progressBar` /
    // `progressFill` / `progressStatus` / `recentLogsEl` shim objects were
    // removed — their writes hit dummy objects that never made it into the
    // DOM, so the lines were dead.

    // Output area
    const outputDiv = document.createElement('div');
    outputDiv.className = 'discogs-output';

    importBtn.addEventListener('click', () => {
        importBtn.disabled = true;
        importBtn.textContent = 'Importing…';
        progressPct.style.display = 'inline';
        progressPct.textContent = '0%';

        // Show sticky progress bar
        bar.classList.add('is-importing');
        _showBar();
        bar.scrollIntoView({ behavior: 'smooth', block: 'start' });
        bar._showProgress = () => { _showBar(); };
        requestAnimationFrame(bar._showProgress);

        // Fresh log/summary elements each run
        _logs = document.createElement('ul');
        _logs.className = 'logs';
        setLogContainer(_logs);
        _summary = document.createElement('p');
        _summary.className = 'summary';
        outputDiv.innerHTML = '';
        outputDiv.appendChild(_summary);
        outputDiv.appendChild(_logs);

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
            const lines = [..._logs.querySelectorAll('li')].map(li => {
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

        const copyLogBtn = document.createElement('button');
        copyLogBtn.textContent = 'Copy log';
        copyLogBtn.title = 'Copy the full import log (incl. raw Discogs JSON)';
        copyLogBtn.style.cssText = 'font-size:0.78rem;padding:0.15rem 0.5rem;cursor:pointer;margin-left:auto;flex-shrink:0;';
        copyLogBtn.addEventListener('click', () => {
            copyToClipboard(buildCopyText({ skipDiscogsJson: false }), copyLogBtn, 'Copy log');
        });
        row2.appendChild(copyLogBtn);

        const copyLogNoJsonBtn = document.createElement('button');
        copyLogNoJsonBtn.textContent = 'Copy log (no JSON)';
        copyLogNoJsonBtn.title = 'Copy the log without the raw Discogs JSON block — small enough to fit in a GitHub issue';
        copyLogNoJsonBtn.style.cssText = 'font-size:0.78rem;padding:0.15rem 0.5rem;cursor:pointer;flex-shrink:0;';
        copyLogNoJsonBtn.addEventListener('click', () => {
            copyToClipboard(buildCopyText({ skipDiscogsJson: true }), copyLogNoJsonBtn, 'Copy log (no JSON)');
        });
        row2.appendChild(copyLogNoJsonBtn);

        // Expose progress update hook for `dispatchAllRelationships` to call
        // — currently only the `pct >= 100` branch matters; the status-text
        // path landed in the marquee bar's tooltip but the real status now
        // lives in the line-by-line log.
        bar._setProgress = (pct) => {
            if (pct !== null && pct >= 100) _hideBar();
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
            setTimeout(() => {
                bar.classList.remove('is-importing');
                _hideBar();
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
            let artistRoles = rolesFromDiscogsArtists(json.extraartists?.filter(artist => !artist.tracks));
            // ── Raw Discogs JSON (collapsible, once per log session) ─────────────────
            if (!_logs._releaseInfoAdded) {
                _logs._releaseInfoAdded = true;
                const trackCount = (json.tracklist || []).filter(t => t.type_ === 'track').length;
                const summary = `${json.title || ''}${json.year ? ' \u00b7 ' + json.year : ''} \u00b7 ${trackCount} tracks`;
                const li = document.createElement('li');
                const pre = document.createElement('pre');
                pre.style.cssText = 'max-height:400px;overflow:auto;font-size:0.72rem;background:#f8f8f8;padding:0.5rem;border:1px solid #ddd;border-radius:3px;margin:0.3rem 0 0 0;white-space:pre-wrap;word-break:break-all;';
                pre.textContent = JSON.stringify(json, null, 2);
                const copyJsonBtn = document.createElement('button');
                copyJsonBtn.textContent = 'Copy JSON';
                copyJsonBtn.style.cssText = 'font-size:0.75rem;padding:0.1rem 0.4rem;cursor:pointer;margin-left:0.5rem;vertical-align:middle;';
                copyJsonBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(JSON.stringify(json, null, 2)).catch(() => {
                        const ta = Object.assign(document.createElement('textarea'), { value: JSON.stringify(json, null, 2) });
                        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
                    });
                    copyJsonBtn.textContent = 'Copied!';
                    setTimeout(() => { copyJsonBtn.textContent = 'Copy JSON'; }, 1500);
                });
                li.innerHTML = `<details><summary style="cursor:pointer;user-select:none;"><strong>${summary} — raw Discogs JSON</strong></summary></details>`;
                li.querySelector('summary').appendChild(copyJsonBtn);
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
                return showReviewTable(capturedResults, rolesMap, companiesRolesMap, {
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
