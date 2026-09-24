// #605: split one combined source credit ("George & Ira Gershwin") into one
// review row per artist. Pure helpers, shared by the review table (which turns
// a row into N rows) and dispatch (which fans the original entity's roles out
// to the N split artists).

// Same separators Apollo's ⋔ split uses (apollo_editor `SEP_RE`), so a credit
// that splits there splits here too.
const SEP_RE = /\s*(\bfeat\.?|\bft\.?|\bfeaturing|&|\band\b|\bvs\.?|\bwith\b|×|・|,|;)\s*/gi;

const stripDiscogsNum = s => String(s || '').replace(/\s+\(\d+\)$/, '');

/**
 * "George & Ira Gershwin" → ['George Gershwin', 'Ira Gershwin'].
 * Returns [] when the name holds no separator (nothing to split).
 *
 * Shared surname: when every part but the last is a single word and the last
 * has several, the earlier parts are given the last one's final word — the
 * "George & Ira Gershwin" shape. "Simon & Garfunkel" (all single words) and
 * "Lee Perry & Mad Professor" (first part already multi-word) are left alone.
 */
export function splitCreditName(name) {
    const parts = stripDiscogsNum(name).split(SEP_RE)
        .filter((_, i) => i % 2 === 0)
        .map(p => p.trim())
        .filter(Boolean);
    if (parts.length < 2) return [];
    const words = p => p.split(/\s+/);
    const last = words(parts[parts.length - 1]);
    if (last.length > 1 && parts.slice(0, -1).every(p => words(p).length === 1)) {
        const surname = last[last.length - 1];
        return parts.map((p, i) => i === parts.length - 1 ? p : `${p} ${surname}`);
    }
    return parts;
}

/** Key of a split part: stable per (original key, index), never a real source URL. */
export const splitKey = (origKey, i) => `${origKey}#split${i}`;

/**
 * Fan roles out over split entities. `splits` is Map<origKey, [{ key, name }]>;
 * `keyOfEntity` maps a role's artist to the key the review table used. A role
 * whose artist was split becomes one role per part, each carrying a synthetic
 * artist (so the confirmedMap lookup hits the part's own row) and no
 * credited-as — the combined "George & Ira Gershwin" credit belongs to neither.
 */
export function expandSplitRoles(roles, splits, keyOfEntity) {
    if (!splits || !splits.size || !roles) return roles;
    const out = [];
    for (const role of roles) {
        const parts = role?.artist ? splits.get(keyOfEntity(role.artist)) : null;
        if (!parts) { out.push(role); continue; }
        for (const p of parts) {
            out.push({ ...role, creditedAs: '', artist: { name: p.name, anv: '', _syntheticKey: p.key, _splitOf: keyOfEntity(role.artist) } });
        }
    }
    return out;
}
