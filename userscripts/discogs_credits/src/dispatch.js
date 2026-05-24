// The main dispatch orchestrator. Walks the (pre-resolved) Discogs JSON
// and feeds every credit into MB's relationship editor via
// `dispatchRelationship`. Handles companies, release-level artists, the
// track-level artist credits, and the work-level credits — with
// deduplication against this session and against MB's existing rels.

import { addLogLine }                  from './log.js';
import { pageWindow }                   from './constants.js';
import { db }                            from './storage.js';
import { getDiscogsLinkKey }             from './api-discogs.js';
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
import { buildEditNote }                from './edit-note.js';
import { ENTITY_TYPE_MAP }               from './data/entity-map.js';
import { WORK_ONLY_ARTIST_RELS }         from './data/work-only-rels.js';

export async function instantFillRelationships(companies, artistRoles, tracklistRels, applyToTracks, createWorks, discogsTracklist, processTracklist, resolvedEntityTypes, confirmedMap) {
    resolvedEntityTypes = resolvedEntityTypes || new Map();
    confirmedMap = confirmedMap || new Map();
    const re = await waitForMBEditor();
    if (!re) return;

    const MB = pageWindow.MB;
    const releaseEntity = re.state.entity;
    // Counter semantics (issue #14):
    //   added       — rels actually dispatched into editor state this session
    //   existedRels — rels that were already on the source entity in MB before
    //                 this session, OR already dispatched earlier in this session
    //                 (within-session dedup). The script would have added them
    //                 but MB's reducer would silently no-op the dispatch.
    //   skipped     — credits the script chose not to dispatch (no Discogs
    //                 page, no MB ID, no review-table confirmation, etc.)
    //   failed      — errors (bad MBID, deprecated link type, entity fetch
    //                 failure, etc.)
    let added = 0, existedRels = 0, skipped = 0, failed = 0;
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

    addLogLine(`Starting instant fill: ${companies.length} companies, ${artistRoles.length} release artist roles, ${tracklistRels.length} tracklist roles`);

    const bar = document.querySelector('.discogs-bar');
    function tickProgress() {
        const done = added + skipped + failed;
        const est = Math.max(done + 1, companies.length + artistRoles.length + tracklistRels.length);
        const pct = Math.min(Math.round((done / est) * 99), 99);
        const _pct = document.querySelector('#discogs-progress-pct');
        if (_pct) _pct.textContent = pct + '%';
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
        addLogLine(`Found ${trackCount} track(s) in editor state (${recordingByGid.size} with GID, ${recordingByPosition.size} position entries: ${[...recordingByPosition.keys()].join(',')}). relatedWorks: ${editorWorkByRecGid.size} pre-linked`)
    } catch(e) {
        addLogLine(`<span style="color:orange">WARN Iterating MB state: ${e.message}</span>`);
    }

    // ── Fetch position→GID map from WS2 (authoritative, always correct) ──────
    const positionToGid = new Map(); // "1" / "A1" → recording GID
    try {
        const relMbid = releaseEntity.gid;
        addLogLine(`WS2: fetching recordings for release ${relMbid}…`);
        const wsJson = await fetchWithRetry(`/ws/2/release/${relMbid}?inc=recordings&fmt=json`);
        addLogLine(`WS2: response received`);
        if (wsJson) {
            const mediaCount = wsJson.media?.length ?? 0;
            addLogLine(`WS2: ${mediaCount} medium/media in response`);
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
            addLogLine(`WS2 position map: ${positionToGid.size} entries (${[...positionToGid.keys()].sort().join(', ')})`);
        }
    } catch(e) {
        addLogLine(`<span style="color:orange">WARN WS2 recording fetch failed: ${e.message} — using editor state positions only</span>`);
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
                addLogLine(`<span style="color:orange">WARN Recording ${gid} for track ${track.position} not in editor state</span>`);
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
            addLogLine(`<span style="color:orange">WARN No recording for track ${track.position} "${track.title}". WS2 keys: ${ws2Keys} | State keys: ${stateKeys}</span>`);
        }
        return null;
    }

    // ── Helper: resolve MBID from IDB cache for a Discogs entity ─────────────
    async function getMbidForEntity(entity, entityType) {
        return new Promise((resolve, reject) => {
            const key = getDiscogsLinkKey(entity.resource_url);
            if (!key) return reject(`No Discogs key for ${entity.name}`);
            const tx = db.transaction(['mblinks'], 'readonly');
            const req = tx.objectStore('mblinks').get(key);
            req.onsuccess = () => {
                const mbUrl = req.result?.mb_links?.[0];
                if (mbUrl) resolve(mbUrl);
                else reject(`${entity.name} not in IDB cache — run pre-flight check first`);
            };
            req.onerror = () => reject(`IDB error for ${entity.name}`);
        });
    }

    // ── Helper: does a matching rel already exist on the source entity? ─────
    // Compares (linkTypeID, target gid, attributes) — what MB's reducer would
    // dedupe on. Without this check the script counted every dispatch as
    // "added", even when MB silently no-op'd them (issue #14).
    function relAlreadyExists(sourceEntity, linkTypeID, targetGid, attrTree) {
        const rels = sourceEntity?.relationships;
        if (!Array.isArray(rels) || rels.length === 0) return false;
        const candSig = (() => {
            if (!attrTree) return '';
            try {
                return [...pageWindow.MB.tree.iterate(attrTree)]
                    .map(a => `${a.typeID}:${a.text_value || ''}`).sort().join(',');
            } catch (e) { return ''; }
        })();
        return rels.some(r => {
            if (r.linkTypeID !== linkTypeID) return false;
            const tgt = r.target?.gid || r.entity0?.gid || r.entity1?.gid;
            if (tgt !== targetGid) return false;
            const existingSig = (r.attributes || [])
                .map(a => `${a.typeID}:${a.text_value || ''}`).sort().join(',');
            return existingSig === candSig;
        });
    }

    // ── Helper: process one relationship ─────────────────────────────────────
    async function processOne(sourceEntity, entityType0, entityType1, linkTypeName, mbUrl, rawAttributes, credit, trackPos) {
        const mbid = mbUrl.replace(/.*\//, '').replace(/[^a-f0-9-]/gi, '').substring(0, 36);
        if (!mbid) { addLogLine(`<span style="color:red">ERR Bad MBID URL: ${mbUrl}</span>`); failed++; return; }

        const linkTypeID = resolveLinkTypeId(linkTypeName, entityType0, entityType1);
        if (!linkTypeID) {
            // resolveLinkTypeId has already logged a precise reason (deprecated,
            // wrong entity pair, unknown name, etc.). No need to double-log.
            failed++; return;
        }

        const attrTree = buildAttributes(rawAttributes);
        const attrSig = attrTree ? (() => { try { return [...pageWindow.MB.tree.iterate(attrTree)].map(a => a.typeID || '').join(','); } catch(e) { return ''; } })() : '';
        const sessionKey = `${sourceEntity.gid}|${linkTypeID}|${mbid}|${attrSig}`;
        // Within-session dedup: same (source, linkType, target, attrs) tuple
        // gets visited multiple times if a Discogs credit appears at both
        // release and track level. Count as already-existing, not as "skipped".
        if (dispatchedThisSession.has(sessionKey)) { existedRels++; return; }
        dispatchedThisSession.add(sessionKey);

        let targetEntity;
        try {
            targetEntity = await fetchMBEntity(mbid);
        } catch(e) {
            addLogLine(`<span style="color:red">ERR Entity fetch failed for ${mbid}: ${e.message}</span>`);
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
                addLogLine(`<span style="color:orange">WARN Entity "${targetEntity.name}" is a ${targetEntity.entityType} but expected ${entityType0}/${entityType1} — link type "${linkTypeName}" may not apply</span>`);
            }
        }

        // Pre-existence check against MB state: if the source entity already
        // has a rel with the same (linkTypeID, target.gid, attrs), MB's
        // reducer would no-op the dispatch and we'd over-count. Detect now,
        // log clearly, count as existed instead of added. (issue #14)
        if (relAlreadyExists(sourceEntity, resolvedLinkTypeID, targetEntity.gid, attrTree)) {
            existedRels++;
            return;
        }

        dispatchRelationship(re, sourceEntity, targetEntity, resolvedLinkTypeID, credit, attrTree, trackPos);
        added++;
    }

    // ── Companies / labels / places ───────────────────────────────────────────
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
                addLogLine(`<span style="color:orange">WARN Skipped ${company.name}: MB has no "${details.linkType}" relationship for labels (only places). Add manually if needed.</span>`);
                skipped++; tickProgress(); continue;
            }
        }
        // Resolution must come from the review-table phase: confirmedMap → IDB cache.
        // The old `getMbId` (network) fallback added ~1-3s per unresolved entity (bug
        // majkinetor/musicbrainz-userscripts#8) and was redundant — preflight already
        // tried the same `/ws/2/url` lookup. Unresolved here = unresolved by user.
        let mbUrl;
        try { mbUrl = await getMbidForEntity(company, resolvedEt); }
        catch(e) {
            addLogLine(`<span style="color:orange">WARN Skipped ${company.name} — not resolved in review</span>`);
            skipped++; tickProgress(); continue;
        }
        const et = resolvedEt;
        const [t0, t1] = et <= 'release' ? [et, 'release'] : ['release', et];
        await processOne(releaseEntity, t0, t1, details.linkType, mbUrl, [], '');
        tickProgress();
    }

    // ── Release-level artist roles ────────────────────────────────────────────
    // When "move to tracks" is on, RECORDING_LINK_TYPES roles are skipped here
    // and dispatched only to recordings below — keeping them off the release.
    for (const role of artistRoles) {
        if (applyToTracks && RECORDING_LINK_TYPES.has(role.linkType)) continue;
        // Work-only rels (writer, composer, etc.) go to works, not the release
        if (WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue;

        // Try confirmedMap first (handles artists with no resource_url)
        const _artKey = role.artist.resource_url || role.artist._syntheticKey || `_nourl_${role.artist.name}`;
        let mbUrl = confirmedMap.get(_artKey) || (role.artist.resource_url ? confirmedMap.get(role.artist.resource_url) : null);
        // Name-based fallback: search all confirmedMap keys for _nourl_ match
        if (!mbUrl) {
            for (const [k, v] of confirmedMap) {
                if (k === `_nourl_${role.artist.name}`) { mbUrl = v; break; }
            }
        }
        if (!mbUrl && !role.artist.resource_url) {
            // No Discogs page, not in confirmedMap — skip with clear message
            addLogLine(`<span style="color:orange">WARN Skipped ${role.artist.name} (${role.linkType}) — no Discogs page, not confirmed in review</span>`);
            skipped++; tickProgress(); continue;
        }
        if (!mbUrl) {
            // See bug #8 — no network fallback; unresolved = skip immediately.
            try { mbUrl = await getMbidForEntity(role.artist, 'artist'); }
            catch(e) {
                addLogLine(`<span style="color:orange">WARN Skipped ${role.artist.name} — not resolved in review (${role.linkType})</span>`);
                skipped++; tickProgress(); continue;
            }
        }
        const credit = role.artist.anv?.trim() || role.artist.name;
        await processOne(releaseEntity, 'artist', 'release', role.linkType, mbUrl, role.attributes || [], credit);
        tickProgress();
    }

    // ── Apply release-level artist credits to all recordings ────────────────
    if (applyToTracks && recordingByGid.size > 0) {
        // Exclude work-only roles — those go to works via the works section below
        const applicable = artistRoles.filter(role => RECORDING_LINK_TYPES.has(role.linkType) && !WORK_ONLY_ARTIST_RELS.includes(role.linkType));
        if (applicable.length > 0) {
            addLogLine(`Applying ${applicable.length} release credit(s) to ${recordingByGid.size} recording(s)…`);
            for (const role of applicable) {
                let mbUrl;
                // See bug #8 — no network fallback.
                try { mbUrl = await getMbidForEntity(role.artist, 'artist'); }
                catch(e) {
                    addLogLine(`<span style="color:orange">WARN Skipped ${role.artist.name} (${role.linkType}) in applyToTracks — not resolved in review</span>`);
                    continue;
                }
                const credit = role.artist.anv?.trim() || role.artist.name;
                for (const recEntity of recordingByGid.values()) {
                    await processOne(recEntity, 'artist', 'recording', role.linkType, mbUrl, role.attributes || [], credit, positionByGid.get(recEntity.gid) || '*');
                }
            }
        }
    }

    // ── Work-only tracklist relationships (composer, lyricist, arranger etc.) ──
    // recordingOfLinkTypeId: the "recording of" / "performance" link type
    const recordingOfLinkTypeId = resolveLinkTypeId('performance', 'recording', 'work');

    // Collect work-only tracklist rels grouped by recording GID
    const workOnlyByGid = new Map(); // recGid → [{ role, recEntity }, ...]
    for (const role of tracklistRels) {
        if (!WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue;
        const recEntity = getRecordingEntity(role.track);
        if (!recEntity) {
            addLogLine(`<span style="color:red">ERR Work-only rel for track ${role.track.position} "${role.track.title}" — no recording found, skipped</span>`);
            failed++;
            continue;
        }
        if (!workOnlyByGid.has(recEntity.gid)) workOnlyByGid.set(recEntity.gid, []);
        workOnlyByGid.get(recEntity.gid).push({ role, recEntity });
    }

    // Release-level work-only roles apply to all recordings — only when createWorks is on
    if (createWorks) {
        for (const role of artistRoles) {
            if (!WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue;
            for (const recEntity of recordingByGid.values()) {
                const syntheticRole = { ...role, track: { position: '', title: recEntity.name || '' } };
                if (!workOnlyByGid.has(recEntity.gid)) workOnlyByGid.set(recEntity.gid, []);
                workOnlyByGid.get(recEntity.gid).push({ role: syntheticRole, recEntity });
            }
        }
    }

    // When createWorks is ON, also ensure all recordings have a work —
    // even those with no work-only artist relationships.
    if (createWorks && recordingOfLinkTypeId) {
        for (const recEntity of recordingByGid.values()) {
            if (!workOnlyByGid.has(recEntity.gid)) {
                workOnlyByGid.set(recEntity.gid, []); // empty roles — work creation only
            }
        }
    }

    if (workOnlyByGid.size > 0) {
        if (!recordingOfLinkTypeId) {
            addLogLine('<span style="color:red">ERR Could not resolve "performance" link type — work processing skipped</span>');
        } else {
            addLogLine(`Processing work relationships for ${workOnlyByGid.size} recording(s)…`);

            // Use editor state relatedWorks (built during recording map phase above) — no extra fetch needed
            const existingWorkByRecGid = editorWorkByRecGid;
            addLogLine(`Editor state: ${existingWorkByRecGid.size} recording(s) already have a linked work`);

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

            for (const [recGid, entries] of workOnlyByGid) {
                // entries may be empty when createWorks adds all recordings (no work-only roles)
                const recEntity  = entries[0]?.recEntity  ?? recordingByGid.get(recGid);
                const trackTitle = entries[0]?.role.track.title    ?? recEntity?.name ?? recGid;
                const trackPos   = entries[0]?.role.track.position ?? '';
                if (!recEntity) continue;

                // Check for pre-existing works using MB's own relatedWorks field on the track wrapper
                // (mirrors MB's batch-create-works logic: `if (relatedWorks.size !== 0) continue`)
                const hasExistingWork = editorWorkByRecGid.has(recGid);

                let workEntity = null;
                if (hasExistingWork) {
                    workEntity = editorWorkByRecGid.get(recGid);
                    const wid = workEntity.gid || workEntity.id;
                    addLogLine(`Track ${trackPos} "${trackTitle}": work already linked (${workEntity.name || wid || 'existing'}) — skipping creation`);
                    if (!workEntity.gid && !workEntity.id) continue; // can't use this entity
                }

                // Also check for works dispatched in this session (newly created ones)
                if (!workEntity) workEntity = getWorkFromEditorState(recEntity);

                // 3. No work found
                if (!workEntity) {
                    if (!createWorks) {
                        // Log as error — work-only rels cannot be applied without a work
                        for (const { role } of entries) {
                            addLogLine(`<span style="color:red">ERR Track ${trackPos} "${trackTitle}": no work exists for ${role.linkType} (${role.artist.name}) — enable "Create missing works" or add work manually</span>`);
                            failed++;
                        }
                        continue;
                    }

                    // Use MB's own batch-create-works mechanism:
                    // 1. Build work object matching MB's createWorkObject() output
                    // 2. Register it via mergeLinkedEntities so the editor knows about it
                    // 3. Dispatch the recording→work relationship
                    const MB = pageWindow.MB;
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
                    addLogLine(`Track ${trackPos} "${trackTitle}": created new work "${trackTitle}"`);
                    added++;
                    tickProgress();
                    // Re-read from editor state so subsequent artist→work dispatches see the live entity
                    workEntity = getWorkFromEditorState(recEntity) || workEntity;
                }

                // Apply all work-only artist rels to the work
                for (const { role } of entries) {
                    let mbUrl;
                    // See bug #8 — no network fallback.
                    try { mbUrl = await getMbidForEntity(role.artist, 'artist'); }
                    catch(e) {
                        addLogLine(`<span style="color:orange">WARN Skipped ${role.artist.name} — not resolved in review (${role.linkType})</span>`);
                        continue;
                    }
                    const credit = role.artist.anv?.trim() || role.artist.name;
                    if (workEntity.gid) {
                        await processOne(workEntity, 'artist', 'work', role.linkType, mbUrl, role.attributes || [], credit, trackPos || (entries[0]?.role?.track?.position));
                    } else {
                        // New work (no MBID yet) — dispatch directly with the provisional entity
                        const linkTypeID = resolveLinkTypeId(role.linkType, 'artist', 'work');
                        if (linkTypeID) {
                            const mbid = mbUrl.replace(/.*\//, '').replace(/[^a-f0-9-]/gi, '').substring(0, 36);
                            try {
                                const artistEntity = await fetchMBEntity(mbid);
                                dispatchRelationship(re, workEntity, artistEntity, linkTypeID, credit, buildAttributes(role.attributes || []));
                                added++;
                            } catch(e) {
                                addLogLine(`<span style="color:red">ERR Failed to add ${role.linkType} for new work: ${e.message}</span>`);
                            }
                        }
                    }
                }
            }
        }
    }

    // ── Tracklist non-work artist roles ───────────────────────────────────────
    const seenTrackRels = new Set();
    for (const role of tracklistRels) {
        if (WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue; // handled above

        // Try confirmedMap first (handles artists with no resource_url)
        const _tArtKey = role.artist.resource_url || role.artist._syntheticKey || `_nourl_${role.artist.name}`;
        let mbUrl = confirmedMap.get(_tArtKey) || (role.artist.resource_url ? confirmedMap.get(role.artist.resource_url) : null);
        if (!mbUrl) {
            for (const [k, v] of confirmedMap) {
                if (k === `_nourl_${role.artist.name}`) { mbUrl = v; break; }
            }
        }
        if (!mbUrl && !role.artist.resource_url) {
            addLogLine(`<span style="color:orange">WARN Skipped ${role.artist.name} on track ${role.track.position} — no Discogs page, not confirmed</span>`);
            continue;
        }
        if (!mbUrl) {
            // See bug #8 — no network fallback.
            try { mbUrl = await getMbidForEntity(role.artist, 'artist'); }
            catch(e) {
                addLogLine(`<span style="color:orange">WARN Skipped ${role.artist.name} on track ${role.track.position} — not resolved in review</span>`);
                continue;
            }
        }

        const recEntity = getRecordingEntity(role.track);
        if (!recEntity) {
            addLogLine(`<span style="color:orange">WARN No recording found for track ${role.track.position} "${role.track.title}" — skipped</span>`);
            failed++; continue;
        }

        const credit = role.artist.anv?.trim() || role.artist.name;
        const attrKey = (role.attributes||[]).map(a=>a.value||a._type||'').join(',');
        const trackRelKey = `${role.track.position}|${role.linkType}|${mbUrl}|${attrKey}`;
        if (seenTrackRels.has(trackRelKey)) continue;
        seenTrackRels.add(trackRelKey);
        addLogLine(`Track ${role.track.position} "${role.track.title}": adding <strong>${role.linkType}</strong> — ${credit}`);
        await processOne(recEntity, 'artist', 'recording', role.linkType, mbUrl, role.attributes || [], credit, role.track.position);
        tickProgress();
    }

    // ── Update edit note ──────────────────────────────────────────────────────
    try {
        const opts = [
            processTracklist !== undefined ? `per-track:${processTracklist ? 'on' : 'off'}` : null,
            applyToTracks   !== undefined ? `move-to-tracks:${applyToTracks ? 'on' : 'off'}` : null,
            createWorks     !== undefined ? `create-works:${createWorks ? 'on' : 'off'}` : null,
        ].filter(Boolean).join(', ');
        const note = buildEditNote(discogsUrl, opts);
        re.dispatch({ type: 'update-edit-note', editNote: note });
    } catch(e) { /* ignore */ }

    addLogLine(`<strong>Done: ${added} added, ${existedRels} already existed, ${skipped} skipped, ${failed} failed</strong>`);
}
