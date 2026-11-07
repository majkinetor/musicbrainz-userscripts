// Contributor identity comes from verified GitHub discussion metadata.
export function applyContributions(entries,manifest,exportsByPath){
  const people=new Map(manifest.contributors.map(person=>[person.id,person]));
  const submissions=[...manifest.submissions].sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt)||a.id.localeCompare(b.id));
  return entries.map(entry=>{
    const history=[];let chosen;
    for(const submission of submissions){
      const item=exportsByPath.get(submission.exportPath)?.entries.find(item=>item.id===entry.id);
      if(!item)continue;
      const author=people.get(submission.authorId);if(!author)throw new Error('Unknown contribution author');
      const contribution={submissionId:submission.id,discussionNumber:submission.discussionNumber,url:submission.url,author,disposition:submission.disposition,verdict:item.review.proposedVerdict || null,reviewedReport:submission.reportVersion};
      history.push(contribution);
      if(submission.disposition==='accepted'&&submission.acceptedBy&&item.review.proposedVerdict)chosen=contribution;
    }
    return {...entry,sourceVerdict:entry.verdict,verdict:chosen?.verdict || entry.verdict,contributions:history,acceptedReview:chosen || null};
  });
}
