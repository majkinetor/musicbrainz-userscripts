// MusicBrainz relationship-editor state interactions.
//
// Three functions talk directly to `MB.relationshipEditor` and friends:
//   - waitForMBEditor: poll until the React editor mounts.
//   - dispatchRelationship: feed a relationship into MB's React reducer.
//   - buildAttributes: turn the script's mixed attribute representation
//     into MB's internal ImmutableTree shape via `MB.tree.fromDistinctAscArray`.

import { pageWindow, REL_TEMPLATE } from './constants.js';
import { addLogLine }               from './log.js';

/** Poll for MB.relationshipEditor.state.entity with verbose log feedback. */
export async function waitForMBEditor(timeoutMs = 15000) {
    addLogLine('Waiting for MB relationship editor…');
    let waited = 0;
    while (waited < timeoutMs) {
        const MB = pageWindow.MB;
        const re = MB?.relationshipEditor;
        const st = re?.state;
        if (st?.entity) {
            addLogLine(`Editor ready (${waited}ms). Release: "${st.entity.name}"`);
            return re;
        }
        if (waited % 2000 === 0 && waited > 0) {
            const mbKeys = MB ? Object.keys(MB).join(', ') : 'undefined';
            const reKeys = re ? Object.keys(re).join(', ') : 'undefined';
            const stKeys = st ? Object.keys(st).join(', ') : 'undefined';
            addLogLine(`[${waited}ms] MB={${mbKeys}} re={${reKeys}} state={${stKeys}}`);
        }
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
    }
    addLogLine('<span style="color:red">ERR MB editor not ready after 15s — aborting</span>');
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
    addLogLine(`→ <strong>${ltName}</strong>${attrDesc}${posLabel}: ${sourceEntity.name || sourceEntity.gid} ↔ ${targetEntity.name || targetEntity.gid}${credit && credit !== (targetEntity.name || targetEntity.gid) ? ` (credited: ${credit})` : ''}`);
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
export function buildAttributes(rawAttributes) {
    if (!rawAttributes || rawAttributes.length === 0) return null;
    const MB = pageWindow.MB;
    const tree = MB?.tree;
    const lat = MB?.linkedEntities?.link_attribute_type;
    if (!tree || !lat) return null;

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
        addLogLine(`<span style="color:orange">WARN Attribute "${name}" not found in MB — dropping attribute but keeping the rel</span>`);
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
        } else if (typeof attr === 'function') {
            // Legacy function attribute — extract quoted string from source
            attrName = extractFnValue(attr);
        }
        if (!attrName) continue;
        const found = findAttrByName(attrName);
        if (!found || seen.has(found.id)) continue;
        seen.add(found.id);
        attrObjs.push({ type: found, typeID: found.id, credited_as: '', text_value: textValue });
    }
    if (attrObjs.length === 0) return null;
    attrObjs.sort((a, b) => a.typeID - b.typeID);
    try {
        return tree.fromDistinctAscArray(attrObjs);
    } catch(e) {
        addLogLine(`<span style="color:orange">WARN Attribute tree build failed (${e.message}) — importing without attributes</span>`);
        return null;
    }
}
