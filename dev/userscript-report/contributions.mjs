// Contributor identity comes from verified GitHub discussion metadata.
export function applyContributions(entries,manifest,exportsByPath){
  const people=new Map(manifest.contributors.map(person=>[person.id,person]));
  const submissions=[...manifest.submissions].sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt)||a.id.localeCompare(b.id));
  return entries.map(entry=>{
    const history=[],acceptedNotes=[];let chosen;const features=(entry.features || []).map(f=>({...f}));
    for(const submission of submissions){
      const item=exportsByPath.get(submission.exportPath)?.entries.find(item=>item.id===entry.id);
      if(!item)continue;
      const author=people.get(submission.authorId);if(!author)throw new Error('Unknown contribution author');
      const contribution={submissionId:submission.id,discussionNumber:submission.discussionNumber,url:submission.url,author,disposition:submission.disposition,verdict:item.review.proposedVerdict || null,reviewedReport:submission.reportVersion};
      history.push(contribution);
      if(submission.disposition!=='accepted'||!submission.acceptedBy)continue;
      if(item.review.proposedVerdict)chosen=contribution;
      if(item.review.note)acceptedNotes.push({...contribution,text:item.review.note,kind:'Review note'});
      for(const comment of item.review.comments || [])acceptedNotes.push({...contribution,text:comment.text,kind:'Comment'});
      for(const [id,change] of Object.entries(item.review.features || {})){
        const feature=features.find(f=>f.id===id);
        if(feature)Object.assign(feature,{weight:change.weight,coverage:change.coverage,comment:change.comment || '',acceptedContribution:contribution});
        else if(change.added)features.push({...change,id,acceptedContribution:contribution});
        else if(change.comment || change.weight!==item.review.basis?.features?.find(f=>f.id===id)?.weight || change.coverage!==item.review.basis?.features?.find(f=>f.id===id)?.coverage){
          const baseline=item.review.basis?.features?.find(f=>f.id===id);
          const changes=[change.comment&&'Note: '+change.comment,baseline&&change.weight!==baseline.weight&&'Weight: '+baseline.weight+' → '+change.weight,baseline&&change.coverage!==baseline.coverage&&'Coverage: '+baseline.coverage+' → '+change.coverage].filter(Boolean);
          if(changes.length)acceptedNotes.push({...contribution,text:(change.name || baseline?.name || id)+' — '+changes.join('; '),kind:'Earlier capability review'});
        }
      }
    }
    return {...entry,features,acceptedNotes,sourceVerdict:entry.verdict,verdict:chosen?.verdict || entry.verdict,contributions:history,acceptedReview:chosen || null};
  });
}
