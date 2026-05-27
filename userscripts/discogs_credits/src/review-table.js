// The unified post-preflight review table — one row per Discogs credit,
// auto-matched ones pre-filled and editable, attention-needed ones
// highlighted with search + create actions. Renders into the existing
// `<ul.logs>` element wired by the UI bar; never starts the import until
// the user explicitly clicks "Start import".

import { readIdbRecord, writeIdbRecord }   from './storage.js';
import { mbThrottle, fetchWithRetry }      from './api-mb.js';
import { parseDiscogsUrl, getDiscogsEntityData } from './api-discogs.js';
import { guessSortName }                   from './mappers.js';
import { getLogContainer }                 from './log.js';
import { _hideBar }                        from './progress-bar.js';
import { DISCOGS_CHANNEL, pageWindow }     from './constants.js';

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
    // `opts.onRefresh` — optional callback wired by ui-bar; when invoked, it
    // re-runs preflight with `bypassIdb=true` and returns the fresh results.
    // The review table exposes a "🔄 Refresh from MB" button that calls it.
    const onRefresh = opts?.onRefresh || null;

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
        // Up to 5 concurrent requests, 200ms stagger between slots,
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

        // ── Credited-as override map (issue #62) ────────────────────────────
        // Keyed by mbUrl (final resolved MB entity URL). Populated by the
        // per-row "Credited as" input. Stashed on `confirmedMap` at
        // confirm-time so the dispatch layer can pick it up and override
        // the Discogs-side credit when sending each rel. Empty string =
        // user explicitly cleared the field; the dispatcher treats
        // missing/empty as "fall through to Discogs default".
        const creditOverrides = new Map();

        // Build the pre-fill source: walk MB's currently-loaded state and
        // collect every existing `entity1_credit` per target entity. The
        // most-frequent string for each (entity, source-id) pair becomes
        // the suggested override. If no existing rel mentions the entity,
        // the input falls through to the Discogs display name (the
        // current behaviour pre-#62).
        const existingCreditByMbid = computeExistingCreditByMbid();
        function computeExistingCreditByMbid() {
            const counts = new Map(); // mbid -> Map(credit -> count)
            try {
                const root = pageWindow?.MB?.relationshipEditor?.state?.relationshipsBySource;
                if (!root) return new Map();
                walk(root);
                function walk(node) {
                    if (!node) return;
                    if (Array.isArray(node)) { for (const r of node) tally(r); return; }
                    if (typeof node === 'object') {
                        for (const v of Object.values(node)) walk(v);
                    }
                }
                function tally(rel) {
                    if (!rel || rel._status === 2) return; // skip removed
                    const credit = rel.entity1_credit;
                    if (!credit) return;
                    const tgt = rel.entity1?.gid;
                    if (!tgt) return;
                    if (!counts.has(tgt)) counts.set(tgt, new Map());
                    const m = counts.get(tgt);
                    m.set(credit, (m.get(credit) || 0) + 1);
                }
            } catch (e) { /* MB state shape changed -- best effort, skip */ }
            // Reduce to mbid -> most-frequent-credit.
            const out = new Map();
            for (const [mbid, m] of counts) {
                let best = null, bestN = 0;
                for (const [credit, n] of m) {
                    if (n > bestN) { best = credit; bestN = n; }
                }
                if (best) out.set(mbid, best);
            }
            return out;
        }

        // ── Panel shell ────────────────────────────────────────────────────────
        const panel = document.createElement('div');
        panel.style.cssText = 'border:2px solid #c8a000;border-radius:0.5rem;background:#fffef5;padding:1rem 1.5rem;margin:0.5rem 0;';
        // Hover-highlight (issue #63) lives in `src/hover-highlight.js` and
        // installs once at script load, scoped to the whole page — see that
        // module's header for why. The chips below still carry
        // `data-role-key` because hover-highlight reads it directly.
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
        // Refresh button on the LEFT side of the heading (#77 follow-up)
        // so the action lives on the same edge as the rest of the
        // review table's left-leaning chip layout.
        if (onRefresh) {
            // Refresh-from-MB button — re-runs preflight with the IDB cache
            // bypassed, so stale entries (entity merged, renamed, etc.) get
            // re-resolved from the live MB API.
            const refreshBtn = document.createElement('button');
            refreshBtn.textContent = '🔄 Refresh from MB';
            refreshBtn.title = 'Re-resolve every entity via MusicBrainz API, ignoring the local IDB cache';
            refreshBtn.style.cssText = 'font-size:0.8rem;cursor:pointer;padding:0.2rem 0.5rem;border:1px solid #b59a00;border-radius:3px;background:#fff;color:#5a4000;flex-shrink:0;';
            refreshBtn.addEventListener('click', () => {
                refreshBtn.disabled = true;
                refreshBtn.textContent = '🔄 Refreshing…';
                (panelLi || panel).remove();
                onRefresh().then(freshResults => {
                    showReviewTable(freshResults, rolesMap, companiesRolesMap, { onRefresh })
                        .then(confirmedMap => resolve(confirmedMap));
                });
            });
            heading.appendChild(refreshBtn);
        }
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
        ['Discogs entity', 'MB match / search'].forEach(col => {
            const th = document.createElement('th');
            th.style.cssText = 'text-align:left;padding:0.3rem 0.5rem;border:1px solid #d4b800;white-space:nowrap;';
            th.textContent = col;
            hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');

        allResults.forEach(r => {
            // Unified fields set by `resolveEntity` (artists + companies share the
            // same shape, dispatched by `resolveAll` in preflight.js).
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
            // `data-entity-key` — used by the issue #63 hover-highlight to
            // dim/lit the row when a role chip on another row matches.
            tr.dataset.entityKey = _entityKey;

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

            // First line — entity name on the left, inline action chips
            // on the right (Proposal C from #77). Flex justify-between
            // keeps the actions docked to the right edge of the cell.
            const nameRow = document.createElement('div');
            nameRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:0.6rem;';
            const nameWrap = document.createElement('span');
            nameWrap.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;';

            if (entityType !== 'artist') {
                const badge = document.createElement('span');
                badge.textContent = entityType;
                badge.style.cssText = 'font-size:0.7rem;background:#e0e0e0;border-radius:3px;padding:0 0.3rem;margin-right:0.3rem;color:#555;vertical-align:middle;';
                nameWrap.appendChild(badge);
            }
            const hasDiscogsUrl = !!(r.entity?.resource_url);
            const dlA = document.createElement(hasDiscogsUrl ? 'a' : 'span');
            dlA.href = discogsHref; dlA.target = '_blank'; dlA.rel = 'noopener noreferrer nofollow';
            dlA.textContent = displayName;
            // Used by the issue-#63 hover-highlight to identify entity-name
            // elements regardless of href presence.
            if (!hasDiscogsUrl) dlA.className = 'discogs-entity-name';
            nameWrap.appendChild(dlA);
            if (!hasDiscogsUrl) {
                const noUrl = document.createElement('span');
                noUrl.textContent = ' \u26a0\ufe0f'; noUrl.title = 'No Discogs artist page — manual search needed';
                noUrl.style.cssText = 'cursor:help;color:#c80;';
                nameWrap.appendChild(noUrl);
            }
            if (nameMismatch) {
                const w = document.createElement('span');
                w.textContent = ' \u26a0\ufe0f'; w.title = 'Name differs from MB match';
                w.style.cursor = 'help';
                nameWrap.appendChild(w);
            }
            nameRow.appendChild(nameWrap);

            // actionsLine slot on the right of nameRow. `renderActions`
            // (defined later in this closure) appends the link button +
            // create cluster here per Proposal C — see #77.
            const actionsLine = document.createElement('span');
            actionsLine.style.cssText = 'display:inline-flex;align-items:center;gap:0.3rem;flex-shrink:0;';
            nameRow.appendChild(actionsLine);
            tdDiscogs.appendChild(nameRow);
            tr.appendChild(tdDiscogs);

            // Roles line below entity name. Each role is its own <span> so it
            // can carry a `data-role-key` (display label *without* the track-
            // position suffix) — issue #63 hover-highlight matches the key,
            // not the displayed text, so `bass [1]` and `bass [3]` highlight
            // together on hover.
            const rolesList = r._roles || [];
            if (rolesList.length > 0) {
                const seen = new Map(); // unique-display-string -> { roleKey, displayText }
                rolesList.forEach(({ displayLabel, linkType, trackPos }) => {
                    const key = displayLabel || linkType;
                    if (!key) return;
                    const uniqueKey = key + (trackPos ? '[' + trackPos + ']' : '');
                    if (seen.has(uniqueKey)) return;
                    seen.set(uniqueKey, {
                        roleKey:     key,
                        displayText: key + (trackPos ? ' [' + trackPos + ']' : ''),
                    });
                });
                const chips = [...seen.values()];

                const rolesLine = document.createElement('div');
                rolesLine.style.cssText = 'font-size:0.75rem;color:#888;margin-top:0.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;';
                rolesLine.title = chips.map(c => c.displayText).join(', ');
                chips.forEach((chip, i) => {
                    if (i > 0) rolesLine.appendChild(document.createTextNode(', '));
                    const span = document.createElement('span');
                    span.className = 'discogs-role-chip';
                    span.dataset.roleKey = chip.roleKey;
                    span.textContent = chip.displayText;
                    rolesLine.appendChild(span);
                });
                tdDiscogs.appendChild(rolesLine);
            }

            // ── "Credited as" editable input (issue #62) ──────────────────
            // The default value comes from `existingCreditByMbid` if MB
            // already has the entity on this release; otherwise the
            // Discogs display name (current behaviour). When the row's
            // MB entity changes (via search-pick or manual edit), the
            // pre-fill is recomputed if the user hasn't typed.
            // The active value is mirrored into `creditOverrides[mbUrl]`
            // on every edit, ready for the dispatch step to consume.
            const credLine = document.createElement('div');
            // Extra top padding per #77 follow-up (and the second follow-up
            // "add more padding"). Combined margin + padding so the gap is
            // visible even when the surrounding cell trims margins.
            credLine.style.cssText = 'display:flex;align-items:center;gap:0.3rem;margin-top:1rem;padding-top:0.25rem;max-width:280px;';
            const credLabel = document.createElement('label');
            credLabel.textContent = 'Credited as:';
            credLabel.style.cssText = 'font-size:0.72rem;color:#888;flex-shrink:0;';
            const credInput = document.createElement('input');
            credInput.type = 'text';
            // Default background is plain white; when the user (or the
            // most-frequent-existing-credit pre-fill) sets a value
            // different from the original Discogs `displayName`, the
            // background flips to a soft yellow so the difference is
            // obvious at a glance (#77 follow-up).
            const CRED_BG_SAME      = '#fff';
            const CRED_BG_DIFFERENT = '#fff4d0'; // soft yellow
            credInput.style.cssText = 'flex:1;padding:0.15rem 0.35rem;font-size:0.78rem;border:1px solid #ddd;border-radius:3px;background:' + CRED_BG_SAME + ';';
            credInput.placeholder = displayName;
            credInput.title = `Override the credited name dispatched with every rel for this entity.\nLeave empty to use the default (Discogs name, or MB's most-frequent existing credit when known).`;
            function refreshCredBg() {
                const value = (credInput.value || '').trim();
                const same = (value === '' || value === displayName);
                credInput.style.background = same ? CRED_BG_SAME : CRED_BG_DIFFERENT;
            }
            // Initial value: most-frequent existing MB credit, or Discogs
            // display name as fallback.
            function pickPrefill(mbUrl) {
                if (mbUrl) {
                    const mbid = (String(mbUrl).split('/').pop() || '').replace(/[^a-f0-9-]/gi, '').slice(0, 36);
                    if (mbid && existingCreditByMbid.has(mbid)) return existingCreditByMbid.get(mbid);
                }
                return displayName;
            }
            credInput.value = pickPrefill(r.mbUrl);
            credInput._userTouched = false;
            refreshCredBg();
            credInput.addEventListener('input', () => {
                credInput._userTouched = true;
                // Mirror into the side-map immediately. The mbUrl on the
                // row may change later (search → pick a different MBID);
                // the row.mbUrlForCredits closure is bumped in those
                // handlers, see `setRowResolved` below.
                const url = credInput._activeMbUrl;
                if (url) creditOverrides.set(url, credInput.value);
                refreshCredBg();
            });
            credInput._activeMbUrl = r.mbUrl;
            if (r.mbUrl) creditOverrides.set(r.mbUrl, credInput.value);
            credLine.appendChild(credLabel);
            credLine.appendChild(credInput);
            tdDiscogs.appendChild(credLine);
            // Stash so other parts (search picker, refresh) can re-target
            // the override key when the row's mbUrl changes.
            r._credInput = credInput;

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
            // Per #77 iter 3: search icon on the LEFT of the input.
            searchRow.appendChild(searchBtn);
            searchRow.appendChild(searchInput);

            tdMb.appendChild(candidateList);
            tdMb.appendChild(searchRow);
            tr.appendChild(tdMb);

            // No separate Action column — actions render inside the
            // Discogs column's `actionsLine` slot (Proposal C of #77).
            // We keep a `tdAction` alias pointing at `actionsLine` so the
            // existing `renderActions` body stays compact below.
            const tdAction = actionsLine;
            tbody.appendChild(tr);

            // ── Helpers ────────────────────────────────────────────────────────
            function setRowResolved(a) {
                // a = { id, name, disambiguation }
                const mbUrl = `//musicbrainz.org/${entityType}/${a.id}`;
                rowState.set(_entityKey, { mbUrl, mbName: a.name, mbDisambig: a.disambiguation || '', confirmed: true, via: 'user', fromCache: false });
                // Re-target the Credited-as override for this row to the
                // newly-selected mbUrl (#62). If the input still holds
                // the pre-fill (user hasn't touched), recompute the
                // pre-fill against the new mbid; otherwise preserve
                // their typed value verbatim.
                if (r._credInput) {
                    const oldUrl = r._credInput._activeMbUrl;
                    if (oldUrl && oldUrl !== mbUrl) creditOverrides.delete(oldUrl);
                    r._credInput._activeMbUrl = mbUrl;
                    if (!r._credInput._userTouched) {
                        const fresh = pickPrefill(mbUrl);
                        r._credInput.value = fresh;
                    }
                    creditOverrides.set(mbUrl, r._credInput.value);
                    refreshCredBg();
                }
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
                // Clear the Credited-as override now that there's no
                // resolved entity to attach it to (#62). Input value is
                // kept so the user doesn't lose their typing.
                if (r._credInput && r._credInput._activeMbUrl) {
                    creditOverrides.delete(r._credInput._activeMbUrl);
                    r._credInput._activeMbUrl = null;
                }
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

            // Shared style for inline icon-chip buttons (Proposal C in
            // the actionsLine). Color is set per-chip via concatenation
            // so each action has its own accent: orange for the Discogs
            // link, green for create, muted gray for advanced.
            const ACTION_CHIP_STYLE =
                'display:inline-flex;align-items:center;justify-content:center;' +
                'min-width:1.6rem;height:1.6rem;padding:0 0.35rem;' +
                'font-size:0.95rem;line-height:1;cursor:pointer;' +
                'border:1px solid #d6d6d6;border-radius:0.3rem;background:#fafafa;';

            function renderActions(selected) {
                tdAction.innerHTML = '';
                if (selected) {
                    // Link state lives in a single chip (Proposal C from #77):
                    //   🔗 — needs adding (default action)
                    //   ✓  — already linked (no further action)
                    //   ⚠  — linked to a different MB entity (informational)
                    //   ⋯  — verifying (after user clicks 🔗 and goes to MB)
                    // Inline-flex so it sits next to the create chips on the
                    // same row as the entity name.
                    const linkSlot = document.createElement('span');
                    linkSlot.style.cssText = 'display:inline-flex;align-items:center;font-size:0.8rem;color:#888;';
                    linkSlot.textContent = '…';
                    linkSlot.title = 'Checking whether MB already has this Discogs URL linked';
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

                    // Re-runs the MB URL-relation check for THIS row, bypassing
                    // both session and localStorage caches. Used by the
                    // "Add Discogs link" focus-return handler so the button
                    // updates to "\u2713 already linked" once the user has actually
                    // submitted the link edit on the other tab (issue #6).
                    function recheckUrlBypassCache() {
                        _urlCheckSessionCache.delete(urlCheckCacheKey);
                        try { localStorage.removeItem(urlCheckLsKey); } catch(e) {}
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

                    function applyUrlCheckResult(result) {
                        if (result === 'linked') {
                            linkSlot.textContent = '\u2713';
                            linkSlot.title = 'Discogs URL already linked to this MB ' + entityType;
                            linkSlot.style.color = '#5a5';
                            linkSlot.style.fontWeight = 'bold';
                        } else if (result === 'other') {
                            linkSlot.textContent = '\u26a0\ufe0f';
                            linkSlot.title = `Discogs URL is linked to a DIFFERENT MB ${entityType}`;
                            linkSlot.style.color = '#c80';
                        } else {
                            linkSlot.textContent = '';
                            linkSlot.style.color = '';
                            const addLinkBtn = document.createElement('button');
                            addLinkBtn.textContent = '\ud83d\udd17'; // \ud83d\udd17
                            addLinkBtn.title = 'Add Discogs link to MB ' + entityType;
                            addLinkBtn.style.cssText = ACTION_CHIP_STYLE + 'color:#e8771d;'; // Discogs orange accent
                            addLinkBtn.addEventListener('click', () => {
                                const ltId = entityType === 'label' ? '217' : entityType === 'place' ? '705' : '180';
                                const p = new URLSearchParams({ [`edit-${entityType}.url.0.text`]: discogsHref, [`edit-${entityType}.url.0.link_type_id`]: ltId });
                                const mbid = selected.id.replace(/.*\//, '').replace(/[^a-f0-9-]/gi, '').substring(0, 36);
                                window.open(`https://musicbrainz.org/${entityType}/${mbid}/edit?${p}`, '_blank', 'noopener,noreferrer');
                                // Replace button with a "pending verification" badge.
                                // When the user comes back to this tab, we re-run the
                                // URL check (cache-bypassed) and the row flips to
                                // "\u2713 Discogs URL already linked" \u2014 or, if the user
                                // didn't actually submit the edit, the button is
                                // restored. Issue #6: previously the button just sat
                                // there forever, not reflecting the link.
                                linkSlot.innerHTML = '';
                                // Compact pending indicator (Proposal C):
                                // an ellipsis with the full status in the
                                // tooltip \u2014 re-verified when the tab
                                // regains focus.
                                linkSlot.textContent = '\u2026';
                                linkSlot.title = 'Verifying Discogs link on return to this tab\u2026';
                                linkSlot.style.color = '#888';
                                linkSlot.style.fontStyle = 'italic';
                                const onReturn = () => {
                                    if (document.visibilityState !== 'visible') return;
                                    document.removeEventListener('visibilitychange', onReturn);
                                    window.removeEventListener('focus', onReturn);
                                    recheckUrlBypassCache();
                                };
                                document.addEventListener('visibilitychange', onReturn);
                                window.addEventListener('focus', onReturn);
                            });
                            linkSlot.appendChild(addLinkBtn);
                        }
                    }

                    if (!discogsHref) {
                        // No Discogs URL — skip URL check entirely
                        linkSlot.textContent = '⚠ No Discogs page';
                        linkSlot.style.color = '#c80';
                    } else if (Array.isArray(r.urlLinkedIds)) {
                        // Preflight already harvested the Discogs-URL → MB-entity
                        // relations (parallel with name search). Compute the row's
                        // state from that without firing another `/ws/2/url?…`
                        // request per row. Populates both caches so post-import
                        // re-checks (focus-return) stay equally cheap.
                        const result = r.urlLinkedIds.includes(selected.id) ? 'linked'
                                     : r.urlLinkedIds.length > 0          ? 'other'
                                                                          : 'none';
                        _urlCheckSessionCache.set(urlCheckCacheKey, result);
                        try { localStorage.setItem(urlCheckLsKey, JSON.stringify({ date: urlCheckToday, result })); } catch(e) {}
                        applyUrlCheckResult(result);
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
                // Opens the MB create-entity tab pre-filled with name + Discogs
                // URL relation, optionally also `comment` (= disambiguation).
                // Used by both "Create in MB" (default-name, no disambiguation)
                // and the "Create (adv)" popup flow (issue #5).
                function openCreateTab({ name, disambiguation } = {}) {
                    const finalName = (name || displayName).trim();
                    let createUrl;
                    let createParams;
                    if (entityType === 'artist') {
                        createParams = {
                            'edit-artist.name':      finalName,
                            'edit-artist.sort_name': guessSortName(finalName),
                            'edit-artist.type_id':   '1',
                        };
                        if (discogsHref) {
                            createParams['edit-artist.url.0.text']         = discogsHref;
                            createParams['edit-artist.url.0.link_type_id'] = '180';
                        }
                        if (disambiguation) createParams['edit-artist.comment'] = disambiguation;
                        createUrl = 'https://musicbrainz.org/artist/create';
                    } else {
                        const ltId = entityType === 'label' ? '217' : '705';
                        createParams = {
                            [`edit-${entityType}.name`]:                finalName,
                            [`edit-${entityType}.url.0.text`]:          discogsHref,
                            [`edit-${entityType}.url.0.link_type_id`]: ltId,
                        };
                        if (disambiguation) createParams[`edit-${entityType}.comment`] = disambiguation;
                        createUrl = `https://musicbrainz.org/${entityType}/create`;
                    }
                    const p = new URLSearchParams(createParams);
                    const newTab = window.open(`${createUrl}?${p}`, '_blank');
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
                        // Issue #78: `openCreateTab` puts the Discogs URL
                        // straight into MB's create form (`edit-<type>.url.0.text`
                        // + `link_type_id`), so when the entity is born the
                        // URL relation already exists on it. Pre-seed the
                        // URL-check cache for this new MBID so the row's
                        // action chip jumps straight to ✓ without going
                        // through 🔗 "Add Discogs link" — the link is
                        // already there. The session cache is keyed by
                        // `${mbid}|${discogsHref}` exactly as renderActions
                        // builds it.
                        _urlCheckSessionCache.set(`${evt.data.id}|${discogsHref}`, 'linked');
                        setRowResolved({ id: evt.data.id, name: evt.data.name, disambiguation: evt.data.disambiguation });
                    };
                    DISCOGS_CHANNEL.addEventListener('message', onCreated);
                }

                // Inline icon chips (Proposal C from #77). All three
                // actions — link / create / advanced — render side by
                // side in the actionsLine to the right of the entity
                // name. Compact icons with descriptive `title=` for
                // accessibility.
                const createBtn = document.createElement('button');
                createBtn.textContent = '+';
                createBtn.title = 'Create in MB with default Discogs name + URL';
                createBtn.style.cssText = ACTION_CHIP_STYLE + 'color:#2a7;font-size:1.15rem;font-weight:600;'; // bigger, bolder plus
                createBtn.addEventListener('click', () => openCreateTab());

                const createAdvBtn = document.createElement('button');
                createAdvBtn.textContent = '▾';
                createAdvBtn.title = 'Create in MB with editable name + disambiguation, pre-filled from the Discogs profile';
                createAdvBtn.style.cssText = ACTION_CHIP_STYLE + 'color:#666;'; // muted

                createAdvBtn.addEventListener('click', () => openAdvancedCreatePopup());

                tdAction.appendChild(createBtn);
                tdAction.appendChild(createAdvBtn);

                async function openAdvancedCreatePopup() {
                    // Default disambiguation suggestion: first 3 distinct role labels.
                    const distinctRoles = [];
                    const seen = new Set();
                    for (const role of (r._roles || [])) {
                        const label = (role.displayLabel || role.linkType || '').trim();
                        if (!label || seen.has(label)) continue;
                        seen.add(label);
                        distinctRoles.push(label);
                        if (distinctRoles.length === 3) break;
                    }
                    const defaultDis = distinctRoles.join(', ');

                    // ── Modal shell ─────────────────────────────────────────
                    const overlay = document.createElement('div');
                    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:10000;display:flex;align-items:center;justify-content:center;';
                    const modal = document.createElement('div');
                    modal.style.cssText = 'background:#fff;border-radius:0.5rem;padding:1.1rem 1.35rem 1rem;max-width:600px;width:92%;max-height:82vh;'
                                        + 'display:flex;flex-direction:column;gap:0.55rem;box-shadow:0 12px 32px rgba(0,0,0,0.32);'
                                        + 'font-family:inherit;';

                    const heading = document.createElement('div');
                    heading.style.cssText = 'font-weight:bold;font-size:1.02rem;color:#222;margin-bottom:0.15rem;';
                    heading.textContent = `Create ${entityType} in MusicBrainz`;
                    modal.appendChild(heading);

                    // ── Name input ──────────────────────────────────────────
                    const FIELD_LABEL = 'font-size:0.78rem;color:#666;font-weight:600;letter-spacing:0.02em;text-transform:uppercase;margin-top:0.25rem;';
                    const FIELD_INPUT = 'padding:0.45rem 0.55rem;border:1px solid #c8c8c8;border-radius:0.3rem;font-size:0.93rem;font-family:inherit;';

                    const nameLabel = document.createElement('label');
                    nameLabel.style.cssText = FIELD_LABEL;
                    nameLabel.textContent = 'Name';
                    modal.appendChild(nameLabel);

                    const nameInput = document.createElement('input');
                    nameInput.type = 'text';
                    nameInput.value = displayName;
                    nameInput.style.cssText = FIELD_INPUT;
                    modal.appendChild(nameInput);
                    // Track whether the user has touched the input — if they
                    // haven't, we'll overwrite it with the Discogs realname
                    // once the lazy fetch completes (and the realname differs
                    // from the Discogs displayName, i.e. it's actually useful).
                    let nameUserTouched = false;
                    nameInput.addEventListener('input', () => { nameUserTouched = true; });

                    // ── Disambiguation input ────────────────────────────────
                    const disLabel = document.createElement('label');
                    disLabel.style.cssText = FIELD_LABEL;
                    disLabel.textContent = 'Disambiguation';
                    modal.appendChild(disLabel);

                    const disInput = document.createElement('input');
                    disInput.type = 'text';
                    disInput.value = defaultDis;
                    disInput.style.cssText = FIELD_INPUT;
                    modal.appendChild(disInput);
                    let disUserTouched = false;
                    disInput.addEventListener('input', () => { disUserTouched = true; });

                    // ── Discogs profile blurb ───────────────────────────────
                    const profileLabel = document.createElement('div');
                    profileLabel.style.cssText = 'font-size:0.78rem;color:#888;margin-top:0.55rem;';
                    profileLabel.textContent = 'Discogs profile — select text to copy into Disambiguation';
                    modal.appendChild(profileLabel);

                    const profileBox = document.createElement('div');
                    profileBox.style.cssText = 'border:1px solid #e0e0e0;border-radius:0.3rem;padding:0.5rem 0.6rem;background:#fafafa;'
                                             + 'font-size:0.85rem;line-height:1.5;white-space:pre-wrap;overflow:auto;'
                                             + 'min-height:5rem;max-height:18rem;flex:1;color:#444;';
                    profileBox.textContent = 'Loading profile from Discogs…';
                    modal.appendChild(profileBox);

                    // Selecting text inside the profile auto-fills the
                    // Disambiguation input. `mouseup` + `keyup` together
                    // catch both drag and shift-arrow selection. We bail
                    // when the selection is empty (e.g. the user just
                    // clicked to deselect — don't clobber the field).
                    const captureSelection = () => {
                        const sel = window.getSelection();
                        if (!sel || sel.isCollapsed) return;
                        if (!profileBox.contains(sel.anchorNode)) return;
                        const text = sel.toString().trim();
                        if (!text) return;
                        disInput.value = text;
                        // Counts as user input — don't surprise the user by
                        // overwriting with the realname later.
                        disUserTouched = true;
                    };
                    profileBox.addEventListener('mouseup', captureSelection);
                    profileBox.addEventListener('keyup',   captureSelection);

                    // ── Button row ──────────────────────────────────────────
                    const btnRow = document.createElement('div');
                    btnRow.style.cssText = 'display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.55rem;';
                    const cancelBtn = document.createElement('button');
                    cancelBtn.textContent = 'Cancel';
                    cancelBtn.style.cssText = 'padding:0.4rem 1rem;cursor:pointer;border:1px solid #c8c8c8;border-radius:0.25rem;background:#fafafa;color:#444;font-size:0.88rem;';
                    const submitBtn = document.createElement('button');
                    submitBtn.textContent = 'Create ↗';
                    submitBtn.style.cssText = 'padding:0.4rem 1.1rem;cursor:pointer;font-weight:bold;background:#2ecc40;color:#fff;border:none;border-radius:0.25rem;font-size:0.9rem;';
                    btnRow.appendChild(cancelBtn);
                    btnRow.appendChild(submitBtn);
                    modal.appendChild(btnRow);

                    overlay.appendChild(modal);
                    document.body.appendChild(overlay);

                    // ── Cleanup + submit handlers ───────────────────────────
                    const close = () => {
                        document.removeEventListener('keydown', onKey);
                        overlay.remove();
                    };
                    const submit = () => {
                        const name = nameInput.value.trim();
                        const dis  = disInput.value.trim();
                        close();
                        openCreateTab({ name: name || displayName, disambiguation: dis || null });
                    };
                    const onKey = (ev) => {
                        if (ev.key === 'Escape') { close(); }
                        else if (ev.key === 'Enter' && (ev.target === disInput || ev.target === nameInput)) submit();
                    };
                    document.addEventListener('keydown', onKey);
                    overlay.addEventListener('click', ev => { if (ev.target === overlay) close(); });
                    cancelBtn.addEventListener('click', close);
                    submitBtn.addEventListener('click', submit);

                    // Focus the disambiguation field (the field the user is
                    // most likely to edit). Select-all so type-replace works.
                    disInput.focus(); disInput.select();

                    // ── Lazy Discogs fetch — profile + realname ────────────
                    try {
                        const data = await getDiscogsEntityData(r.entity?.resource_url);
                        // Bump the name input to realname if the user hasn't
                        // started typing AND it's actually different/useful.
                        if (data?.realname && !nameUserTouched && data.realname.trim() !== displayName.trim()) {
                            nameInput.value = data.realname.trim();
                        }
                        const lines = [];
                        if (data?.namevariations?.length) lines.push(`Also known as: ${data.namevariations.slice(0, 6).join(', ')}`);
                        if (data?.profile) {
                            if (lines.length) lines.push('');
                            lines.push(data.profile);
                        }
                        profileBox.textContent = lines.length ? lines.join('\n') : '(no Discogs profile)';
                    } catch (e) {
                        profileBox.textContent = '(failed to load Discogs profile)';
                    }
                }
            }

            function makeCandidateRow(a) {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:0.35rem;padding:0.2rem 0.35rem;border:1px solid #ddd;border-radius:3px;background:#fff;font-size:0.82rem;';
                // Per #77 iter 3: select icon on the LEFT of the candidate row.
                const selBtn = document.createElement('button');
                selBtn.textContent = '✓';
                selBtn.title = 'Select this candidate as the MB match';
                selBtn.style.cssText = 'font-size:0.95rem;line-height:1;cursor:pointer;padding:0.1rem 0.45rem;white-space:nowrap;border:1px solid #b5d5b5;border-radius:0.25rem;background:#eaf6ea;color:#2a7;font-weight:600;flex-shrink:0;';
                selBtn.addEventListener('click', () => setRowResolved(a));
                row.appendChild(selBtn);

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

            // Stash the unresolved + total counts on `confirmedMap` for the
            // dispatch layer to surface in the edit note (no call-site
            // signature change — Maps accept arbitrary properties).
            confirmedMap.unresolvedCount = unresolvedCount;
            confirmedMap.totalEntities   = allResults.length;
            // Credited-as overrides keyed by final mbUrl (#62). The
            // dispatcher picks these up via the `dedupOpts` arg and
            // overrides each rel's `entity1_credit` when present.
            confirmedMap.creditOverrides = creditOverrides;
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
