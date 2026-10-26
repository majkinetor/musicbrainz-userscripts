// Unit tests for dev/match/artist-match.mjs (#613). node dev/match/test-artist-match.mjs
import {
    mbmFold, mbmSameName, mbmHolds, mbmIdentityQuery, mbmExactIdentity,
    mbmRelatedArtists, mbmContextHolders, mbmCoCreditHits, mbmRankCandidates, MBM_SPECIAL_PURPOSE, MBM_EXACT_LIMIT,
} from './artist-match.mjs';

let fail = 0;
const ck = (c, m, got) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m + (c || got === undefined ? '' : '   got: ' + JSON.stringify(got))); if (!c) fail++; };
const A = (id, name, aliases = [], score) => ({ id, name, aliases: aliases.map(n => ({ name: n })), ...(score != null ? { score } : {}) });

// normalization
ck(mbmFold('  Ståle  Đukić – Ω ') === 'stale dukic - ω', 'fold: accents, đ, dash variants, case, spaces', mbmFold('  Ståle  Đukić – Ω '));
ck(mbmSameName('BEYONCÉ', 'Beyonce') && !mbmSameName('', ''), 'sameName folds, and two empties are not "the same name"');
ck(mbmHolds(A('1', 'Abiodun', ['Don Abi']), 'don abi') === 'alias' && mbmHolds(A('1', 'Abiodun'), 'Abiodun') === 'name', 'holds: by alias / by name');
ck(mbmIdentityQuery('Say "Hi" \\ now') === 'alias:"Say Hi now" OR artist:"Say Hi now"', 'identity query strips quotes/backslashes', mbmIdentityQuery('Say "Hi" \\ now'));
ck(mbmIdentityQuery('Geffen', 'label') === 'alias:"Geffen" OR label:"Geffen"', 'identity query for labels');
ck(MBM_EXACT_LIMIT === 100 && MBM_SPECIAL_PURPOSE.includes('89ad4ac3-39f7-470e-963a-56509c546377'), 'limit 100; Various Artists is special-purpose');

// exact identity — the #613 completeness rule
const donAbi = { count: 1, offset: 0, artists: [A('b4acea3f', 'Abiodun', ['Don Abi', 'Abiodun Odukoya'])] };
let r = mbmExactIdentity(donAbi, 'Don Abi');
ck(r.status === 'unique' && r.hit.id === 'b4acea3f' && r.via === 'alias', '"Don Abi": complete (1 match), one alias holder → unique via alias (#442)', r.status);
const kim = { count: 2777, offset: 0, artists: [A('k1', 'Kim Wilde'), A('k2', 'Kim Carnes'), A('k3', 'Kim')] };
r = mbmExactIdentity(kim, 'Kim');
ck(r.status === 'incomplete' && r.exact.length === 1, '"Kim": one exact holder seen but 2,777 matches → incomplete, NOT unique (the old false-unique)', r.status);
const djsun = { count: 3, offset: 0, artists: [A('d1', 'DJ Sun'), A('d2', 'DJ Sun'), A('d3', 'DJ Sun')] };
ck(mbmExactIdentity(djsun, 'DJ Sun').status === 'ambiguous', '"DJ Sun": 3 exact holders → ambiguous');
ck(mbmExactIdentity({ count: 2, artists: [A('x', 'Other'), A('y', 'Else')] }, 'Nobody').status === 'none', 'complete and nobody holds it → none');
ck(mbmExactIdentity(null, 'X').status === 'failed' && mbmExactIdentity(undefined, 'X').exact.length === 0, 'no response → failed (never cache as "none")');
const teto = { count: 2, artists: [A('t1', 'kasane teto'), A('t2', 'Someone', ['Kasane Teto'])] };
r = mbmExactIdentity(teto, 'Kasane Teto');
ck(r.status === 'unique' && r.hit.id === 't2', 'case-exact tie-break: exactly one holds it WITH case → that one (#445)', r.hit && r.hit.id);
const geffen = { count: 2, labels: [A('g1', 'Geffen Records', [], 100), A('g2', 'Geffen Records', [], 45)] };
ck(mbmExactIdentity(geffen, 'Geffen Records').status === 'ambiguous', 'labels without scoreGap: two exact → ambiguous (artists stay strict)');
r = mbmExactIdentity(geffen, 'Geffen Records', { scoreGap: 20 });
ck(r.status === 'unique' && r.hit.id === 'g1', 'scoreGap 20 (Group Therapy labels, #522): 100 vs 45 → the top one', r.status);
ck(mbmExactIdentity({ count: 3, offset: 0, artists: [A('a', 'X'), A('b', 'Y')] }, 'X').status === 'incomplete', 'count 3 but only 2 returned → incomplete even with a single holder');

