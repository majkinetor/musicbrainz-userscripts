import { weightedVerdict } from './review-model.mjs';

// Contributor identity comes from verified GitHub discussion metadata.
export function applyContributions(entries,manifest,exportsByPath){
  const people=new Map(manifest.contributors.map(person=>[person.id,person]));
  const submissions=[...manifest.submissions].sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt)||a.id.localeCompare(b.id));
  return entries.map(entry=>{
    let acceptedNotes=[],chosen,weighted;const history=[],features=(entry.features || []).map(f=>({...f}));
    // The same words from the same person, accepted again in a later submission, show once, at the latest.
    const addNote=note=>{acceptedNotes=acceptedNotes.filter(n=>n.text!==note.text||n.author.id!==note.author.id);acceptedNotes.push(note);};
    for(const submission of submissions){
      const item=exportsByPath.get(submission.exportPath)?.entries.find(item=>item.id===entry.id);
      if(!item)continue;
      const author=people.get(submission.authorId);if(!author)throw new Error('Unknown contribution author');
      const contribution={submissionId:submission.id,discussionNumber:submission.discussionNumber,url:submission.url,author,disposition:submission.disposition,verdict:item.review.proposedVerdict || null,reviewedReport:submission.reportVersion};
      history.push(contribution);
      if(submission.disposition!=='accepted'||!submission.acceptedBy)continue;
      if(item.review.proposedVerdict)chosen=contribution;
      if(item.review.note)addNote({...contribution,text:item.review.note,kind:'Review note'});
      for(const comment of item.review.comments || [])addNote({...contribution,text:comment.text,kind:'Comment'});
      let scored=false;
      for(const [id,change] of Object.entries(item.review.features || {})){
        // A later accepted review of a capability supersedes earlier notes on it.
        acceptedNotes=acceptedNotes.filter(note=>note.featureId!==id);
        const feature=features.find(f=>f.id===id);
        if(feature){
          if(change.weight!==(feature.weight ?? 5)||change.coverage!==feature.coverage)scored=true;
          Object.assign(feature,{weight:change.weight,coverage:change.coverage,comment:change.comment || '',acceptedContribution:contribution});
        }else if(change.added||change.coverage!=='Unknown'){
          // An assessed capability the current analysis lacks is kept as an accepted addition.
          scored=true;features.push({...change,id,added:true,acceptedContribution:contribution});
        }else{
          const baseline=item.review.basis?.features?.find(f=>f.id===id);
          const changes=[change.comment&&'Note: '+change.comment,baseline&&change.weight!==baseline.weight&&'Weight: '+baseline.weight+' → '+change.weight,baseline&&change.coverage!==baseline.coverage&&'Coverage: '+baseline.coverage+' → '+change.coverage].filter(Boolean);
          if(changes.length)addNote({...contribution,featureId:id,text:(change.name || baseline?.name || id)+' — '+changes.join('; '),kind:'Earlier capability review'});
        }
      }
      // Without an explicit verdict, accepted scoring changes take the weighted result.
      if(!item.review.proposedVerdict&&scored){
        const verdict=weightedVerdict(features).verdict;
        if(verdict!=='Needs assessment'){weighted={...contribution,verdict};chosen=undefined;}
      }else if(item.review.proposedVerdict)weighted=undefined;
    }
    const accepted=chosen || weighted || null;
    return {...entry,features,acceptedNotes,sourceVerdict:entry.verdict,verdict:accepted?.verdict || entry.verdict,contributions:history,acceptedReview:accepted};
  });
}
