// The unified post-preflight review table — one row per Discogs credit,
// auto-matched ones pre-filled and editable, attention-needed ones
// highlighted with search + create actions. Renders into the existing
// `<ul.logs>` element wired by the UI bar; never starts the import until
// the user explicitly clicks "Start import".

import { readIdbRecord, writeIdbRecord }   from './storage.js';
import { mbThrottle, fetchWithRetry }      from './api-mb.js';
import { parseDiscogsUrl }                 from './api-discogs.js';
import { guessSortName }                   from './mappers.js';
import { getLogContainer }                 from './log.js';
import { _hideBar }                        from './progress-bar.js';

// Session-level URL check cache (avoids localStorage key mismatches across sessions)
const _urlCheckSessionCache = new Map();

/**
 * Unified artist review table shown after the pre-flight check.
 * ALL artists appear here — auto-resolved ones are pre-filled and editable,
 * attention-needed ones are highlighted orange with search + create actions.
 *
 * Returns a Promise that resolves with a Map<resource_url, mbUrl> of every
 * artist the user has confirmed (or left as auto-matched). The import never
 * starts until the user explicitly clicks "Start import".
 */
export async function showReviewTable(allResults, rolesMap, companiesRolesMap, opts) {
    rolesMap = rolesMap || new Map();
    companiesRolesMap = companiesRolesMap || new Map();
    // `opts` is reserved for future configuration. The release-level preflight
    // cache (and its `isFromCache` / `cacheKey` / `onRefresh` hooks) was
    // removed — IDB-backed entity caching covers the practical wins on its
    // own, without the stale-shape footguns of an extra cache layer.
    void opts;

    // Pre-load missing names into a Map — IDB first, then MB WS2 fetch.
    const _preloadedNames = new Map();
    const _nullNames = allResults.filter(r => r.type === 'resolved' && r.mbUrl && !r.mbName);
    for (const r of _nullNames) {
        const rUrl = r.entity?.resource_url;
        try {
            const idbKey = parseDiscogsUrl(rUrl)?.key;
            const rec = await readIdbRecord(idbKey);
            if (rec?.name) {
                _preloadedNames.set(rUrl, { name: rec.name, dis: rec.disambiguation || '' });
                continue;
            }
            const mbid = (r.mbUrl || '').split('/').pop().replace(/[^a-f0-9-]/g, '').substring(0, 36);
            if (!mbid) continue;
            const et = r.entityType || 'artist';
            const data = await mbThrottle.fetchJson(`https://musicbrainz.org/ws/2/${et}/${mbid}?fmt=json`);
            if (data?.name) {
                _preloadedNames.set(rUrl, { name: data.name, dis: data.disambiguation || '' });
                if (idbKey) {
                    await writeIdbRecord(idbKey, {
                        mbid,
                        entityType:     et,
                        name:           data.name,
                        disambiguation: data.disambiguation || '',
                        // No resolvedVia change — this is just a name-display
                        // populate; whatever set the cached mbid stays the
                        // source of truth for `resolvedVia`.
                    });
                }
            }
            // No artificial gap — `mbThrottle` paces and backs off on 503.
        } catch(e) {}
    }

    return new Promise(resolve => {
        // Per-row state: resource_url -> { mbUrl, mbName, mbDisambig, confirmed, via }.
        // `confirmed = true` means the user is happy with this match (or it
        // auto-matched cleanly). Mutations from user picks / undo / IDB
        // pre-load are immediately reflected in `rowState` — and from there
        // into the IDB `entity_cache` via `writeIdbRecord`. No separate
        // localStorage layer.
        const rowState = new Map();

        const attentionCount = allResults.filter(r => r.type === 'attention').length;
        const mismatchCount  = allResults.filter(r => {
            if (r.type !== 'resolved') return false;
            const e = r.logEntry;
            return e && e.mbName && e.displayName && e.mbName.toLowerCase().trim() !== e.displayName.toLowerCase().trim();
        }).length;

        // ── Shared concurrency pool for Discogs-URL-link checks ─────────────
        // Uses the same burst+retry pattern as checkMissingArtists:
        // up to 5 concurrent requests, 200ms stagger between slots,
        // automatic exponential backoff on 429/503.
        const URL_CHECK_CONCURRENCY = 5;
        const urlCheckPending = []; // { fn, resolve, reject }
        let urlCheckRunning = 0;
        let urlCheckStarted = false;



        function queuedUrlCheck(fn) {
            return new Promise((resolve, reject) => {
                urlCheckPending.push({ fn, resolve, reject });
                // Restart a worker if none are running (handles late additions after initial drain)
                if (urlCheckRunning < URL_CHECK_CONCURRENCY) {
                    runUrlCheckWorker();
                }
            });
        }

        async function runUrlCheckWorker() {
            urlCheckRunning++;
            while (urlCheckPending.length > 0) {
                const { fn, resolve, reject } = urlCheckPending.shift();
                try { resolve(await fn()); } catch(e) { reject(e); }
                // No artificial gap between iterations — `mbThrottle` paces
                // and cooperatively backs off on 503 (issue #30).
            }
            urlCheckRunning--;
        }

        // ── Helpers shared across rows ─────────────────────────────────────
        // Small pill that surfaces *how* an entity was resolved. Two facts
        // travel together:
        //   `via`       — the resolution mechanism (`name` / `url` / `both` /
        //                 `user`, or `cache` for legacy IDB records that
        //                 predate the `resolvedVia` field).
        //   `fromCache` — whether THIS resolution was served from IDB rather
        //                 than a fresh MB lookup.
        // The label composes both: a name-resolved entity loaded from cache
        // shows `name (cache)`, freshly-resolved shows just `name`.
        const VIA_STYLES = {
            both:  { text: 'name+url', color: '#2a7' }, // green — high confidence
            url:   { text: 'url',      color: '#46a' }, // blue
            name:  { text: 'name',     color: '#46a' }, // blue
            user:  { text: 'user',     color: '#777' }, // grey
            cache: { text: 'cache',    color: '#777' }, // grey (legacy: original mechanism unknown)
        };
        /** Resolve a `(via, fromCache)` pair to `{ text, color }` for display. */
        function viaCfg(via, fromCache) {
            const base = VIA_STYLES[via];
            if (!base) return null;
            if (fromCache && via !== 'cache') {
                return { text: `${base.text} (cache)`, color: base.color };
            }
            return base;
        }
        function makeViaBadge(via, fromCache) {
            const cfg = viaCfg(via, fromCache);
            if (!cfg) return null;
            const span = document.createElement('span');
            span.textContent = cfg.text;
            span.title = fromCache && via !== 'cache'
                ? `Resolved via ${via}, served from cache`
                : `Resolved via ${via}`;
            span.style.cssText = `font-size:0.68rem;background:#f5f5f5;color:${cfg.color};` +
                                 `padding:0 0.35rem;border-radius:8px;border:1px solid #ddd;flex-shrink:0;`;
            return span;
        }

        // ── Panel shell ────────────────────────────────────────────────────────
        const panel = document.createElement('div');
        panel.style.cssText = 'border:2px solid #c8a000;border-radius:0.5rem;background:#fffef5;padding:1rem 1.5rem;margin:0.5rem 0;';
        // Hide progress row while review table is shown
        { const _pb = document.getElementById('discogs-progress-bar'); if (_pb) _pb.style.display = 'none'; }
        // Hide progress row while review table is shown
        const _bar = document.querySelector('.discogs-bar');
        if (_bar) {
            _hideBar();
            const _r2 = _bar.querySelector('.discogs-bar-row2'); if (_r2) _r2.style.marginTop = '';
        }

        const heading = document.createElement('div');
        heading.style.cssText = 'display:flex;align-items:center;gap:0.6rem;margin:0 0 0.5rem;padding:0.4rem 0.6rem;border-radius:0.3rem;background:#f5e8a0;border:1px solid #d4b800;';
        const headingText = document.createElement('span');
        headingText.style.cssText = 'font-weight:bold;font-size:1rem;color:#5a4000;flex:1;';
        headingText.textContent = `Review — ${allResults.length} entit${allResults.length === 1 ? 'y' : 'ies'}`;
        heading.appendChild(headingText);
        panel.appendChild(heading);

        const intro = document.createElement('p');
        intro.style.cssText = 'margin:0 0 0.75rem;font-size:0.85rem;color:#666;';
        intro.innerHTML =
            'Review all artist matches before importing. ' +
            '<span style="background:#ffe0e0;padding:0 0.3rem;border-radius:2px;">Red rows</span> need attention. ' +
            '<span style="background:#fff8e1;padding:0 0.3rem;border-radius:2px;">Yellow rows</span> have a name mismatch — verify. ' +
            'Green rows are confirmed. Use the search or create buttons to resolve outstanding issues.';
        panel.appendChild(intro);

        // ── Table ──────────────────────────────────────────────────────────────
        const table = document.createElement('table');
        table.style.cssText = 'border-collapse:collapse;width:100%;font-size:0.85rem;';
        const thead = document.createElement('thead');
        const hr = document.createElement('tr');
        hr.style.background = '#f5e8a0';
        ['Discogs entity', 'MB match / search', 'Actions'].forEach(col => {
            const th = document.createElement('th');
            th.style.cssText = 'text-align:left;padding:0.3rem 0.5rem;border:1px solid #d4b800;white-space:nowrap;';
            th.textContent = col;
            hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');

        allResults.forEach(r => {
            // Unified fields set by both checkMissingArtists and checkMissingCompanies
            const entityType  = r.entityType || 'artist';
            const displayName = r.displayName || r.entity?.name || '';
            const discogsHref = r.discogsHref || '';
            const e           = r.logEntry || null;
            // Keep backward-compat alias
            const artist      = r.entity;

            // Initial state
            const isResolved  = r.type === 'resolved';
            const initMbUrl   = isResolved ? r.mbUrl : null;
            const _entityKey = r.entity?.resource_url || r.entity?._syntheticKey || `_nourl_${r.entity?.name || r.displayName}`;
            const _pl = _preloadedNames.get(_entityKey) || _preloadedNames.get(r.entity?.resource_url);
            const initMbName  = (e && e.mbName) ? e.mbName : (_pl?.name || (isResolved ? r.mbName : null) || null);
            const initMbDisam = (e && e.mbDisambig) ? e.mbDisambig : (_pl?.dis || r.mbDisambig || '');
            const nameMismatch = isResolved && initMbName &&
                initMbName.toLowerCase().trim() !== displayName.toLowerCase().trim();
            const needsAttention = r.type === 'attention';

            // Row background: orange = needs attention, yellow = mismatch, white = clean
            const rowBg = needsAttention ? '#ffe0e0' : (nameMismatch ? '#fff8e1' : '#fff');
            const borderColor = needsAttention ? '#cc6666' : '#d4d4d4';

            const tr = document.createElement('tr');
            tr.style.cssText = `vertical-align:top;background:${rowBg};`;

            // Initialise rowState. `via` carries how the entity got resolved
            // (`name` / `url` / `both` / `user` / `cache`) — surfaced in the
            // post-import log summary table so users can audit auto-matches.
            // `via` carries the ORIGINAL mechanism (`name` / `url` / `both` /
            // `user`, or `cache` for legacy IDB records); `fromCache` flags
            // whether IDB served the resolution. The label composes them, e.g.
            // `name (cache)`.
            rowState.set(_entityKey, {
                mbUrl: initMbUrl, mbName: initMbName, mbDisambig: initMbDisam,
                confirmed: isResolved && !needsAttention,
                via:       isResolved ? (r.logEntry?.via       || null)  : null,
                fromCache: isResolved ? (r.logEntry?.fromCache || false) : false,
            });

            // ── Col 1: Discogs ─────────────────────────────────────────────────
            const tdDiscogs = document.createElement('td');
            tdDiscogs.style.cssText = `padding:0.3rem 0.5rem;border:1px solid ${borderColor};white-space:nowrap;`;
            if (entityType !== 'artist') {
                const badge = document.createElement('span');
                badge.textContent = entityType;
                badge.style.cssText = 'font-size:0.7rem;background:#e0e0e0;border-radius:3px;padding:0 0.3rem;margin-right:0.3rem;color:#555;vertical-align:middle;';
                tdDiscogs.appendChild(badge);
            }
            const hasDiscogsUrl = !!(r.entity?.resource_url);
            const dlA = document.createElement(hasDiscogsUrl ? 'a' : 'span');
            dlA.href = discogsHref; dlA.target = '_blank'; dlA.rel = 'noopener noreferrer nofollow';
            dlA.textContent = displayName;
            tdDiscogs.appendChild(dlA);
            if (!hasDiscogsUrl) {
                const noUrl = document.createElement('span');
                noUrl.textContent = ' \u26a0\ufe0f'; noUrl.title = 'No Discogs artist page — manual search needed';
                noUrl.style.cssText = 'cursor:help;color:#c80;';
                tdDiscogs.appendChild(noUrl);
            }
            if (nameMismatch) {
                const w = document.createElement('span');
                w.textContent = ' \u26a0\ufe0f'; w.title = 'Name differs from MB match';
                w.style.cursor = 'help';
                tdDiscogs.appendChild(w);
            }
            tr.appendChild(tdDiscogs);

            // Roles line below entity name
            const rolesList = r._roles || [];
            if (rolesList.length > 0) {
                const labels = [...new Map(rolesList.map(({displayLabel, linkType, trackPos}) => {
                    const key = displayLabel || linkType;
                    return [key + (trackPos ? '['+trackPos+']' : ''), key + (trackPos ? ' ['+trackPos+']' : '')];
                })).values()];
                const rolesLine = document.createElement('div');
                rolesLine.style.cssText = 'font-size:0.75rem;color:#888;margin-top:0.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;';
                rolesLine.title = labels.join(', ');
                rolesLine.textContent = labels.join(', ');
                tdDiscogs.appendChild(rolesLine);
            }

            // ── Col 2: MB artist / search ──────────────────────────────────────
            const tdMb = document.createElement('td');
            tdMb.style.cssText = `padding:0.3rem 0.5rem;border:1px solid ${borderColor};min-width:240px;`;

            const candidateList = document.createElement('div');
            candidateList.style.cssText = 'display:flex;flex-direction:column;gap:0.2rem;margin-bottom:0.3rem;';

            const searchRow = document.createElement('div');
            searchRow.style.cssText = 'display:flex;gap:0.3rem;';
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.value = displayName;
            searchInput.style.cssText = 'flex:1;padding:0.15rem 0.35rem;font-size:0.82rem;border:1px solid #bbb;border-radius:3px;';
            const searchBtn = document.createElement('button');
            searchBtn.textContent = '\uD83D\uDD0D';
            searchBtn.title = 'Search MusicBrainz';
            searchBtn.style.cssText = 'padding:0.15rem 0.35rem;cursor:pointer;';
            searchRow.appendChild(searchInput);
            searchRow.appendChild(searchBtn);

            tdMb.appendChild(candidateList);
            tdMb.appendChild(searchRow);
            tr.appendChild(tdMb);

            // ── Col 3: Actions ─────────────────────────────────────────────────
            const tdAction = document.createElement('td');
            tdAction.style.cssText = `padding:0.3rem 0.5rem;border:1px solid ${borderColor};white-space:nowrap;`;
            tr.appendChild(tdAction);
            tbody.appendChild(tr);

            // ── Helpers ────────────────────────────────────────────────────────
            function setRowResolved(a) {
                // a = { id, name, disambiguation }
                const mbUrl = `//musicbrainz.org/${entityType}/${a.id}`;
                rowState.set(_entityKey, { mbUrl, mbName: a.name, mbDisambig: a.disambiguation || '', confirmed: true, via: 'user', fromCache: false });
                // Persist to IDB immediately so selection survives even without clicking Start import
                const _idbKey = r.entity?.resource_url ? parseDiscogsUrl(r.entity.resource_url)?.key : null;
                if (_idbKey) {
                    writeIdbRecord(_idbKey, {
                        mbid:           a.id,
                        entityType,
                        name:           a.name,
                        disambiguation: a.disambiguation || '',
                        resolvedVia:    'user',  // user picked this in the review table
                    });
                }

                tr.style.background = '#f0fff0';
                searchInput.disabled = true;
                searchBtn.disabled = true;

                candidateList.innerHTML = '';
                const selRow = document.createElement('div');
                selRow.style.cssText = 'padding:0.15rem 0.4rem;border:1px solid #5a5;border-radius:3px;background:#e8f8e8;display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;';
                const selA = document.createElement('a');
                selA.href = 'https:' + mbUrl; selA.target = '_blank'; selA.rel = 'noopener noreferrer nofollow';
                selA.textContent = '\u2713 ' + a.name + (a.disambiguation ? ` (${a.disambiguation})` : '');
                selA.style.fontWeight = 'bold';
                // Allow un-confirming
                const undoBtn = document.createElement('button');
                undoBtn.textContent = '\u2715';
                undoBtn.title = 'Clear selection';
                undoBtn.style.cssText = 'font-size:0.75rem;cursor:pointer;padding:0 0.3rem;margin-left:auto;';
                undoBtn.addEventListener('click', () => setRowUnresolved());
                selRow.appendChild(selA);
                // User picked via the dropdown \u2014 always badge as `user`,
                // never `(cache)` (this is a fresh pick).
                const viaBadge = makeViaBadge('user', false);
                if (viaBadge) selRow.appendChild(viaBadge);
                selRow.appendChild(undoBtn);
                candidateList.appendChild(selRow);

                // Actions: Add Discogs link + Create fallback
                renderActions(a);
                updateImportBtn();
            }

            function setRowUnresolved() {
                rowState.set(_entityKey, { mbUrl: null, mbName: null, mbDisambig: '', confirmed: false, via: null, fromCache: false });
                tr.style.background = '#ffe0e0';
                searchInput.disabled = false;
                searchBtn.disabled = false;
                candidateList.innerHTML = '';
                const none = document.createElement('div');
                none.style.cssText = 'font-size:0.82rem;color:#888;';
                none.textContent = 'No selection \u2014 search or create';
                candidateList.appendChild(none);
                renderActions(null);
                updateImportBtn();
            }

            function renderActions(selected) {
                tdAction.innerHTML = '';
                if (selected) {
                    // Check if artist already has this Discogs URL linked — show button only if missing
                    const linkSlot = document.createElement('span');
                    linkSlot.style.cssText = 'display:block;margin-bottom:0.25rem;font-size:0.8rem;';
                    linkSlot.textContent = 'Checking Discogs link…';
                    tdAction.appendChild(linkSlot);

                    // Query whether this specific Discogs URL is already linked in MB.
                    // Cache result in localStorage for today to avoid repeated checks.
                    // Use session Map as primary cache; fall back to localStorage for cross-session
                    const urlCheckCacheKey = `${selected.id}|${discogsHref}`;
                    const urlCheckLsKey = `discogs-urlcheck-${selected.id}-${discogsHref.replace(/[^a-z0-9]/gi,'-').substring(0,80)}`;
                    const urlCheckToday = new Date().toISOString().slice(0, 10);
                    const urlCheckExpiry = new Date(); urlCheckExpiry.setDate(urlCheckExpiry.getDate() - 7);
                    const urlCheckExpiryStr = urlCheckExpiry.toISOString().slice(0, 10);
                    let urlCheckCached = _urlCheckSessionCache.get(urlCheckCacheKey) ?? null;
                    if (urlCheckCached === null) {
                        try { const s = JSON.parse(localStorage.getItem(urlCheckLsKey)||'null'); if (s?.date >= urlCheckExpiryStr) urlCheckCached = s.result; } catch(e) {}
                        if (urlCheckCached !== null) _urlCheckSessionCache.set(urlCheckCacheKey, urlCheckCached);
                    }

                    function applyUrlCheckResult(result) {
                        if (result === 'linked') {
                            linkSlot.textContent = '\u2713 Discogs URL already linked';
                            linkSlot.style.color = '#5a5';
                        } else if (result === 'other') {
                            linkSlot.innerHTML = `\u26a0\ufe0f Linked to a different MB ${entityType}`;
                            linkSlot.style.color = '#c80';
                        } else {
                            linkSlot.textContent = '';
                            const addLinkBtn = document.createElement('button');
                            addLinkBtn.textContent = 'Add Discogs link \u2197';
                            addLinkBtn.style.cssText = 'font-size:0.8rem;cursor:pointer;display:block;white-space:nowrap;';
                            addLinkBtn.addEventListener('click', () => {
                                const ltId = entityType === 'label' ? '217' : entityType === 'place' ? '705' : '180';
                                const p = new URLSearchParams({ [`edit-${entityType}.url.0.text`]: discogsHref, [`edit-${entityType}.url.0.link_type_id`]: ltId });
                                const mbid = selected.id.replace(/.*\//, '').replace(/[^a-f0-9-]/gi, '').substring(0, 36);
                                window.open(`https://musicbrainz.org/${entityType}/${mbid}/edit?${p}`, '_blank', 'noopener,noreferrer');
                            });
                            linkSlot.appendChild(addLinkBtn);
                        }
                    }

                    if (!discogsHref) {
                        // No Discogs URL — skip URL check entirely
                        linkSlot.textContent = '⚠ No Discogs page';
                        linkSlot.style.color = '#c80';
                    } else if (urlCheckCached !== null) {
                        applyUrlCheckResult(urlCheckCached);
                    } else {
                        queuedUrlCheck(() =>
                            fetchWithRetry(`//musicbrainz.org/ws/2/url?resource=${encodeURIComponent(discogsHref)}&inc=${entityType}-rels&fmt=json`)
                                .then(json => {
                                    const linkedIds = (json.relations || []).filter(r => r[entityType]).map(r => r[entityType].id);
                                    const result = linkedIds.includes(selected.id) ? 'linked' : linkedIds.length > 0 ? 'other' : 'none';
                                    _urlCheckSessionCache.set(urlCheckCacheKey, result);
                                    try { localStorage.setItem(urlCheckLsKey, JSON.stringify({ date: urlCheckToday, result })); } catch(e) {}
                                    applyUrlCheckResult(result);
                                })
                                .catch(() => applyUrlCheckResult('none'))
                        );
                    }
                }
                const createBtn = document.createElement('button');
                createBtn.textContent = 'Create in MB ↗';
                createBtn.style.cssText = 'font-size:0.8rem;cursor:pointer;display:block;white-space:nowrap;';
                createBtn.addEventListener('click', () => {
                    if (entityType === 'artist') {
                        const createParams = {
                            'edit-artist.name': displayName,
                            'edit-artist.sort_name': guessSortName(displayName),
                            'edit-artist.type_id': '1',
                        };
                        if (discogsHref) {
                            createParams['edit-artist.url.0.text'] = discogsHref;
                            createParams['edit-artist.url.0.link_type_id'] = '180';
                        }
                        const p = new URLSearchParams(createParams);
                        const newTab = window.open(`https://musicbrainz.org/artist/create?${p}`, '_blank');
                        if (newTab) {
                            const trySet = () => {
                                try { newTab.sessionStorage.setItem('discogs-importer-pending-artist', r.entity.resource_url); }
                                catch(e) { setTimeout(trySet, 50); }
                            };
                            trySet();
                        }
                        const onCreated = (evt) => {
                            if (evt.data?.type !== 'artist-created') return;
                            if (evt.data.resourceUrl !== r.entity.resource_url) return;
                            DISCOGS_CHANNEL.removeEventListener('message', onCreated);
                            setRowResolved({ id: evt.data.id, name: evt.data.name, disambiguation: evt.data.disambiguation });
                        };
                        DISCOGS_CHANNEL.addEventListener('message', onCreated);
                    } else {
                        const ltId = entityType === 'label' ? '217' : '705';
                        const p = new URLSearchParams({
                            [`edit-${entityType}.name`]: displayName,
                            [`edit-${entityType}.url.0.text`]: discogsHref,
                            [`edit-${entityType}.url.0.link_type_id`]: ltId,
                        });
                        const newTab = window.open(`https://musicbrainz.org/${entityType}/create?${p}`, '_blank');
                        if (newTab) {
                            const trySet = () => {
                                try { newTab.sessionStorage.setItem('discogs-importer-pending-artist', r.entity.resource_url); }
                                catch(e) { setTimeout(trySet, 50); }
                            };
                            trySet();
                        }
                        const onCreated = (evt) => {
                            if (evt.data?.type !== 'artist-created') return;
                            if (evt.data.resourceUrl !== r.entity.resource_url) return;
                            DISCOGS_CHANNEL.removeEventListener('message', onCreated);
                            setRowResolved({ id: evt.data.id, name: evt.data.name, disambiguation: evt.data.disambiguation });
                        };
                        DISCOGS_CHANNEL.addEventListener('message', onCreated);
                    }
                });
                tdAction.appendChild(createBtn);
            }

            function makeCandidateRow(a) {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:0.35rem;padding:0.2rem 0.35rem;border:1px solid #ddd;border-radius:3px;background:#fff;font-size:0.82rem;';
                const info = document.createElement('span');
                info.style.flex = '1';
                const nameA = document.createElement('a');
                nameA.href = `https://musicbrainz.org/${entityType}/${a.id}`;
                nameA.target = '_blank'; nameA.rel = 'noopener noreferrer nofollow';
                nameA.style.fontWeight = 'bold';
                nameA.textContent = a.name;
                info.appendChild(nameA);
                if (a.disambiguation) {
                    const d = document.createElement('span');
                    d.style.cssText = 'color:#777;margin-left:0.25rem;';
                    d.textContent = `(${a.disambiguation})`;
                    info.appendChild(d);
                }
                row.appendChild(info);
                const selBtn = document.createElement('button');
                selBtn.textContent = 'Select';
                selBtn.style.cssText = 'font-size:0.78rem;cursor:pointer;padding:0.1rem 0.3rem;white-space:nowrap;';
                selBtn.addEventListener('click', () => setRowResolved(a));
                row.appendChild(selBtn);
                return row;
            }

            // Extract MBID from a raw UUID or MB URL
            function extractMbid(q) {
                const m = q.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
                return m ? m[0] : null;
            }

            function doSearch(q) {
                if (!q) return;
                // If input looks like an MBID or MB URL, fetch directly
                const mbid = extractMbid(q);
                if (mbid) {
                    candidateList.innerHTML = '<div style="font-size:0.82rem;color:#888;">Looking up MBID…</div>';
                    mbThrottle.fetchJson(`//musicbrainz.org/ws/2/${entityType}/${mbid}?fmt=json`)
                        .then(json => {
                            if (!json) return;
                            candidateList.innerHTML = '';
                            if (json.id) {
                                candidateList.appendChild(makeCandidateRow({
                                    id: json.id,
                                    name: json.name,
                                    disambiguation: json.disambiguation || '',
                                }));
                            } else {
                                candidateList.innerHTML = '<div style="font-size:0.82rem;color:#888;">Not found</div>';
                            }
                        })
                        .catch(() => {
                            candidateList.innerHTML = `<div style="font-size:0.82rem;color:#c00;">MBID not found or wrong entity type</div>`;
                        });
                    return;
                }
                mbThrottle.fetchJson(`//musicbrainz.org/ws/2/${entityType}?query=${encodeURIComponent(q)}&fmt=json&limit=8`)
                    .then(json => {
                        if (!json) return;
                        candidateList.innerHTML = '';
                        const resultKey = entityType === 'label' ? 'labels' : entityType === 'place' ? 'places' : 'artists';
                        if (!json[resultKey] || json[resultKey].length === 0) {
                            const none = document.createElement('div');
                            none.style.cssText = 'font-size:0.82rem;color:#888;';
                            none.textContent = 'No results';
                            candidateList.appendChild(none);
                        } else {
                            json[resultKey].forEach(a => candidateList.appendChild(makeCandidateRow(a)));
                        }
                    }).catch(() => {});
            }

            let searchTimer;
            searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => doSearch(searchInput.value.trim()), 300); });
            searchInput.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); doSearch(searchInput.value.trim()); } });
            searchBtn.addEventListener('click', () => doSearch(searchInput.value.trim()));

            // ── Initial population ─────────────────────────────────────────────
            if (isResolved && initMbUrl) {
                // Pre-fill with the auto-matched result.
                // Always reconstruct the MB URL using the current entityType — the cached
                // mbUrl may have been stored as /artist/ for what is now a /label/ or /place/.
                const mbid = initMbUrl.replace(/.*\//, '').replace(/[^a-f0-9-]/gi, '').substring(0, 36);
                const correctedMbUrl = `//musicbrainz.org/${entityType}/${mbid}`;
                // If name fetch was rate-limited, use MBID as display and mark unconfirmed
                const displayName2 = initMbName || mbid;
                if (!initMbName) {
                    // Name was null in cache — keep yellow, IDB pre-load handled before rendering
                    rowState.set(_entityKey, { mbUrl: initMbUrl, mbName: null, mbDisambig: '', confirmed: true, via: r.logEntry?.via || null, fromCache: r.logEntry?.fromCache || false });
                    tr.style.background = '#fff8e1';
                }
                const fakeA = { id: mbid, name: displayName2, disambiguation: initMbDisam };
                candidateList.innerHTML = '';
                const selRow = document.createElement('div');
                selRow.style.cssText = 'padding:0.15rem 0.4rem;border:1px solid #5a5;border-radius:3px;background:#e8f8e8;display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;';
                const selA = document.createElement('a');
                selA.href = 'https:' + correctedMbUrl; selA.target = '_blank'; selA.rel = 'noopener noreferrer nofollow';
                selA.textContent = '\u2713 ' + displayName2 + (initMbDisam ? ` (${initMbDisam})` : '') + (!initMbName ? ' ⚠ name unknown' : '');
                selA.style.fontWeight = 'bold';
                const undoBtn = document.createElement('button');
                undoBtn.textContent = '\u2715';
                undoBtn.title = 'Clear selection';
                undoBtn.style.cssText = 'font-size:0.75rem;cursor:pointer;padding:0 0.3rem;margin-left:auto;';
                undoBtn.addEventListener('click', () => setRowUnresolved());
                selRow.appendChild(selA);
                // `via` badge — `name`, `url`, `both`, or `cache`, with a
                // `(cache)` suffix when the resolution came from IDB.
                const viaBadge = makeViaBadge(r.logEntry?.via, r.logEntry?.fromCache);
                if (viaBadge) selRow.appendChild(viaBadge);
                selRow.appendChild(undoBtn);
                candidateList.appendChild(selRow);
                renderActions(fakeA);
            } else if (r.nameMatches && r.nameMatches.length > 0) {
                r.nameMatches.forEach(a => candidateList.appendChild(makeCandidateRow(a)));
                renderActions(null);
            } else {
                const none = document.createElement('div');
                none.style.cssText = 'font-size:0.82rem;color:#888;';
                none.textContent = needsAttention ? 'No suggestions \u2014 search or create' : '';
                if (needsAttention) candidateList.appendChild(none);
                renderActions(null);
            }
        });

        table.appendChild(tbody);
        panel.appendChild(table);

        // ── Import button ──────────────────────────────────────────────────────
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:0.75rem;align-items:center;margin-top:0.75rem;flex-wrap:wrap;';

        const importBtn = document.createElement('button');
        importBtn.style.cssText = 'border:none;padding:0.4rem 1.1rem;border-radius:0.3rem;cursor:pointer;font-weight:bold;font-size:0.95rem;';

        const issueNote = document.createElement('span');
        issueNote.style.cssText = 'font-size:0.85rem;color:#7a5c00;';

        function updateImportBtn() {
            const unresolved = [...rowState.values()].filter(s => !s.confirmed).length;
            const mismatch   = [...rowState.values()].filter(s => s.confirmed && s.mbName &&
                s.mbName.toLowerCase().trim() !== s.mbUrl).length; // rough check
            if (unresolved === 0) {
                importBtn.textContent = 'Start import \u2192';
                importBtn.style.background = '#2ecc40';
                importBtn.style.color = '#fff';
                issueNote.textContent = '';
            } else {
                importBtn.textContent = `Start import anyway \u2192`;
                importBtn.style.background = '#e0a800';
                importBtn.style.color = '#fff';
                issueNote.textContent = `\u26a0 ${unresolved} artist(s) unresolved \u2014 they will be skipped`;
            }
        }
        updateImportBtn();

        importBtn.addEventListener('click', () => {
            const confirmedMap = new Map();
            rowState.forEach((s, key) => {
                if (s.mbUrl) confirmedMap.set(key, s.mbUrl);
            });

            // ── Log summary table ──────────────────────────────────────
            const tbl = document.createElement('table');
            tbl.style.cssText = 'border-collapse:collapse;width:100%;font-size:0.78rem;margin:0.4rem 0;';
            const thRow = document.createElement('tr');
            thRow.style.background = '#f5f5f5';
            ['Discogs entity', 'Roles / Tracks', 'MB match', 'MBID', 'Resolved via'].forEach(h => {
                const th = document.createElement('th');
                th.style.cssText = 'text-align:left;padding:0.2rem 0.4rem;border:1px solid #ddd;white-space:nowrap;';
                th.textContent = h;
                thRow.appendChild(th);
            });
            tbl.appendChild(thRow);
            allResults.forEach(r => {
                const _rKey = r.entity?.resource_url || r.entity?._syntheticKey || `_nourl_${r.entity?.name || r.displayName}`;
                const state = rowState.get(_rKey) || {};
                const tr2 = document.createElement('tr');
                const url = r.entity?.resource_url || r.entity?._syntheticKey || '';
                const rolesList2 = url ? (rolesMap.get(url) || companiesRolesMap.get(url) || []) : [];
                const grouped2 = new Map();
                rolesList2.forEach(({ displayLabel, linkType, trackPos }) => {
                    const key = displayLabel || linkType;
                    if (!grouped2.has(key)) grouped2.set(key, new Set());
                    if (trackPos) grouped2.get(key).add(trackPos);
                });
                const rolesText = [...grouped2.entries()].map(([label, tr]) =>
                    label + (tr.size ? ' [' + [...tr].join(',') + ']' : '')).join('; ');

                const mbid = state.mbUrl ? state.mbUrl.replace(/.*\//, '').replace(/[^a-f0-9-]/gi,'').substring(0,36) : '';
                const matchText = state.mbName || (state.mbUrl ? mbid : '');
                // Resolution mechanism + cache state — composed via `viaCfg`:
                // fresh → `name+url`/`url`/`name`/`user`; from IDB →
                // `name (cache)` / `url (cache)` / `both (cache)` / etc.;
                // legacy IDB record with no original mechanism → `cache`.
                const vCfg = state.via ? viaCfg(state.via, state.fromCache) : null;
                const viaText = vCfg ? vCfg.text : (state.mbUrl ? '—' : '');

                [r.displayName || r.entity?.name, rolesText, matchText, mbid, viaText].forEach((val, ci) => {
                    const td = document.createElement('td');
                    td.style.cssText = 'padding:0.15rem 0.4rem;border:1px solid #ddd;' +
                        (ci === 2 && !val ? 'color:#aaa;' : ci === 2 ? 'color:#060;' :
                         ci === 4 && vCfg ? `color:${vCfg.color};` : '');
                    if (ci === 2 && mbid) {
                        const a = document.createElement('a');
                        a.href = 'https:' + state.mbUrl; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
                        a.textContent = val || mbid;
                        td.appendChild(a);
                    } else {
                        td.textContent = val || (ci === 1 ? '' : ci === 2 ? '—' : '');
                    }
                    tr2.appendChild(td);
                });
                tbl.appendChild(tr2);
            });
            const tblLi = document.createElement('li');
            tblLi.style.cssText = 'list-style:none;margin:0;padding:0;';
            tblLi.appendChild(tbl);
            getLogContainer().appendChild(tblLi);
            // ─────────────────────────────────────────────────────────

            // Add unresolved count line after the table
            const unresolvedCount = allResults.filter(r => { const _k = r.entity?.resource_url || r.entity?._syntheticKey || `_nourl_${r.entity?.name || r.displayName}`; return !rowState.get(_k)?.confirmed; }).length;
            if (unresolvedCount > 0) {
                const unresolvedLi = document.createElement('li');
                unresolvedLi.style.cssText = 'list-style:none;margin:0.2rem 0;font-size:0.82rem;color:#a06000;';
                unresolvedLi.textContent = `⚠ ${unresolvedCount} entity/entities unresolved — will be skipped`;
                getLogContainer().appendChild(unresolvedLi);
            }

            (panelLi || panel).remove();
            resolve(confirmedMap);
        });

        btnRow.appendChild(importBtn);
        btnRow.appendChild(issueNote);
        panel.appendChild(btnRow);

        const panelLi = document.createElement('li');
        panelLi.style.cssText = 'list-style:none;margin:0;padding:0;';
        panelLi.appendChild(panel);
        getLogContainer().appendChild(panelLi);
        getLogContainer().scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        _hideBar();
    });
}
