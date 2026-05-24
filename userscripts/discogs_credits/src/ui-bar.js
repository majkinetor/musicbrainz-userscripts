// The "Import Discogs Credits" UI bar — inserted into the MB
// `/edit-relationships` page when a Discogs URL is linked to the
// release. Owns the bar styles (embedded so the userscript ships
// self-contained), the option toggles, the "Import" button, and the
// orchestration that runs after click (`startImportRels`).
//
// Two pieces of module-private state are reused across re-runs of the
// bar's onclick handler:
//   _logs   — the <ul> the script appends per-line log messages to.
//   _summary — the <p> shown above the log with the import summary.
// They're set when insertDiscogsBar mounts the bar; startImportRels
// reads them when populating the run output.
//
// One IIFE at the top cleans up stale `discogs-release-*` localStorage
// entries from old versions on every page load (cheap, idempotent).

import { DISCOGS_LOGO_URL }              from './constants.js';
import { db }                             from './storage.js';
import {
    addLogLine,
    setLogContainer,
}                                        from './log.js';
import { _showBar, _hideBar }             from './progress-bar.js';
import {
    getDiscogsLinkKey,
    getDiscogsReleaseData,
    clearReleaseDataCache,
}                                        from './api-discogs.js';
import {
    convertPotentialDJMixers,
    convertDiscogsArtistsToRolesRelationships,
    getAllArtistTracks,
    getArtistRoles,
}                                        from './mappers.js';
import {
    checkMissingArtists,
    checkMissingCompanies,
}                                        from './preflight.js';
import { showReviewTable }               from './review-table.js';
import { instantFillRelationships }      from './dispatch.js';
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
        .discogs-tooltip {
            display: none;
            position: absolute;
            bottom: calc(100% + 6px);
            left: 50%;
            transform: translateX(-50%);
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
            left: 50%;
            transform: translateX(-50%);
            border: 5px solid transparent;
            border-top-color: #333;
        }
        .discogs-toggle:hover .discogs-tooltip { display: block; }
    `;
    document.head.appendChild(style);

    // Build the bar
    const bar = document.createElement('div');
    bar.className = 'discogs-bar';

    // ── Row 1: logo + source URL + import button ──────────────────────────────
    const row1 = document.createElement('div');
    row1.className = 'discogs-bar-row1';

    const logo = document.createElement('img');
    logo.src = DISCOGS_LOGO_URL;
    logo.className = 'discogs-logo';
    logo.alt = 'Discogs';
    row1.appendChild(logo);

    const sourceSpan = document.createElement('span');
    sourceSpan.className = 'discogs-source';
    sourceSpan.innerHTML = `<a href="${discogsUrl}" target="_blank" rel="noopener noreferrer nofollow">${discogsUrl}</a>`;
    row1.appendChild(sourceSpan);

    const importBtn = document.createElement('button');
    importBtn.className = 'discogs-import-btn';
    importBtn.textContent = 'Import from Discogs';
    const progressPct = document.createElement('span');
    progressPct.id = 'discogs-progress-pct';
    progressPct.style.cssText = 'display:none; margin-left:0.5rem; font-size:0.85rem; color:#e8771d; font-weight:bold; min-width:3.5rem;';
    row1.appendChild(importBtn);
    row1.appendChild(progressPct);
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
        }
        lbl.addEventListener('click', (e) => {
            e.preventDefault();
            cb.checked = !cb.checked;
            lbl.classList.toggle('active', cb.checked);
        });
        row2.appendChild(lbl);
        return cb;
    }

    const OPTS_KEY = 'discogs-importer-opts';
    let savedOpts = {};
    try { savedOpts = JSON.parse(localStorage.getItem(OPTS_KEY) || '{}'); } catch(e) {}
    const bv = (k, d) => k in savedOpts ? savedOpts[k] : d;

    const tracklistCb    = makeCheckbox('Per-track credits',              bv('tracklist', true),
        'Import per-track artist credits from Discogs.');
    const applyTracksCb  = makeCheckbox('Move release credits to tracks', bv('applyTracks', true),
        'Move performance credits from the release down to every recording.');
    const createWorksCb  = makeCheckbox('Create missing works',           bv('createWorks', true),
        'Create a new inline work for recordings without one, and link composer/lyricist/writer credits to it.');
    const saveOpts = () => {
        try { localStorage.setItem(OPTS_KEY, JSON.stringify({
            tracklist: tracklistCb.checked, applyTracks: applyTracksCb.checked,
            createWorks: createWorksCb.checked,
        })); } catch(e) {}
    };
    [tracklistCb, applyTracksCb, createWorksCb].forEach(cb =>
        cb.closest('label').addEventListener('click', () => setTimeout(saveOpts, 0)));

    bar.appendChild(row2);

    // ── Progress bar ──────────────────────────────────────────────────────────
    // _showBar / _hideBar are module-level (defined before insertDiscogsBar)

    // Compat shims — old code references these names
    const progressBar = { style: { display: '' } };
    const progressRow = progressBar;
    const progressTrack = progressBar;
    const progressFill = { style: {}, className: '' };
    const progressStatus = { textContent: '' };
    const recentLogsEl = { innerHTML: '' };
    const recentLogBuffer = [];
    function pushRecentLog() {}
    function startProgressAnim() { _showBar(); }
    function stopProgressAnim() { _hideBar(); }

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
        startProgressAnim();
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

        const copyLogBtn = document.createElement('button');
        copyLogBtn.textContent = 'Copy log';
        copyLogBtn.style.cssText = 'font-size:0.78rem;padding:0.15rem 0.5rem;cursor:pointer;margin-left:auto;flex-shrink:0;';
        copyLogBtn.addEventListener('click', () => {
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
                        const sumText = sum ? [...sum.childNodes].map(n => {
                            if (n.nodeType === Node.TEXT_NODE) return n.textContent;
                            if (n.tagName?.toLowerCase() === 'strong') return '**' + n.textContent + '**';
                            return n.textContent;
                        }).join('') : '';
                        // Get non-summary children
                        const body = [...node.childNodes].filter(n => n !== sum).map(nodeToMd).join('');
                        return '<details><summary>' + sumText + '</summary>\n\n' + body + '\n</details>';
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
                const md = htmlToMd(li);
                // Add trailing two-spaces for markdown line breaks, except tables/details
                if (md.startsWith('\n\n|') || md.startsWith('<details>')) return md;
                return md + '  ';
            }).join('\n');
            navigator.clipboard.writeText(lines).catch(() => {
                const ta = Object.assign(document.createElement('textarea'), { value: lines });
                document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
            }).finally?.(() => {});
            copyLogBtn.textContent = 'Copied!';
            setTimeout(() => { copyLogBtn.textContent = 'Copy log'; }, 1500);
        });
        row2.appendChild(copyLogBtn);

        // Expose progress update hooks for instantFillRelationships to call
        bar._setProgress = (pct, statusText) => {
            if (pct !== null && pct >= 100) { stopProgressAnim(); }
            if (statusText) {
                progressStatus.textContent = statusText;
                pushRecentLog(statusText.replace(/<[^>]*>/g, ''));
            }
        };

        // Re-show progress bar
        requestAnimationFrame(_showBar);

        const opts = `per-track:${tracklistCb.checked?'on':'off'}, move-to-tracks:${applyTracksCb.checked?'on':'off'}, create-works:${createWorksCb.checked?'on':'off'}`;
        const editNote = buildEditNote(discogsUrl, opts);
        editNote.split('\n').forEach(line => {
            if (!line.trim()) return;
            // Make URLs clickable in the log
            const html = line.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer nofollow">$1</a>');
            addLogLine(html);
        });
        startImportRels(discogsUrl, tracklistCb.checked, applyTracksCb.checked, createWorksCb.checked).finally(() => {
            importBtn.disabled = false;
            importBtn.textContent = 'Import from Discogs';
            progressPct.textContent = '100%';
            setTimeout(() => { progressPct.style.display = 'none'; }, 2000);
            // Freeze progress at 100% then remove sticky after a moment
            progressFill.className = 'discogs-progress-fill';
            progressFill.style.width = '100%';
            progressStatus.textContent = 'Done';
            setTimeout(() => {
                bar.classList.remove('is-importing');
                stopProgressAnim();
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
function startImportRels(discogsUrl, processTracklist, applyToTracks, createWorks) {
    return getDiscogsReleaseData(discogsUrl)
        .then(json => {
            let artistRoles = convertDiscogsArtistsToRolesRelationships(json.extraartists?.filter(artist => !artist.tracks));
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
            addLogLine(`Found ${json.companies.length + artistRoles.length} release relationships`);
            // handle potential dj mixes - if the tracks are the full medium then assign it to the release/medium else leave it as individual tracks
            artistRoles = artistRoles.concat(convertPotentialDJMixers(json));
            let tracklistRels = [];
            if (processTracklist) {
                tracklistRels = json.tracklist
                    .filter(track => track.type_ === 'track')
                    .reduce((map, track) => {
                        if (!track.extraartists || !Array.isArray(track.extraartists)) {
                            return map;
                        }
                        return map.concat(
                            convertDiscogsArtistsToRolesRelationships(track.extraartists).map(rel => {
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
                addLogLine(`Found ${tracklistRels.length} tracklist relationships`);
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
                    if (role.artist?.resource_url) getDiscogsLinkKey(role.artist.resource_url);
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
                    getDiscogsLinkKey(c.resource_url);
                    uniqueCompanies.push(c);
                }
            });

            // ── Pre-flight cache ─────────────────────────────────────────
            const PREFLIGHT_CACHE_KEY = `discogs-preflight-${discogsUrl}`;
            const today = new Date().toISOString().slice(0, 10);
            let cachedResults = null;
            try {
                const saved = JSON.parse(localStorage.getItem(PREFLIGHT_CACHE_KEY) || 'null');
                if (saved?.date === today && Array.isArray(saved.results)) {
                    cachedResults = saved.results;
                }
            } catch(e) {}

            function runPreflight(bypassIdb) {
                const artistProgressLi = document.createElement('li');
                artistProgressLi.textContent = `Checking ${uniqueArtists.length} artist(s) against MusicBrainz…`;
                _logs.appendChild(artistProgressLi);

                const companyProgressLi = document.createElement('li');
                companyProgressLi.textContent = `Checking ${uniqueCompanies.length} label(s)/place(s) against MusicBrainz…`;
                _logs.appendChild(companyProgressLi);

                return Promise.all([
                    checkMissingArtists(uniqueArtists, artistProgressLi, bypassIdb),
                    checkMissingCompanies(uniqueCompanies, companyProgressLi, bypassIdb),
                ]).then(([artistResults, companyResults]) => {
                    const allResults = [...artistResults.allResults, ...companyResults.allResults].filter(Boolean);
                    // Save to cache (only if not bypassing)
                    if (!bypassIdb) try {
                        const slimResults = allResults.map(r => ({
                            type: r.type, entityType: r.entityType || 'artist',
                            displayName: r.displayName || r.entity?.name || '',
                            discogsHref: r.discogsHref || '',
                            rateLimited: r.rateLimited || false,
                            nameMatches: (r.nameMatches || []).slice(0, 5),
                            mbUrl: r.mbUrl || null,
                            // Only save mbName if we actually have it — don't cache null names
                            mbName: r.mbName || null,
                            mbDisambig: r.mbDisambig || '',
                            entity: { resource_url: r.entity?.resource_url, name: r.entity?.name || '', _syntheticKey: r.entity?._syntheticKey || '' },
                        }));
                        localStorage.setItem(PREFLIGHT_CACHE_KEY, JSON.stringify({ date: today, results: slimResults }));
                    } catch(e) { console.warn('Discogs importer: preflight cache save failed', e); }
                    return allResults;
                });
            }

            let capturedResults = null; // shared across promise chain
            let capturedConfirmedMap = null;
            const preflightPromise = cachedResults ? Promise.resolve(cachedResults) : runPreflight();

            return preflightPromise.then(allResults => {
                // Annotate each result with its Discogs roles (works for both cache and fresh)
                allResults.forEach(r => {
                    if (!r) return;
                    const url = r.entity?.resource_url || r.entity?._syntheticKey;
                    if (url) r._roles = rolesMap.get(url) || companiesRolesMap.get(url) || [];
                });
                capturedResults = allResults;
                return showReviewTable(capturedResults, rolesMap, companiesRolesMap, {
                    isFromCache: !!cachedResults,
                    cacheKey: PREFLIGHT_CACHE_KEY,
                    onRefresh: () => {
                        // Clear session memory cache for this release so data is truly fresh
                        clearReleaseDataCache(discogsUrl);
                        return runPreflight(true).then(freshResults => {
                        freshResults.forEach(r => {
                            if (!r) return;
                            const url = r.entity?.resource_url || r.entity?._syntheticKey;
                            if (url) r._roles = rolesMap.get(url) || companiesRolesMap.get(url) || [];
                        });
                        return freshResults;
                        });
                    },
                });
            })
                .then(confirmedMap => {
                    capturedConfirmedMap = confirmedMap;
                    // Bulk-write confirmed entries to IDB. Inline writes in
                    // `setRowResolved` (review-table) and `checkOne` (preflight)
                    // already persist as each entity resolves (issue #23), so
                    // this is a final correctness sweep — and it MERGES into
                    // any existing record so `mb_name` / `mb_disambiguation`
                    // from the inline writes survive instead of being clobbered
                    // by a 2-field `{discogs_id, mb_links}` put.
                    const cachePromises = [];
                    confirmedMap.forEach((mbUrl, resourceUrl) => {
                        const key = getDiscogsLinkKey(resourceUrl);
                        if (!key) return;
                        cachePromises.push(new Promise(res => {
                            try {
                                const tx = db.transaction(['mblinks'], 'readwrite');
                                tx.oncomplete = res; tx.onerror = res;
                                const store = tx.objectStore('mblinks');
                                const readReq = store.get(key);
                                readReq.onsuccess = () => {
                                    const prev = readReq.result || {};
                                    store.put({
                                        ...prev,
                                        discogs_id: key,
                                        mb_links:   [mbUrl],
                                    });
                                };
                                readReq.onerror = () => store.put({ discogs_id: key, mb_links: [mbUrl] });
                            } catch (e) { res(); }
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
                    return instantFillRelationships(json.companies, artistRoles, tracklistRels, applyToTracks, createWorks, json.tracklist, processTracklist, resolvedEntityTypes, capturedConfirmedMap);
                });
        })
        .then(() => { });
}
