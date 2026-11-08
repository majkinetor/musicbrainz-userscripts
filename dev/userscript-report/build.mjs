// Offline full-list report and portable review workspace. See README.md.
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validate, reviewState, evidenceUrl, hash, inputsFor } from './lib.mjs';
import { parseCatalog, githubIdentity } from './catalog.mjs';
import { tipJs } from '../ui/tooltip.mjs';
import { applyContributions } from './contributions.mjs';
import { sourceAnalysisState } from './source-analysis.mjs';
import { reviewHelpHtml } from './help.mjs';
import { readReviewBundle, verdictLabel, verdictOptions } from './review-model.mjs';
const dir = path.dirname(fileURLToPath(import.meta.url));
const read = name => JSON.parse(readFileSync(path.join(dir,'data',name)));
const sources = read('sources.json'), reviews = read('reviews.json');
validate(sources,reviews);
const archivedWiki = path.join(dir,`../reports/926-userscript-comparison/wiki-${sources.wiki.revision}.wikitext`);
const cachedWiki = path.join(dir,`.cache/${sources.wiki.sha256}.wikitext`);
const wikiPath = existsSync(archivedWiki) ? archivedWiki : existsSync(cachedWiki) ? cachedWiki : null;
let catalog;
if (wikiPath) {
  const wiki = readFileSync(wikiPath,'utf8');
  if (hash(wiki) !== sources.wiki.sha256) throw new Error('Wiki content does not match the collected revision hash');
  catalog = parseCatalog(wiki);
} else {
  const stored = read('catalog.json');
  if (stored.wikiRevision !== sources.wiki.revision || stored.wikiSha256 !== sources.wiki.sha256) throw new Error('Collect this wiki revision before rebuilding its catalog');
  catalog = stored.entries;
}
const names = {apollo_editor:'Apollo Editor',mammoth:'Mammoth',first_contact:'First Contact',art_station:'Art Station',falcon:'Falcon',fusion:'Fusion'};
let entries = catalog.map(c => {
  const review = reviews.find(r => githubIdentity(r.reviewedExternal.url) === c.stableId);
  const verdict = review?.verdict || (c.kind === 'Suite entry' ? 'Suite entry' : c.kind === 'Companion tool' ? 'Companion tool' : 'Unassessed');
  const features = review?.capabilities.map(f => ({...f,weight:5})) || [{id:'wiki.main-workflow',name:c.description || c.name,coverage:'Unknown',weight:5,reason:'Wiki description only. Source functionality and suite coverage have not been assessed.'}];
  const observedInputs = review ? inputsFor(review,sources) : null;
  const basis = {name:c.name,hash:hash(JSON.stringify({row:c.rowHash,review,observedInputs})),wikiRevision:sources.wiki.revision,wikiRowHash:c.rowHash,
    sourceIdentity:c.stableId,sourceUrl:review?.reviewedExternal.url || c.sourceUrl,sourceVersion:review?.reviewedExternal.version || null,sourceHash:review?.reviewedExternal.sha256 || null,
    sourceCommit:review?.reviewedExternal.commit || null,toolsetCommit:review?.reviewedToolsetCommit || sources.toolset.commit,
    baselineVerdict:verdict,features,assessedInputs:review?.reviewedInputs || null,observedInputs};
  return {...c,verdict,features,basis,tools:review?.tools.map(t=>names[t] || t) || [],
    summary:review?.summary || (c.kind === 'Suite entry' ? 'Our own listed tool; not counted as a replacement of another project.' : c.kind === 'Companion tool' ? 'Listed companion service; not treated as an obsolete userscript.' : 'Listed in the wiki. This entry awaits source review; its description is a starting point, not a replacement finding.'),
    assessment:review ? {scope:review.scope,gaps:review.gaps,migration:review.migration,reviewedAt:review.reviewedAt,confidence:review.confidence,
      evidence:review.evidence.map(e=>({label:e.label,url:evidenceUrl(review,e)})),freshness:reviewState(review,sources)} : null};
});
if (entries.filter(e=>e.assessment).length !== reviews.length) throw new Error('A reviewed pilot source was lost while parsing the full listing');
const majorSources=read('major-sources.json'),analyses=read('source-analyses.json');
entries=entries.map(entry=>{
 const analysis=analyses.entries.find(a=>a.id===entry.id),source=majorSources.entries.find(s=>s.id===entry.id);
 if(!analysis)return {...entry,analysisState:entry.assessment?(entry.assessment.freshness.status==='Needs review'?'Needs recheck':'Code analyzed'):'Not analyzed'};
 const state=sourceAnalysisState(analysis,source,majorSources.toolset);
 if(analysis.status!=='Code analyzed')return {...entry,analysisState:state,sourceAnalysis:{...analysis,state,source},summary:analysis.summary};
 const features=analysis.capabilities;
 return {...entry,verdict:analysis.verdict,features,summary:analysis.summary,tools:analysis.tools.map(t=>names[t]||t.replaceAll('_',' ')),analysisState:state,
  sourceAnalysis:{...analysis,state,source},basis:{...entry.basis,hash:hash(entry.basis.hash+JSON.stringify({analysis,state})),features,baselineVerdict:analysis.verdict,sourceUrl:source.evidenceUrl,sourceVersion:source.version,sourceHash:analysis.sourceHash,sourceCommit:source.commit||null,toolsetCommit:analysis.suiteCommit}};
});
const contributions=read('contributions.json');
const exportsByPath=new Map(contributions.submissions.map(s=>{const data=read(s.exportPath);readReviewBundle(data);return [s.exportPath,data];}));
const withContributions=manifest=>applyContributions(entries,manifest,exportsByPath).map(entry=>{
  if(entry.acceptedReview||entry.acceptedNotes.length||entry.features.some(f=>f.acceptedContribution))entry.basis={...entry.basis,features:entry.features,hash:hash(entry.basis.hash+JSON.stringify({acceptedReview:entry.acceptedReview,features:entry.features,acceptedNotes:entry.acceptedNotes})),baselineVerdict:entry.verdict,acceptedReview:entry.acceptedReview};
  return entry;
});
// A review made before some accepted submissions still holds when only those
// submissions changed the row: earlierHashes lists the row's fingerprint after
// each earlier set of accepted submissions, under the current source analysis.
const accepted=[...contributions.submissions].filter(s=>s.disposition==='accepted').sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt)||a.id.localeCompare(b.id));
const earlier=accepted.map((_,n)=>withContributions({...contributions,submissions:accepted.slice(0,n)}));
entries=withContributions(contributions).map((entry,i)=>{
  const hashes=[...new Set(earlier.map(list=>list[i].basis.hash))].filter(h=>h!==entry.basis.hash);
  if(hashes.length)entry.basis={...entry.basis,earlierHashes:hashes};
  return entry;
});
// Retain the raw wiki and old exports, but compare third-party tools only.
entries=entries.filter(e=>e.kind!=='Suite entry'&&!e.stableId.startsWith('github:majkinetor/')&&e.name!=='Import Discogs releases to MusicBrainz');
const data = {schemaVersion:2,reportId:'mb-userscripts-926',wiki:sources.wiki,collectedAt:majorSources.capturedAt,
  toolsetCommit:majorSources.toolset.commit,sourceManifestSha256:hash(JSON.stringify({sources,majorSources})),contributors:contributions.contributors,submissions:contributions.submissions,entries};
