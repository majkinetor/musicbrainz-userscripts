// Property-based assertions for the import test.
//
// Inputs:
//   - existingRels, finalRels: snapshots from snapshotRelationships() before/after import.
//   - discogsJson:  the raw Discogs release JSON (object).
//   - mbValid:      { linkTypes, attrTypes, recordingsByPosition }
//                   pulled from MB.linkedEntities + WS2 to validate against.
//
// Output:
//   { failures: [...], warnings: [...], stats: {...} }
//
// Assertion numbering matches dev/ANALYSIS.md §3.3.
//
// Note: commit 2 baseline runs without test-mode placeholder routing in the script,
// so assertion #7 is informational-only (no [no artist|label|place] rels are dispatched
// yet). It activates fully once commit 3/4 adds that path.

const NO_ENTITY_MBIDS = new Set([
    'eec63d3c-3b81-4ad4-b1e4-7c147d4d2b61',   // [no artist]
    '157afde4-4bf5-4039-8ad2-5a15acc85176',   // [no label]
    'f14d8916-edfd-4e55-97b0-9b996e01d87e',   // [no place]
]);

/** Stable signature for diffing rel snapshots.
 * MB assigns each rel a unique numeric `id`. Pre-existing rels have positive ids
 * from the database; staged/added rels have negative ids from `getRelationshipStateId()`.
 * So `rel.id` is the right identity key — we don't need to recompute from fields.
 */
function relKey(r) {
    return String(r.id ?? `auto:${r.linkTypeID}|${r.sourceGid}|${r.targetGid}|${r.targetCredit}`);
}

/** Returns {newRels, removedRels} comparing two snapshots. */
export function diffSnapshots(existing, final) {
    const existingKeys = new Set(existing.map(relKey));
    const finalKeys    = new Set(final.map(relKey));
    return {
        newRels:     final.filter(r => !existingKeys.has(relKey(r))),
        removedRels: existing.filter(r => !finalKeys.has(relKey(r))),
    };
}

/** Flatten every Discogs credit (release + track level) into a uniform shape. */
export function discogsCreditIndex(discogsJson) {
    const out = [];   // [{kind:'company'|'artist', name, role, track:{position,title}|null}]

    for (const c of (discogsJson.companies || [])) {
        out.push({ kind: 'company', name: c.name, role: c.entity_type_name || '', track: null, resourceUrl: c.resource_url });
    }
    for (const a of (discogsJson.extraartists || [])) {
        const roles = (a.role || '').split(/\s*,\s*/).filter(Boolean);
        for (const role of roles) {
            out.push({ kind: 'artist', name: a.name, role, track: null, resourceUrl: a.resource_url, anv: a.anv });
        }
    }
    for (const t of (discogsJson.tracklist || [])) {
        if (t.type_ !== 'track') continue;
        for (const a of (t.extraartists || [])) {
            const roles = (a.role || '').split(/\s*,\s*/).filter(Boolean);
            for (const role of roles) {
                out.push({
                    kind: 'artist', name: a.name, role,
                    track: { position: t.position, title: t.title },
                    resourceUrl: a.resource_url, anv: a.anv,
                });
            }
        }
    }
    return out;
}

/** Build {position-string → recording.gid} map from MB WS2 release JSON. */
export function recordingPositionMap(mbReleaseJson) {
    const m = new Map();
    const isMulti = (mbReleaseJson.media || []).length > 1;
    for (const med of (mbReleaseJson.media || [])) {
        for (const tr of (med.tracks || [])) {
            const gid = tr.recording?.id;
            if (!gid) continue;
            if (med.position != null && tr.position != null) m.set(`${med.position}-${tr.position}`, gid);
            if (med.position != null && tr.number   != null) m.set(`${med.position}-${tr.number}`,   gid);
            if (!isMulti) {
                if (tr.position != null) m.set(String(tr.position), gid);
                if (tr.number   != null) m.set(String(tr.number),   gid);
            }
        }
    }
    return m;
}

/**
 * Run all assertions. Returns {failures, warnings, stats}.
 */
