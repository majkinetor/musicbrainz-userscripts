// Public static report: visitor drafts stay local; GitHub handles publication.
const report = JSON.parse(document.getElementById('report-data').textContent);
const byId = new Map(report.entries.map(e=>[e.id,e]));
const rows = new Map([...document.querySelectorAll('.script')].map(el=>[el.dataset.id,el]));
const storageKey = 'mb-userscripts:926:reviews:v1';
let records = new Map(), storageBlocked = false;
const openPanels = new Map();
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
function recordFor(entry){if(!records.has(entry.id))records.set(entry.id,{proposedVerdict:'',note:'',draft:'',features:{},comments:[],deletedComments:[],basis:structuredClone(entry.basis),reportAtReview:reportRef(),updatedAt:new Date().toISOString()});return records.get(entry.id);}
function changed(entry,fn){const record=recordFor(entry);fn(record);record.updatedAt=new Date().toISOString();save();updateRow(entry);}
function isStale(entry){return records.has(entry.id)&&records.get(entry.id).basis.hash!==entry.basis.hash;}
function updateRow(entry){const el=rows.get(entry.id),r=records.get(entry.id),personal=el.querySelector('.personal'),marker=el.querySelector('.review-marker');personal.hidden=!r;marker.hidden=!r||!isStale(entry);
  if(r){const score=weightedVerdict(effectiveFeatures(entry,r));personal.textContent='Yours: '+verdictLabel(r.proposedVerdict || (hasScoringChanges(entry,r)?score.verdict:entry.verdict));marker.textContent='Needs recheck';}
  el.querySelectorAll('.my-verdict,.row-verdict').forEach(select=>select.value=r?.proposedVerdict || '');
  el.querySelector('.row-note').textContent=r?.note?'Edit note':'Note';el.querySelector('.row-revert').hidden=!r;
  const note=el.querySelector('.note');if(note&&document.activeElement!==note){note.value=r?.note || '';growNote(note);}
  const output=el.querySelector('.weighted');if(output){const result=weightedVerdict(effectiveFeatures(entry,r));output.textContent='Weighted: '+verdictLabel(result.verdict)+(result.score===null?'':result.unknown?' · '+result.score+'–'+result.ceiling+'%':' · '+result.score+'%');}}
