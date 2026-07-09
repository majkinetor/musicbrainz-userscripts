// The main dispatch orchestrator. Walks the (pre-resolved) Discogs JSON
// and feeds every credit into MB's relationship editor via
// `dispatchRelationship`. Handles companies, release-level artists, the
// track-level artist credits, and the work-level credits — with
// deduplication against this session and against MB's existing rels.

import { log }                  from './log.js';
import { pageWindow, EQUIVALENCE_SETS, SELECTORS } from './constants.js';
import {
    mbThrottle,
    fetchMBEntity,
    fetchWithRetry,
    resolveLinkTypeId,
}                                       from './api-mb.js';
import {
    waitForMBEditor,
    dispatchRelationship,
    buildAttributes,
}                                       from './editor-state.js';
import { buildEditNote, combineEditNote } from './edit-note.js';
import { ENTITY_TYPE_MAP }               from './data/entity-map.js';
import { WORK_ONLY_ARTIST_RELS }         from './data/work-only-rels.js';
import { _showBar, _setProgressPct }     from './progress-bar.js';

// #393 Discogs disambiguates same-named entities with a trailing " (N)" (e.g. "Odeon (4)"). MB doesn't use
// that number, so strip it from a Discogs-sourced credited-as (anv/name) — never from a user's review override.
const stripDiscogsNum = s => String(s || '').replace(/\s+\(\d+\)$/, '');

// #225: Build a memoized predicate `(typeID) => boolean` that reports whether
// a link-attribute type is *identifying* — i.e. it lives under MB's
// "instrument" or "vocal" attribute root — as opposed to a pure modifier
// (additional, solo, guest, minor…). Two instrument/vocal performances that
// differ in their identifying attribute are distinct roles, not duplicates.
// Exported for unit testing. When the attribute table is unavailable (no MB on
// the page, or a future schema change), every attribute classifies as
// non-identifying, which makes the duplicate-role dedup fall back to its prior
// whole-signature behaviour — a safe no-op.
export function makeIdentifyingClassifier(lat) {
    const identifyingRoots = new Set();
    if (lat) {
        for (const v of Object.values(lat)) {
            const isRoot = (v.parent_id == null || v.parent_id === v.id);
            if (isRoot && /^(instrument|vocal)$/i.test(v.name || '')) identifyingRoots.add(v.id);
        }
    }
    const rootCache = new Map();
    const rootIdOf = (typeID) => {
        if (rootCache.has(typeID)) return rootCache.get(typeID);
        let node = lat ? lat[typeID] : null;
        let guard = 0;
        while (node && node.parent_id != null && node.parent_id !== node.id && lat[node.parent_id] && guard++ < 64) {
            node = lat[node.parent_id];
        }
        const rootId = node ? node.id : typeID;
        rootCache.set(typeID, rootId);
        return rootId;
    };
    return (typeID) => identifyingRoots.has(rootIdOf(typeID));
}

