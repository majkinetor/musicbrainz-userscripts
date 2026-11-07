// Public static report: visitor drafts stay local; GitHub handles publication.
const report = JSON.parse(document.getElementById('report-data').textContent);
const byId = new Map(report.entries.map(e=>[e.id,e]));
const rows = new Map([...document.querySelectorAll('.script')].map(el=>[el.dataset.id,el]));
const storageKey = 'mb-userscripts:926:reviews:v1';
let records = new Map(), storageBlocked = false;
const escapeText = v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const textList = values=>'<ul>'+values.map(v=>'<li>'+escapeText(v)+'</li>').join('')+'</ul>';
const safeLink = (url,label)=>/^https?:\/\//i.test(url || '') ? '<a href="'+escapeText(url)+'" target="_blank" rel="noopener noreferrer">'+escapeText(label)+' ↗</a>' : escapeText(label);
const message = text=>{document.getElementById('message').textContent=text;};
const reportRef = ()=>({reportId:report.reportId,reportVersion:report.reportVersion,permanentUrl:report.permanentUrl,wikiRevision:report.wiki.revision,toolsetCommit:report.toolsetCommit,sourceManifestSha256:report.sourceManifestSha256,collectedAt:report.collectedAt});
function bundle(){return {format:'mb-userscript-review',schemaVersion:1,exportedAt:new Date().toISOString(),report:reportRef(),
  purpose:'User review data for AI incorporation. Preserve source provenance, distinguish user preferences from verified evidence, and investigate corrections before replacing original findings.',
  scoringPolicy:{weights:weightOptions,coverageCredit:{Covered:1,Partial:.5,Gap:0},unknown:'Any active unknown coverage yields Needs assessment',essential:'An essential feature not fully covered caps the weighted verdict at Partial overlap',manualVerdict:'proposedVerdict is the visitor-selected verdict; retain the weighted suggestion separately'},
  entries:[...records].map(([id,review])=>{const entry=byId.get(id);return {id,name:entry?.name || review.basis.name,currentBasis:entry?.basis || null,currentFinding:entry?{summary:entry.summary,tools:entry.tools,assessment:entry.assessment}:null,review};})};}
try {
  const raw = localStorage.getItem(storageKey);
  if (raw) records = mergeReviewEntries(new Map(),readReviewBundle(JSON.parse(raw)));
} catch (error) { storageBlocked=true; message('Existing reviews could not be loaded. They have not been overwritten. Import a valid export or export this session before closing.'); }
function updateSaveStatus(){document.getElementById('save-status').textContent=records.size+' edited script(s) · '+(storageBlocked?'not saved in browser — export before closing':'saved in this browser');
  const orphans=[...records.keys()].filter(id=>!byId.has(id));const el=document.getElementById('orphans');el.hidden=!orphans.length;el.textContent=orphans.length+' review(s) refer to entries absent from this report. They are retained in every export.';}
function save(){try {if(storageBlocked)throw new Error();localStorage.setItem(storageKey,JSON.stringify(bundle()));}catch{storageBlocked=true;}updateSaveStatus();}
function recordFor(entry){if(!records.has(entry.id))records.set(entry.id,{status:'In progress',proposedVerdict:'',note:'',draft:'',features:{},comments:[],deletedComments:[],basis:structuredClone(entry.basis),reportAtReview:reportRef(),updatedAt:new Date().toISOString()});return records.get(entry.id);}
function changed(entry,fn){const record=recordFor(entry);fn(record);record.updatedAt=new Date().toISOString();save();updateRow(entry);}
function isStale(entry){return records.has(entry.id)&&records.get(entry.id).basis.hash!==entry.basis.hash;}
function updateRow(entry){const el=rows.get(entry.id),r=records.get(entry.id),personal=el.querySelector('.personal'),marker=el.querySelector('.review-marker');personal.hidden=!r;marker.hidden=!r;
  if(r){const score=weightedVerdict(effectiveFeatures(entry,r));personal.textContent='Yours: '+verdictLabel(r.proposedVerdict || score.verdict);marker.textContent=isStale(entry)?'Needs recheck':r.status;}
  const output=el.querySelector('.weighted');if(output){const result=weightedVerdict(effectiveFeatures(entry,r));output.textContent='Weighted: '+verdictLabel(result.verdict)+(result.score===null?'':result.unknown?' · '+result.score+'–'+result.ceiling+'%':' · '+result.score+'%');}}
