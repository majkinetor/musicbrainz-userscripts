import { createHash } from 'node:crypto';

export const verdicts = ['Replaceable', 'Mostly replaceable', 'Partial overlap', 'Complementary', 'No equivalent', 'Unassessed / excluded'];
export const repoUrl = 'https://github.com/majkinetor/musicbrainz-userscripts';
export const hash = value => createHash('sha256').update(value).digest('hex');

export function userscriptText(bytes) {
  const text = bytes.toString('utf8');
  if (!text.includes('// ==UserScript==') || /<html[\s>]/i.test(text.slice(0, 300))) throw new Error('Invalid userscript response');
  return text;
}

export function wikiRevision(bytes) {
  const page = JSON.parse(bytes.toString('utf8')).query.pages[0];
  const rev = page.revisions[0];
  const content = rev.slots.main.content;
  if (!content.includes('Userscripts: Importers') || !content.includes('UserscriptList-Source.svg')) throw new Error('Invalid wiki response');
  return rev;
}

export function inputsFor(review, sources) {
  const external = sources.external.find(s => s.id === review.id);
  if (!external) throw new Error('Missing external source: ' + review.id);
  // Negative inventory findings depend on the entire suite. Positive findings
  // depend on the tools inspected; new capabilities still need periodic reconciliation.
  const files = sources.toolset.files.filter(f => !review.tools.length ||
    review.tools.some(t => f.path.startsWith(`userscripts/${t}/`)) ||
    (review.id === 'aliases' && f.path === 'dev/aliases/alias-editor.mjs'));
  return Object.fromEntries([
    ['external:' + external.stableId, external.sha256],
    ['wiki', `${sources.wiki.revision}:${sources.wiki.sha256}`],
    ...files.map(f => [f.path, f.sha256]),
  ].sort(([a], [b]) => a.localeCompare(b, 'en')));
}

export function reviewState(review, sources, asOf = sources.collectedAt) {
  const current = inputsFor(review, sources);
  const old = review.reviewedInputs || {};
  const changed = [...new Set([...Object.keys(old), ...Object.keys(current)])]
    .filter(key => old[key] !== current[key]);
  const age = (new Date(asOf) - new Date(review.reviewedAt)) / 86400000;
  const reasons = changed.map(key => `Changed input: ${key}`);
  if (age > 90) reasons.push('Evidence is more than 90 days old');
  return { status: reasons.length ? 'Needs review' : 'Reviewed snapshot', reasons, changed };
}

export function validate(sources, reviews) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  check(sources.schemaVersion === 1, 'Unsupported source schema');
  check(!Number.isNaN(Date.parse(sources.collectedAt)), 'Invalid collection timestamp');
  check(Number.isInteger(sources.wiki.revision) && /^[a-f0-9]{64}$/.test(sources.wiki.sha256), 'Invalid wiki fingerprint');
  check(/^[a-f0-9]{40}$/.test(sources.toolset.commit), 'Invalid toolset commit');
  const ids = new Set();
  for (const source of sources.external) {
    check(!ids.has(source.id), 'Duplicate source ID'); ids.add(source.id);
    check(/^[a-f0-9]{64}$/.test(source.sha256) && /^[a-f0-9]{40}$/.test(source.commit), 'Invalid external fingerprint');
    check(source.url.startsWith(`https://github.com/${source.repo}/blob/${source.commit}/`), 'Unpinned source URL');
  }
  check(new Set(reviews.map(r => r.id)).size === reviews.length, 'Duplicate review ID');
  for (const row of reviews) {
    check(ids.has(row.id) && verdicts.includes(row.verdict), 'Invalid review identity or verdict');
    check(row.confidence && row.scope && row.summary && row.migration, 'Incomplete assessment');
    check(!Number.isNaN(Date.parse(row.reviewedAt)) && row.reviewer, 'Missing review provenance');
    check(row.reviewedExternal?.sha256 && /^[a-f0-9]{40}$/.test(row.reviewedToolsetCommit), 'Missing assessed versions');
    check(row.reviewedInputs && Object.keys(row.reviewedInputs).length > 2, 'Missing assessment dependencies');
    check(row.capabilities.length && row.evidence.length && row.gaps.length, 'Missing capabilities, evidence or limits');
    for (const cap of row.capabilities) check(cap.id && cap.name && cap.reason && ['Covered', 'Partial', 'Gap'].includes(cap.coverage), 'Invalid capability');
    if (row.verdict === 'Replaceable') check(row.capabilities.every(c => c.coverage === 'Covered'), 'Replacement has an uncovered capability');
    for (const evidence of row.evidence) {
      check(evidence.label && (evidence.line || evidence.anchor), 'Evidence lacks a locator');
      check(evidence.source === 'external' || row.reviewedInputs[evidence.source], 'Evidence source is outside the assessment dependencies');
    }
    reviewState(row, sources);
  }
  return true;
}

export function evidenceUrl(review, evidence) {
  const base = evidence.source === 'external' ? review.reviewedExternal.url :
    `${repoUrl}/blob/${review.reviewedToolsetCommit}/${evidence.source}`;
  return base + (evidence.line ? `#L${evidence.line}` : '#' + evidence.anchor);
}
