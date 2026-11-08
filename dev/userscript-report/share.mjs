import { weightedVerdict, effectiveFeatures, hasScoringChanges, weightOptions, verdictLabel } from './review-model.mjs';

export const discussionCategory = '3rd-party';
export const discussionsBase = 'https://github.com/majkinetor/musicbrainz-userscripts/discussions/new';
const md = value=>String(value).replace(/[\r\n]+/g,' ').replace(/[\\`*_{}\[\]<>]/g,'\\$&');
export function changeSummary(item){
  const r=item.review,basis=item.currentBasis || r.basis;
  const weighted=weightedVerdict(effectiveFeatures({features:basis.features || []},r)).verdict;
  const before=basis.baselineVerdict || 'Unassessed';
  const proposed=r.proposedVerdict || (hasScoringChanges({features:basis.features || []},r)?weighted:before);
  const details=[],weightLabel=n=>weightOptions.find(w=>w[0]===n)?.[1] || String(n);
  for(const [id,f] of Object.entries(r.features)){
    const original=(basis.features || r.basis.features || []).find(x=>x.id===id),changes=[];
    if(!original || f.added)changes.push('added capability; weight '+weightLabel(f.weight)+', coverage '+f.coverage);
    else{
      if(f.weight!==(original.weight ?? 5))changes.push('weight '+weightLabel(original.weight ?? 5)+' → '+weightLabel(f.weight));
      if(f.coverage!==original.coverage)changes.push('coverage '+original.coverage+' → '+f.coverage);
    }
    if(f.comment)changes.push('note: '+f.comment);
    else if(original?.comment)changes.push('note removed');
    if(changes.length)details.push('  - Capability **'+md(f.name)+'**: '+changes.map(md).join('; '));
  }
  if(r.note)details.push('  - Note: '+md(r.note));
  for(const c of r.comments)details.push('  - Comment'+(c.updatedAt?' (edited)':'')+': '+md(c.text));
  if(r.draft)details.push('  - Unposted comment: '+md(r.draft));
  if(r.deletedComments?.length)details.push('  - Deleted '+r.deletedComments.length+' comment(s).');
  // Unchanged entries stay in the JSON export but not in the discussion text.
  if(before===proposed&&!details.length)return '';
  const verdict=before===proposed?verdictLabel(proposed)+' (unchanged)':verdictLabel(before)+' → '+verdictLabel(proposed);
  return '- **'+md(item.name || basis.name)+'**: '+md(verdict)+(details.length?'\n'+details.join('\n'):'');
}
export const pastePrompt='The full review summary is on your clipboard: select all of this text and paste over it (Ctrl+A, Ctrl+V), then attach the downloaded JSON review file. Until then, the short list below says what changed.';
export function discussionDraft(bundle){
  const version=bundle.report.reportVersion || bundle.report.sourceManifestSha256;
  const reportLink=bundle.report.permanentUrl;
  const lines=[reportLink?'Report: ['+md(version.slice(0,12))+']('+reportLink+')':'Report version: `'+version+'`',
    'Wiki revision '+bundle.report.wikiRevision+' · toolset `'+bundle.report.toolsetCommit.slice(0,8)+'`','',
    '## Requested changes','',...bundle.entries.map(changeSummary).filter(Boolean),''];
  const json=JSON.stringify(bundle,null,2);
  const inline=lines.join('\n')+'\n<details>\n<summary>Review export (JSON)</summary>\n\n```json\n'+json+'\n```\n\n</details>\n';
  let requiresAttachment=inline.length>50000,body=inline;
  const title='Report '+version.slice(0,12)+': '+bundle.entries.length+' script review(s)';
  const url=new URL(discussionsBase);url.searchParams.set('category',discussionCategory);url.searchParams.set('title',title);
  url.searchParams.set('body',body);
  if(url.href.length>7500){
    // The referenced immutable report contains the original full findings.
    // Avoid repeating those findings and fingerprints in the compose URL.
    const compact={...bundle,entries:bundle.entries.map(item=>({...item,currentBasis:undefined,currentFinding:undefined,review:{...item.review,basis:{name:item.review.basis.name,hash:item.review.basis.hash,sourceIdentity:item.review.basis.sourceIdentity,baselineVerdict:item.review.basis.baselineVerdict}}}))};
    body=lines.join('\n')+'\n<details>\n<summary>Review export (JSON)</summary>\n\n```json\n'+JSON.stringify(compact)+'\n```\n\n</details>\n';
    url.searchParams.set('body',body);
  }
  let requiresPaste=false;
  if(url.href.length>7500){
    // Every change stays in the discussion text. When it does not fit the
    // compose URL, the full body goes to the clipboard and the URL carries
    // only a paste prompt; the JSON export is attached separately.
    requiresAttachment=true;
    body=lines.join('\n')+'\n## Review export\n\nAttach the downloaded JSON review file before publishing. It contains every change, comment and source reference.\n';
    url.searchParams.set('body',body);
    if(url.href.length>7500){
      // Never an empty post: the URL keeps each script's first line (its verdict) while it fits.
      requiresPaste=true;
      const short=bundle.entries.map(changeSummary).filter(Boolean).map(line=>line.split('\n')[0]),kept=[];
      const draft=more=>pastePrompt+'\n\n'+lines.slice(0,2).join('\n')+'\n\n## Requested changes (short)\n\n'+kept.join('\n')+(more?'\n- … and '+more+' more in the JSON export':'')+'\n';
      for(const line of short){kept.push(line);url.searchParams.set('body',draft(short.length-kept.length));if(url.href.length>7500){kept.pop();break;}}
      url.searchParams.set('body',draft(short.length-kept.length));
    }
  }else requiresAttachment=false;
  return {title,body,url:url.href,requiresAttachment,requiresPaste};
}