function featureChange(entry,id,field,value){const f=effectiveFeatures(entry,records.get(entry.id)).find(x=>x.id===id);changed(entry,r=>{r.features[id]={name:f.name,weight:f.weight,coverage:f.coverage,comment:f.comment || '',added:f.added===true,...r.features[id],[field]:value};});}
function renderDetails(entry){const row=rows.get(entry.id),panel=row.querySelector('.detail'),r=records.get(entry.id),features=effectiveFeatures(entry,r),a=entry.assessment;
  const sourceFreshness=a && Date.now()-Date.parse(a.reviewedAt)>90*86400000?'Needs review · evidence age':a?.freshness.status;
  panel.innerHTML='<div class="meta"><span>'+escapeText(entry.author)+'</span><span>'+escapeText(entry.categories.join(' · '))+'</span><span>'+safeLink(entry.sourceUrl || entry.downloadUrl,'Original source')+'</span><span>'+safeLink(report.wiki.url,'Wiki revision '+report.wiki.revision)+'</span></div>'+
    '<p class="summary-text">'+escapeText(entry.summary)+'</p><p class="dim">'+escapeText(entry.description)+'</p>'+
    (entry.wikiStatus?'<p class="dim">Wiki status (not a replacement verdict): '+escapeText(entry.wikiStatus)+'</p>':'')+
    (a?'<p class="dim compact">'+escapeText(a.confidence)+' confidence · '+escapeText(sourceFreshness)+' · @'+escapeText(entry.basis.sourceVersion || 'unknown')+'</p>':'<p class="dim compact">Source assessment pending</p>')+
    (isStale(entry)?'<p class="warning">The source or assessment changed since your review. Export retains both versions. <button type="button" class="ack">Confirm against this snapshot</button></p>':'')+
    '<div class="review-status"><label>My verdict <select class="my-verdict" data-tip="Your verdict\nChoose directly or keep the weighted suggestion. The report verdict stays unchanged."><option value="">Weighted</option>'+verdictOptions.map(v=>'<option value="'+escapeText(v)+'"'+(r?.proposedVerdict===v?' selected':'')+'>'+escapeText(verdictLabel(v))+'</option>').join('')+'</select></label><label>Status <select class="status" data-tip="Review status\nUse Changes requested for corrections to the next report">'+['In progress','Confirmed','Changes requested'].map(v=>'<option'+(r?.status===v?' selected':'')+'>'+v+'</option>').join('')+'</select></label><span class="weighted" data-tip="Weighted suggestion\nCovered earns full weight; Partial half; Gap zero. Unknown needs assessment. Essential gaps prevent Mostly replaceable."></span></div>'+
    '<h2>Capabilities <button class="help" data-tip="Feature weights\nIgnore (0), Minor (1), Normal (3), Important (5), Essential (10). Essential means you cannot lose this workflow." aria-label="About feature weights">?</button></h2><div class="caps-wrap"><table class="caps"><thead><tr><th>Feature</th><th>Weight</th><th>Coverage</th><th>Note</th></tr></thead><tbody>'+features.map(f=>'<tr data-feature="'+escapeText(f.id)+'"><td>'+escapeText(f.name)+' <button class="help" data-tip="'+escapeText((f.reason || 'Added in your review')+'\nOriginal: '+(entry.features.find(x=>x.id===f.id)?.coverage || 'User-added'))+'" aria-label="Feature evidence">?</button></td><td><select data-field="weight" aria-label="Importance: '+escapeText(f.name)+'">'+weightOptions.map(([value,label])=>'<option value="'+value+'"'+(f.weight===value?' selected':'')+'>'+label+'</option>').join('')+'</select></td><td><select data-field="coverage" aria-label="Coverage: '+escapeText(f.name)+'">'+coverageValues.map(value=>'<option'+(f.coverage===value?' selected':'')+'>'+value+'</option>').join('')+'</select></td><td><textarea data-field="comment" maxlength="20000" aria-label="Comment: '+escapeText(f.name)+'" placeholder="Note" data-tip="Feature note\nExplain a correction or preference. Clear this field to delete it.">'+escapeText(f.comment || '')+'</textarea></td></tr>').join('')+'</tbody></table></div>'+
    '<div class="add-feature"><input class="feature-name" maxlength="2000" aria-label="New feature" placeholder="New feature" data-tip="Add a capability\nIt starts with unknown coverage"><button class="add" type="button">Add</button></div>'+
    (a?'<h3>Important gaps / limitations</h3>'+textList(a.gaps)+'<h3>Switching route</h3><p>'+escapeText(a.migration)+'</p><h3>Pinned evidence</h3><ul class="evidence">'+a.evidence.map(e=>'<li>'+safeLink(e.url,e.label)+'</li>').join('')+'</ul>':'')+
    '<label class="review-note"><span>Note <button class="clear-note plain" type="button" aria-label="Delete note" data-tip="Delete the overall note">✕</button></span><textarea class="note" maxlength="20000" placeholder="Note" data-tip="Review note\nExplain your verdict or correction">'+escapeText(r?.note || '')+'</textarea></label>'+
    '<h3>Comments</h3><ul class="comments">'+(r?.comments || []).map(c=>'<li data-comment="'+escapeText(c.id)+'"><div class="comment-header"><time>'+escapeText(c.at.slice(0,16).replace('T',' '))+(c.updatedAt?' · edited':'')+'</time><div><button class="edit-comment plain" type="button">Edit</button><button class="delete-comment plain" type="button">Delete</button></div></div><p>'+escapeText(c.text)+'</p></li>').join('')+'</ul><div class="post-comment"><textarea class="comment-draft" aria-label="New comment" maxlength="20000" placeholder="Comment" data-tip="Review comment\nSaved locally. Send to GitHub when ready.">'+escapeText(r?.draft || '')+'</textarea><button class="post" type="button">Add comment</button></div>';
  panel.querySelector('.status').onchange=e=>changed(entry,r=>{r.status=e.target.value;});
  panel.querySelector('.my-verdict').onchange=e=>changed(entry,r=>{r.proposedVerdict=e.target.value;});
  panel.querySelector('.ack')?.addEventListener('click',()=>{changed(entry,r=>{r.basis=structuredClone(entry.basis);r.reportAtReview=reportRef();r.status='Confirmed';});renderDetails(entry);});
  panel.querySelectorAll('[data-field]').forEach(control=>control.addEventListener(control.tagName==='TEXTAREA'?'input':'change',()=>featureChange(entry,control.closest('[data-feature]').dataset.feature,control.dataset.field,control.dataset.field==='weight'?Number(control.value):control.value)));
  panel.querySelector('.note').oninput=e=>changed(entry,r=>{r.note=e.target.value;});
  panel.querySelector('.clear-note').onclick=()=>{changed(entry,r=>{r.note='';});panel.querySelector('.note').value='';};
  panel.querySelector('.comment-draft').oninput=e=>changed(entry,r=>{r.draft=e.target.value;});
  panel.querySelector('.post').onclick=()=>{const text=panel.querySelector('.comment-draft').value.trim();if(!text)return;const current=recordFor(entry);if(current.comments.length>=500){message('Comment limit reached; export before starting another review file.');return;}changed(entry,r=>{r.comments.push({id:crypto.randomUUID(),at:new Date().toISOString(),text});r.draft='';});renderDetails(entry);};
  panel.querySelectorAll('.delete-comment').forEach(button=>button.onclick=()=>{const id=button.closest('[data-comment]').dataset.comment;changed(entry,r=>{r.deletedComments=[...new Set([...(r.deletedComments || []),id])];r.comments=r.comments.filter(c=>c.id!==id);});renderDetails(entry);});
  panel.querySelectorAll('.edit-comment').forEach(button=>button.onclick=()=>{const li=button.closest('[data-comment]'),id=li.dataset.comment,c=records.get(entry.id).comments.find(c=>c.id===id);li.innerHTML='<textarea class="comment-edit" aria-label="Edit comment" maxlength="20000">'+escapeText(c.text)+'</textarea><button class="save-comment" type="button">Save</button><button class="cancel-comment" type="button">Cancel</button>';li.querySelector('.save-comment').onclick=()=>{const text=li.querySelector('textarea').value.trim();if(!text){message('Use Delete to remove this comment.');return;}changed(entry,r=>{const comment=r.comments.find(c=>c.id===id);comment.text=text;comment.updatedAt=new Date().toISOString();});renderDetails(entry);};li.querySelector('.cancel-comment').onclick=()=>renderDetails(entry);li.querySelector('textarea').focus();});
  panel.querySelector('.add').onclick=()=>{const name=panel.querySelector('.feature-name').value.trim();if(!name)return;if(Object.keys(recordFor(entry).features).length>=200){message('Feature limit reached.');return;}changed(entry,r=>{r.features['custom:'+crypto.randomUUID()]={name,coverage:'Unknown',weight:5,comment:'',added:true};});renderDetails(entry);};
  updateRow(entry);
}
for(const entry of report.entries){const row=rows.get(entry.id);row.addEventListener('toggle',()=>{if(row.open&&!row.querySelector('.detail').hasChildNodes())renderDetails(entry);if(!row.open)filterRows();});updateRow(entry);}
const controls=['search','verdict','category','tool','review-filter'].map(id=>document.getElementById(id));
function filterRows(){const [search,verdict,category,tool,reviewFilter]=controls.map(c=>c.value);let count=0;
  for(const entry of report.entries){const r=records.get(entry.id);const text=[entry.name,entry.author,entry.description,...entry.tools,...entry.features.map(f=>f.name),r?.note || '',...(r?.comments || []).map(c=>c.text),...Object.values(r?.features || {}).map(f=>f.name+' '+f.comment)].join(' ').toLowerCase();
    const reviewed=!reviewFilter || (reviewFilter==='Not reviewed'?!r:reviewFilter==='Edited'?!!r:reviewFilter==='Needs recheck'?isStale(entry):r?.status===reviewFilter);
    const show=(!search||text.includes(search.toLowerCase()))&&(!verdict||entry.verdict===verdict)&&(!category||entry.categories.includes(category))&&(!tool||entry.tools.includes(tool))&&reviewed;
    rows.get(entry.id).hidden=!show;if(show)count++;}
  document.getElementById('count').textContent=count+' of '+report.entries.length+' entries';document.getElementById('empty').hidden=count!==0;
}
controls.forEach(c=>c.addEventListener(c.id==='search'?'input':'change',filterRows));
document.getElementById('reset').onclick=()=>{controls.forEach(c=>c.value='');filterRows();};
document.getElementById('collapse').onclick=()=>{for(const row of rows.values())row.open=false;};
document.getElementById('export').onclick=()=>{const blob=new Blob([JSON.stringify(bundle(),null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='musicbrainz-reviews-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);message('Exported '+records.size+' review(s), including comments, drafts and source references. Give the JSON file to the AI.');};
document.getElementById('import').onclick=()=>document.getElementById('import-file').click();
document.getElementById('import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>16000000)throw new Error('Review file is larger than 16 MB.');const incoming=readReviewBundle(JSON.parse(await file.text()));records=mergeReviewEntries(records,incoming);save();for(const entry of report.entries){updateRow(entry);if(rows.get(entry.id).open)renderDetails(entry);else rows.get(entry.id).querySelector('.detail').replaceChildren();}filterRows();message('Imported '+incoming.length+' review(s). Newer edits win; posted comments are retained.');}catch(error){message(error.message || 'Import failed; existing reviews were retained.');}finally{e.target.value='';}};
document.getElementById('provenance').innerHTML=safeLink(report.permanentUrl,'Report '+report.reportVersion.slice(0,12))+' · Wiki '+report.wiki.revision+' · Sources '+escapeText(report.collectedAt.slice(0,10));
updateSaveStatus();filterRows();

function downloadReview(){document.getElementById('export').click();}
document.getElementById('github').onclick=()=>{
  if(!records.size){message('Add a verdict, change or comment first.');return;}
  mbuTipHide(true);
  const draft=discussionDraft(bundle());
  document.getElementById('share-version').textContent='Report '+report.reportVersion.slice(0,12)+' · 3rd party';
  document.getElementById('share-summary').innerHTML=textList(bundle().entries.map(changeSummary).map(line=>line.replace(/^- \*\*|\*\*/g,'')));
  document.getElementById('share-body').value=draft.body;
  document.getElementById('share-open').href=draft.url;
  document.getElementById('share-hint').textContent=draft.requiresAttachment?'Copy the draft, attach Download JSON on GitHub, then publish.':'Copy the draft, paste into GitHub, then publish. JSON is included.';
  document.getElementById('share-dialog').showModal();
};
document.getElementById('share-copy').onclick=async()=>{
  const field=document.getElementById('share-body');
  try{await navigator.clipboard.writeText(field.value);document.getElementById('share-hint').textContent='Copied. Paste into GitHub and publish.';}
  catch{field.focus();field.select();document.getElementById('share-hint').textContent='Press Ctrl+C to copy, then open GitHub and paste.';}
};
document.getElementById('share-export').onclick=downloadReview;
