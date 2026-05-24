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
    for (const r of newRels) {
        for (const a of (r.attrs || [])) {
            if (!attrTypes[a.typeID]) {
                failures.push({
                    kind: 'unknown_attribute',
                    rel: r,
                    msg: `attribute typeID ${a.typeID} (text=${JSON.stringify(a.text_value)}) not in MB.linkedEntities.link_attribute_type`,
                });
            }
        }
    }

    // ── Assertion 6: for track-level new rels, the recording's track position
    // matches a Discogs credit at that same position.
    //
    // Each staged rel carries `sourceTrackPos` (from the medium walk in the snapshot).
    // We accept a rel if a Discogs track credit exists with matching name+role at
    // either the plain position (e.g. "A1", "3") or compound "medPos-trackPos".
    const credits = discogsCreditIndex(discogsJson);
    for (const r of newRels) {
        if (r.sourceType !== 'recording') continue;
        if (r.sourceTrackPos == null)    continue;   // unmapped recording

        const credit = (r.targetCredit || r.targetName || '').trim().toLowerCase();
        const ltName = (linkTypes[r.linkTypeID]?.name || '').toLowerCase();
        const compoundPos = r.sourceMedPos ? `${r.sourceMedPos}-${r.sourceTrackPos}` : null;

        const supported = credits.some(c => {
            if (!c.track) return false;
            const cPos = String(c.track.position);
            const posMatch = cPos === r.sourceTrackPos ||
                             (compoundPos && cPos === compoundPos);
            if (!posMatch) return false;

            const nameMatch = c.name.toLowerCase().trim() === credit ||
                              (c.anv || '').toLowerCase().trim() === credit;
            // Loose role match: ltName may be embedded in c.role (e.g. "Producer [Co]"),
            // or c.role may be a sub-part of ltName.
            const cRole0 = c.role.toLowerCase().split(/[\[(,]/)[0].trim();
            const roleMatch = c.role.toLowerCase().includes(ltName) ||
                              (cRole0 && ltName.includes(cRole0));
            return nameMatch && roleMatch;
        });
        if (!supported) {
            failures.push({
                kind: 'track_mismatch',
                rel: r,
                msg: `track-level rel "${ltName}" → "${credit}" on recording at position ${r.sourceTrackPos}${compoundPos ? ` (or ${compoundPos})` : ''}: no matching Discogs credit at that position`,
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

/** Fetch the Discogs release JSON from MB-side Discogs URL. */
export async function fetchDiscogsJson(page, discogsUrl) {
    // Convert /release/123 to api.discogs.com/releases/123
    const m = discogsUrl.match(/discogs\.com\/(?:release|releases)\/(\d+)/);
    if (!m) throw new Error(`Cannot parse Discogs URL: ${discogsUrl}`);
    const id = m[1];
    return await page.evaluate(async (apiUrl) => {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`Discogs API ${apiUrl} → ${res.status}`);
        return await res.json();
    }, `https://api.discogs.com/releases/${id}`);
}

/** Fetch the MB release WS2 JSON (with recordings) from the page. */
export async function fetchMbReleaseJson(page, mbid) {
    return await page.evaluate(async (mbid_) => {
        const res = await fetch(`https://musicbrainz.org/ws/2/release/${mbid_}?inc=recordings+media&fmt=json`);
        if (!res.ok) throw new Error(`MB WS2 release/${mbid_} → ${res.status}`);
        return await res.json();
    }, mbid);
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

/** Get the Discogs URL the script auto-detected for this release (from the import bar). */
export async function getDetectedDiscogsUrl(page) {
    return await page.evaluate(() => {
        const a = document.querySelector('.discogs-bar .discogs-source a');
        return a?.href || null;
    });
}
