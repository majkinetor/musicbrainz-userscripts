// Unit: #605 — split a combined credit into separate artists, and fan the
// original entity's roles out to the split parts at dispatch.
const { splitCreditName, splitKey, expandSplitRoles } = await import('../src/split-credit.js');

let ok = true;
const check = (label, cond, got) => { console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label + (cond ? '' : '   got: ' + JSON.stringify(got))); if (!cond) ok = false; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const cases = [
    ['George & Ira Gershwin',          ['George Gershwin', 'Ira Gershwin']],   // the #605 release
    ['George & Ira Gershwin (2)',      ['George Gershwin', 'Ira Gershwin']],   // Discogs disambiguation number
    ['Simon & Garfunkel',              ['Simon', 'Garfunkel']],
    ['Lee Perry & Mad Professor',      ['Lee Perry', 'Mad Professor']],
    ['A feat. B',                      ['A', 'B']],
    ['Tom, Dick and Harry Smith',      ['Tom Smith', 'Dick Smith', 'Harry Smith']],
    ['Duke Ellington',                 []],
    ['Andy Anderson',                  []],                                     // "and" inside a word is not a separator
    ['',                               []],
];
for (const [inp, want] of cases) {
    const got = splitCreditName(inp);
    check(`splitCreditName(${JSON.stringify(inp)}) → ${JSON.stringify(want)}`, eq(got, want), got);
}

const orig = { name: 'George & Ira Gershwin', resource_url: 'https://api.discogs.com/artists/640665', anv: '' };
const other = { name: 'Ella Fitzgerald', resource_url: 'https://api.discogs.com/artists/1' };
const key = e => e.resource_url || e._syntheticKey || `_nourl_${e.name}`;
const splits = new Map([[orig.resource_url, [
    { key: splitKey(orig.resource_url, 0), name: 'George Gershwin' },
    { key: splitKey(orig.resource_url, 1), name: 'Ira Gershwin' },
]]]);
const roles = [
    { linkType: 'writer', artist: orig, creditedAs: 'G. & I. Gershwin', track: { position: '8' } },
    { linkType: 'vocal', artist: other, track: { position: '8' } },
];
const out = expandSplitRoles(roles, splits, key);
check('split role fans out to 2, the other role is kept → 3 roles', out.length === 3, out.length);
check('  parts carry the split names', eq(out.slice(0, 2).map(r => r.artist.name), ['George Gershwin', 'Ira Gershwin']), out.map(r => r.artist.name));
check('  parts key to their own review rows', eq(out.slice(0, 2).map(r => key(r.artist)), [splitKey(orig.resource_url, 0), splitKey(orig.resource_url, 1)]));
check('  parts keep link type + track', out.slice(0, 2).every(r => r.linkType === 'writer' && r.track.position === '8'));
check('  combined credited-as is dropped', out.slice(0, 2).every(r => r.creditedAs === ''));
check('  unsplit role untouched', out[2] === roles[1]);
check('no splits → same array back', expandSplitRoles(roles, new Map(), key) === roles);

console.log(ok ? '\nALL PASS' : '\nFAILURES');
process.exit(ok ? 0 : 1);