// #612 context
const band = { id: 'band', name: 'The Band', aliases: [{ name: 'Band, The' }], relations: [
    { type: 'member of band', artist: { id: 'm1', name: 'Joni' } },
    { type: 'member of band', artist: { id: 'm2', name: 'Robbie Robertson' } },
    { type: 'collaboration', artist: { id: 'm2', name: 'Robbie Robertson' } },
    { type: 'url', url: { resource: 'https://x' } },
] };
const rel = mbmRelatedArtists(band);
ck(rel.length === 3 && rel[0].rel === 'self' && rel[0].aliases[0] === 'Band, The', 'related set: self (+aliases) + each related artist once, url rels ignored', rel.map(x => x.gid));
let ctx = mbmContextHolders(rel, 'Joni');
ck(ctx.length === 1 && ctx[0].gid === 'm1' && ctx[0].via === 'name', '"Joni" (globally ambiguous) is exactly one member → context hit', ctx);
ctx = mbmContextHolders(rel, 'Robbie', [A('m2', 'Robbie Robertson', ['Robbie'])]);
ck(ctx.length === 1 && ctx[0].gid === 'm2' && ctx[0].via === 'alias', 'C4: an alias seen on a search candidate with the same MBID counts, no extra request', ctx);
ck(mbmContextHolders(rel, 'Nobody').length === 0 && mbmRelatedArtists(null).length === 0, 'no holder → empty; no artist json → empty set');

// #437 co-credit
const recs = { recordings: [
    { 'artist-credit': [{ name: 'Sidney Samson', artist: { id: 'ctx', name: 'Sidney Samson' } }, { name: 'Joni', artist: { id: 'j1', name: 'Joni' } }] },
    { 'artist-credit': [{ name: 'Sidney Samson', artist: { id: 'ctx', name: 'Sidney Samson' } }, { name: 'Joni', artist: { id: 'j1', name: 'Joni' } }] },
    { 'artist-credit': [{ name: 'Sidney Samson', artist: { id: 'ctx', name: 'Sidney Samson' } }, { name: 'Someone Else', artist: { id: 'z', name: 'Someone Else' } }] },
] };
const hits = mbmCoCreditHits(recs, 'ctx', 'joni');
ck(hits.length === 1 && hits[0].gid === 'j1', 'co-credit: the artist credited as the name next to the context artist, deduped', hits);

