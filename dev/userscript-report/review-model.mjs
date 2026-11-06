export const coverageValues = ['Covered', 'Partial', 'Gap', 'Unknown'];
export const weightOptions = [[0,'Ignore'],[1,'Minor'],[3,'Normal'],[5,'Important'],[10,'Essential']];

export function weightedVerdict(features) {
  const active = features.filter(f => f.weight > 0);
  if (!active.length) return {verdict:'Not applicable',score:null,total:0,unknown:0};
  const total = active.reduce((n,f) => n + f.weight,0);
  const earned = active.reduce((n,f) => n + f.weight * (f.coverage === 'Covered' ? 1 : f.coverage === 'Partial' ? .5 : 0),0);
  const unknown = active.filter(f => f.coverage === 'Unknown').reduce((n,f) => n + f.weight,0);
  const score = earned === total ? 100 : earned > 0 ? Math.max(1,Math.min(99,Math.round(100 * earned / total))) : 0;
  const ceiling = Math.round(100 * (earned + unknown) / total);
  const essentialGap = active.some(f => f.weight === 10 && f.coverage !== 'Covered');
  const verdict = unknown ? 'Needs assessment' : earned === total ? 'Replaceable' : earned / total >= .75 && !essentialGap ? 'Mostly replaceable' : earned > 0 ? 'Partial overlap' : 'No equivalent';
  return {verdict,score,ceiling,total,unknown,essentialGap};
}

export function effectiveFeatures(entry, record) {
  const features = entry.features.map(f => ({...f,weight:f.weight ?? 5}));
  for (const f of features) {
    const change = record?.features?.[f.id];
    if (change) Object.assign(f, {weight:change.weight,coverage:change.coverage,comment:change.comment || ''});
  }
  // Retain notes for capabilities removed or renamed in a later report.
  for (const [id,f] of Object.entries(record?.features || {})) if (!features.some(x => x.id === id)) features.push({...f,id,retained:!f.added});
  return features;
}

export function readReviewBundle(value) {
  const fail = () => { throw new Error('Invalid review file. Expected a version 1 MusicBrainz review export.'); };
  if (!value || value.format !== 'mb-userscript-review' || value.schemaVersion !== 1 || !Array.isArray(value.entries) || value.entries.length > 2000) fail();
  const seen = new Set();
  const entries = value.entries.map(item => {
    if (!item || typeof item.id !== 'string' || item.id.length > 512 || ['__proto__','constructor','prototype'].includes(item.id) || seen.has(item.id)) fail();
    seen.add(item.id);
    const r = item.review;
    if (!r || !['In progress','Confirmed','Changes requested'].includes(r.status) || typeof r.updatedAt !== 'string' || !Number.isFinite(Date.parse(r.updatedAt))) fail();
    if (!r.basis || typeof r.basis.hash !== 'string' || typeof r.basis.name !== 'string') fail();
    if (typeof r.note !== 'string' || r.note.length > 20000 || (r.draft !== undefined && (typeof r.draft !== 'string' || r.draft.length > 20000)) || !r.features || typeof r.features !== 'object' || Array.isArray(r.features) || Object.keys(r.features).length > 200 || !Array.isArray(r.comments)) fail();
    const features = Object.fromEntries(Object.entries(r.features).map(([id,f]) => {
      if (['__proto__','constructor','prototype'].includes(id) || !f || typeof f.name !== 'string' || f.name.length > 2000 || !weightOptions.some(w => w[0] === f.weight) || !coverageValues.includes(f.coverage) || typeof f.comment !== 'string' || f.comment.length > 20000) fail();
      return [id,{name:f.name,weight:f.weight,coverage:f.coverage,comment:f.comment,added:f.added === true}];
    }));
    const comments = r.comments.map(c => {
      if (!c || typeof c.id !== 'string' || typeof c.text !== 'string' || c.text.length > 20000 || !Number.isFinite(Date.parse(c.at))) fail();
      return {id:c.id,text:c.text,at:c.at};
    });
    return {id:item.id,review:{status:r.status,note:r.note,draft:r.draft || '',features,comments,basis:r.basis,updatedAt:r.updatedAt}};
  });
  return entries;
}

export function mergeReviewEntries(existing, incoming) {
  const next = new Map(existing);
  // Newer edits win on the same record, but retain the union of posted comments.
  for (const {id,review} of incoming) {
    const old = next.get(id);
    if (!old) { next.set(id,review); continue; }
    const winner = Date.parse(review.updatedAt) > Date.parse(old.updatedAt) ? review : old;
    const comments = new Map([...old.comments,...review.comments].map(c => [c.id,c]));
    next.set(id,{...winner,comments:[...comments.values()].sort((a,b) => a.at.localeCompare(b.at))});
  }
  return next;
}