export function runAssertions({ existingRels, finalRels, newRels, discogsJson, mbReleaseJson, linkTypes, attrTypes }) {
    const failures = [];
    const warnings = [];
    const stats = {
        existing: existingRels.length,
        final:    finalRels.length,
        added:    newRels.length,
        byType:   {},
    };

    // Count newRels by linkType name
    for (const r of newRels) {
        const lt = linkTypes[r.linkTypeID];
        const name = lt?.name ?? `id:${r.linkTypeID}`;
        stats.byType[name] = (stats.byType[name] || 0) + 1;
    }

    // ── Assertion 1: every new linkTypeID exists in MB.linkedEntities.link_type
    for (const r of newRels) {
        if (!linkTypes[r.linkTypeID]) {
            failures.push({ kind: 'unknown_link_type', rel: r, msg: `linkTypeID ${r.linkTypeID} not in MB.linkedEntities.link_type` });
        }
    }

    // ── Assertion 1b: no staged rel uses a deprecated link type
    // (MB would reject the commit — that was the original symptom of issue #2)
    for (const r of newRels) {
        const lt = linkTypes[r.linkTypeID];
        if (lt?.deprecated) {
            failures.push({
                kind: 'deprecated_link_type',
                rel:  r,
                msg:  `linkTypeID ${r.linkTypeID} (name="${lt.name}", ${lt.type0}→${lt.type1}) is deprecated — commit would be rejected`,
            });
        }
    }

    // ── Assertion 2: (linkTypeID, sourceType, targetType) triple is valid
    // With `backward: false` source is entity0, so expected sourceType=lt.type0, targetType=lt.type1.
    // With `backward: true`  source is entity1, so expected sourceType=lt.type1, targetType=lt.type0.
    for (const r of newRels) {
        const lt = linkTypes[r.linkTypeID];
        if (!lt) continue;  // covered by #1
        const expectedSource = r.backward ? lt.type1 : lt.type0;
        const expectedTarget = r.backward ? lt.type0 : lt.type1;
        if (expectedSource !== r.sourceType || expectedTarget !== r.targetType) {
            failures.push({
                kind: 'invalid_triple',
                rel: r,
                msg: `linkType "${lt.name}" expects source=${expectedSource}, target=${expectedTarget} but got source=${r.sourceType}, target=${r.targetType}`,
            });
        }
    }

    // ── Assertion 3: every attribute exists in MB.linkedEntities.link_attribute_type
    //    AND is SUPPORTED by the rel's link type (its root is listed in
    //    link_type.attributes). An unsupported attribute makes MB reject the whole
    //    commit ("Attribute N is unsupported for link type M" — #295).
    for (const r of newRels) {
        const lt = linkTypes[r.linkTypeID];
        const supportedRoots = lt ? new Set(Object.keys(lt.attributes || {})) : null;
        for (const a of (r.attrs || [])) {
            const at = attrTypes[a.typeID];
            if (!at) {
                failures.push({
                    kind: 'unknown_attribute',
                    rel: r,
                    msg: `attribute typeID ${a.typeID} (text=${JSON.stringify(a.text_value)}) not in MB.linkedEntities.link_attribute_type`,
                });
                continue;
            }
            const rootId = (at.root_id != null) ? at.root_id : at.id;
            if (supportedRoots && !supportedRoots.has(String(rootId))) {
                failures.push({
                    kind: 'unsupported_attribute',
                    rel: r,
                    msg: `attribute "${at.name}" (typeID ${a.typeID}) is unsupported by link type ${r.linkTypeID} (${lt.name}) — MB would reject the commit`,
                });
            }
        }
    }

    // ── Assertion 6: for track-level new rels, the recording's track position
    // matches a Discogs credit at that same position.
    //
    // Covers both:
    //  - recording-source rels (performer/producer/instrument/etc.) — the
    //    source's own track position is checked.
    //  - work-source rels (writer/composer/lyricist/etc.) — the work is
    //    followed back to the recording it's linked to (via the "recording
    //    of" / "performance" rel found in the snapshot), and THAT recording's
    //    track position is checked.
    //
    // The latter catches the wrong-track-collapse class that bug #4 originally
    // hit (writer credits for tracks 2-13 all landed on track 1's work, but
    // assertion #6 only checked recording-source rels and missed it).
    //
    // Discogs↔MB role-name aliases (Discogs "Written-By" ↔ MB "writer", etc.)
    // are needed because the existing substring matcher fails for those.
    const ROLE_ALIASES = {
        writer:        ['written-by', 'songwriter'],
        composer:      ['composed by', 'composition'],
        lyricist:      ['lyrics by', 'lyrics'],
        arranger:      ['arranged by'],
        producer:      ['producer', 'produced by', 'produced'],
        engineer:      ['engineer', 'engineered by'],
        mix:           ['mixed by', 'mix'],
        mastering:     ['mastered by'],
        performer:     ['performer'],
    };

    function rolesMatch(discogsRole, mbLinkTypeName) {
        const lower = discogsRole.toLowerCase();
        if (lower.includes(mbLinkTypeName)) return true;
        const cRole0 = lower.split(/[\[(,]/)[0].trim();
        if (cRole0 && mbLinkTypeName.includes(cRole0)) return true;
        const aliases = ROLE_ALIASES[mbLinkTypeName] || [];
        return aliases.some(a => lower.includes(a));
    }

    // Build a map: work.gid → { trackPos, medPos } via "performance"/"recording of"
    // rels in the snapshot. Use ALL rels (existing + staged) because a brand-new
    // writer-on-work rel uses a previously-existing recording↔work link.
    const allKnownRels = (finalRels || []).concat(existingRels || []);
    const workToTrack = new Map();
    for (const rel of allKnownRels) {
        if (rel.sourceType === 'recording' && rel.targetType === 'work'
                && rel.targetGid && rel.sourceTrackPos != null) {
            if (!workToTrack.has(rel.targetGid)) {
                workToTrack.set(rel.targetGid, {
                    trackPos: rel.sourceTrackPos,
                    medPos:   rel.sourceMedPos,
                });
            }
        }
    }

    const credits = discogsCreditIndex(discogsJson);
    for (const r of newRels) {
        // Resolve a track position for this rel — directly for recording-source,
        // via workToTrack for work-source. Anything else is out of scope.
        let trackPos, medPos;
        if (r.sourceType === 'recording') {
            if (r.sourceTrackPos == null) continue;
            trackPos = r.sourceTrackPos;
            medPos   = r.sourceMedPos;
        } else if (r.sourceType === 'work') {
            const link = workToTrack.get(r.sourceGid);
            if (!link) continue;   // orphan work — can't verify
            trackPos = link.trackPos;
            medPos   = link.medPos;
        } else {
            continue;
        }

        const credit = (r.targetCredit || r.targetName || '').trim().toLowerCase();
        const ltName = (linkTypes[r.linkTypeID]?.name || '').toLowerCase();
        const compoundPos = medPos ? `${medPos}-${trackPos}` : null;

        const supported = credits.some(c => {
            if (!c.track) return false;
            const cPos = String(c.track.position);
            // Accept both plain and compound match for both candidate forms.
            // Discogs may zero-pad ("1-02") while our trackPos is "2" — so try
            // both as-is and a "1-2"-style unpadded compound.
            const padded   = cPos;
            const unpadded = cPos.replace(/-0+(\d)/g, '-$1');
            const posMatch = padded === trackPos || unpadded === trackPos ||
                             (compoundPos && (padded === compoundPos || unpadded === compoundPos));
            if (!posMatch) return false;

            const nameMatch = c.name.toLowerCase().trim() === credit ||
                              (c.anv || '').toLowerCase().trim() === credit;
            return nameMatch && rolesMatch(c.role, ltName);
        });
        if (!supported) {
            failures.push({
                kind: 'track_mismatch',
                rel: r,
                msg: `${r.sourceType}-source rel "${ltName}" → "${credit}" at track ${trackPos}${compoundPos ? ` (or ${compoundPos})` : ''}: no matching Discogs credit at that position`,
            });
        }
    }

    // ── Assertion 7: placeholder routing sanity ([no artist|label|place] → credited_as = real name, begin_date.year unique)
    const placeholderRels = newRels.filter(r => NO_ENTITY_MBIDS.has(r.targetGid));
    if (placeholderRels.length === 0) {
        // Commit-2 baseline: no placeholder routing yet. Informational only.
    } else {
        // Group by source-entity to check year uniqueness within each source's placeholder rels
        const bySourceLink = new Map();
        for (const r of placeholderRels) {
            const credit = (r.targetCredit || '').trim();
            if (!credit) {
                failures.push({ kind: 'placeholder_no_credit', rel: r, msg: 'placeholder rel missing credited_as' });
            }
            const k = `${r.sourceGid}|${r.linkTypeID}`;
            if (!bySourceLink.has(k)) bySourceLink.set(k, []);
            bySourceLink.get(k).push(r);
        }
        for (const [k, rels] of bySourceLink) {
            const years = rels.map(r => r.beginYear).filter(y => y != null);
            const unique = new Set(years);
            if (years.length !== unique.size) {
                failures.push({
                    kind: 'placeholder_year_dup',
                    msg: `placeholder rels at ${k} have duplicate begin_date.year values: ${years.join(', ')}`,
                });
            }
        }
    }

    // ── Assertion 8: no self-loop (source === target === release)
    const releaseGid = mbReleaseJson.id;
    for (const r of newRels) {
        if (r.sourceGid === releaseGid && r.targetGid === releaseGid) {
            failures.push({ kind: 'self_loop', rel: r, msg: `release-to-release self-loop on linkType ${r.linkTypeID}` });
        }
    }

    return { failures, warnings, stats };
}

/** Fetch JSON with exponential-backoff retry on 429/503 (rate-limit / overload).
 * Runs inside the page so the request originates from MB's own origin (matching
 * the userscript's own throttle path).
 */
async function fetchJsonWithRetry(page, url, label) {
    return await page.evaluate(async ({ url, label }) => {
        const RETRIES = 4;
        for (let attempt = 0; attempt <= RETRIES; attempt++) {
            const res = await fetch(url);
            if (res.ok) return await res.json();
            if (res.status === 429 || res.status === 503) {
                if (attempt === RETRIES) {
                    throw new Error(`${label} ${url} → ${res.status} after ${RETRIES} retries`);
                }
                const retryAfter = parseInt(res.headers.get('Retry-After'), 10);
                const waitMs = retryAfter > 0 ? retryAfter * 1000 : Math.min(1000 * Math.pow(2, attempt), 16_000);
                await new Promise(r => setTimeout(r, waitMs));
                continue;
            }
            throw new Error(`${label} ${url} → ${res.status}`);
        }
    }, { url, label });
}

/** Fetch the Discogs release JSON. */
export async function fetchDiscogsJson(page, discogsUrl) {
    const m = discogsUrl.match(/discogs\.com\/(?:release|releases)\/(\d+)/);
    if (!m) throw new Error(`Cannot parse Discogs URL: ${discogsUrl}`);
    return fetchJsonWithRetry(page, `https://api.discogs.com/releases/${m[1]}`, 'Discogs');
}

/** Fetch the MB release WS2 JSON (with recordings + media). */
export async function fetchMbReleaseJson(page, mbid) {
    return fetchJsonWithRetry(page, `https://musicbrainz.org/ws/2/release/${mbid}?inc=recordings+media&fmt=json`, 'MB WS2');
}

/** Read MB.linkedEntities.{link_type, link_attribute_type} from the page. */
export async function fetchMbLinkedEntities(page) {
    return await page.evaluate(() => {
        const w = /** @type any */ (window);
        return {
            linkTypes: w.MB?.linkedEntities?.link_type || {},
            attrTypes: w.MB?.linkedEntities?.link_attribute_type || {},
        };
    });
}

/**
 * Diagnostic: every link type whose `name`, `link_phrase`, or `reverse_link_phrase`
 * contains the search string (case-insensitive). Used to figure out, e.g.,
 * which exact MB link type powers "orchestra" on a recording (bug #2 fix).
 */
export async function probeLinkTypesByPhrase(page, needles) {
    return await page.evaluate((needlesIn) => {
        const w = /** @type any */ (window);
        const lt = w.MB?.linkedEntities?.link_type || {};
        const lower = (needlesIn || []).map(s => String(s).toLowerCase());
        const out = [];
        for (const v of Object.values(lt)) {
            const blob = [v.name, v.link_phrase, v.reverse_link_phrase, v.long_link_phrase].filter(Boolean).join(' | ').toLowerCase();
            if (lower.some(n => blob.includes(n))) {
                out.push({
                    id:         v.id,
                    name:       v.name,
                    type0:      v.type0,
                    type1:      v.type1,
                    forward:    v.link_phrase,
                    reverse:    v.reverse_link_phrase,
                    deprecated: v.deprecated ?? v.is_deprecated ?? false,
                    rawKeys:    Object.keys(v).sort(),
                });
            }
        }
        return out;
    }, needles);
}

/** Get the Discogs URL the script auto-detected for this release (from the import bar). */
export async function getDetectedDiscogsUrl(page) {
    // #272 turned the bar's Discogs source from an <a> link into a button with no
    // href, so the URL is no longer in the bar DOM. Read it from MB's own URL
    // relationships instead — the same source of truth the script imports from.
    const mbid = (page.url().match(/release\/([0-9a-f-]{36})/i) || [])[1];
    if (!mbid) return null;
    const j = await fetchJsonWithRetry(page, `https://musicbrainz.org/ws/2/release/${mbid}?inc=url-rels&fmt=json`, 'MB url-rels').catch(() => null);
    const rel = j && (j.relations || []).find(r => r.url && /discogs\.com\/(?:[a-z]{2}\/)?(?:release|master)\//i.test(r.url.resource || ''));
    return rel ? rel.url.resource : null;
}