// #798 ranking on release evidence
const C = (gid, name, extra = {}) => ({ gid, name, aliases: [], ...extra });
const smiths = [C('s1', 'John Smith', { type: 'Person', score: 100 }), C('s2', 'John Smith', { type: 'Person', score: 100 }), C('s3', 'John Smith', { type: 'Group', score: 90 })];
let rk = mbmRankCandidates('John Smith', smiths, {});
ck(!rk.best && rk.ranked.length === 3, 'three same-named, no evidence → no pick', rk.best);
rk = mbmRankCandidates('John Smith', smiths, { related: [{ gid: 's2', rel: 'member of band', of: 'Toto' }] });
ck(rk.best && rk.best.gid === 's2' && rk.best.level === 'strong' && rk.ranked[0].reasons.some(x => x.text === 'related' && /member of band · Toto/.test(x.tip)), 'a member of the release artist → strong pick, with the reason', rk.best);
rk = mbmRankCandidates('John Smith', smiths, { known: [{ gid: 's1', why: 'track 4 producer' }], related: [{ gid: 's2', rel: 'member of band', of: 'Toto' }] });
ck(!rk.best && rk.ranked[0].gid === 's1', 'already credited ranks above a related artist, but two backed candidates are left to you', rk.best);
rk = mbmRankCandidates('John Smith', smiths, { remembered: 's3', known: [{ gid: 's1', why: 'x' }] });
ck(!rk.best && rk.ranked[0].gid === 's3', 'your earlier pick ranks first; the release backs another, so no pick', rk.best);
rk = mbmRankCandidates('Don Abi', [C('a1', 'Abiodun', { aliases: [{ name: 'Don Abi' }] }), C('a2', 'Don Abiola')], { unique: 'a1' });
ck(rk.best && rk.best.gid === 'a1' && rk.best.level === 'unique', 'the only holder → unique pick', rk.best);
rk = mbmRankCandidates('Kim', [C('k1', 'Kim', { type: 'Person', begin: 1990 }), C('k2', 'Kim', { type: 'Person', begin: 1950 })], { year: 1975, want: 'person' });
ck(rk.ranked[0].gid === 'k2' && rk.ranked[1].reasons.some(x => x.text === 'born 1990' && x.sign < 0), 'born after the release ranks lower, and says so', rk.ranked.map(x => x.gid));
rk = mbmRankCandidates('Kim', [C('k1', 'Kim', { type: 'Group' }), C('k2', 'Kim', { type: 'Person' })], { want: 'person' });
ck(rk.ranked[0].gid === 'k2' && rk.ranked[1].reasons.some(x => x.text === 'a group'), 'a group ranks below a person for an instrument role', rk.ranked.map(x => x.gid));
rk = mbmRankCandidates('Kim', [C('89ad4ac3-39f7-470e-963a-56509c546377', 'Kim')], { unique: '89ad4ac3-39f7-470e-963a-56509c546377' });
ck(!rk.ranked.length && !rk.best, 'a special-purpose artist is never a candidate');
rk = mbmRankCandidates('Joni', [C('j1', 'Joni Mitchell', { score: 80 })], {});
ck(!rk.best, 'a weak candidate that does not even hold the name is never picked', rk.best);
rk = mbmRankCandidates('John Smith', smiths, { sibling: [{ gid: 's3', why: 'producer on “X (deluxe)”' }] });
ck(rk.best && rk.best.gid === 's3' && rk.best.level === 'strong' && rk.ranked[0].reasons.some(x => x.text === 'same group' && /deluxe/.test(x.tip)), 'step 4: credited on another release of the group → strong pick, with the release', rk.best);
rk = mbmRankCandidates('John Smith', smiths, { cocredit: [{ gid: 's1', n: 3, of: 'Toto' }] });
ck(rk.best && rk.best.gid === 's1' && rk.ranked[0].reasons.some(x => x.text === 'co-credit' && /beside Toto on 3 recordings/.test(x.tip)), 'step 4: credited beside the release artist → strong pick', rk.best);
rk = mbmRankCandidates('John Smith', smiths, { history: [{ gid: 's1', role: 'mastering', n: 0 }, { gid: 's2', role: 'mastering', n: 12, where: 'release · recording' }, { gid: 's3', role: 'mastering', n: 0 }] });
ck(rk.best && rk.best.gid === 's2' && rk.best.level === 'strong' && rk.ranked[0].reasons.some(x => x.text === 'mastering ×12') && rk.ranked[1].reasons.some(x => x.text === 'never mastering' && x.sign < 0), 'role history: the one who held the role is picked, the others say they never did', rk.ranked.map(x => x.reasons));
rk = mbmRankCandidates('John Smith', smiths, { known: [{ gid: 's1', why: 'x' }], sibling: [{ gid: 's1', why: 'y' }] });
ck(!rk.ranked[0].reasons.some(x => x.text === 'same group'), 'step 4: on the release already, the group adds nothing', rk.ranked[0].reasons);

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
