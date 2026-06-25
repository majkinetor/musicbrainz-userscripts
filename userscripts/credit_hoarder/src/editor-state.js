// MusicBrainz relationship-editor state interactions.
//
// Three functions talk directly to `MB.relationshipEditor` and friends:
//   - waitForMBEditor: poll until the React editor mounts.
//   - dispatchRelationship: feed a relationship into MB's React reducer.
//   - buildAttributes: turn the script's mixed attribute representation
//     into MB's internal ImmutableTree shape via `MB.tree.fromDistinctAscArray`.

import { pageWindow, REL_TEMPLATE } from './constants.js';
import { log }               from './log.js';

/** Poll for MB.relationshipEditor.state.entity with verbose log feedback. */
export async function waitForMBEditor(timeoutMs = 15000) {
    log.info('Waiting for MB relationship editor…');
    let waited = 0;
    while (waited < timeoutMs) {
        const MB = pageWindow.MB;
        const re = MB?.relationshipEditor;
        const st = re?.state;
        if (st?.entity) {
            log.info(`Editor ready (${waited}ms). Release: "${st.entity.name}"`);
            return re;
        }
        if (waited % 2000 === 0 && waited > 0) {
            const mbKeys = MB ? Object.keys(MB).join(', ') : 'undefined';
            const reKeys = re ? Object.keys(re).join(', ') : 'undefined';
            const stKeys = st ? Object.keys(st).join(', ') : 'undefined';
            log.info(`[${waited}ms] MB={${mbKeys}} re={${reKeys}} state={${stKeys}}`);
        }
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
    }
    log.error('MB editor not ready after 15s — aborting');
    return null;
}

/**
 * Dispatch one relationship into MB's React editor state.
 * `sourceEntity` and `targetEntity` are full MB entity objects (from
 * `/ws/js/entity/`). `credit` is the "credited as" string (may be empty).
 * `attributes` is an MB ImmutableTree (the kind `buildAttributes` returns)
 * or null.
 *
 * MB requires entity0 to be the lower entityType (alphabetically); the
 * function swaps source/target if necessary and routes credits to the
 * correct side.
 */
export function dispatchRelationship(re, sourceEntity, targetEntity, linkTypeID, credit, attributes, trackPos) {
    // A "credited as" identical to the target's own name is redundant: MB stores
    // it as blank, and dispatching a non-blank duplicate prevents MB from
    // grouping/merging this rel with ones that (correctly) have none — e.g.
    // manually-added rels — so the same artist shows as two split entries
    // instead of a single "Name (tracks 1–4)". Blank it. #210
    if (credit && credit === (targetEntity.name || '')) credit = '';
    const swapped = sourceEntity.entityType > targetEntity.entityType;
    const e0 = swapped ? targetEntity : sourceEntity;
    const e1 = swapped ? sourceEntity : targetEntity;
    // Resolve link type name and attribute values for the log
    const ltEntry = pageWindow.MB?.linkedEntities?.link_type?.[linkTypeID];
    const ltName = ltEntry ? ltEntry.name : linkTypeID;
    let attrDesc = '';
    if (attributes) {
        try {
            const parts = [];
            for (const a of pageWindow.MB.tree.iterate(attributes)) {
                const n = a.type?.name || a.typeID;
                const v = a.text_value ? `=${a.text_value}` : '';
                if (n) parts.push(n + v);
            }
            if (parts.length) attrDesc = ` [${parts.join(', ')}]`;
        } catch(e) {}
    }
    const posLabel = (trackPos != null && trackPos !== '') ? ` <span style="color:#888;font-size:0.85em">#${trackPos}</span>` : '';
    log.info(`→ <strong>${ltName}</strong>${attrDesc}${posLabel}: ${sourceEntity.name || sourceEntity.gid} ↔ ${targetEntity.name || targetEntity.gid}${credit && credit !== (targetEntity.name || targetEntity.gid) ? ` (credited: ${credit})` : ''}`);
    re.dispatch({
        type: 'update-relationship-state',
        sourceEntity,
        batchSelectionCount: null,
        creditsToChangeForSource: '',
        creditsToChangeForTarget: '',
        oldRelationshipState: null,
        newRelationshipState: {
            ...REL_TEMPLATE,
            entity0: e0,
            entity0_credit: swapped ? (credit || '') : '',
            entity1: e1,
            entity1_credit: swapped ? '' : (credit || ''),
            id: re.getRelationshipStateId(),
            linkTypeID,
            attributes: attributes || null,
        },
    });
}

