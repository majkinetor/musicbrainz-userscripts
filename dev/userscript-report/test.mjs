import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate, reviewState, userscriptText, wikiRevision } from './lib.mjs';
import { parseCatalog } from './catalog.mjs';
import { weightedVerdict, readReviewBundle, mergeReviewEntries } from './review-model.mjs';
import { discussionDraft, changeSummary, pastePrompt } from './share.mjs';
import { applyContributions } from './contributions.mjs';
import {sourceAnalysisState} from './source-analysis.mjs';

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

test('explicit visitor verdict and report version survive export import',()=>{
  const review=makeReview('2026-11-07T10:00:00Z','Comment');
  review.proposedVerdict='Replaceable';review.reportAtReview={reportVersion:'a'.repeat(64),permanentUrl:'https://example.com/reports/a.html'};
  const entries=readReviewBundle({format:'mb-userscript-review',schemaVersion:1,entries:[{id:'example',review}]});
  assert.equal(entries[0].review.proposedVerdict,'Replaceable');assert.equal(entries[0].review.reportAtReview.reportVersion,'a'.repeat(64));
});
test('deleted comments stay deleted when an older export is imported',()=>{
  const old=makeReview('2026-11-07T10:00:00Z','Deleted note');
  const recent={...old,updatedAt:'2026-11-07T11:00:00Z',comments:[],deletedComments:['Deleted note']};
  for(const [existing,incoming] of [[recent,old],[old,recent]]){
    const r=mergeReviewEntries(new Map([['example',existing]]),[{id:'example',review:incoming}]).get('example');
    assert.equal(r.comments.length,0);assert.deepEqual(r.deletedComments,['Deleted note']);
  }
});
test('edited comment text wins over an older copy of the same comment',()=>{
  const old=makeReview('2026-11-07T10:00:00Z','Note');
  const recent=structuredClone(old);recent.comments[0].text='Corrected note';recent.comments[0].updatedAt='2026-11-07T11:00:00Z';
  const r=mergeReviewEntries(new Map([['example',recent]]),[{id:'example',review:old}]).get('example');
  assert.equal(r.comments[0].text,'Corrected note');
});
const sharingFixture=()=>{const review=makeReview('2026-11-07T10:00:00Z','Comment');review.proposedVerdict='Replaceable';review.basis={...review.basis,baselineVerdict:'Mostly replaceable',features:[]};return {format:'mb-userscript-review',schemaVersion:1,report:{reportVersion:'a'.repeat(64),permanentUrl:'https://example.com/reports/a.html',wikiRevision:79510,toolsetCommit:'b'.repeat(40)},entries:[{id:'example',name:'Harmony',currentBasis:review.basis,review}]};};
test('GitHub draft includes concise verdict changes, pinned report and the exact export',()=>{
  const value=sharingFixture(),draft=discussionDraft(value);
  assert.ok(draft.body.includes('**Harmony**: Mostly replaceable → Fully replaceable'));
  assert.ok(draft.body.includes(value.report.permanentUrl));
  assert.equal(new URL(draft.url).searchParams.get('category'),'3rd-party');
  assert.deepEqual(JSON.parse(draft.body.match(/```json\n([\s\S]*?)\n```/)[1]),value);
  assert.equal(new URL(draft.url).searchParams.get('body'),draft.body);
  assert.equal(new URL(draft.url).searchParams.get('title'),draft.title);
  assert.ok(draft.url.length<=7500);
});
test('oversized exports require an attachment rather than truncating feedback',()=>{
  const value=sharingFixture();value.entries[0].review.comments=Array.from({length:4},(_,i)=>({id:String(i),at:'2026-11-07T10:00:00Z',text:'x'.repeat(18000)}));
  const draft=discussionDraft(value);assert.equal(draft.requiresAttachment,true);assert.ok(draft.body.includes('Attach the downloaded JSON'));assert.ok(JSON.stringify(value).length>50000);
  assert.equal(draft.requiresPaste,true);const short=new URL(draft.url).searchParams.get('body');assert.ok(short.startsWith(pastePrompt));assert.match(short,/\*\*Harmony\*\*: Mostly replaceable → Fully replaceable/,'the URL body still names the change');assert.ok(draft.url.length<=7500);
  assert.equal(draft.body.split('x'.repeat(18000)).length,5,'every comment stays in the body to paste');
});
test('discussion text lists every change and leaves out unchanged scripts',()=>{
  const value=sharingFixture(),base=value.entries[0];
  value.entries=Array.from({length:60},(_,i)=>{const e=structuredClone(base);e.id='s'+i;e.name='Script '+i;return e;});
  const same=structuredClone(base);same.id='same';same.name='Unchanged script';same.review.proposedVerdict='';same.review.note='';same.review.draft='';same.review.comments=[];same.review.features={};value.entries.push(same);
  const draft=discussionDraft(value);
  for(let i=0;i<60;i++)assert.ok(draft.body.includes('**Script '+i+'**'));
  assert.ok(!draft.body.includes('Unchanged script'));assert.ok(!draft.body.includes('more changes'));assert.ok(!draft.body.includes('earlier report baseline'));
});
test('a later accepted review supersedes earlier notes on the same capability and scores an assessed addition',()=>{
 const author={id:'one',login:'reviewer'};const sub=(id,at,path)=>({id,authorId:'one',updatedAt:at,exportPath:path,disposition:'accepted',acceptedBy:'majkinetor'});
 const basis={features:[{id:'old',name:'Old workflow',weight:5,coverage:'Unknown'}]};
 const files=new Map([['a',{entries:[{id:'script',review:{basis,features:{old:{name:'Old workflow',weight:5,coverage:'Unknown',comment:'Trivial feature'}}}}]}],
  ['b',{entries:[{id:'script',review:{basis,features:{old:{name:'Old workflow',weight:5,coverage:'Covered'}}}}]}]]);
 const [entry]=applyContributions([{id:'script',verdict:'Partial overlap',features:[{id:'new',name:'Actual capability',coverage:'Covered',weight:5}]}],{contributors:[author],submissions:[sub('1','2026-11-07T01','a'),sub('2','2026-11-07T02','b')]},files);
 assert.equal(entry.acceptedNotes.length,0);assert.equal(entry.features.length,2);assert.equal(entry.verdict,'Replaceable');assert.equal(entry.acceptedReview.submissionId,'2');
});
test('comments alone do not invent a verdict change',()=>{
  const item=sharingFixture().entries[0];item.review.proposedVerdict='';item.review.features={};
  assert.ok(!changeSummary(item).includes('→'));
});