// Dedup options come in as a trailing object (default empty). Used by
// `relAlreadyExists` to honor the maintainer-configurable rules from
// issue #62:
//   dedupeEquivalenceSets  — treat writer ≡ composer (etc.) when looking
//                            up existing rels for skipping.
//   dedupeDuplicateRoles   — when (linkType, target) is already on the
//                            source, skip regardless of attr/credit/date
//                            differences. Without this, only an exact
//                            attr-signature match counts as "already
//                            there", so e.g. instrument with different
//                            tasks would still dispatch.
//   creditOverrides        — Map<mbUrl, string> from the review table's
//                            editable "Credited as" input. When present
//                            for the resolved entity, the override wins
//                            over the Discogs-side credit. Falls back to
//                            the Discogs name when no override exists.
export async function dispatchAllRelationships(companies, artistRoles, tracklistRels, applyToTracks, createWorksMode, discogsTracklist, processTracklist, resolvedEntityTypes, confirmedMap, discogsUrl, dedupOpts) {
    resolvedEntityTypes = resolvedEntityTypes || new Map();
    confirmedMap = confirmedMap || new Map();
    dedupOpts = dedupOpts || {};
    const dedupeEquivalenceSets = dedupOpts.dedupeEquivalenceSets !== false; // default ON
    const dedupeDuplicateRoles  = dedupOpts.dedupeDuplicateRoles  !== false; // default ON
    const creditOverrides       = dedupOpts.creditOverrides || new Map();
    const re = await waitForMBEditor();
    if (!re) return;

    const MB = pageWindow.MB;

    // #225: classifier that tells an instrument/vocal *identifying* attribute
    // (synthesizer, drum machine, lead vocals…) apart from a pure modifier
    // (additional, solo, guest…). The duplicate-role dedup uses it so two
    // performances of DIFFERENT instruments aren't collapsed into one.
    const isIdentifyingAttr = makeIdentifyingClassifier(MB?.linkedEntities?.link_attribute_type);

    // Precompute the equivalence-set lookup once: linkTypeID -> Set of
    // sibling linkTypeIDs (incl. itself) that share a configured group.
    // `EQUIVALENCE_SETS` lists names like ['writer', 'composer']; we
    // resolve those against MB.linkedEntities.link_type to MBIDs at the
    // exact (sourceType, targetType) pair to keep matches strict.
    const equivalenceLookup = (() => {
        const m = new Map();
        if (!dedupeEquivalenceSets || !MB?.linkedEntities?.link_type) return m;
        for (const set of EQUIVALENCE_SETS) {
            // For each set, collect all link types whose name lowercase-matches
            // any member. Group them by (type0, type1) pair so we don't
            // cross-contaminate (e.g. work-level composer vs recording-level
            // composer have different IDs but live under the same pair name).
            const byPair = new Map(); // 'type0|type1' -> [linkTypeID]
            for (const [id, lt] of Object.entries(MB.linkedEntities.link_type)) {
                if (!lt?.name) continue;
                if (!set.includes(String(lt.name).toLowerCase())) continue;
                const key = `${lt.type0}|${lt.type1}`;
                if (!byPair.has(key)) byPair.set(key, []);
                byPair.get(key).push(Number(id));
            }
            for (const ids of byPair.values()) {
                if (ids.length < 2) continue; // single-member pair: no equivalence
                const sibSet = new Set(ids);
                for (const id of ids) m.set(id, sibSet);
            }
        }
        return m;
    })();
    const releaseEntity = re.state.entity;
    // Counter semantics (issues #14, #34):
    //   added       — rels actually dispatched into editor state this session
    //   existedInMb — the source entity already had this rel in MB *before*
    //                 this session. Detected via `relAlreadyExists` against
    //                 `re.state` — MB's reducer would silently no-op us.
    //   dedupedThisSession — same (source, linkType, target, attrs) tuple
    //                 was dispatched earlier in *this* session (e.g. Discogs
    //                 credit appears at both release and track level).
    //                 Previously combined into `existedRels` which was
    //                 misleading — "already existed" implied pre-existing,
    //                 but the count was inflated by intra-session duplicates.
    //   skipped     — credits the script chose not to dispatch (no Discogs
    //                 page, no MB ID, no review-table confirmation, etc.)
    //   failed      — errors (bad MBID, deprecated link type, entity fetch
    //                 failure, etc.)
    let added = 0, existedInMb = 0, dedupedThisSession = 0, skipped = 0, failed = 0;
    // Track dispatched relationships this session to catch same-run duplicates
    const dispatchedThisSession = new Set(); // "sourceGid|linkTypeID|targetGid"

    // Link types that belong on recordings, not the release
    // (used for both the "skip at release level" and "move to tracks" logic)
    // Link types that belong on recordings (and are eligible for "move to tracks"
    // via applyToTracks). DO NOT add link types here whose MB artist→recording
    // variant is deprecated — e.g. `mastering` — they belong only at release
    // level. resolveLinkTypeId enforces this independently, but keeping the
    // set tight avoids running the dispatch machinery for credits that
    // resolveLinkTypeId will then refuse.
    const RECORDING_LINK_TYPES = new Set([
        'performer', 'instrument', 'vocal', 'vocals', 'orchestra', 'conductor',
        'concertmaster', 'chorus master', 'producer', 'engineer', 'mix',
        'recording', 'remixer', 'DJ-mixer', 'additional', 'guest',
        'programming',
        // NOT 'mastering' — MB deprecated artist→recording mastering (link type 136).
    ]);

    log.info(`Starting instant fill: ${companies.length} companies, ${artistRoles.length} release artist roles, ${tracklistRels.length} tracklist roles`);

    // The review-table code calls `_hideBar()` when it mounts; nothing
    // re-shows the bar between the review-table tear-down and the
    // dispatch loop start, so #82's fill-phase progress was invisible
    // even though `tickProgress` was pushing percentages. Re-show here.
    try { _showBar(); } catch (_) {}

    const bar = document.querySelector('.discogs-bar');
    function tickProgress() {
        const done = added + skipped + failed;
        const est = Math.max(done + 1, companies.length + artistRoles.length + tracklistRels.length);
        const pct = Math.min(Math.round((done / est) * 99), 99);
        // Push the actual fill width to the top-of-page progress bar
        // (#82). `_setProgressPct` also mirrors the value into the inline
        // "NN%" header text (#151), so no separate text write is needed.
        try { _setProgressPct(pct); } catch (_) {}
    }

    // ── Build recording maps from MB editor state ────────────────────────────
    const recordingByGid      = new Map(); // gid      → recording entity
    const recordingByPosition = new Map(); // "1"/"A1" → recording entity (fallback for unlinked tracks)
    const editorWorkByRecGid  = new Map(); // recGid   → work entity (from editor state relatedWorks)
    const positionByGid       = new Map(); // recGid   → track position string
    let trackCount = 0;
    try {
        let mediumIndex = 0;
        for (const [mediumKey, medium] of MB.tree.iterate(re.state.mediums)) {
            mediumIndex++;
            const tracks = medium?.tracks ?? medium;
            let trackIndex = 0;
            for (const rawTrack of MB.tree.iterate(tracks)) {
                const trackObj = Array.isArray(rawTrack) ? rawTrack[1] : rawTrack;
                const trackKey = Array.isArray(rawTrack) ? rawTrack[0] : null;
                const rec = trackObj?.recording ?? trackObj;

                if (!rec) continue;
                trackCount++;
                if (rec.gid) {
                    recordingByGid.set(rec.gid, rec);
                    // Store compound position for multi-medium releases
                    positionByGid.set(rec.gid, `${mediumIndex}-${trackIndex + 1}`);
                    // relatedWorks on the track wrapper contains works already linked in the editor
                    const rw = trackObj?.relatedWorks;
                                    if (rw && rw.size > 0) {
                        try {
                            for (const entry of MB.tree.iterate(rw)) {
                                // Each entry is {isSelected, targetTypeGroups, work}
                                const raw = Array.isArray(entry) ? entry[1] : entry;
                                const work = raw?.work ?? raw;
                                if (work?.gid || work?.id) {
                                    editorWorkByRecGid.set(rec.gid, work);
                                    break;
                                }
                            }
                        } catch(e) {}
                    }
                }
                const positions = new Set([
                    trackObj?.position, trackObj?.number,
                    rec?.position, rec?.number,
                    trackKey, trackIndex + 1,
                    // Compound keys: "mediumIndex-trackPosition"
                    `${mediumIndex}-${trackIndex + 1}`,
                    trackObj?.position != null ? `${mediumIndex}-${trackObj.position}` : null,
                    trackObj?.number != null ? `${mediumIndex}-${trackObj.number}` : null,
                ].filter(x => x != null).map(String));
                for (const p of positions) recordingByPosition.set(p, rec);
                trackIndex++;
            }
        }
        log.info(`Found ${trackCount} track(s) in editor state (${recordingByGid.size} with GID, ${recordingByPosition.size} position entries: ${[...recordingByPosition.keys()].join(',')}). relatedWorks: ${editorWorkByRecGid.size} pre-linked`)
    } catch(e) {
        log.warn(`Iterating MB state: ${e.message}`);
    }

    // ── Fetch position→GID map from WS2 (authoritative, always correct) ──────
    const positionToGid = new Map(); // "1" / "A1" → recording GID
    try {
        const relMbid = releaseEntity.gid;
        log.info(`WS2: fetching recordings for release ${relMbid}…`);
        const wsJson = await fetchWithRetry(`/ws/2/release/${relMbid}?inc=recordings&fmt=json`);
        log.info(`WS2: response received`);
        if (wsJson) {
            const mediaCount = wsJson.media?.length ?? 0;
            log.info(`WS2: ${mediaCount} medium/media in response`);
            const mediaArr = wsJson.media || [];
            const isMultiMedium = mediaArr.length > 1;
            for (const medium of mediaArr) {
                const medPos = medium.position; // 1-based medium index
                for (const track of (medium.tracks || [])) {
                    const gid = track.recording?.id;
                    if (!gid) continue;
                    // Always add compound "medPos-trackPos" key (Discogs format for multi-disc)
                    if (medPos != null && track.position != null) {
                        positionToGid.set(`${medPos}-${track.position}`, gid);
                    }
                    if (medPos != null && track.number != null) {
                        positionToGid.set(`${medPos}-${track.number}`, gid);
                    }
                    // For single-medium releases also add plain position keys
                    if (!isMultiMedium) {
                        if (track.position != null) positionToGid.set(String(track.position), gid);
                        if (track.number != null)   positionToGid.set(String(track.number), gid);
                    }
                }
            }
            log.info(`WS2 position map: ${positionToGid.size} entries (${[...positionToGid.keys()].sort().join(', ')})`);
        }
    } catch(e) {
        log.warn(`WS2 recording fetch failed: ${e.message} — using editor state positions only`);
    }

    // ── Helper: get recording entity for a Discogs track ─────────────────────
    //
    // Multi-medium guard (issue #4): on multi-medium releases, plain non-prefixed
    // candidates would match the first medium's track at that position — silently
    // collapsing disc-2 credits onto disc-1 recordings. We REQUIRE the candidate
    // key to carry an explicit `<medPos>-` prefix when the release has >1 medium,
    // except when Discogs already supplies one (e.g. "2-01"). For vinyl letter
    // positions ("C1") without explicit medium, infer the disc from the side
    // letter — A/B → disc 1, C/D → disc 2, etc.
    //
    // For single-medium releases, plain candidates are accepted (the only medium
    // is unambiguous).
    const isMultiMedium = positionToGid.size > 0
        && [...positionToGid.keys()].some(k => /^[2-9]-/.test(k));

    function inferDiscFromVinylSide(pos) {
        const m = String(pos || '').match(/^([A-Z])\d+$/i);
        if (!m) return null;
        return Math.floor((m[1].toUpperCase().charCodeAt(0) - 65) / 2) + 1;
    }

    function getRecordingEntity(track) {
        // Discogs zero-pads compound positions ("1-02") while MB doesn't ("1-2").
        // Strips one or more leading zeros after the dash. Issue #4 was originally
        // diagnosed as a multi-medium collapse but the actual root cause was this
        // zero-padding mismatch: lookup of "1-02" missed, fell through to
        // `parseInt("1-02") = 1` → tried "1-1" → matched the wrong track.
        const stripPad = s => String(s).replace(/-0+(\d)/g, '-$1');

        const pos = track.position != null ? String(track.position) : '';
        const num = track.number   != null ? String(track.number)   : '';

        const compounds = new Set();
        const plain     = new Set();

        // Position handling
        if (/^\d+-/.test(pos)) {
            // Discogs already gave a compound. NOT a fallback for parseInt — for
            // "1-02", parseInt returns 1 which is meaningless and produces a
            // misleading "1-1" candidate that matches the WRONG recording.
            compounds.add(pos);
            const unpadded = stripPad(pos);
            if (unpadded !== pos) compounds.add(unpadded);
        } else if (pos) {
            plain.add(pos);
            const inferredDisc = inferDiscFromVinylSide(pos);
            if (inferredDisc != null) compounds.add(`${inferredDisc}-${pos}`);
            for (let m = 1; m <= 10; m++) compounds.add(`${m}-${pos}`);
        }

        // Track number (some Discogs entries set both .position and .number)
        if (num && num !== pos) {
            plain.add(num);
            for (let m = 1; m <= 10; m++) compounds.add(`${m}-${num}`);
        }

        // On multi-medium releases, plain candidates are ambiguous — skip them.
        const tryKeys = isMultiMedium ? [...compounds] : [...plain, ...compounds];

        // 1. WS2-based GID lookup
        for (const c of tryKeys) {
            const gid = positionToGid.get(c);
            if (gid) {
                const rec = recordingByGid.get(gid);
                if (rec) return rec;
                log.warn(`Recording ${gid} for track ${track.position} not in editor state`);
                return null;
            }
        }
        // 2. Direct position lookup from editor state
        for (const c of tryKeys) {
            const rec = recordingByPosition.get(c);
            if (rec) return rec;
        }
        // Nothing found
        if (trackCount > 0) {
            const ws2Keys   = positionToGid.size    ? [...positionToGid.keys()].join(', ')    : '(empty)';
            const stateKeys = recordingByPosition.size ? [...recordingByPosition.keys()].join(', ') : '(empty)';
            log.warn(`No recording for track ${track.position} "${track.title}". WS2 keys: ${ws2Keys} | State keys: ${stateKeys}`);
        }
        return null;
    }

    // ── Helper: confirmedMap lookup for a Discogs entity ───────────────────
    // Single source of truth for "is this entity authorised to be dispatched":
    // the review-table phase populates `confirmedMap` with everything the user
    // (or auto-match) approved. If the entity isn't in the map, it's been
    // either explicitly unresolved by the user OR was never resolved at all —
    // either way we skip it. Used to be: fall back to IDB on miss, which
    // let unselected entities sneak through (issue #35) because IDB still
    // had the preflight auto-match cached.
    function confirmedMbUrl(entity) {
        if (!entity) return null;
        const direct = confirmedMap.get(entity.resource_url)
                    || confirmedMap.get(entity._syntheticKey)
                    || null;
        if (direct) return direct;
        // Artists without a Discogs page get keyed by `_nourl_<name>`.
        if (entity.name) {
            return confirmedMap.get(`_nourl_${entity.name}`) || null;
        }
        return null;
    }

    // ── Helper: does a matching rel already exist on the source entity? ─────
    // Compares (linkTypeID, target gid, attributes) — what MB's reducer would
    // dedupe on. Without this check the script counted every dispatch as
    // "added", even when MB silently no-op'd them (issue #14).
    //
    // Returns `null` when no match, or `{ kind, existingLinkName }` so the
    // caller can pick a distinct log message per #62 feedback:
    //   - 'exact'          identical link type + same attrs ("Already in MB")
    //   - 'equivalence'    equivalent link type (e.g. writer when adding composer)
    //   - 'duplicate-role' same link type + same target but DIFFERENT attrs
    //                      (only counted when `dedupeDuplicateRoles` is on)
    function relAlreadyExists(sourceEntity, linkTypeID, targetGid, attrTree) {
        const rels = sourceEntity?.relationships;
        if (!Array.isArray(rels) || rels.length === 0) return null;
        // Equivalence-set expansion: when ON, a writer rel counts as
        // existing for an incoming composer dispatch (and vice versa).
        const acceptableLinkTypes = equivalenceLookup.get(linkTypeID) || new Set([linkTypeID]);
        // #233: include each attribute's credited-as — a vocal credited
        // "spoken vocals [Michal]" is a different role from "[Tonda]", so one
        // actor voicing several characters keeps every rel (no false dedup).
        const sigOf   = (attrs) => attrs.map(a => `${a.typeID}:${a.text_value || ''}:${a.credited_as || ''}`).sort().join(',');
        // #225: signature of only the instrument/vocal-identifying attributes —
        // what makes two performances the "same role". Modifiers are excluded.
        const idSigOf = (attrs) => attrs.filter(a => isIdentifyingAttr(a.typeID))
            .map(a => `${a.typeID}:${a.text_value || ''}:${a.credited_as || ''}`).sort().join(',');
        const candAttrs = (() => {
            if (!attrTree) return [];
            try {
                return [...pageWindow.MB.tree.iterate(attrTree)]
                    .map(a => ({ typeID: a.typeID, text_value: a.text_value || '', credited_as: a.credited_as || '' }));
            } catch (e) { return []; }
        })();
        const candSig   = sigOf(candAttrs);
        const candIdSig = idSigOf(candAttrs);
        const lookupName = (id) => {
            try { return pageWindow.MB.linkedEntities.link_type[id]?.name || `#${id}`; }
            catch (e) { return `#${id}`; }
        };
        // Two-pass: prefer exact matches over duplicate-role matches when
        // both could fire, so the log message reflects the cheaper match.
        let dupMatch = null;
        for (const r of rels) {
            if (!acceptableLinkTypes.has(r.linkTypeID)) continue;
            const tgt = r.target?.gid || r.entity0?.gid || r.entity1?.gid;
            if (tgt !== targetGid) continue;
            const isEquivalent = (r.linkTypeID !== linkTypeID);
            const existingAttrs = (r.attributes || []).map(a => ({ typeID: a.typeID, text_value: a.text_value || '', credited_as: a.credited_as || '' }));
            const exactMatch = (sigOf(existingAttrs) === candSig);
            if (exactMatch) {
                return { kind: isEquivalent ? 'equivalence' : 'exact', existingLinkName: lookupName(r.linkTypeID) };
            }
            // Attrs differ. It's a duplicate *role* only when the identifying
            // instrument/vocal attributes are the same (e.g. "guitar" vs
            // "guitar (solo)"). Different instruments (synthesizer vs drum
            // machine) are distinct performances and must both be added (#225).
            if (dedupeDuplicateRoles && !dupMatch && idSigOf(existingAttrs) === candIdSig) {
                dupMatch = { kind: isEquivalent ? 'equivalence' : 'duplicate-role', existingLinkName: lookupName(r.linkTypeID) };
            }
        }
        return dupMatch;
    }

    // ── Helper: process one relationship ─────────────────────────────────────
    async function processOne(sourceEntity, entityType0, entityType1, linkTypeName, mbUrl, rawAttributes, credit, trackPos) {
        // Credited-as override (issue #62): when the user edited the
        // "Credited as" input on this entity's review-table row, that
        // value wins over the Discogs-side credit for every rel
        // dispatched to this target. Empty/missing override falls
        // through to the caller's credit (typically Discogs ANV).
        const overrideCredit = creditOverrides.get(mbUrl);
        if (overrideCredit && String(overrideCredit).trim()) {
            credit = String(overrideCredit).trim();
        }
        const mbid = mbUrl.replace(/.*\//, '').replace(/[^a-f0-9-]/gi, '').substring(0, 36);
        if (!mbid) { log.error(`Bad MBID URL: ${mbUrl}`); failed++; return; }

        const linkTypeID = resolveLinkTypeId(linkTypeName, entityType0, entityType1);
        if (!linkTypeID) {
            // resolveLinkTypeId has already logged a precise reason (deprecated,
            // wrong entity pair, unknown name, etc.). No need to double-log.
            failed++; return;
        }

        const attrTree = buildAttributes(rawAttributes, linkTypeID);   // #295: drop attributes this link type doesn't support
        // #233: fold each attribute's credited-as into the signature so two
        // spoken-vocals rels that differ only by character ("spoken vocals
        // [Michal]" vs "[Tonda]") aren't collapsed by the session dedup.
        const attrSig = attrTree ? (() => { try { return [...pageWindow.MB.tree.iterate(attrTree)].map(a => (a.typeID || '') + (a.credited_as ? '~' + a.credited_as : '')).join(','); } catch(e) { return ''; } })() : '';
        const sessionKey = `${sourceEntity.gid}|${linkTypeID}|${mbid}|${attrSig}`;
        // Within-session dedup: same (source, linkType, target, attrs) tuple
        // gets visited multiple times if a Discogs credit appears at both
        // release and track level. Tracked separately from "existed in MB"
        // (issue #34) so the final summary doesn't conflate them.
        if (dispatchedThisSession.has(sessionKey)) {
            log.info(`Skipped duplicate dispatch of <strong>${linkTypeName}</strong>: ${sourceEntity.name} ↔ ${credit || ''} — already queued earlier this run`);
            dedupedThisSession++;
            return;
        }
        dispatchedThisSession.add(sessionKey);

        let targetEntity;
        try {
            targetEntity = await fetchMBEntity(mbid);
        } catch(e) {
            log.error(`Entity fetch failed for ${mbid}: ${e.message}`);
            failed++; return;
        }

        // Re-resolve link type using the ACTUAL entity type from MB.
        // Entities like recording studios are often stored as labels, not places.
        // Semantic equivalents: some place link types have label counterparts and vice versa.
        const PLACE_TO_LABEL_LINK = {
            'glass mastered at': 'glass mastered',
            'mastered at':       'mastering',
            'pressed at':        'pressed',
            'manufactured at':   'manufactured',
            'recorded at':       'engineer',
            'mixed at':          'mix',
        };
        const LABEL_TO_PLACE_LINK = Object.fromEntries(
            Object.entries(PLACE_TO_LABEL_LINK).map(([k, v]) => [v, k])
        );

        let resolvedLinkTypeID = linkTypeID;
        if (targetEntity.entityType !== entityType1 && targetEntity.entityType !== entityType0) {
            const at = targetEntity.entityType;
            const [rt0, rt1] = at < sourceEntity.entityType ? [at, sourceEntity.entityType] : [sourceEntity.entityType, at];
            let reResolved = resolveLinkTypeId(linkTypeName, rt0, rt1);
            if (!reResolved) {
                // Try semantic equivalent for place↔label entity type switches
                const altName = at === 'label' ? PLACE_TO_LABEL_LINK[linkTypeName]
                                               : LABEL_TO_PLACE_LINK[linkTypeName];
                if (altName) reResolved = resolveLinkTypeId(altName, rt0, rt1);
            }
            if (reResolved) {
                resolvedLinkTypeID = reResolved;
            } else {
                log.warn(`Entity "${targetEntity.name}" is a ${targetEntity.entityType} but expected ${entityType0}/${entityType1} — link type "${linkTypeName}" may not apply`);
            }
        }

        // Pre-existence check against MB state: if the source entity already
        // has a rel with the same (linkTypeID, target.gid, attrs), MB's
        // reducer would no-op the dispatch and we'd over-count. Detect now,
        // log per-rel (issue #34 — silent count was misleading), count as
        // existed instead of added. (issue #14)
        const dedupHit = relAlreadyExists(sourceEntity, resolvedLinkTypeID, targetEntity.gid, attrTree);
        if (dedupHit) {
            // Distinct log message per #62 feedback. Three cases:
            //   exact          — identical rel already in MB
            //   equivalence    — equivalent role (writer ↔ composer) already there
            //   duplicate-role — same role + different attrs (only when
            //                    the "Duplicate roles" option is on)
            const pair = `${sourceEntity.name} ↔ ${targetEntity.name}${credit && credit !== targetEntity.name ? ` (credited: ${credit})` : ''}`;
            const existing = dedupHit.existingLinkName;
            if (dedupHit.kind === 'equivalence') {
                log.info(`Deduplication (equivalence sets): <strong>${linkTypeName}</strong> not added — equivalent <strong>${existing}</strong> already on ${pair}`);
            } else if (dedupHit.kind === 'duplicate-role') {
                log.info(`Deduplication (duplicate roles): <strong>${linkTypeName}</strong> not added — same role already exists with different attributes on ${pair}`);
            } else {
                log.info(`Already in MB: <strong>${linkTypeName}</strong>: ${pair}`);
            }
            existedInMb++;
            return;
        }

        dispatchRelationship(re, sourceEntity, targetEntity, resolvedLinkTypeID, credit, attrTree, trackPos);
        added++;
    }

    // ── Children: each named for the section it owns, called in order at the
    //              bottom of this function. They share the enclosing closure
    //              (counters, recordingByGid, processOne, etc.).

    async function dispatchCompanies() {
        for (const company of companies) {
            const details = ENTITY_TYPE_MAP[company.entity_type_name];
            if (!details) continue;
            // Use the entity type actually found in MB (e.g. 'label' instead of 'place')
            const resolvedEt = resolvedEntityTypes.get(company.resource_url) || details.entityType;
            // If resolved type doesn't match mapping type, check if the link is valid for that type
            if (resolvedEt !== details.entityType) {
                // MB only supports certain link types per entity type combination.
                // All place-mapped link types are place-only and cannot be used with labels.
                if (details.entityType === 'place' && resolvedEt === 'label') {
                    log.warn(`Skipped ${company.name}: MB has no "${details.linkType}" relationship for labels (only places). Add manually if needed.`);
                    skipped++; tickProgress(); continue;
                }
            }
            // Resolution comes from the review-table phase (`confirmedMap`).
            // No IDB fallback: if the user explicitly cleared the auto-match
            // (issue #35), IDB still has the cached MBID but `confirmedMap`
            // doesn't — and the user wins.
            const mbUrl = confirmedMbUrl(company);
            if (!mbUrl) {
                log.skip(`Skipped ${company.name} — not resolved in review`);
                skipped++; tickProgress(); continue;
            }
            const et = resolvedEt;
            const [t0, t1] = et <= 'release' ? [et, 'release'] : ['release', et];
            await processOne(releaseEntity, t0, t1, details.linkType, mbUrl, [], '');
            tickProgress();
        }
    }

    async function dispatchReleaseArtists() {
        // When "move to tracks" is on, RECORDING_LINK_TYPES roles are skipped here
        // and dispatched only to recordings below — keeping them off the release.
        for (const role of artistRoles) {
            if (applyToTracks && RECORDING_LINK_TYPES.has(role.linkType)) continue;
            // Work-only rels (writer, composer, etc.) go to works, not the release
            if (WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue;

            const mbUrl = confirmedMbUrl(role.artist);
            if (!mbUrl) {
                log.skip(`Skipped ${role.artist.name} (${role.linkType}) — not resolved in review`);
                skipped++; tickProgress(); continue;
            }
            const credit = role.creditedAs || stripDiscogsNum(role.artist.anv?.trim() || role.artist.name);
            await processOne(releaseEntity, 'artist', 'release', role.linkType, mbUrl, role.attributes || [], credit);
            tickProgress();
        }
    }

    async function dispatchTracklist() {
        // Apply release-level artist credits to all recordings (only when applyToTracks is on).
        if (applyToTracks && recordingByGid.size > 0) {
            // Exclude work-only roles — those go to works via dispatchWorks below.
            const applicable = artistRoles.filter(role => RECORDING_LINK_TYPES.has(role.linkType) && !WORK_ONLY_ARTIST_RELS.includes(role.linkType));
            if (applicable.length > 0) {
                log.info(`Applying ${applicable.length} release credit(s) to ${recordingByGid.size} recording(s)…`);
                for (const role of applicable) {
                    const mbUrl = confirmedMbUrl(role.artist);
                    if (!mbUrl) {
                        log.skip(`Skipped ${role.artist.name} (${role.linkType}) in applyToTracks — not resolved in review`);
                        continue;
                    }
                    const credit = role.creditedAs || stripDiscogsNum(role.artist.anv?.trim() || role.artist.name);
                    for (const recEntity of recordingByGid.values()) {
                        await processOne(recEntity, 'artist', 'recording', role.linkType, mbUrl, role.attributes || [], credit, positionByGid.get(recEntity.gid) || '*');
                    }
                }
            }
        }
    }

    async function dispatchWorks() {
        // recordingOfLinkTypeId: the "recording of" / "performance" link type
        const recordingOfLinkTypeId = resolveLinkTypeId('performance', 'recording', 'work');

        // Collect work-only tracklist rels grouped by recording GID. In
        // `when-needed` mode, skip roles whose artist won't actually
        // dispatch (unresolved or user-skipped in the review). Otherwise
        // we'd create a work for a recording whose only "work-needed"
        // reason is a credit that gets dropped at dispatch time anyway.
        // In `when-missing` we still include them — the user explicitly
        // asked for a work on every recording, so the work gets created
        // with whatever resolved credits attach.
        const includeOnlyResolved = createWorksMode === 'when-needed';
        const workOnlyByGid = new Map(); // recGid → [{ role, recEntity }, ...]
        for (const role of tracklistRels) {
            if (!WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue;
            if (includeOnlyResolved && !confirmedMbUrl(role.artist)) continue;
            const recEntity = getRecordingEntity(role.track);
            if (!recEntity) {
                log.error(`Work-only rel for track ${role.track.position} "${role.track.title}" — no recording found, skipped`);
                failed++;
                continue;
            }
            if (!workOnlyByGid.has(recEntity.gid)) workOnlyByGid.set(recEntity.gid, []);
            workOnlyByGid.get(recEntity.gid).push({ role, recEntity });
        }

        // Release-level work-only roles apply to all recordings. Same
        // resolved-only filter in `when-needed`.
        for (const role of artistRoles) {
            if (!WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue;
            if (includeOnlyResolved && !confirmedMbUrl(role.artist)) continue;
            for (const recEntity of recordingByGid.values()) {
                const syntheticRole = { ...role, track: { position: '', title: recEntity.name || '' } };
                if (!workOnlyByGid.has(recEntity.gid)) workOnlyByGid.set(recEntity.gid, []);
                workOnlyByGid.get(recEntity.gid).push({ role: syntheticRole, recEntity });
            }
        }

        // #94: "when missing" mode also ensures EVERY recording has a work,
        // even those with no work-only artist relationships. "when needed"
        // (default) skips this step — recordings without an associated
        // composer/lyricist/writer credit are left alone.
        if (createWorksMode === 'when-missing' && recordingOfLinkTypeId) {
            for (const recEntity of recordingByGid.values()) {
                if (!workOnlyByGid.has(recEntity.gid)) {
                    workOnlyByGid.set(recEntity.gid, []); // empty roles — work creation only
                }
            }
        }

        if (workOnlyByGid.size === 0) return;

        if (!recordingOfLinkTypeId) {
            log.error('Could not resolve "performance" link type — work processing skipped');
            return;
        }

        log.info(`Processing work relationships for ${workOnlyByGid.size} recording(s)…`);

        // Use editor state relatedWorks (built during recording map phase above) — no extra fetch needed
        const existingWorkByRecGid = editorWorkByRecGid;
        log.info(`Editor state: ${existingWorkByRecGid.size} recording(s) already have a linked work`);

        // Check editor state only for relationships dispatched in THIS session
        function getWorkFromEditorState(recEntity) {
            try {
                for (const rel of MB.tree.iterate(recEntity.relationships)) {
                    if (rel._status === 1 && rel.linkTypeID === recordingOfLinkTypeId) {
                        return rel.entity0?.entityType === 'work' ? rel.entity0 : rel.entity1;
                    }
                }
            } catch(e) {}
            return null;
        }

        // #257 a recording must never get more than one freshly-created work in a single
        // run. The loop keys on unique recording GIDs so this can't happen normally — if it
        // ever does it's a logic error, so we surface it (error + skip) instead of silently
        // creating a duplicate work.
        const createdWorkRecGids = new Set();
        for (const [recGid, entries] of workOnlyByGid) {
            // entries may be empty when createWorksMode='when-missing' adds all recordings (no work-only roles)
            const recEntity  = entries[0]?.recEntity  ?? recordingByGid.get(recGid);
            // `||` (not `??`): a parsed credit may carry an empty track title — fall
            // through to the MB recording's name so the created work is never nameless (#232).
            const trackTitle = entries[0]?.role.track.title || recEntity?.name || recGid;
            const trackPos   = entries[0]?.role.track.position ?? '';
            if (!recEntity) continue;

            // Check for pre-existing works using MB's own relatedWorks field on the track wrapper
            // (mirrors MB's batch-create-works logic: `if (relatedWorks.size !== 0) continue`)
            const hasExistingWork = editorWorkByRecGid.has(recGid);

            let workEntity = null;
            if (hasExistingWork) {
                workEntity = editorWorkByRecGid.get(recGid);
                const wid = workEntity.gid || workEntity.id;
                log.info(`Track ${trackPos} "${trackTitle}": work already linked (${workEntity.name || wid || 'existing'}) — skipping creation`);
                if (!workEntity.gid && !workEntity.id) continue; // can't use this entity
            }

            // Also check for works dispatched in this session (newly created ones)
            if (!workEntity) workEntity = getWorkFromEditorState(recEntity);

            // No work found. In `never` mode we refuse to create one and
            // log the work-only credits as errors (legacy `createWorks: false`
            // behaviour, restored as a third picker option). Otherwise
            // (`when-needed` / `when-missing`) we create a new work below.
            if (!workEntity && createWorksMode === 'never') {
                for (const { role } of entries) {
                    log.error(`Track ${trackPos} "${trackTitle}": no work exists for ${role.linkType} (${role.artist.name}) — "Create works" is set to "never". Add the work manually or change the mode.`);
                    failed++;
                }
                continue;
            }
            if (!workEntity) {
                // #257 guard: refuse to create a second work for a recording we already
                // created one for this run (should be impossible — keys are unique).
                if (createdWorkRecGids.has(recGid)) {
                    log.error(`Track ${trackPos} "${trackTitle}": a work was already created for this recording in this run — skipping to avoid a duplicate work`);
                    failed++;
                    continue;
                }
                // Use MB's own batch-create-works mechanism:
                //   1. Build a work object matching MB's createWorkObject() output
                //   2. Register it via mergeLinkedEntities so the editor knows about it
                //   3. Dispatch the recording→work relationship
                const newWorkId = re.getRelationshipStateId(); // negative unique ID
                workEntity = {
                    _fromBatchCreateWorksDialog: true,
                    attributes: [],
                    comment: '',
                    editsPending: false,
                    entityType: 'work',
                    gid: null,
                    id: newWorkId,
                    iswcs: [],
                    languages: [],
                    name: trackTitle,
                    typeID: null,
                };
                // Register the new work entity in MB's linked entities store
                // (mirrors what MB does before dispatching batch-created works)
                if (MB.mergeLinkedEntities) {
                    MB.mergeLinkedEntities({ work: { [newWorkId]: workEntity } });
                }
                // Dispatch recording→work relationship using MB's own relationship structure
                re.dispatch({
                    type: 'update-relationship-state',
                    sourceEntity: recEntity,
                    batchSelectionCount: null,
                    creditsToChangeForSource: '',
                    creditsToChangeForTarget: '',
                    oldRelationshipState: null,
                    newRelationshipState: {
                        _lineage: ['batch-created work'],
                        _original: null,
                        _status: 1,
                        attributes: null,
                        begin_date: null,
                        editsPending: false,
                        end_date: null,
                        ended: false,
                        entity0: recEntity,
                        entity0_credit: '',
                        entity1: workEntity,
                        entity1_credit: '',
                        id: re.getRelationshipStateId(),
                        linkOrder: 0,
                        linkTypeID: recordingOfLinkTypeId,
                    },
                });
                createdWorkRecGids.add(recGid);
                log.info(`Track ${trackPos} "${trackTitle}": created new work "${trackTitle}"`);
                added++;
                tickProgress();
                // Re-read from editor state so subsequent artist→work dispatches see the live entity
                workEntity = getWorkFromEditorState(recEntity) || workEntity;
            }

            // Apply all work-only artist rels to the work
            for (const { role } of entries) {
                const mbUrl = confirmedMbUrl(role.artist);
                if (!mbUrl) {
                    log.skip(`Skipped ${role.artist.name} — not resolved in review (${role.linkType})`);
                    continue;
                }
                const credit = role.creditedAs || stripDiscogsNum(role.artist.anv?.trim() || role.artist.name);
                if (workEntity.gid) {
                    await processOne(workEntity, 'artist', 'work', role.linkType, mbUrl, role.attributes || [], credit, trackPos || (entries[0]?.role?.track?.position));
                } else {
                    // New work (no MBID yet) — dispatch directly with the provisional entity
                    const linkTypeID = resolveLinkTypeId(role.linkType, 'artist', 'work');
                    if (linkTypeID) {
                        const mbid = mbUrl.replace(/.*\//, '').replace(/[^a-f0-9-]/gi, '').substring(0, 36);
                        try {
                            const artistEntity = await fetchMBEntity(mbid);
                            dispatchRelationship(re, workEntity, artistEntity, linkTypeID, credit, buildAttributes(role.attributes || [], linkTypeID));
                            added++;
                        } catch(e) {
                            log.error(`Failed to add ${role.linkType} for new work: ${e.message}`);
                        }
                    }
                }
            }
        }
    }

    async function dispatchTracklistArtists() {
        const seenTrackRels = new Set();
        for (const role of tracklistRels) {
            if (WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue; // handled by dispatchWorks

            const mbUrl = confirmedMbUrl(role.artist);
            if (!mbUrl) {
                log.skip(`Skipped ${role.artist.name} on track ${role.track.position} — not resolved in review`);
                continue;
            }

            const recEntity = getRecordingEntity(role.track);
            if (!recEntity) {
                log.warn(`No recording found for track ${role.track.position} "${role.track.title}" — skipped`);
                failed++; continue;
            }

            const credit = role.creditedAs || stripDiscogsNum(role.artist.anv?.trim() || role.artist.name);
            const attrKey = (role.attributes||[]).map(a=>a.value||a._type||'').join(',');
            const trackRelKey = `${role.track.position}|${role.linkType}|${mbUrl}|${attrKey}`;
            if (seenTrackRels.has(trackRelKey)) continue;
            seenTrackRels.add(trackRelKey);
            log.info(`Track ${role.track.position} "${role.track.title}": adding <strong>${role.linkType}</strong> — ${credit}`);
            await processOne(recEntity, 'artist', 'recording', role.linkType, mbUrl, role.attributes || [], credit, role.track.position);
            tickProgress();
        }
    }

    // ── Orchestrate: call the five children in their original execution order.
    await dispatchCompanies();
    await dispatchReleaseArtists();
    await dispatchTracklist();
    await dispatchWorks();
    await dispatchTracklistArtists();

    // ── Update edit note ──────────────────────────────────────────────────────
    try {
        const opts = [
            processTracklist !== undefined ? `per-track:${processTracklist ? 'on' : 'off'}` : null,
            applyToTracks   !== undefined ? `move-to-tracks:${applyToTracks ? 'on' : 'off'}` : null,
            createWorksMode !== undefined ? `create-works:${createWorksMode}` : null,
        ].filter(Boolean).join(', ');
        // Statistics (issues #56, follow-up) — surface input size, review
        // outcome (unresolved entities), and dispatch outcome in the edit
        // note so a reviewer can see at a glance how big the import was
        // without expanding any log section.
        // `unresolvedCount` is the count of distinct entities the user
        // couldn't / wouldn't resolve in the review table — stashed on
        // `confirmedMap` by review-table because the dispatch layer doesn't
        // see `allResults` directly.
        const trackCount = Array.isArray(discogsTracklist) ? discogsTracklist.length : 0;
        const inputStats = `Input: ${companies?.length || 0} companies, ${artistRoles?.length || 0} release credits, ${tracklistRels?.length || 0} tracklist credits on ${trackCount} track${trackCount === 1 ? '' : 's'}`;
        const unresolvedCount = confirmedMap?.unresolvedCount || 0;
        const totalEntities   = confirmedMap?.totalEntities   || 0;
        const unresolvedLine  = unresolvedCount > 0
            ? `Unresolved: ${unresolvedCount} of ${totalEntities} entit${totalEntities === 1 ? 'y' : 'ies'} skipped in review`
            : null;
        const editNoteDedupPart = dedupedThisSession > 0
            ? `, ${dedupedThisSession} dispatch duplicate${dedupedThisSession === 1 ? '' : 's'}`
            : '';
        const resultStats = `Result: ${added} added, ${existedInMb} already in MB${editNoteDedupPart}, ${skipped} skipped, ${failed} failed`;
        const ourNote = buildEditNote(discogsUrl, opts, [inputStats, unresolvedLine, resultStats].filter(Boolean));
        // Preserve any note another script already wrote — append ours instead
        // of overwriting (issue #174). Read the live textarea value as the base.
        const existingNote = document.querySelector(SELECTORS.EditNote)?.value || '';
        const note = combineEditNote(existingNote, ourNote);
        re.dispatch({ type: 'update-edit-note', editNote: note });
    } catch(e) { /* ignore */ }

    // Final summary. `existedInMb` and `dedupedThisSession` separated per
    // issue #34 — a combined "already existed" was confusing because the
    // dedup case counted intra-session duplicates, which the user reads
    // as "the rel was already in MB" (they aren't).
    const dedupPart = dedupedThisSession > 0
        ? `, ${dedupedThisSession} dispatch duplicate${dedupedThisSession === 1 ? '' : 's'}`
        : '';
    log.info(`<strong>Done: ${added} added, ${existedInMb} already in MB${dedupPart}, ${skipped} skipped, ${failed} failed</strong>`);
}
