// Quick triage is independent of accepted maintainer outcomes.
export function majorReviewState(review,source,toolset){
 if(!review)return 'Not reviewed';
 if(!source||source.state!=='captured')return 'Source unavailable';
 if(review.sourceHash!==source.sha256)return 'Needs recheck';
 const files=new Map(toolset.files.map(f=>[f.path,f.sha256]));
 if(review.dependencies.some(f=>files.get(f.path)!==f.sha256))return 'Needs recheck';
 if((!review.tools.length||review.suggestedVerdict==='No equivalent')&&review.suiteInventoryHash!==toolset.inventoryHash)return 'Needs recheck';
 return 'Pinned snapshot';
}