test('the permanent report URL identifies a byte-identical report snapshot',()=>{
  const metadata=JSON.parse(readFileSync(new URL('./out/report.json',import.meta.url),'utf8'));
  assert.match(metadata.version,/^[a-f0-9]{64}$/);
  const current=readFileSync(new URL('./out/index.html',import.meta.url));
  const archived=readFileSync(new URL('./out/reports/'+metadata.version+'.html',import.meta.url));
  assert.deepEqual(current,archived);assert.ok(metadata.url.endsWith('/reports/'+metadata.version+'.html'));
});

test('one contributor can have multiple accepted discussions without losing history',()=>{
  const author={id:'account-1',login:'reviewer',url:'https://github.com/reviewer'};
  const submissions=[{id:'discussion-1',discussionNumber:1,authorId:author.id,updatedAt:'2026-11-01',exportPath:'one.json',disposition:'accepted',acceptedBy:'majkinetor'},
    {id:'discussion-2',discussionNumber:2,authorId:author.id,updatedAt:'2026-11-02',exportPath:'two.json',disposition:'accepted',acceptedBy:'majkinetor'},
    {id:'discussion-3',discussionNumber:3,authorId:author.id,updatedAt:'2026-11-03',exportPath:'three.json',disposition:'proposed'}];
  const files=new Map([['one.json',{entries:[{id:'script',review:{proposedVerdict:'Partial overlap'}}]}],['two.json',{entries:[{id:'script',review:{proposedVerdict:'Replaceable'}}]}],['three.json',{entries:[{id:'script',review:{proposedVerdict:'No equivalent'}}]}]]);
  const [entry]=applyContributions([{id:'script',verdict:'Unassessed'}],{contributors:[author],submissions},files);
  assert.equal(entry.verdict,'Replaceable');assert.equal(entry.sourceVerdict,'Unassessed');assert.equal(entry.contributions.length,3);
  assert.equal(entry.acceptedReview.discussionNumber,2);assert.equal(entry.acceptedReview.author.id,author.id);
});

