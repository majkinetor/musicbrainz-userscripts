import { weightedVerdict, effectiveFeatures, verdictLabel } from './review-model.mjs';

export const discussionCategory = '3rd-party';
export const discussionsBase = 'https://github.com/majkinetor/musicbrainz-userscripts/discussions/new';
const md = value=>String(value).replace(/[\r\n]+/g,' ').replace(/[\\`*_{}\[\]<>]/g,'\\$&');
export function changeSummary(item){
  const r=item.review,basis=item.currentBasis || r.basis;
  const weighted=weightedVerdict(effectiveFeatures({features:basis.features || []},r)).verdict;
  const before=basis.baselineVerdict || 'Unassessed';
  const proposed=r.proposedVerdict || (Object.keys(r.features).length?weighted:before);
  const reasons=[];
  if(Object.keys(r.features).length)reasons.push(Object.keys(r.features).length+' feature edit(s)');
  if(r.note)reasons.push('note');
  if(r.comments.length)reasons.push(r.comments.length+' comment(s)');
  if(r.draft)reasons.push('draft note');
  if(r.deletedComments?.length)reasons.push(r.deletedComments.length+' deleted comment(s)');
  if(r.basis.hash!==basis.hash)reasons.push('earlier review baseline');
  const verdict=before===proposed?verdictLabel(proposed):verdictLabel(before)+' → '+verdictLabel(proposed);
  return '- **'+md(item.name || basis.name)+'**: '+md(verdict)+(reasons.length?' · '+reasons.join(', '):'');
}
export function discussionDraft(bundle){
  const version=bundle.report.reportVersion || bundle.report.sourceManifestSha256;
  const reportLink=bundle.report.permanentUrl;
  const lines=[reportLink?'Report: ['+md(version.slice(0,12))+']('+reportLink+')':'Report version: `'+version+'`',
    'Wiki revision '+bundle.report.wikiRevision+' · toolset `'+bundle.report.toolsetCommit.slice(0,8)+'`','',
    '## Requested changes','',...bundle.entries.map(changeSummary),''];
  const json=JSON.stringify(bundle,null,2);
  const inline=lines.join('\n')+'\n<details>\n<summary>Review export (JSON)</summary>\n\n```json\n'+json+'\n```\n\n</details>\n';
  const requiresAttachment=inline.length>50000;
  const body=requiresAttachment?lines.join('\n')+'\n## Review export\n\nAttach the downloaded JSON review file before publishing this discussion. It contains the full review and original source references.\n':inline;
  const title='Report '+version.slice(0,12)+': '+bundle.entries.length+' script review(s)';
  const url=new URL(discussionsBase);url.searchParams.set('category',discussionCategory);url.searchParams.set('title',title);
  // Large JSON exports stay out of query strings. The visitor pastes the exact
  // copied Markdown or attaches its downloaded JSON while signed in to GitHub.
  return {title,body,url:url.href,requiresAttachment};
}
