// The unified post-preflight review table — one row per Discogs credit,
// auto-matched ones pre-filled and editable, attention-needed ones
// highlighted with search + create actions. Renders into the existing
// `<ul.logs>` element wired by the UI bar; never starts the import until
// the user explicitly clicks "Start import".

import { readIdbRecord, writeIdbRecord }   from './storage.js';
import { mbThrottle, fetchWithRetry, fetchArtistRelTypes } from './api-mb.js';
import { getDiscogsEntityData }            from './api-discogs.js';
import { parseSourceEntityUrl, sourceNameForUrl, sourceUrlLinkTypeId, idbKeyForEntity } from './sources/registry.js';
import { guessSortName }                   from './mappers.js';
import { buildCreateNote }                 from './edit-note.js';
import { getLogContainer, getReviewContainer } from './log.js';
import { _hideBar }                        from './progress-bar.js';
import { DISCOGS_CHANNEL, pageWindow }     from './constants.js';

// Session-level URL check cache (avoids localStorage key mismatches across sessions)
const _urlCheckSessionCache = new Map();

// #273: one-time spinner keyframes for the background-create placeholder.
function ensureCreatingStyle() {
    if (document.getElementById('ch-creating-style')) return;
    const st = document.createElement('style');
    st.id = 'ch-creating-style';
    st.textContent = '@keyframes ch-creating-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(st);
}

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
    // `opts.headerSlot` — a container in the always-visible bar header where the
    // Start-import button + unresolved message are mounted, so the user doesn't
    // have to scroll past the table to reach them (#139). Falls back to a footer
    // row under the table when absent.
    const headerSlot = opts?.headerSlot || null;
    // `opts.sourceName` — name of the import source ('Discogs'/'Tidal'/'Qobuz').
    // Per-row labels derive the source from the entity URL when there is one;
    // URL-less credits (all of Qobuz) fall back to this so a Qobuz row never
    // claims "No Discogs page" (#193 live-test round 3).
    const importSourceName = opts?.sourceName || 'Discogs';
    // `opts.sourceIcon` — the source's brand glyph (HTML), shown on the Start-import
    // button so the chosen source stays visible through the review phase (#193).
    const sourceIcon = opts?.sourceIcon || '';
    // #408: on an "Import all" run, a per-entity provenance map + an icon lookup drive a
    // leading "Source" column (brand-icon badges). Absent on single-source runs → no column.
    const entitySources = opts?.entitySources || null;
    const sourceBadgeIcon = opts?.sourceBadgeIcon || (() => '');

    // Pre-load missing names into a Map — IDB first, then MB WS2 fetch.
    const _preloadedNames = new Map();
    const _nullNames = allResults.filter(r => r.type === 'resolved' && r.mbUrl && !r.mbName);
    for (const r of _nullNames) {
        const rUrl = r.entity?.resource_url;
        try {
            const idbKey = idbKeyForEntity(r.entity);
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
        // `opts.registerAbort` — hand the caller (ui-bar's cancelRun) a way to
        // resolve this promise with `null`, so a mid-review cancel unwinds the
        // import chain cleanly (null ⇒ "review skipped, don't dispatch") instead
        // of leaving it pending forever. Resolving twice is a no-op, so a normal
        // Start-import resolve later still wins if this was never called.
        opts?.registerAbort?.(() => resolve(null));
        // Per-row state: resource_url -> { mbUrl, mbName, mbDisambig, confirmed, via }.
        // `confirmed = true` means the user is happy with this match (or it
        // auto-matched cleanly). Mutations from user picks / undo / IDB
        // pre-load are immediately reflected in `rowState` — and from there
        // into the IDB `entity_cache` via `writeIdbRecord`. No separate
        // localStorage layer.
        const rowState = new Map();
        // Per-entity search input, so the header's "N unresolved" message can
        // focus the first still-unresolved row (#139). Keyed like `rowState`.
        const rowSearchInputs = new Map();
        // Per-row Discogs-link state, keyed like `rowState`: 'linked' | 'other' |
        // 'none' (= addable: the 🔗 chip is showing) | 'na'. Drives the header's
        // "N links" badge (count of 'none'). `linksNote` is the badge element,
        // assigned once the header mounts; `updateLinksBadge` is a no-op until then.
        const linkState = new Map();
        const rowLinkChips = new Map();   // _entityKey → the 🔗 add-link button, for jump-to
        let linksNote = null;
        function updateLinksBadge() {
            if (!linksNote) return;
            const n = [...linkState.values()].filter(v => v === 'none').length;
            linksNote.textContent = n ? `🔗 ${n} link${n === 1 ? '' : 's'}` : '';
            linksNote.style.display = n ? '' : 'none';
            linksNote.classList.toggle('clickable', n > 0);
        }
        const keyOf = r => r.entity?.resource_url || r.entity?._syntheticKey || `_nourl_${r.entity?.name || r.displayName}`;
        // Cycle through the rows whose source URL still needs linking (linkState
        // 'none'), scrolling each into view and pulsing its 🔗 chip — same UX as
        // the "N unresolved" jump. Scans live `linkState` so added links drop out.
        let _linkJumpIdx = -1;
        function jumpNextLink() {
            const n = allResults.length;
            let found = -1;
            for (let step = 1; step <= n; step++) {
                const i = (_linkJumpIdx + step) % n;
                if (linkState.get(keyOf(allResults[i])) === 'none') { found = i; break; }
            }
            if (found === -1) return;
            _linkJumpIdx = found;
            const key = keyOf(allResults[found]);
            const chip = rowLinkChips.get(key);
            const target = chip || rowSearchInputs.get(key);
            if (!target) return;
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (chip) {
                const o = chip.style.boxShadow;
                chip.style.boxShadow = '0 0 0 3px rgba(232,119,29,0.6)';
                setTimeout(() => { chip.style.boxShadow = o; }, 1200);
            }
        }

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
            const MB = pageWindow?.MB;
            const iterate = MB?.tree?.iterate;
            if (!iterate) return counts;
            // Unwrap a [key, value] yield to just the value when the tree
            // is a Map. For plain trees (array nodes), the yield is the
            // value itself.
            const valueOf = (yielded) => Array.isArray(yielded) ? yielded[1] : yielded;
            const isTree  = (x) => x && typeof x === 'object' && x.size != null && (x.left !== undefined || x.right !== undefined || x.value !== undefined);

            function tally(rel) {
                if (!rel || rel._status === 2) return; // skip removed
                // Check both ends — work→artist rels list the artist as
                // entity0 (with empty entity0_credit by default).
                for (const side of [1, 0]) {
                    const entity = rel[`entity${side}`];
                    const tgt = entity?.gid;
                    if (!tgt) continue;
                    // Use entity name as fallback when entity{N}_credit is
                    // empty — MB displays the entity name when no credit
                    // override is set, so the visible "credit" IS the entity
                    // name. Without this, Discogs ANV "Idol" wouldn't default
                    // to "Billy Idol" and "Foder"/"Profilio" wouldn't default
                    // to "Daniel Foder"/"Brian Profilio" (#105).
                    const credit = rel[`entity${side}_credit`] || entity.name;
                    if (!credit) continue;
                    if (!counts.has(tgt)) counts.set(tgt, new Map());
                    const m = counts.get(tgt);
                    m.set(credit, (m.get(credit) || 0) + 1);
                }
            }

            // Walk the nested-tree shape MB uses for `(existing)relationshipsBySource`:
            //   tree by source-entity
            //   -> tree by target-type
            //      -> tree by (typeId, backward) — yields `typeGroup` objects
            //         -> typeGroup.phraseGroups (tree by phrase)
            //            -> phraseGroup.relationships (tree of rels)
            // The earlier "recursive Object.values()" walker walked the
            // tree's internal `{left, right, size, value}` nodes, never
            // reaching actual rels. #105.
            function walkRels(rels) {
                if (!isTree(rels)) return;
                for (const e of iterate(rels)) tally(valueOf(e));
            }
            function walkPhraseGroups(phraseGroups) {
                if (!isTree(phraseGroups)) return;
                for (const e of iterate(phraseGroups)) {
                    const pg = valueOf(e);
                    if (pg?.relationships) walkRels(pg.relationships);
                }
            }
            function walkTypeGroups(byTypeId) {
                if (!isTree(byTypeId)) return;
                for (const e of iterate(byTypeId)) {
                    const tg = valueOf(e);
                    if (tg?.phraseGroups) walkPhraseGroups(tg.phraseGroups);
                }
            }
            function walkPerSource(perSource) {
                if (!isTree(perSource)) return;
                for (const e of iterate(perSource)) {
                    walkTypeGroups(valueOf(e));
                }
            }
            function walkSource(root) {
                if (!isTree(root)) return;
                for (const e of iterate(root)) {
                    walkPerSource(valueOf(e));
                }
            }

            // Pass 1: pre-existing rels (loaded with the page) — what the
            // user already sees on the release-edit page before our import.
            try { walkSource(MB.relationshipEditor?.state?.existingRelationshipsBySource); }
            catch (e) { /* shape changed — fall through */ }
            // Pass 2: newly-added rels staged in this editor session (e.g.
            // by a prior aborted import or manual edits).
            try { walkSource(MB.relationshipEditor?.state?.relationshipsBySource); }
            catch (e) { /* shape changed — fall through */ }
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
                if (headerSlot) headerSlot.replaceChildren();   // #139: cleared, repopulated by the recursive render
                onRefresh().then(freshResults => {
                    // Pass the FULL opts through, not just { onRefresh, headerSlot } —
                    // dropping sourceName/sourceIcon made the source-aware render throw
                    // (e.g. sourceName.charAt(0)) and aborted before the Start-import
                    // button mounted, so a refresh left no import button. (#193)
                    showReviewTable(freshResults, rolesMap, companiesRolesMap, opts)
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
        [...(entitySources ? ['Source'] : []), importSourceName + ' entity', 'MB match / search'].forEach(col => {
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
            // Which source this row's labels should name: derived from the
            // entity URL when present, else the import source (#193 — a
            // URL-less Qobuz row must not claim "No Discogs page").
            const srcName     = discogsHref ? sourceNameForUrl(discogsHref) : importSourceName;
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

            // ── Col 0 (#408 consolidated): Source badges ───────────────────────
            if (entitySources) {
                const tdSrc = document.createElement('td');
                tdSrc.style.cssText = `padding:0.3rem 0.5rem;border:1px solid ${borderColor};white-space:nowrap;text-align:center;`;
                const names = entitySources.get(_entityKey) || [];
                tdSrc.innerHTML = names.map(nm => `<span class="discogs-src-badge" title="${nm}" style="display:inline-flex;vertical-align:middle;margin:0 1px;">${sourceBadgeIcon(nm)}</span>`).join('') || '<span style="color:#bbb;">—</span>';
                tr.appendChild(tdSrc);
            }

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
            // #325: Tidal exposes no label page, so company credits carry a synthetic
            // `/_company/` placeholder URL that 404s — render the name as plain text,
            // not a dead link.
            const placeholderUrl = /\/_company\//.test(discogsHref) || /\/_company\//.test(r.entity?.resource_url || '');
            const hasDiscogsUrl = !!(r.entity?.resource_url) && !placeholderUrl;
            const dlA = document.createElement(hasDiscogsUrl ? 'a' : 'span');
            dlA.href = discogsHref; dlA.target = '_blank'; dlA.rel = 'noopener noreferrer nofollow';
            dlA.textContent = displayName;
            // Used by the issue-#63 hover-highlight to identify entity-name
            // elements regardless of href presence.
            if (!hasDiscogsUrl) dlA.className = 'discogs-entity-name';
            // #271: tooltip the originating track title(s). The parsed name can
            // legitimately drop part of the real artist ("Europa 51" → "Europa",
            // the trailing number being indistinguishable from a mix qualifier),
            // so seeing the full title gives the context to pick the right MB
            // entity. Multiple titles when the same name remixes several tracks.
            const _srcTitles = [...new Set((r._roles || []).map(x => x.trackTitle).filter(Boolean))];
            if (_srcTitles.length) dlA.title = _srcTitles.join('\n');
            nameWrap.appendChild(dlA);
            // Distinct warning badges per #81. Both warnings used to be
            // the same icon, distinguishable only via tooltip. Now each
            // condition gets a short text label with a distinct color.
            const BADGE_BASE = 'display:inline-flex;align-items:center;margin-left:0.35rem;' +
                               'padding:0.05rem 0.4rem;font-size:0.65rem;font-weight:600;' +
                               'border-radius:0.7rem;letter-spacing:0.01em;cursor:help;' +
                               'text-transform:lowercase;line-height:1.4;';
            // The Titles source (#271) derives names from track titles — there's
            // no external entity page to miss, so the "no profile" badge is pure
            // noise on every row; skip it. For real URL sources, a URL-less row
            // genuinely lacks a profile, so keep the badge (source-worded).
            if (!hasDiscogsUrl && !placeholderUrl && srcName !== 'Titles') {
                const noUrl = document.createElement('span');
                noUrl.textContent = 'no profile';
                noUrl.title = `No ${srcName} artist page — name lookup unavailable, search MB manually`;
                noUrl.style.cssText = BADGE_BASE + 'background:#fde0e0;color:#a02020;border:1px solid #d44040;';
                nameWrap.appendChild(noUrl);
            }
            if (nameMismatch) {
                const w = document.createElement('span');
                w.textContent = 'name differs';
                w.title = 'MB entity name differs from the Discogs display name — double-check this is the right match';
                w.style.cssText = BADGE_BASE + 'background:#fff1c4;color:#7a5800;border:1px solid #d4ad3a;';
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
            credInput.title = `Override the credited name dispatched with every rel for this entity.\nLeave empty to use the default (${srcName} name, or MB's most-frequent existing credit when known).`;
            function refreshCredBg() {
                const value = (credInput.value || '').trim();
                const same = (value === '' || value === displayName);
                credInput.style.background = same ? CRED_BG_SAME : CRED_BG_DIFFERENT;
            }
            // Initial value priority (#105):
            //   1. User's saved override from a prior session (`r.creditOverride`
            //      — set by preflight from the IDB record).
            //   2. MB's most-frequent existing credit on this release for the
            //      resolved entity.
            //   3. #271 Titles source — the resolved MB entity name (the parsed
            //      remix name is unreliable, e.g. "Kenneth Bager Ambient" from
            //      "… Ambient Remix"; default to the MB name as if "MB" clicked).
            //   4. Source/parsed display name.
            function pickPrefill(mbUrl) {
                if (r.creditOverride !== undefined && r.creditOverride !== null && r.creditOverride !== '') {
                    return r.creditOverride;
                }
                if (mbUrl) {
                    const mbid = (String(mbUrl).split('/').pop() || '').replace(/[^a-f0-9-]/gi, '').slice(0, 36);
                    if (mbid && existingCreditByMbid.has(mbid)) return existingCreditByMbid.get(mbid);
                }
                if (srcName === 'Titles') {
                    const mbName = rowState.get(_entityKey)?.mbName || r.mbName;
                    if (mbName) return mbName;
                }
                return displayName;
            }
            credInput.value = pickPrefill(r.mbUrl);
            credInput._userTouched = false;
            refreshCredBg();
            // Persist user's edits to IDB so the next session pre-fills with
            // their choice (#105). Debounced so we don't write on every
            // keystroke.
            let _credSaveTimer;
            credInput.addEventListener('input', () => {
                credInput._userTouched = true;
                // Mirror into the side-map immediately. The mbUrl on the
                // row may change later (search → pick a different MBID);
                // the row.mbUrlForCredits closure is bumped in those
                // handlers, see `setRowResolved` below.
                const url = credInput._activeMbUrl;
                if (url) creditOverrides.set(url, credInput.value);
                refreshCredBg();
                clearTimeout(_credSaveTimer);
                _credSaveTimer = setTimeout(() => {
                    const idbKey = idbKeyForEntity(r.entity);
                    if (idbKey) writeIdbRecord(idbKey, { creditOverride: credInput.value });
                }, 500);
            });
            credInput._activeMbUrl = r.mbUrl;
            if (r.mbUrl) creditOverrides.set(r.mbUrl, credInput.value);

            // [MB] / [D] quick-set buttons (#108): one click swaps the
            // "Credited as" value to the MB entity name or the Discogs
            // name. Disabled state: [MB] requires a resolved entity AND
            // a value that isn't already the MB name; [D] is disabled
            // when the value already equals the Discogs displayName.
            const CRED_BTN_STYLE = 'flex-shrink:0;padding:0.05rem 0.35rem;font-size:0.7rem;line-height:1;cursor:pointer;border:1px solid #c8a000;border-radius:3px;background:#fffbe6;color:#7a5000;';
            const mbBtn = document.createElement('button');
            mbBtn.type = 'button';
            mbBtn.textContent = 'MB';
            mbBtn.title = 'Set Credited as to the MB entity name';
            mbBtn.style.cssText = CRED_BTN_STYLE;
            const dBtn = document.createElement('button');
            dBtn.type = 'button';
            dBtn.textContent = srcName.charAt(0);   // D / T / Q — the import source
            dBtn.title = `Set Credited as to the ${srcName} name`;
            dBtn.style.cssText = CRED_BTN_STYLE;
            function currentMbName() {
                return rowState.get(_entityKey)?.mbName || r.mbName || null;
            }
            function refreshCredBtns() {
                const val = credInput.value;
                const mbName = currentMbName();
                // Hide rather than disable — disabled chips next to every
                // row looked spammy. Buttons disappear entirely when the
                // action would be a no-op (#108 follow-up).
                mbBtn.style.display = (!mbName || val === mbName) ? 'none' : '';
                dBtn.style.display  = (val === displayName) ? 'none' : '';
            }
            function setCredViaButton(value) {
                credInput.value = value;
                credInput._userTouched = true;
                credInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            mbBtn.addEventListener('click', () => {
                const mbName = currentMbName();
                if (mbName) setCredViaButton(mbName);
            });
            dBtn.addEventListener('click', () => setCredViaButton(displayName));
            credInput.addEventListener('input', refreshCredBtns);
            refreshCredBtns();

            credLine.appendChild(credLabel);
            credLine.appendChild(credInput);
            credLine.appendChild(mbBtn);
            credLine.appendChild(dBtn);
            tdDiscogs.appendChild(credLine);
            // Stash so other parts (search picker, refresh) can re-target
            // the override key when the row's mbUrl changes.
            r._credInput = credInput;
            r._refreshCredBtns = refreshCredBtns;

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
            rowSearchInputs.set(_entityKey, searchInput);   // #139: header "N unresolved" jumps here
            const searchBtn = document.createElement('button');
            searchBtn.type = 'button';
            // Flat stroke magnifier (#118) \u2014 replaces the glossy \uD83D\uDD0D emoji on a
            // beveled default button. currentColor so it inherits the muted grey.
            searchBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/></svg>';
            searchBtn.title = 'Search MusicBrainz';
            searchBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;padding:0 0.45rem;cursor:pointer;color:#666;background:#fff;border:1px solid #bbb;border-radius:3px;';
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

            // MB role types in the resolved header (#132), on request. Returns an
            // inline "MB roles ▾" element appended to the green resolved header on
            // the MB side; clicking it lazily fetches the artist's existing MB
            // relationship categories (producer / mix / mastering / misc / …) and
            // shows them as tags, so the reviewer can compare against the Discogs
            // role. Lazy by design — fetching isn't free (one MB request/artist),
            // so nothing loads until clicked; session-cached per MBID. Artists only.
            // `explicitMbid` (optional) targets a SPECIFIC artist — used by the
            // unselected search candidates so each one can preview its own MB
            // roles before you pick it. Without it, the chip reads the row's
            // currently-resolved artist (the green header use).
            function buildMbRolesEl(explicitMbid) {
                if (entityType !== 'artist') return null;
                const wrap = document.createElement('span');
                wrap.style.cssText = 'display:inline-flex;align-items:center;gap:0.25rem;margin-left:0.5rem;min-width:0;overflow:hidden;font-size:0.72rem;';
                const trigger = document.createElement('a');
                trigger.href = '#';
                trigger.textContent = 'MB roles ▾';
                trigger.style.cssText = 'color:#7a7a9a;text-decoration:none;cursor:pointer;white-space:nowrap;';
                trigger.title = "Fetch this artist's existing MB relationship types to compare with the Discogs role";
                trigger.addEventListener('click', async (ev) => {
                    ev.preventDefault();
                    let mbid = (String(explicitMbid || '').match(/[a-f0-9-]{36}/i) || [])[0];
                    if (!mbid) {
                        const st = rowState.get(_entityKey);
                        const curUrl = st?.mbUrl || r.mbUrl;
                        mbid = (String(curUrl || '').split('/').pop() || '').replace(/[^a-f0-9-]/gi, '').slice(0, 36);
                    }
                    if (!mbid) { trigger.textContent = 'MB roles: (none selected)'; return; }
                    trigger.textContent = 'MB roles…';
                    const types = await fetchArtistRelTypes(mbid);
                    wrap.innerHTML = '';
                    const label = document.createElement('span');
                    label.style.color = '#888';
                    if (!types)        { label.textContent = 'MB roles: fetch failed'; label.style.color = '#a02020'; wrap.appendChild(label); return; }
                    if (!types.length) { label.textContent = 'MB roles: none'; wrap.appendChild(label); return; }
                    label.textContent = 'MB roles: ';
                    label.style.whiteSpace = 'nowrap';
                    label.style.flex = '0 0 auto';
                    // Now that the label/header layout is fixed, just show every
                    // role — they wrap onto as many lines as needed rather than
                    // hiding behind a "+N" pill that needed a second click (#132).
                    wrap.style.alignItems = 'flex-start';
                    wrap.style.overflow = 'visible';
                    wrap.appendChild(label);
                    wrap.title = types.join(', ');
                    const chipsBox = document.createElement('span');
                    chipsBox.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.25rem;min-width:0;';
                    wrap.appendChild(chipsBox);
                    types.forEach(t => {
                        const c = document.createElement('span');
                        c.textContent = t;
                        c.style.cssText = 'background:#eaeaf5;border:1px solid #ccccdd;border-radius:0.7rem;padding:0 0.4rem;color:#4a4a77;white-space:nowrap;';
                        chipsBox.appendChild(c);
                    });
                });
                wrap.appendChild(trigger);
                return wrap;
            }

            // #273: background-create placeholder. When the user right-clicks "+"
            // to create the entity in a background tab, we don't want the row to
            // sit there showing its search candidates and then REFLOW (changing
            // height, lurching the page) when the postback finally swaps in the
            // resolved entity — especially when the user has scrolled past it.
            // Instead we collapse the row to its FINAL (resolved) height right
            // away and show a "Creating … in the background" placeholder exactly
            // where the resolved name will land, so the eventual swap is a no-op
            // for layout. `_creatingTimer` is a safety net: if the create never
            // posts back (tab closed, MB error) we restore the live UI.
            let _creatingEl = null;
            let _creatingTimer = null;
            let _creatingCancel = null;   // tears down the pending postback listener + bg tab
            function setRowCreating(name, onCancel) {
                ensureCreatingStyle();
                if (_creatingTimer) { clearTimeout(_creatingTimer); _creatingTimer = null; }
                if (_creatingEl) _creatingEl.remove();
                _creatingCancel = onCancel || null;
                candidateList.style.display = 'none';   // hide candidates (keep them — restored on cancel)
                tdAction.innerHTML = '';                // remove create/link chips while it commits
                searchInput.disabled = true;
                searchBtn.disabled = true;
                // Same box metrics as the resolved selRow so the name lands in place.
                const ph = document.createElement('div');
                ph.className = 'ch-creating';
                ph.style.cssText = 'padding:0.15rem 0.4rem;border:1px dashed #8a8ad0;border-radius:3px;background:#f4f4ff;'
                    + 'display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;color:#55557a;font-style:italic;margin-bottom:0.3rem;';
                const spin = document.createElement('span');
                spin.textContent = '⟳';   // ⟳
                spin.style.cssText = 'display:inline-block;animation:ch-creating-spin 0.9s linear infinite;';
                ph.appendChild(spin);
                const txt = document.createElement('span');
                txt.textContent = `Creating ${name} in the background…`;
                ph.appendChild(txt);
                // #273: manual cancel — the bg tab can get stuck (user closed it
                // before it submitted), so let the user dismiss the placeholder and
                // get the live row back instead of waiting out the safety timeout.
                const x = document.createElement('button');
                x.textContent = '✕';
                x.title = 'Cancel — stop waiting and restore the row';
                x.style.cssText = 'margin-left:auto;font-size:0.75rem;line-height:1;cursor:pointer;border:none;background:none;color:#55557a;padding:0 0.2rem;';
                x.addEventListener('click', () => cancelCreating());
                ph.appendChild(x);
                tdMb.insertBefore(ph, candidateList);
                _creatingEl = ph;
                tr.style.background = '#f6f6ff';
                _creatingTimer = setTimeout(() => { _creatingTimer = null; cancelCreating(); }, 90000);
            }
            // User clicked ✕ (or the safety timeout fired): stop listening for the
            // background create's postback, close its tab if we can, restore the row.
            function cancelCreating() {
                if (_creatingCancel) { try { _creatingCancel(); } catch (e) {} }
                clearRowCreating(true);
            }
            // Tear down the placeholder. `restore` = re-enable search + re-render the
            // action chips so the user can retry. setRowResolved/setRowUnresolved call
            // it WITHOUT restore (they re-render the row themselves right after); the
            // ✕ button and the safety timeout call it WITH restore (via cancelCreating).
            function clearRowCreating(restore) {
                if (_creatingTimer) { clearTimeout(_creatingTimer); _creatingTimer = null; }
                _creatingCancel = null;
                if (_creatingEl) { _creatingEl.remove(); _creatingEl = null; }
                candidateList.style.display = '';
                if (restore) {
                    searchInput.disabled = false;
                    searchBtn.disabled = false;
                    tr.style.background = '';
                    renderActions(null);
                }
            }

            function setRowResolved(a) {
                // a = { id, name, disambiguation }
                clearRowCreating();   // #273: drop any background-create placeholder
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
                    if (r._refreshCredBtns) r._refreshCredBtns();
                }
                // Persist to IDB immediately so selection survives even without clicking Start import.
                // idbKeyForEntity also handles name-only entities that carry a
                // release-scoped `_cacheKey` (#271 derived remixers) — so a manual
                // pick on a derived remixer is reused on the next run of this release.
                const _idbKey = idbKeyForEntity(r.entity);
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
                selRow.style.cssText = 'padding:0.15rem 0.4rem;border:1px solid #5a5;border-radius:3px;background:#e8f8e8;display:flex;flex-wrap:wrap;align-items:center;gap:0.4rem;font-size:0.85rem;';
                const selA = document.createElement('a');
                selA.href = 'https:' + mbUrl; selA.target = '_blank'; selA.rel = 'noopener noreferrer nofollow';
                selA.textContent = '\u2713 ' + a.name + (a.disambiguation ? ` (${a.disambiguation})` : '');
                selA.style.fontWeight = 'bold';
                selA.style.whiteSpace = 'nowrap'; selA.style.flex = '0 0 auto';   // #132: name never collapses to a 1-char vertical column when MB-roles chips expand
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
                const mbRolesEl = buildMbRolesEl();
                if (mbRolesEl) selRow.appendChild(mbRolesEl);
                selRow.appendChild(undoBtn);
                candidateList.appendChild(selRow);

                // Actions: Add Discogs link + Create fallback
                renderActions(a);
                updateImportBtn();
            }

            function setRowUnresolved() {
                clearRowCreating();   // #273: drop any background-create placeholder
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
                if (!selected) { linkState.delete(_entityKey); rowLinkChips.delete(_entityKey); updateLinksBadge(); }
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
                    linkSlot.title = `Checking whether MB already has this ${srcName} URL linked`;
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
                                    // Write the verified list back to IDB so the
                                    // poisoned-[] heal (#193 chip bug) re-checks each
                                    // record at most once — next session trusts this.
                                    const healKey = parseSourceEntityUrl(r.entity?.resource_url)?.key;
                                    if (healKey) writeIdbRecord(healKey, { urlLinkedIds: linkedIds });
                                    applyUrlCheckResult(result);
                                })
                                .catch(() => applyUrlCheckResult('none'))
                        );
                    }

                    function applyUrlCheckResult(result) {
                        linkState.set(_entityKey, result);   // 'linked' | 'other' | 'none'
                        if (result !== 'none') rowLinkChips.delete(_entityKey);
                        updateLinksBadge();
                        if (result === 'linked') {
                            linkSlot.textContent = '\u2713';
                            linkSlot.title = srcName + ' URL already linked to this MB ' + entityType;
                            linkSlot.style.color = '#5a5';
                            linkSlot.style.fontWeight = 'bold';
                        } else if (result === 'other') {
                            linkSlot.textContent = '\u26a0\ufe0f';
                            linkSlot.title = `${srcName} URL is linked to a DIFFERENT MB ${entityType}`;
                            linkSlot.style.color = '#c80';
                        } else {
                            linkSlot.textContent = '';
                            linkSlot.style.color = '';
                            const addLinkBtn = document.createElement('button');
                            addLinkBtn.textContent = '\ud83d\udd17'; // \ud83d\udd17
                            addLinkBtn.title = `Add ${srcName} link to MB ${entityType}  ·  right-click: add it silently in the background`;
                            addLinkBtn.style.cssText = ACTION_CHIP_STYLE + 'color:#e8771d;'; // Discogs orange accent
                            // #273: left-click = foreground (focus-return recheck); right-click =
                            // background via GM_openInTab + auto-submit, rechecked on `edit-committed`.
                            const openLinkEdit = (background) => {
                                // #408: a consolidated row can carry several source URLs (one artist
                                // linked on Tidal AND Qobuz) — add them ALL, each with its own link
                                // type, in a single edit (any unwanted one can be removed in the MB
                                // dialog). Non-merged rows keep the single-URL behaviour.
                                const urls = (r._mergeUrls && r._mergeUrls.length) ? r._mergeUrls : [discogsHref];
                                const p = new URLSearchParams();
                                let n = 0;
                                for (const u of urls) {
                                    const lt = sourceUrlLinkTypeId(u, entityType);
                                    if (!lt) continue;
                                    p.set(`edit-${entityType}.url.${n}.text`, u);
                                    p.set(`edit-${entityType}.url.${n}.link_type_id`, lt);
                                    n++;
                                }
                                if (!n) return;
                                p.set(`edit-${entityType}.edit_note`, buildCreateNote(n > 1 ? `Added ${n} source links` : `Added ${srcName} link`));
                                const mbid = selected.id.replace(/.*\//, '').replace(/[^a-f0-9-]/gi, '').substring(0, 36);
                                const editUrl = `https://musicbrainz.org/${entityType}/${mbid}/edit?${p}`;
                                if (background && typeof GM_openInTab === 'function') {
                                    // #273: add the link silently in a background tab + auto-submit.
                                    // The edit-page bootstrap (hash flag) clicks "Enter edit" and
                                    // marks the tab to close; the entity page posts `edit-committed`
                                    // back, and we recheck the chip + close the GM tab here (no focus
                                    // return happens for a background tab).
                                    const editTab = GM_openInTab(`${editUrl}#ch-autocommit`, { active: false, insert: true });
                                    const onCommitted = (evt) => {
                                        if (evt.data?.type !== 'edit-committed' || evt.data.id !== mbid) return;
                                        DISCOGS_CHANNEL.removeEventListener('message', onCommitted);
                                        try { if (editTab && typeof editTab.close === 'function') editTab.close(); } catch (e) {}
                                        recheckUrlBypassCache();
                                    };
                                    DISCOGS_CHANNEL.addEventListener('message', onCommitted);
                                    linkSlot.innerHTML = '';
                                    linkSlot.textContent = '…';
                                    linkSlot.title = `Adding ${srcName} link in the background…`;
                                    linkSlot.style.color = '#888';
                                    linkSlot.style.fontStyle = 'italic';
                                    return;
                                }
                                // Open WITHOUT noopener so we keep the tab reference and can flag
                                // it to auto-close once the link edit submits (it redirects to the
                                // entity page). The focus-return handler below then re-checks the chip.
                                const linkTab = window.open(editUrl, '_blank');
                                if (linkTab) {
                                    const trySet = () => {
                                        try { linkTab.sessionStorage.setItem('discogs-importer-close-after-edit', '1'); }
                                        catch (e) { setTimeout(trySet, 50); }
                                    };
                                    trySet();
                                }
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
                                linkSlot.title = `Verifying ${srcName} link on return to this tab\u2026`;
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
                            };
                            addLinkBtn.addEventListener('click', () => openLinkEdit(false));
                            addLinkBtn.addEventListener('contextmenu', e => { e.preventDefault(); openLinkEdit(true); });
                            linkSlot.appendChild(addLinkBtn);
                            rowLinkChips.set(_entityKey, addLinkBtn);   // jump target for the "N links" badge
                        }
                    }

                    if (!discogsHref || placeholderUrl) {
                        // No external URL (or a synthetic /_company/ placeholder that 404s,
                        // #325) — skip the URL check + the 🔗 add-link affordance entirely
                        // (there's nothing to add, and it must not count as a missing link).
                        // The Titles source / a placeholder show nothing (the chip would be
                        // noise); other real sources keep the informational "no page" chip.
                        linkState.set(_entityKey, 'na'); rowLinkChips.delete(_entityKey); updateLinksBadge();   // no link to add
                        if (srcName === 'Titles' || placeholderUrl) {
                            linkSlot.remove();
                        } else {
                            linkSlot.textContent = `⚠ No ${srcName} page`;
                            linkSlot.style.color = '#c80';
                        }
                    } else if (urlCheckCached !== null) {
                        // Session-cache always takes precedence over the
                        // preflight `urlLinkedIds` snapshot. The cache is
                        // updated by: per-row MB checks, the
                        // recheckUrlBypassCache focus-return flow, and the
                        // `*-created` BroadcastChannel pre-seed (#78). The
                        // `urlLinkedIds` array is captured ONCE during
                        // preflight and is stale the moment the user adds
                        // the link or creates a new entity. Reading
                        // urlLinkedIds first (the old order) clobbered the
                        // #78 pre-seed of `'linked'` with `'none'` derived
                        // from the empty preflight snapshot — that's why
                        // the 🔗 chip kept flashing after entity creation.
                        applyUrlCheckResult(urlCheckCached);
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
                    } else {
                        queuedUrlCheck(() =>
                            fetchWithRetry(`//musicbrainz.org/ws/2/url?resource=${encodeURIComponent(discogsHref)}&inc=${entityType}-rels&fmt=json`)
                                .then(json => {
                                    const linkedIds = (json.relations || []).filter(r => r[entityType]).map(r => r[entityType].id);
                                    const result = linkedIds.includes(selected.id) ? 'linked' : linkedIds.length > 0 ? 'other' : 'none';
                                    _urlCheckSessionCache.set(urlCheckCacheKey, result);
                                    try { localStorage.setItem(urlCheckLsKey, JSON.stringify({ date: urlCheckToday, result })); } catch(e) {}
                                    // Write the verified list back to IDB so the
                                    // poisoned-[] heal (#193 chip bug) re-checks each
                                    // record at most once — next session trusts this.
                                    const healKey = parseSourceEntityUrl(r.entity?.resource_url)?.key;
                                    if (healKey) writeIdbRecord(healKey, { urlLinkedIds: linkedIds });
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
                function openCreateTab({ name, disambiguation, background } = {}) {
                    const finalName = (name || displayName).trim();
                    // #408: seed EVERY source URL (a merged row may carry several — Tidal + Qobuz…),
                    // each with its own link type. Non-merged rows seed just their one URL as before.
                    const seedUrls = (params, et) => {
                        const urls = (r._mergeUrls && r._mergeUrls.length) ? r._mergeUrls : [discogsHref];
                        let n = 0;
                        for (const u of urls) {
                            if (!u) continue;
                            const lt = sourceUrlLinkTypeId(u, et);
                            if (!lt) continue;
                            params[`edit-${et}.url.${n}.text`]         = u;
                            params[`edit-${et}.url.${n}.link_type_id`] = lt;
                            n++;
                        }
                    };
                    let createUrl;
                    let createParams;
                    if (entityType === 'artist') {
                        createParams = {
                            'edit-artist.name':      finalName,
                            'edit-artist.sort_name': guessSortName(finalName),
                            'edit-artist.type_id':   '1',
                        };
                        seedUrls(createParams, 'artist');
                        if (disambiguation) createParams['edit-artist.comment'] = disambiguation;
                        createParams['edit-artist.edit_note'] = buildCreateNote();   // proper attribution on the created entity
                        createUrl = 'https://musicbrainz.org/artist/create';
                    } else {
                        createParams = {
                            [`edit-${entityType}.name`]:                finalName,
                        };
                        seedUrls(createParams, entityType);
                        if (disambiguation) createParams[`edit-${entityType}.comment`] = disambiguation;
                        createParams[`edit-${entityType}.edit_note`] = buildCreateNote();   // proper attribution on the created entity
                        createUrl = `https://musicbrainz.org/${entityType}/create`;
                    }
                    const p = new URLSearchParams(createParams);
                    // Identity for the cross-tab postback. MUST be truthy even
                    // for URL-less credits (all of Qobuz): an empty
                    // `resource_url` made the created-artist tab bail at its
                    // `if (!pending) return` — never posting back, never
                    // closing (#193 live-test round 3). Use the same synthetic
                    // key the rest of the table keys rows by.
                    const pendingKey = r.entity?.resource_url || r.entity?._syntheticKey || `_nourl_${r.entity?.name || displayName}`;
                    let bgTab = null;   // #273: GM_openInTab handle, closed from here on postback
                    if (background && typeof GM_openInTab === 'function') {
                        // #273: create silently in a BACKGROUND tab and auto-submit.
                        // GM_openInTab gives no window handle to the new tab, so we pass
                        // the postback identity in the hash; the create-page bootstrap
                        // reads it, stores the pending marker itself, and clicks "Enter
                        // edit". The hash is dropped on form submit, but the marker (in
                        // the tab's sessionStorage) survives to the entity page, which
                        // posts back + closes — same path as the foreground create. We
                        // also keep the GM tab handle to close it from here on postback
                        // (a GM-opened tab can't always self-close via window.close()).
                        const url = `${createUrl}?${p}#ch-autocommit=${encodeURIComponent(pendingKey)}`;
                        bgTab = GM_openInTab(url, { active: false, insert: true });
                    } else {
                        const newTab = window.open(`${createUrl}?${p}`, '_blank');
                        if (newTab) {
                            const trySet = () => {
                                try { newTab.sessionStorage.setItem('discogs-importer-pending-artist', pendingKey); }
                                catch(e) { setTimeout(trySet, 50); }
                            };
                            trySet();
                        }
                    }
                    const onCreated = (evt) => {
                        if (evt.data?.type !== 'artist-created') return;
                        if (evt.data.resourceUrl !== pendingKey) return;
                        DISCOGS_CHANNEL.removeEventListener('message', onCreated);
                        // #273: ensure the background create tab is gone (its own
                        // window.close() may be a no-op for a GM-opened tab).
                        try { if (bgTab && typeof bgTab.close === 'function') bgTab.close(); } catch (e) {}
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
                    // #273: collapse the row to its final height now + show a
                    // "Creating … in the background" placeholder, so the postback swap
                    // (setRowResolved) doesn't reflow/lurch the page. The ✕ on the
                    // placeholder (or the 90s timeout) cancels: drop the postback
                    // listener and close the bg tab so a stuck create can be dismissed.
                    if (background && typeof GM_openInTab === 'function') {
                        setRowCreating(finalName, () => {
                            DISCOGS_CHANNEL.removeEventListener('message', onCreated);
                            try { if (bgTab && typeof bgTab.close === 'function') bgTab.close(); } catch (e) {}
                        });
                    }
                }

                // Inline icon chips (Proposal C from #77). All three
                // actions — link / create / advanced — render side by
                // side in the actionsLine to the right of the entity
                // name. Compact icons with descriptive `title=` for
                // accessibility.
                const createBtn = document.createElement('button');
                createBtn.textContent = '+';
                createBtn.title = (discogsHref
                    ? `Create in MB with default ${srcName} name + URL`
                    : 'Create in MB with the credited name')
                    + '  ·  right-click: create silently in a background tab (auto-submitted)';
                createBtn.style.cssText = ACTION_CHIP_STYLE + 'color:#2a7;font-size:1.15rem;font-weight:600;'; // bigger, bolder plus
                createBtn.addEventListener('click', () => openCreateTab());
                // #273: right-click creates in the background and auto-commits.
                createBtn.addEventListener('contextmenu', e => { e.preventDefault(); openCreateTab({ background: true }); });

                const createAdvBtn = document.createElement('button');
                createAdvBtn.textContent = '▾';
                createAdvBtn.title = 'Create in MB with editable name + disambiguation'
                    + (srcName === 'Discogs' && discogsHref ? ', pre-filled from the Discogs profile' : '');
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

                    // ── Discogs profile blurb — only for Discogs-sourced entities;
                    //    Tidal/Qobuz credits have no Discogs profile to fetch (#193) ──
                    const showProfile = srcName === 'Discogs' && !!discogsHref;
                    let profileBox = null;
                    if (showProfile) {
                        const profileLabel = document.createElement('div');
                        profileLabel.style.cssText = 'font-size:0.78rem;color:#888;margin-top:0.55rem;';
                        profileLabel.textContent = 'Discogs profile — select text to copy into Disambiguation';
                        modal.appendChild(profileLabel);

                        profileBox = document.createElement('div');
                        profileBox.style.cssText = 'border:1px solid #e0e0e0;border-radius:0.3rem;padding:0.5rem 0.6rem;background:#fafafa;'
                                                 + 'font-size:0.85rem;line-height:1.5;white-space:pre-wrap;overflow:auto;'
                                                 + 'min-height:5rem;max-height:18rem;flex:1;color:#444;';
                        profileBox.textContent = 'Loading profile from Discogs…';
                        modal.appendChild(profileBox);

                        // Selecting text inside the profile auto-fills the
                        // Disambiguation input. `mouseup` + `keyup` together
                        // catch both drag and shift-arrow selection.
                        const captureSelection = () => {
                            const sel = window.getSelection();
                            if (!sel || sel.isCollapsed) return;
                            if (!profileBox.contains(sel.anchorNode)) return;
                            const text = sel.toString().trim();
                            if (!text) return;
                            disInput.value = text;
                            disUserTouched = true;
                        };
                        profileBox.addEventListener('mouseup', captureSelection);
                        profileBox.addEventListener('keyup',   captureSelection);
                    }

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

                    // ── Lazy Discogs fetch — profile + realname (Discogs only — #193) ──
                    if (showProfile) try {
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
                // Preview THIS candidate's existing MB roles before picking it.
                const rolesEl = buildMbRolesEl(a.id);
                if (rolesEl) { rolesEl.style.marginLeft = 'auto'; row.appendChild(rolesEl); }
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
                // #98: show an immediate progress indicator so the user
                // knows the search button took effect. Without it the
                // candidate list looks dead for 1–3s while MB responds
                // (longer when MB is rate-limiting us, see #87).
                candidateList.innerHTML = '<div style="font-size:0.82rem;color:#888;font-style:italic;">Searching…</div>';
                mbThrottle.fetchJson(`//musicbrainz.org/ws/2/${entityType}?query=${encodeURIComponent(q)}&fmt=json&limit=8`)
                    .then(json => {
                        if (!json) {
                            candidateList.innerHTML = '<div style="font-size:0.82rem;color:#c00;">Search failed — MB unavailable</div>';
                            return;
                        }
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
                    })
                    .catch(() => {
                        candidateList.innerHTML = '<div style="font-size:0.82rem;color:#c00;">Search failed</div>';
                    });
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
                selRow.style.cssText = 'padding:0.15rem 0.4rem;border:1px solid #5a5;border-radius:3px;background:#e8f8e8;display:flex;flex-wrap:wrap;align-items:center;gap:0.4rem;font-size:0.85rem;';
                const selA = document.createElement('a');
                selA.href = 'https:' + correctedMbUrl; selA.target = '_blank'; selA.rel = 'noopener noreferrer nofollow';
                selA.textContent = '\u2713 ' + displayName2 + (initMbDisam ? ` (${initMbDisam})` : '') + (!initMbName ? ' ⚠ name unknown' : '');
                selA.style.fontWeight = 'bold';
                selA.style.whiteSpace = 'nowrap'; selA.style.flex = '0 0 auto';   // #132: name never collapses to a 1-char vertical column when MB-roles chips expand
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
                const mbRolesEl = buildMbRolesEl();
                if (mbRolesEl) selRow.appendChild(mbRolesEl);
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
        importBtn.style.cssText = 'border:none;padding:0.4rem 1.1rem;border-radius:0.3rem;cursor:pointer;font-weight:bold;font-size:0.95rem;display:inline-flex;align-items:center;gap:5px;';

        const issueNote = document.createElement('span');
        issueNote.className = 'discogs-issue-note';
        issueNote.style.cssText = 'font-size:0.85rem;color:#7a5c00;';

        // "N links" badge — count of confirmed artists whose Discogs URL isn't yet
        // linked in MB (the 🔗 add-link chip), shown right of "N unresolved" (like
        // Apollo's links badge). Updated live by the per-row URL checks.
        linksNote = document.createElement('span');
        linksNote.className = 'discogs-issue-note discogs-links-note';
        linksNote.style.cssText = 'font-size:0.85rem;color:#e8771d;display:none;';
        linksNote.title = `Confirmed matches whose ${importSourceName} URL isn't linked in MB yet — click to jump to the next one; use its 🔗 chip to add the link`;
        linksNote.addEventListener('click', jumpNextLink);
        updateLinksBadge();

        // #139/#177: clicking the "N unresolved" message scrolls to and focuses
        // the next still-unresolved row's search box. The first click lands on
        // the first unresolved entity; each subsequent click advances to the
        // next one, wrapping back to the first after the last \u2014 so the message
        // doubles as a cycle-through-issues control. Already-resolved rows are
        // skipped automatically (the cursor scans live `rowState`).
        let _jumpIdx = -1;
        function jumpNextUnresolved() {
            const n = allResults.length;
            let found = -1;
            for (let step = 1; step <= n; step++) {
                const i = (_jumpIdx + step) % n;
                if (!rowState.get(keyOf(allResults[i]))?.confirmed) { found = i; break; }
            }
            if (found === -1) return; // everything resolved
            _jumpIdx = found;
            const input = rowSearchInputs.get(keyOf(allResults[found]));
            if (!input) return;
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            try { input.focus({ preventScroll: true }); } catch { input.focus(); }
            input.select?.();
        }
        issueNote.addEventListener('click', jumpNextUnresolved);

        // #113: count checked vs total recording rows straight from the editor's DOM checkboxes
        // (a recording link in the row). DOM-based on purpose — walking MB's medium ImmutableTree at
        // review time could hang the renderer, and this matches exactly the boxes the user sees.
        function recSelectionCounts() {
            try {
                let total = 0, checked = 0;
                for (const tr of document.querySelectorAll('tr')) {
                    if (!tr.querySelector('a[href*="/recording/"]')) continue;
                    const cb = tr.querySelector('input[type="checkbox"]');
                    if (!cb) continue;
                    total++; if (cb.checked) checked++;
                }
                return total ? { checked, total } : null;
            } catch (e) { return null; }
        }
        function updateImportBtn() {
            const unresolved = [...rowState.values()].filter(s => !s.confirmed).length;
            // #113: show a partial recording selection on the button, e.g. "Start import (2/14)"
            const sel = recSelectionCounts();
            const selLabel = (sel && sel.checked > 0 && sel.checked < sel.total) ? ` (${sel.checked}/${sel.total})` : '';
            if (unresolved === 0) {
                importBtn.innerHTML = `Start import${selLabel} \u2192`;   // #272: source icon now lives in the toolbar \u2014 don't double it here
                importBtn.style.background = '#2ecc40';
                importBtn.style.color = '#fff';
                issueNote.textContent = '';
                issueNote.classList.remove('clickable');
                issueNote.removeAttribute('title');
            } else {
                importBtn.innerHTML = `Start import anyway${selLabel} \u2192`;   // #272: icon shown in the toolbar
                importBtn.style.background = '#e0a800';
                importBtn.style.color = '#fff';
                issueNote.textContent = `\u26a0 ${unresolved} unresolved`;
                issueNote.classList.add('clickable');
                issueNote.title = 'Jump to the next unresolved entity \u2014 click again to cycle through them; these will be skipped on import';
            }
        }
        updateImportBtn();
        // Keep the (N/M) count live as the user ticks recording checkboxes — a light poll, NOT a
        // document change-listener (a capture listener drowns in MB's change-event storm during the
        // import and crashes the renderer). Only re-renders the button when the count actually changes;
        // stops once the import starts or the panel goes away.
        let _lastSelKey = '';
        const _recSelPoll = setInterval(() => {
            if (!importBtn.isConnected) { clearInterval(_recSelPoll); return; }
            const s = recSelectionCounts(); const k = s ? `${s.checked}/${s.total}` : '';
            if (k !== _lastSelKey) { _lastSelKey = k; updateImportBtn(); }
        }, 1000);

        // Build the static "log summary" table from the current `rowState` and
        // wrap it in an `<li>` ready to append to the log. Used in two places:
        //   1. importBtn click — replaces the interactive panel with this
        //      static snapshot before dispatch.
        //   2. mid-review "Copy log" (#87 nitpick #2) — the interactive panel
        //      doesn't translate to clean markdown, so `buildCopyText` calls
        //      this builder via the `_buildStaticTableLi` closure stashed on
        //      `panelLi` and substitutes its output in the copy.
        // Captures `allResults`/`rowState`/`rolesMap`/`companiesRolesMap`/
        // `viaCfg` from the enclosing `showReviewTable` scope, so the table
        // always reflects the user's current picks (selecting a different MB
        // entity in the panel updates `rowState`, which the next builder call
        // reads).
        function buildStaticTableLi() {
            const tbl = document.createElement('table');
            tbl.style.cssText = 'border-collapse:collapse;width:100%;font-size:0.78rem;margin:0.4rem 0;';
            const thRow = document.createElement('tr');
            thRow.style.background = '#f5f5f5';
            [importSourceName + ' entity', 'Roles / Tracks', 'MB match', 'MBID', 'Resolved via'].forEach(h => {
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
            return tblLi;
        }

        importBtn.addEventListener('click', () => {
            clearInterval(_recSelPoll);   // #113: stop polling the recording selection once the import starts
            const confirmedMap = new Map();
            rowState.forEach((s, key) => {
                if (s.mbUrl) confirmedMap.set(key, s.mbUrl);
            });

            // ── Log summary table ──────────────────────────────────────
            getLogContainer().appendChild(buildStaticTableLi());
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
            if (headerSlot) headerSlot.replaceChildren();   // #139: clear the header action slot once dispatch starts
            resolve(confirmedMap);
        });

        // #139: mount the Start-import button + unresolved message in the
        // always-visible header (`headerSlot`) instead of below the table.
        // Fall back to a footer row under the table when no slot was provided.
        if (headerSlot) {
            headerSlot.replaceChildren(importBtn, issueNote, linksNote);
        } else {
            btnRow.appendChild(importBtn);
            btnRow.appendChild(issueNote);
            btnRow.appendChild(linksNote);
            panel.appendChild(btnRow);
        }
        updateLinksBadge();   // paint initial count now that the badge is mounted

        const panelLi = document.createElement('li');
        panelLi.style.cssText = 'list-style:none;margin:0;padding:0;';
        // Marker class so `buildCopyText` in ui-bar.js can find the
        // interactive review panel in the log and swap in the static-table
        // form via `_buildStaticTableLi` (nitpick #2). Without the swap,
        // copying the log mid-review produces unintelligible button/select
        // text instead of a clean markdown table.
        panelLi.classList.add('discogs-review-panel-li');
        panelLi._buildStaticTableLi = buildStaticTableLi;
        panelLi.appendChild(panel);
        getReviewContainer().appendChild(panelLi);   // #142: mount outside the collapsible log
        panelLi.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        _hideBar();
    });
}