/**
 * Build an MB attribute ImmutableTree from a mixed attributes array.
 * Handles:
 *   - strings: 'additional', 'guest', 'solo' → checkbox attributes
 *   - structured: { _type: 'instrument'|'vocal'|'task', value: '...' }
 *   - functions: extract the value they would set via toString() parsing
 *     (legacy format: `() => setValueOnAutocomplete(selector, value)`)
 *
 * Attributes whose name doesn't resolve to a known MB attribute type are
 * dropped with a WARN log; the relationship is still dispatched (without
 * the attribute). This prevents fabricated attribute names like `[co]`
 * from blocking the commit (issue #3).
 *
 * Returns the ImmutableTree, or `null` if no attributes survive.
 */
export function buildAttributes(rawAttributes, linkTypeID) {
    if (!rawAttributes || rawAttributes.length === 0) return null;
    const MB = pageWindow.MB;
    const tree = MB?.tree;
    const lat = MB?.linkedEntities?.link_attribute_type;
    if (!tree || !lat) return null;

    // Attributes a link type accepts are listed (by ROOT attribute id) on the
    // link type itself — e.g. the "instrument" rel keys its instrument root (14),
    // the "misc" rel (id 25) keys only "task" (1150). Adding one it doesn't accept
    // makes MB reject the WHOLE commit ("Attribute N is unsupported for link type M",
    // #295 — `assistant` on a misc role). Drop the unsupported attribute and keep the
    // rel, same as we already do for unknown attributes.
    const linkType = (linkTypeID != null) ? MB?.linkedEntities?.link_type?.[linkTypeID] : null;
    const supportedRoots = linkType ? new Set(Object.keys(linkType.attributes || {})) : null;
    const attrSupported = found => {
        if (!supportedRoots) return true;   // no link type context → can't check; leave as-is
        const rootId = (found.root_id != null) ? found.root_id : found.id;
        return supportedRoots.has(String(rootId));
    };

    function findAttrByName(name) {
        const lower = name.toLowerCase().trim();
        // Exact match
        for (const v of Object.values(lat)) {
            if (v.name?.toLowerCase() === lower) return v;
        }
        // Partial/root match — "drums" may be under a parent "drum kit" or
        // vice versa. Require BOTH the needle and the candidate to be at
        // least 4 chars to avoid the "co" → "concertina" class of false
        // positive that triggered issue #3. Anything shorter that doesn't
        // hit the exact-match arm above is treated as an unknown attribute.
        if (lower.length >= 4) {
            for (const v of Object.values(lat)) {
                const vl = v.name?.toLowerCase() || '';
                if (vl.length < 4) continue;
                if (vl.includes(lower) || lower.includes(vl)) return v;
            }
        }
        log.warn(`Attribute "${name}" not found in MB — dropping attribute but keeping the rel`);
        return null;
    }

    // Extract string value from a legacy function attribute by inspecting its source
    function extractFnValue(fn) {
        const src = fn.toString();
        // Match: setValueOnAutocomplete(SELECTORS.X, 'value') or setNativeValue(el, 'value')
        const m = src.match(/,\s*['"`]([^'"`]+)['"`]\s*\)/);
        return m ? m[1] : null;
    }

    const attrObjs = [];
    const seen = new Set();
    for (const attr of rawAttributes) {
        let attrName = null;
        let textValue = '';
        let creditedAs = '';
        if (typeof attr === 'string') {
            // Checkbox-style: 'additional', 'guest', 'solo'
            attrName = attr;
        } else if (attr && typeof attr === 'object' && attr._type) {
            // Structured: { _type: 'instrument'|'vocal'|'task', value: '...' }
            if (attr._type === 'task') {
                // Task is a free-text attribute — look up the "task" type, set text_value
                attrName = 'task';
                textValue = attr.value;
            } else {
                attrName = attr.value;
            }
            // #233: per-attribute credited-as (e.g. a vocal credited "spoken vocals [Michal]")
            if (attr.creditedAs) creditedAs = attr.creditedAs;
        } else if (typeof attr === 'function') {
            // Legacy function attribute — extract quoted string from source
            attrName = extractFnValue(attr);
        }
        if (!attrName) continue;
        const found = findAttrByName(attrName);
        if (!found || seen.has(found.id)) continue;
        if (!attrSupported(found)) {
            log.warn(`Attribute "${found.name}" isn't supported by link type "${linkType.name || linkTypeID}" — dropping it (keeping the rel)`);
            continue;
        }
        seen.add(found.id);
        attrObjs.push({ type: found, typeID: found.id, credited_as: creditedAs, text_value: textValue });
    }
    if (attrObjs.length === 0) return null;
    attrObjs.sort((a, b) => a.typeID - b.typeID);
    try {
        return tree.fromDistinctAscArray(attrObjs);
    } catch(e) {
        log.warn(`Attribute tree build failed (${e.message}) — importing without attributes`);
        return null;
    }
}