const esc = v => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const options = values => [...new Set(values)].sort().map(v=>`<option value="${esc(v)}">${esc(verdictLabel(v))}</option>`).join('');
const duplicateNames = new Set(entries.filter((e,i)=>entries.findIndex(x=>x.name===e.name)!==i).map(e=>e.name));
// A collapsed row is two lines: name over a muted meta line (analysis, reviewers, recheck, contributors' notes) on the left; the verdict, shown once, on the right.
const reviewerCount = e => new Set(e.contributions.map(c=>c.author.id)).size;
const verdictNumber = v => verdictOptions.indexOf(v)+1;
const rowRef = (a,text) => `<span class="row-accepted-note">${text} — <a href="${esc(a.author.url)}" target="_blank" rel="noopener">${esc(a.author.login)}</a> <a href="${esc(a.url)}" target="_blank" rel="noopener">#${esc(a.discussionNumber)}</a></span>`;
// A review that only set the verdict still says so in the row, not just in the reviewer count.
const rowNotes = e => (e.acceptedReview&&!(e.acceptedNotes||[]).some(n=>n.submissionId===e.acceptedReview.submissionId)?rowRef(e.acceptedReview,'Verdict: '+esc(verdictLabel(e.acceptedReview.verdict))):'')+(e.acceptedNotes||[]).map(n=>rowRef(n,`“${esc(n.text)}”`)).join('');
const rows = entries.map(e=>`<details class="script" data-id="${esc(e.id)}"><summary><span class="row-main"><span class="name">${esc(e.name)}${duplicateNames.has(e.name)?` <small>(${esc(e.author)})</small>`:''}</span><span class="row-meta"><span class="analysis-badge" data-tip="Analysis coverage\nCode analyzed means important implementation paths were compared, not live tested. Source unavailable means no code-backed finding.">${e.analysisState==='Code analyzed'?e.features.length+' '+(e.features.length===1?'analysis':'analyses'):esc(e.analysisState)}</span>${reviewerCount(e)?`<button type="button" class="people-count plain" aria-label="Reviewers for ${esc(e.name)}" data-tip="Discussion reviewers\nOpen GitHub profiles and their discussions">${reviewerCount(e)} ${reviewerCount(e)===1?'reviewer':'reviewers'}</button>`:''}<span class="review-marker" data-tip="Needs recheck\nThe report changed since your review; check it again" hidden>Needs recheck</span>${rowNotes(e)}</span></span><span class="summary-actions"><span class="personal" hidden><span class="yours">yours</span><s class="baseline">${esc(verdictLabel(e.verdict))}</s></span><button type="button" class="row-revert plain" aria-label="Revert input for ${esc(e.name)}" data-tip="Revert your changes\nClear this script's local verdict, notes, comments and feature edits" hidden>Revert</button><select class="row-verdict" aria-label="Verdict for ${esc(e.name)}" data-tip="Verdict\nThe report's, until you choose your own"><option value="" data-report="${esc(verdictNumber(e.verdict)?verdictNumber(e.verdict)+' · ':'')}${esc(verdictLabel(e.verdict))}">${esc(verdictNumber(e.verdict)?verdictNumber(e.verdict)+' · ':'')}${esc(verdictLabel(e.verdict))}</option>${verdictOptions.map((v,i)=>`<option value="${esc(v)}">${i+1} · ${esc(verdictLabel(v))}</option>`).join('')}</select><button type="button" class="row-note" aria-label="Note for ${esc(e.name)}" data-tip="Review note\nWrite or edit a note without expanding the script">Note</button></span></summary><div class="detail"></div></details>`).join('\n');
const model = readFileSync(path.join(dir,'review-model.mjs'),'utf8').replace(/^export /gm,'');
const sharing = readFileSync(path.join(dir,'share.mjs'),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const tooltips = tipJs(['main']);
const ui = readFileSync(path.join(dir,'review-ui.js'),'utf8');
const css = readFileSync(path.join(dir,'style.css'),'utf8')+'\n'+readFileSync(path.join(dir,'../script-metrics/templates/site-theme.css'),'utf8');
const theme = readFileSync(path.join(dir,'../script-metrics/templates/site-theme.js'),'utf8');
let html = readFileSync(path.join(dir,'template.html'),'utf8');
const site = JSON.parse(readFileSync(path.join(dir,'site.json'),'utf8'));
data.siteUrl=site.site_url;
data.reportVersion=hash(JSON.stringify(data)+html+model+sharing+tooltips+ui+css+theme);
data.permanentUrl=site.site_url+'/reports/'+data.reportVersion+'.html';
const tokens = {
  '@@HELP@@':reviewHelpHtml(),'@@COUNT@@':String(entries.length),'@@REVIEWED@@':String(entries.filter(e=>e.analysisState==='Code analyzed').length),'@@ROWS@@':rows,
  '@@MAINTAINER@@':String(entries.filter(e=>e.acceptedReview).length),
  '@@VERDICTCHECKS@@':[...new Set(entries.map(e=>e.verdict))].sort().map(v=>`<label><input type="checkbox" name="report-verdict" value="${esc(v)}">${esc(verdictLabel(v))}</label>`).join(''),'@@CATEGORIES@@':options(entries.flatMap(e=>e.categories)),
  '@@TOOLS@@':options(entries.flatMap(e=>e.tools)),
  '@@DATA@@':JSON.stringify(data).replaceAll('<','\\u003c'),
  '@@CSS@@':css,'@@THEME@@':theme,'@@MODEL@@':model,'@@SHARING@@':sharing,'@@TOOLTIPS@@':tooltips,'@@UI@@':ui};
html = html.replace(/@@[A-Z]+@@/g,token=>tokens[token] ?? token);
mkdirSync(path.join(dir,'out'),{recursive:true});
writeFileSync(path.join(dir,'out/index.html'),html);
mkdirSync(path.join(dir,'out/reports'),{recursive:true});
writeFileSync(path.join(dir,'out/reports',data.reportVersion+'.html'),html);
writeFileSync(path.join(dir,'out/report.json'),JSON.stringify({version:data.reportVersion,url:data.permanentUrl,wikiRevision:data.wiki.revision},null,2)+'\n');
writeFileSync(path.join(dir,'data/catalog.json'),JSON.stringify({wikiRevision:sources.wiki.revision,wikiSha256:sources.wiki.sha256,entries:catalog},null,2)+'\n');
writeFileSync(path.join(dir,'data/review-queue.json'),JSON.stringify(reviews.map(r=>({id:r.id,...reviewState(r,sources)})).filter(r=>r.reasons.length),null,2)+'\n');
cpSync(path.join(dir,'out'),path.resolve(dir,'../../docs/third-party-comparison'),{recursive:true});
console.log(`Built ${entries.length} tools, ${entries.filter(e=>e.analysisState==='Code analyzed').length} code analyses and ${entries.filter(e=>e.acceptedReview).length} accepted contributor verdicts.`);