function featureChange(entry,id,field,value){const f=effectiveFeatures(entry,records.get(entry.id)).find(x=>x.id===id);changed(entry,r=>{r.features[id]={name:f.name,weight:f.weight,coverage:f.coverage,comment:f.comment || '',added:f.added===true,...r.features[id],[field]:value};});}
function sourceEvidenceHtml(entry){
 const a=entry.sourceAnalysis,source=a?.source;
 if(!a)return entry.assessment?'<details class="source-evidence"><summary>Evidence & versions</summary><p>'+escapeText(entry.assessment.scope)+'</p><ul>'+entry.assessment.evidence.map(e=>'<li>'+safeLink(e.url,e.label)+'</li>').join('')+'</ul><p>'+escapeText(entry.assessment.migration)+'</p>'+textList(entry.assessment.gaps)+'</details>':'';
 return '<details class="source-evidence"><summary>Evidence & versions</summary><p>'+escapeText(a.scope || a.summary)+'</p>'+(a.reviewedAt?'<p>Analyzed '+escapeText(a.reviewedAt)+' · '+escapeText(a.reviewer)+'</p>':'')+'<p>'+safeLink(source?.evidenceUrl || entry.sourceUrl,'Upstream source')+(source?.version?' · v'+escapeText(source.version):'')+(source?.archivedSource?' · historical source':'')+'</p><p class="fingerprint">SHA-256: '+escapeText(a.sourceHash || 'unavailable')+'</p>'+(source?.parts?.length?'<ul>'+source.parts.map(p=>'<li>'+safeLink(p.url,p.path)+' <span class="fingerprint">'+escapeText(p.sha256)+'</span></li>').join('')+'</ul>':'')+(a.suiteCommit?'<p>'+safeLink('https://github.com/majkinetor/musicbrainz-userscripts/tree/'+a.suiteCommit+'/userscripts','Suite '+a.suiteCommit.slice(0,12))+'</p>':'')+'<ul>'+entry.features.filter(f=>f.evidence?.length).map(f=>'<li><strong>'+escapeText(f.name)+'</strong>: '+f.evidence.map(e=>safeLink(e.url,e.label+' · line '+e.line)).join(' · ')+'</li>').join('')+'</ul>'+(a.tools?.length?'<p>Compared tools: '+a.tools.map(t=>safeLink('https://github.com/majkinetor/musicbrainz-userscripts/blob/'+a.suiteCommit+'/userscripts/'+t+'/README.md',t.replaceAll('_',' '))).join(' · ')+'</p>':'')+(source?.requires?.length?'<p>External requirements (not fully audited):</p>'+textList(source.requires):'')+'</details>';
}
function renderDetails(entry){const row=rows.get(entry.id),panel=row.querySelector('.detail'),r=records.get(entry.id),features=effectiveFeatures(entry,r);
  panel.innerHTML='<div class="entry-intro"><p class="description">'+escapeText(entry.description)+'</p><p class="summary-text dim">'+escapeText(entry.summary)+'</p></div>'+
    '<div class="meta"><span>By '+escapeText(entry.author)+'</span><span>'+escapeText(entry.categories.join(' · '))+'</span><span>'+safeLink(entry.sourceUrl || entry.downloadUrl,'Original source')+'</span><span>'+safeLink(report.wiki.url,'Wiki revision '+report.wiki.revision)+'</span></div>'+
    (entry.acceptedReview?'<section class="maintainer-finding"><span class="finding-label">Maintainer verdict</span><strong>'+escapeText(verdictLabel(entry.verdict))+'</strong><span>'+safeLink(entry.acceptedReview.author.url,'@'+entry.acceptedReview.author.login)+' · '+safeLink(entry.acceptedReview.url,'#'+entry.acceptedReview.discussionNumber)+'</span><button class="help" data-tip="Maintainer review\nAccepted from the linked GitHub discussion. Original source evidence remains separate." aria-label="About maintainer verdict">?</button></section>':'')+
    (entry.acceptedNotes?.length?'<section class="accepted-notes">'+entry.acceptedNotes.map(note=>'<p><b>'+escapeText(note.kind)+':</b> '+escapeText(note.text)+' <small>'+safeLink(note.author.url,'@'+note.author.login)+' · '+safeLink(note.url,'#'+note.discussionNumber)+'</small></p>').join('')+'</section>':'')+
    '<section class="analysis-finding"><strong>'+escapeText(entry.analysisState)+(entry.analysisState==='Code analyzed'?' · '+entry.features.length+' capabilities':'')+'</strong><span>Source verdict: '+escapeText(verdictLabel(entry.sourceVerdict))+'</span>'+(entry.acceptedReview&&entry.sourceVerdict!==entry.verdict?'<span class="warning">Differs from maintainer verdict</span>':'')+'</section>'+
    (isStale(entry)?'<p class="warning">The source or assessment changed since your review. Export retains both versions. <button type="button" class="ack">Confirm against this snapshot</button></p>':'')+
    '<div class="review-status"><label>My verdict <select class="my-verdict" data-tip="Your verdict\nChoose directly or keep the weighted suggestion. The report verdict stays unchanged."><option value="">0 · Weighted</option>'+verdictOptions.map(v=>'<option value="'+escapeText(v)+'"'+(r?.proposedVerdict===v?' selected':'')+'>'+(verdictOptions.indexOf(v)+1)+' · '+escapeText(verdictLabel(v))+'</option>').join('')+'</select></label><span class="weighted" data-tip="Weighted suggestion\nCovered earns full weight; Partial half; Gap zero. Unknown needs assessment. Essential gaps prevent Mostly replaceable."></span><div class="review-actions"><button type="button" data-action="feature">Add feature</button><button type="button" data-action="note">'+(r?.note?'Edit note':'Add note')+'</button><button type="button" data-action="comments">Comments'+(r?.comments.length?' ('+r.comments.length+')':'')+'</button></div></div>'+
    '<h2>Capabilities <button class="help" data-tip="Feature weights\nIgnore (0), Minor (1), Normal (3), Important (5), Essential (10). Essential means you cannot lose this workflow." aria-label="About feature weights">?</button></h2><div class="caps-wrap"><table class="caps"><thead><tr><th>Feature</th><th>Weight</th><th>Coverage</th><th>Note</th></tr></thead><tbody>'+features.map(f=>'<tr data-feature="'+escapeText(f.id)+'"><td>'+escapeText(f.name)+' <button class="help" data-tip="'+escapeText((f.reason || 'Added in your review')+'\nOriginal: '+(entry.features.find(x=>x.id===f.id)?.coverage || 'User-added'))+'" aria-label="Feature evidence">?</button></td><td><select data-field="weight" aria-label="Importance: '+escapeText(f.name)+'">'+weightOptions.map(([value,label])=>'<option value="'+value+'"'+(f.weight===value?' selected':'')+'>'+label+'</option>').join('')+'</select></td><td><select data-field="coverage" aria-label="Coverage: '+escapeText(f.name)+'">'+coverageValues.map(value=>'<option'+(f.coverage===value?' selected':'')+'>'+value+'</option>').join('')+'</select></td><td><textarea data-field="comment" maxlength="20000" aria-label="Comment: '+escapeText(f.name)+'" placeholder="Note" data-tip="Feature note\nExplain a correction or preference. Clear this field to delete it.">'+escapeText(f.comment || '')+'</textarea>'+(f.acceptedContribution?'<small>'+safeLink(f.acceptedContribution.url,'Review #'+f.acceptedContribution.discussionNumber)+'</small>':'')+'</td></tr>').join('')+'</tbody></table></div>'+
    sourceEvidenceHtml(entry)+
    '<section class="review-drawer" hidden><div class="drawer-heading"><strong class="drawer-title"></strong><button class="close-drawer plain" type="button" aria-label="Close editor">✕</button></div><div data-drawer-panel="feature" hidden><div class="add-feature"><input class="feature-name" maxlength="2000" aria-label="New feature" placeholder="New feature" data-tip="Add a capability\nIt starts with unknown coverage"><button class="add" type="button">Add</button></div></div>'+
    '<div data-drawer-panel="note" hidden><label class="review-note"><span>Note <button class="clear-note plain" type="button" aria-label="Delete note" data-tip="Delete the overall note">✕</button></span><textarea class="note" maxlength="20000" placeholder="Note" data-tip="Review note\nExplain your verdict or correction">'+escapeText(r?.note || '')+'</textarea></label></div>'+
    '<div data-drawer-panel="comments" hidden><ul class="comments">'+(r?.comments || []).map(c=>'<li data-comment="'+escapeText(c.id)+'"><div class="comment-header"><time>'+escapeText(c.at.slice(0,16).replace('T',' '))+(c.updatedAt?' · edited':'')+'</time><div><button class="edit-comment plain" type="button">Edit</button><button class="delete-comment plain" type="button">Delete</button></div></div><p>'+escapeText(c.text)+'</p></li>').join('')+'</ul><div class="post-comment"><textarea class="comment-draft" aria-label="New comment" maxlength="20000" placeholder="Comment" data-tip="Review comment\nSaved locally. Send to GitHub when ready.">'+escapeText(r?.draft || '')+'</textarea><button class="post" type="button">Add comment</button></div></div></section>';
  function showPanel(mode,focus=false){
    openPanels.set(entry.id,mode);panel.querySelector('.review-drawer').hidden=false;
    panel.querySelectorAll('[data-drawer-panel]').forEach(el=>{el.hidden=el.dataset.drawerPanel!==mode;});
    panel.querySelector('.drawer-title').textContent={feature:'Add feature',note:'Review note',comments:'Comments'}[mode];
    panel.querySelectorAll('textarea').forEach(growNote);
    if(focus)panel.querySelector({feature:'.feature-name',note:'.note',comments:'.comment-draft'}[mode]).focus();
  }
  panel.querySelectorAll('[data-action]').forEach(button=>button.onclick=()=>showPanel(button.dataset.action,true));
  panel.querySelector('.close-drawer').onclick=()=>{const mode=openPanels.get(entry.id);openPanels.delete(entry.id);panel.querySelector('.review-drawer').hidden=true;panel.querySelector('[data-action="'+mode+'"]').focus();};
  if(openPanels.has(entry.id))showPanel(openPanels.get(entry.id));
  panel.querySelector('.my-verdict').onchange=e=>changed(entry,r=>{r.proposedVerdict=e.target.value;});
  panel.querySelector('.ack')?.addEventListener('click',()=>{changed(entry,r=>{r.basis=structuredClone(entry.basis);r.reportAtReview=reportRef();});renderDetails(entry);});
  panel.querySelectorAll('[data-field]').forEach(control=>control.addEventListener(control.tagName==='TEXTAREA'?'input':'change',()=>featureChange(entry,control.closest('[data-feature]').dataset.feature,control.dataset.field,control.dataset.field==='weight'?Number(control.value):control.value)));
  panel.querySelector('.note').oninput=e=>changed(entry,r=>{r.note=e.target.value;});
  panel.querySelector('.clear-note').onclick=()=>{changed(entry,r=>{r.note='';});panel.querySelector('.note').value='';growNote(panel.querySelector('.note'));};
  panel.querySelector('.comment-draft').oninput=e=>changed(entry,r=>{r.draft=e.target.value;});
  panel.querySelector('.post').onclick=()=>{const text=panel.querySelector('.comment-draft').value.trim();if(!text)return;const current=recordFor(entry);if(current.comments.length>=500){message('Comment limit reached; export before starting another review file.');return;}changed(entry,r=>{r.comments.push({id:crypto.randomUUID(),at:new Date().toISOString(),text});r.draft='';});renderDetails(entry);};
  panel.querySelectorAll('.delete-comment').forEach(button=>button.onclick=()=>{const id=button.closest('[data-comment]').dataset.comment;changed(entry,r=>{r.deletedComments=[...new Set([...(r.deletedComments || []),id])];r.comments=r.comments.filter(c=>c.id!==id);});renderDetails(entry);});
  panel.querySelectorAll('.edit-comment').forEach(button=>button.onclick=()=>{const li=button.closest('[data-comment]'),id=li.dataset.comment,c=records.get(entry.id).comments.find(c=>c.id===id);li.innerHTML='<textarea class="comment-edit" aria-label="Edit comment" maxlength="20000">'+escapeText(c.text)+'</textarea><button class="save-comment" type="button">Save</button><button class="cancel-comment" type="button">Cancel</button>';li.querySelector('.save-comment').onclick=()=>{const text=li.querySelector('textarea').value.trim();if(!text){message('Use Delete to remove this comment.');return;}changed(entry,r=>{const comment=r.comments.find(c=>c.id===id);comment.text=text;comment.updatedAt=new Date().toISOString();});renderDetails(entry);};li.querySelector('.cancel-comment').onclick=()=>renderDetails(entry);wireGrowingNote(li.querySelector('textarea'));li.querySelector('textarea').focus();});
  panel.querySelector('.add').onclick=()=>{const name=panel.querySelector('.feature-name').value.trim();if(!name)return;if(Object.keys(recordFor(entry).features).length>=200){message('Feature limit reached.');return;}changed(entry,r=>{r.features['custom:'+crypto.randomUUID()]={name,coverage:'Unknown',weight:5,comment:'',added:true};});renderDetails(entry);};
  panel.querySelectorAll('textarea').forEach(wireGrowingNote);
  updateRow(entry);
}
function growNote(field){if(!field.getClientRects().length)return;field.style.height='auto';field.style.height=field.scrollHeight+'px';}
function wireGrowingNote(field){field.rows=1;growNote(field);field.addEventListener('input',()=>growNote(field));}
const resizeNotes=new ResizeObserver(()=>document.querySelectorAll('.script[open] textarea').forEach(growNote));
resizeNotes.observe(document.querySelector('main'));
let quickNoteEntry;
function openQuickNote(entry){
  quickNoteEntry=entry;
  document.getElementById('quick-note-title').textContent=entry.name+' · note';
  const field=document.getElementById('quick-note');field.value=records.get(entry.id)?.note || '';
  document.getElementById('quick-note-dialog').showModal();growNote(field);field.focus();
}
document.getElementById('quick-note').oninput=e=>{if(quickNoteEntry)changed(quickNoteEntry,r=>{r.note=e.target.value;});growNote(e.target);};
document.getElementById('quick-note-clear').onclick=()=>{if(quickNoteEntry)changed(quickNoteEntry,r=>{r.note='';});const field=document.getElementById('quick-note');field.value='';growNote(field);field.focus();};
document.getElementById('quick-note-close').onclick=()=>document.getElementById('quick-note-dialog').close();
document.getElementById('quick-note-dialog').addEventListener('close',()=>{rows.get(quickNoteEntry?.id)?.querySelector('.row-note').focus();quickNoteEntry=null;});
function showContributors(entry){
  const dialog=document.getElementById('people-dialog');
  document.getElementById('people-title').textContent=entry.name+' · reviewers';
  const people=[...new Map((entry.contributions || []).map(c=>[c.author.id,c.author])).values()];
  document.getElementById('people-list').innerHTML=people.length?people.map(person=>'<li><div class="person"><img src="https://github.com/'+encodeURIComponent(person.login)+'.png?size=64" width="32" height="32" alt="" loading="lazy">'+safeLink(person.url,'@'+person.login)+'</div><ul>'+entry.contributions.filter(c=>c.author.id===person.id).map(c=>'<li>'+safeLink(c.url,'#'+c.discussionNumber)+' · '+escapeText(c.disposition)+' · '+escapeText(verdictLabel(c.verdict || 'No verdict'))+'<small>Report '+escapeText(c.reviewedReport.slice(0,12))+'</small></li>').join('')+'</ul></li>').join(''):'<li class="dim">No discussion reviews yet.</li>';
  dialog.showModal();
}
document.getElementById('people-close').onclick=()=>document.getElementById('people-dialog').close();
for(const entry of report.entries){
  const row=rows.get(entry.id);
  const verdict=row.querySelector('.row-verdict');
  verdict.addEventListener('click',e=>e.stopPropagation());
  verdict.onchange=e=>changed(entry,r=>{r.proposedVerdict=e.target.value;});
  row.querySelector('.row-revert').onclick=e=>{e.preventDefault();e.stopPropagation();records.delete(entry.id);openPanels.delete(entry.id);save();updateRow(entry);if(row.open)renderDetails(entry);else row.querySelector('.detail').replaceChildren();filterRows();row.querySelector('summary').focus();};
  row.querySelector('.row-note').onclick=e=>{e.preventDefault();e.stopPropagation();openQuickNote(entry);};
  row.querySelector('.people-count').onclick=e=>{e.preventDefault();e.stopPropagation();showContributors(entry);};
  row.addEventListener('keydown',e=>{
    if(e.altKey||e.ctrlKey||e.metaKey||e.target.closest('input,textarea,select,button,[contenteditable="true"]'))return;
    const key=e.key.toLowerCase();
    if(!/^[0-7n]$/.test(key))return;
    e.preventDefault();e.stopPropagation();
    if(key==='n'){row.open=true;renderDetails(entry);row.querySelector('[data-action="note"]').click();return;}
    changed(entry,r=>{r.proposedVerdict=key==='0'?'':verdictOptions[Number(key)-1];});
    const select=row.querySelector('.my-verdict');if(select)select.value=key==='0'?'':verdictOptions[Number(key)-1];
  });
}
for(const entry of report.entries){const row=rows.get(entry.id);row.addEventListener('toggle',()=>{if(row.open&&!row.querySelector('.detail').hasChildNodes())renderDetails(entry);if(!row.open)filterRows();});updateRow(entry);}
const controls=['name-filter','search','category','tool','review-filter'].map(id=>document.getElementById(id));
function filterRows(){const [name,search,category,tool,reviewFilter]=controls.map(c=>c.value);const verdicts=[...document.querySelectorAll('[name="report-verdict"]:checked')].map(c=>c.value);document.getElementById('verdict-label').textContent='Report verdict · '+(verdicts.length?verdicts.length+' selected':'All');let count=0;
  for(const entry of report.entries){const r=records.get(entry.id);const text=[entry.name,entry.author,entry.description,...entry.tools,...entry.features.map(f=>f.name),r?.note || '',...(r?.comments || []).map(c=>c.text),...Object.values(r?.features || {}).map(f=>f.name+' '+f.comment)].join(' ').toLowerCase();
    const reviewed=!reviewFilter || (reviewFilter==='Not reviewed'?!r:reviewFilter==='Edited'?!!r:reviewFilter==='Needs recheck'?isStale(entry):false);
    const show=(!name||entry.name.toLowerCase().includes(name.toLowerCase()))&&(!search||text.includes(search.toLowerCase()))&&(!verdicts.length||verdicts.includes(entry.verdict))&&(!category||entry.categories.includes(category))&&(!tool||entry.tools.includes(tool))&&reviewed;
    rows.get(entry.id).hidden=!show;if(show)count++;}
  document.getElementById('count').textContent=count+' of '+report.entries.length+' entries';document.getElementById('empty').hidden=count!==0;
}
controls.forEach(c=>c.addEventListener(c.type==='search'?'input':'change',filterRows));
document.getElementById('toggle-search').onclick=()=>{const panel=document.getElementById('search-panel'),button=document.getElementById('toggle-search');panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)document.getElementById('search').focus();};
document.getElementById('reset').onclick=()=>{controls.forEach(c=>c.value='');document.querySelectorAll('[name="report-verdict"]').forEach(c=>c.checked=false);filterRows();};
document.getElementById('collapse').onclick=()=>{for(const row of rows.values())row.open=false;};
document.getElementById('export').onclick=()=>{const blob=new Blob([JSON.stringify(bundle(),null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='musicbrainz-reviews-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);message('Exported '+records.size+' review(s), including comments, drafts and source references. Give the JSON file to the AI.');};
document.getElementById('import').onclick=()=>document.getElementById('import-file').click();
document.getElementById('import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>16000000)throw new Error('Review file is larger than 16 MB.');const incoming=readReviewBundle(JSON.parse(await file.text()));records=mergeReviewEntries(records,incoming);save();for(const entry of report.entries){updateRow(entry);if(rows.get(entry.id).open)renderDetails(entry);else rows.get(entry.id).querySelector('.detail').replaceChildren();}filterRows();message('Imported '+incoming.length+' review(s). Newer edits win; posted comments are retained.');}catch(error){message(error.message || 'Import failed; existing reviews were retained.');}finally{e.target.value='';}};
document.getElementById('provenance').innerHTML=safeLink(report.permanentUrl,'Report '+report.reportVersion.slice(0,12))+' · Wiki '+report.wiki.revision+' · Sources '+escapeText(report.collectedAt.slice(0,10));
document.getElementById('contributors').innerHTML='<b>Contributors</b> · '+report.contributors.map(person=>{const submissions=report.submissions.filter(s=>s.authorId===person.id);return safeLink(person.url,person.login)+' ('+submissions.map(s=>safeLink(s.url,'#'+s.discussionNumber)).join(', ')+')';}).join(' · ');
updateSaveStatus();filterRows();

function downloadReview(){document.getElementById('export').click();}
document.getElementById('github').onclick=()=>{
  if(!records.size){message('Add a verdict, change or comment first.');return;}
  mbuTipHide(true);
  const draft=discussionDraft(bundle());
  if(draft.requiresAttachment)downloadReview();
  window.open(draft.url,'_blank','noopener,noreferrer');
  message(draft.requiresAttachment?'GitHub opened with the title and body filled. Attach the downloaded JSON before publishing.':'GitHub opened with the title, body and review export filled.');
};

document.querySelectorAll('[name="report-verdict"]').forEach(c=>c.onchange=filterRows);
document.getElementById('clear-verdicts').onclick=()=>{document.querySelectorAll('[name="report-verdict"]').forEach(c=>c.checked=false);filterRows();};

document.getElementById('review-help').onclick=()=>document.getElementById('help-dialog').showModal();
document.getElementById('help-close').onclick=()=>document.getElementById('help-dialog').close();
