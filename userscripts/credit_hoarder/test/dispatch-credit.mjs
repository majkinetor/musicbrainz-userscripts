// #210 — dispatchRelationship blanks a "credited as" that equals the target's
// own name (redundant; would split MB grouping), but keeps a real variation.
// Run: node test/dispatch-credit.mjs
import assert from 'node:assert/strict';

// Minimal MB stub so editor-state.js (→ constants.js → window) imports cleanly.
globalThis.window = {
    MB: { tree: { iterate: () => [] }, linkedEntities: { link_type: { 5: { name: 'performer' } } } },
};

const { dispatchRelationship } = await import('../src/editor-state.js');

function dispatchedCredit(credit, targetName) {
    let captured = null;
    const re = { dispatch: a => { captured = a; }, getRelationshipStateId: () => 1 };
    const source = { entityType: 'recording', name: 'A Track' };          // recording > artist → swapped
    const target = { entityType: 'artist', name: targetName, gid: 'gid-1' };
    dispatchRelationship(re, source, target, 5, credit, null, '');
    const st = captured.newRelationshipState;
    // swapped → artist is entity0, so its credit lands in entity0_credit
    return st.entity0_credit;
}

// credited-as identical to the artist name → blanked
assert.equal(dispatchedCredit('Noah Sebastian', 'Noah Sebastian'), '');
// a genuine variation (different casing/spelling) → preserved
assert.equal(dispatchedCredit('noah', 'Noah Sebastian'), 'noah');
// already-empty stays empty
assert.equal(dispatchedCredit('', 'Noah Sebastian'), '');

console.log('dispatch-credit: all assertions passed');