test('feature notes are visible in Markdown and do not change a verdict',()=>{
 const basis={name:'Harmony',hash:'same',baselineVerdict:'Replaceable',features:[{id:'import',name:'Import release',coverage:'Unknown',weight:5}]};
 const review={note:'',draft:'',features:{import:{name:'Import release',coverage:'Unknown',weight:5,comment:'Trivial feature'}},comments:[],basis};
 const text=changeSummary({id:'example',name:'Harmony',currentBasis:basis,review});
 assert.match(text,/Fully replaceable \(unchanged\)/);assert.match(text,/Capability \*\*Import release\*\*: note: Trivial feature/);assert.doesNotMatch(text,/Needs assessment/);
 review.features.import.coverage='Gap';assert.match(changeSummary({name:'Harmony',currentBasis:basis,review}),/coverage Unknown → Gap/);
});
import { majorReviewState } from './major-review.mjs';
test('quick review reuses identical hashes and invalidates changed source or suite inventory',()=>{
 const review={sourceHash:'one',tools:[],suiteInventoryHash:'inventory',dependencies:[{path:'a.js',sha256:'a'}]};
 const source={state:'captured',sha256:'one'},suite={inventoryHash:'inventory',files:[{path:'a.js',sha256:'a'}]};
 assert.equal(majorReviewState(review,source,suite),'Pinned snapshot');
 assert.equal(majorReviewState(review,{...source,sha256:'two'},suite),'Needs recheck');
 assert.equal(majorReviewState(review,source,{...suite,inventoryHash:'new inventory'}),'Needs recheck');
 assert.equal(majorReviewState(review,source,{...suite,files:[{path:'a.js',sha256:'b'}]}),'Needs recheck');
 assert.equal(majorReviewState(review,{state:'unavailable'},suite),'Source unavailable');
});

test('analysis fingerprints include implementation parts and new relevant suite files',()=>{
 const source={state:'captured',sha256:'readme',implementationHash:'modules'},suite={inventoryHash:'inventory',files:[{path:'userscripts/tool/main.user.js',sha256:'one'}]};
 const analysis={status:'Code analyzed',sourceHash:'modules',tools:['tool'],verdict:'Partial overlap',dependencies:suite.files};
 assert.equal(sourceAnalysisState(analysis,source,suite),'Code analyzed');
 assert.equal(sourceAnalysisState(analysis,{...source,implementationHash:'changed'},suite),'Needs recheck');
 assert.equal(sourceAnalysisState(analysis,source,{...suite,files:[...suite.files,{path:'userscripts/tool/new.user.js',sha256:'new'}]}),'Needs recheck');
 assert.equal(sourceAnalysisState(null,source,suite),'Not analyzed');
 assert.equal(sourceAnalysisState(analysis,{state:'unavailable'},suite),'Source unavailable');
});

test('every positive accepted verdict has an analysis or an explicit unavailable source',()=>{
 const html=readFileSync(new URL('./out/index.html',import.meta.url),'utf8');const data=JSON.parse(html.match(/<script type="application\/json" id="report-data">([\s\S]*?)<\/script>/)[1]);
 const accepted=data.entries.filter(e=>e.acceptedReview);assert.equal(accepted.length,279);
 assert.ok(accepted.filter(e=>!['No equivalent','Not applicable'].includes(e.verdict)).every(e=>e.sourceAnalysis || e.assessment),'every positive verdict has an analysis');
 const harmony=accepted.find(e=>e.name==='Harmony');assert.equal(harmony.features.length,8);
 assert.equal(harmony.verdict,'Mostly replaceable');assert.equal(harmony.sourceVerdict,'Partial overlap');assert.equal(harmony.acceptedReview.discussionNumber,943);
 assert.ok(!harmony.acceptedNotes.some(n=>n.text.includes('Trivial feature')),'#943 supersedes the #942 test note');
 const analyses=JSON.parse(readFileSync(new URL('./data/source-analyses.json',import.meta.url)));assert.equal(analyses.entries.filter(e=>e.status==='Source unavailable').length,3);
 for(const a of analyses.entries.filter(e=>e.status==='Code analyzed')){
  assert.match(a.sourceHash,/^[a-f0-9]{64}$/);assert.ok(a.capabilities.length);assert.ok(a.dependencies.length);
  assert.ok(a.capabilities.every(f=>f.evidence?.some(e=>e.line>0&&e.sha256.length===64)));
 }
});

test('accepted feature notes survive replacing an old aggregate capability',()=>{
 const author={id:'one',login:'reviewer'};const submission={id:'d',authorId:'one',updatedAt:'2026-11-07',exportPath:'export',disposition:'accepted',acceptedBy:'majkinetor'};
 const files=new Map([['export',{entries:[{id:'script',review:{proposedVerdict:'',note:'Overall note',basis:{features:[{id:'old',name:'Old workflow',weight:5,coverage:'Unknown'}]},features:{old:{name:'Old workflow',weight:5,coverage:'Unknown',comment:'Trivial feature'}}}}]}]]);
 const [entry]=applyContributions([{id:'script',verdict:'Partial overlap',features:[{id:'new',name:'Actual capability',coverage:'Gap',weight:5}]}],{contributors:[author],submissions:[submission]},files);
 assert.equal(entry.verdict,'Partial overlap');assert.equal(entry.acceptedReview,null);assert.equal(entry.acceptedNotes.length,2);
 assert.match(entry.acceptedNotes[1].text,/Old workflow — Note: Trivial feature/);assert.equal(entry.features.length,1);
});
