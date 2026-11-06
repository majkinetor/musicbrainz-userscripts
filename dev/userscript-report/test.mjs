import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate, reviewState, userscriptText, wikiRevision } from './lib.mjs';
import { parseCatalog } from './catalog.mjs';
import { weightedVerdict, readReviewBundle, mergeReviewEntries } from './review-model.mjs';

const sources = JSON.parse(readFileSync(new URL('./data/sources.json', import.meta.url)));
const reviews = JSON.parse(readFileSync(new URL('./data/reviews.json', import.meta.url)));
const queued = data => reviews.filter(r => reviewState(r, data).status === 'Needs review').map(r => r.id);

test('the published records validate and unchanged inputs require no repeat review', () => {
  assert.equal(validate(sources, reviews), true);
  assert.deepEqual(queued(sources), []);
});
test('one external content change queues its assessment, even without a version bump', () => {
  const next = structuredClone(sources);
  next.external.find(s => s.id === 'bandcamp').sha256 = 'a'.repeat(64);
  assert.deepEqual(queued(next), ['bandcamp']);
});
test('an inlined Mammoth change queues its comparison and negative suite-inventory findings', () => {
  const next = structuredClone(sources);
  next.toolset.files.find(f => f.path === 'userscripts/mammoth/mammoth.user.js').sha256 = 'b'.repeat(64);
  assert.deepEqual(queued(next), ['elephant', 'setlist', 'jasrac']);
});
test('new suite members invalidate negative inventory findings', () => {
  const next = structuredClone(sources);
  next.toolset.files.push({path:'userscripts/new_workflow/README.md',sha256:'c'.repeat(64),version:null});
  assert.deepEqual(queued(next), ['setlist', 'jasrac']);
});
test('changed alias shared source reaches the alias finding', () => {
  const next = structuredClone(sources);
  next.toolset.files.find(f => f.path === 'dev/aliases/alias-editor.mjs').sha256 = 'd'.repeat(64);
  assert.deepEqual(queued(next), ['aliases', 'setlist', 'jasrac']);
});
test('old evidence needs review without a code change', () => {
  const row = structuredClone(reviews[0]);
  row.reviewedAt = '2025-01-01T00:00:00Z';
  assert.match(reviewState(row, sources).reasons.join(), /90 days/);
});
test('replacement cannot hide a capability gap', () => {
  const rows = structuredClone(reviews);
  rows.find(r => r.id === 'aliases').capabilities[0].coverage = 'Gap';
  assert.throws(() => validate(sources, rows), /uncovered capability/);
});
test('browser checks and login HTML cannot be accepted as source snapshots', () => {
  for (const page of ['<html><title>Verifying your browser</title></html>', '<html>Log in</html>']) {
    assert.throws(() => userscriptText(Buffer.from(page)), /Invalid userscript/);
    assert.throws(() => wikiRevision(Buffer.from(page)));
  }
});

test('full inventory expands the Amazon rowspan without merging distinct forks', () => {
  const wiki=readFileSync(new URL('../reports/926-userscript-comparison/wiki-79510.wikitext',import.meta.url),'utf8');
  const entries=parseCatalog(wiki);
  assert.equal(entries.length,293);
  const amazon=entries.filter(e=>e.name==='Import Amazon releases to MusicBrainz');
  assert.equal(amazon.length,2);
  assert.notEqual(amazon[0].stableId,amazon[1].stableId);
  assert.equal(amazon[0].description,amazon[1].description);
  const batch=entries.filter(e=>e.name==='Batch-add "performance of" relationships');
  assert.equal(batch.length,1);
  assert.deepEqual(batch[0].categories,['Userscripts: Works','Userscripts: Recordings']);
  assert.ok(entries.some(e=>e.kind==='Suite entry'));
});
test('weights change the verdict; ignoring a gap removes its influence', () => {
  const features=[{weight:5,coverage:'Covered'},{weight:5,coverage:'Gap'}];
  assert.equal(weightedVerdict(features).verdict,'Partial overlap');
  features[1].weight=1;
  assert.equal(weightedVerdict(features).verdict,'Mostly replaceable');
  features[1].weight=0;
  assert.equal(weightedVerdict(features).verdict,'Replaceable');
});
test('essential gaps and unknown coverage cannot be hidden by many covered features', () => {
  const many=Array.from({length:10},()=>({weight:5,coverage:'Covered'}));
  assert.equal(weightedVerdict([...many,{weight:10,coverage:'Gap'}]).verdict,'Partial overlap');
  assert.equal(weightedVerdict([...many,{weight:1,coverage:'Unknown'}]).verdict,'Needs assessment');
  assert.equal(weightedVerdict([{weight:0,coverage:'Gap'}]).verdict,'Not applicable');
  assert.equal(weightedVerdict([...Array.from({length:199},()=>({weight:10,coverage:'Covered'})),{weight:1,coverage:'Gap'}]).verdict,'Mostly replaceable');
});
const makeReview=(updatedAt,text)=>({status:'In progress',note:'Correction',draft:'Unposted draft',features:{'example.feature':{name:'Example',coverage:'Gap',weight:10,comment:'Important'}},comments:[{id:text,text,at:updatedAt}],basis:{hash:'old-hash',name:'Example'},updatedAt});
test('portable review files retain feature weights, comments, draft and old baseline', () => {
  const r=makeReview('2026-11-06T10:00:00Z','Keep this');
  const parsed=readReviewBundle(JSON.parse(JSON.stringify({format:'mb-userscript-review',schemaVersion:1,entries:[{id:'example',review:r}]})));
  assert.equal(parsed[0].review.features['example.feature'].weight,10);
  assert.equal(parsed[0].review.comments[0].text,'Keep this');
  assert.equal(parsed[0].review.draft,'Unposted draft');
  assert.equal(parsed[0].review.basis.hash,'old-hash');
});
test('merging an older export preserves newer edits and both comment histories', () => {
  const old=makeReview('2026-11-06T10:00:00Z','Old comment');
  const recent=makeReview('2026-11-06T11:00:00Z','Recent comment');recent.note='Newer correction';
  const result=mergeReviewEntries(new Map([['example',recent]]),[{id:'example',review:old},{id:'removed-entry',review:old}]);
  assert.equal(result.get('example').note,'Newer correction');
  assert.equal(result.get('example').comments.length,2);
  assert.ok(result.has('removed-entry'));
});
test('malformed imports cannot apply out-of-range weights or prototype keys', () => {
  const value={format:'mb-userscript-review',schemaVersion:1,entries:[{id:'example',review:makeReview('2026-11-06T10:00:00Z','Comment')}]};
  value.entries[0].review.features['example.feature'].weight=999;
  assert.throws(()=>readReviewBundle(value));
  value.entries[0].review.features['example.feature'].weight=5;
  value.entries[0].id='__proto__';assert.throws(()=>readReviewBundle(value));
});
