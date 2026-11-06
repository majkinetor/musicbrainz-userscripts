import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate, reviewState, userscriptText, wikiRevision } from './lib.mjs';

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
