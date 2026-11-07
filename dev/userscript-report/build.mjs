// Offline full-list report and portable review workspace. See README.md.
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validate, reviewState, evidenceUrl, hash, inputsFor } from './lib.mjs';
import { parseCatalog, githubIdentity } from './catalog.mjs';
import { tipJs } from '../ui/tooltip.mjs';
import { applyContributions } from './contributions.mjs';
import { majorReviewState } from './major-review.mjs';
import { reviewHelpHtml } from './help.mjs';
import { verdictLabel, verdictOptions } from './review-model.mjs';
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
const contributions=read('contributions.json');
const exportsByPath=new Map(contributions.submissions.map(s=>[s.exportPath,read(s.exportPath)]));
entries=applyContributions(entries,contributions,exportsByPath).map(entry=>{
  if(entry.acceptedReview)entry.basis={...entry.basis,hash:hash(entry.basis.hash+JSON.stringify(entry.acceptedReview)),baselineVerdict:entry.verdict,acceptedReview:entry.acceptedReview};
  return entry;
});
const majorSources=read('major-sources.json'),majorReviews=read('major-reviews.json');
entries=entries.map(entry=>{
 const review=majorReviews.entries.find(r=>r.id===entry.id),source=majorSources.entries.find(s=>s.id===entry.id);
 if(!review)return entry;
 const state=majorReviewState(review,source,majorSources.toolset);
 return {...entry,quickReview:{...review,state,source,suiteCommit:majorSources.toolset.commit},basis:{...entry.basis,hash:hash(entry.basis.hash+JSON.stringify({review,state})),quickReview:review}};
});
// Retain the raw wiki and old exports, but compare third-party tools only.
entries=entries.filter(e=>e.kind!=='Suite entry'&&!e.stableId.startsWith('github:majkinetor/')&&e.name!=='Import Discogs releases to MusicBrainz');
const data = {schemaVersion:2,reportId:'mb-userscripts-926',wiki:sources.wiki,collectedAt:sources.collectedAt,
  toolsetCommit:sources.toolset.commit,sourceManifestSha256:hash(JSON.stringify(sources)),contributors:contributions.contributors,submissions:contributions.submissions,entries};
const esc = v => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const options = values => [...new Set(values)].sort().map(v=>`<option value="${esc(v)}">${esc(verdictLabel(v))}</option>`).join('');
const duplicateNames = new Set(entries.filter((e,i)=>entries.findIndex(x=>x.name===e.name)!==i).map(e=>e.name));
const rows = entries.map(e=>`<details class="script" data-id="${esc(e.id)}"><summary><span class="name">${esc(e.name)}${duplicateNames.has(e.name)?` <small>(${esc(e.author)})</small>`:''}</span><button type="button" class="people-count plain" aria-label="Reviewers for ${esc(e.name)}" data-tip="Discussion reviewers\nOpen GitHub profiles and their discussions">${new Set(e.contributions.map(c=>c.author.id)).size} <span aria-hidden="true">${new Set(e.contributions.map(c=>c.author.id)).size===1?'reviewer':'reviewers'}</span></button><span class="summary-actions"><select class="row-verdict" aria-label="Quick verdict for ${esc(e.name)}" data-tip="Your verdict\nChoose without expanding the script"><option value="">My verdict</option>${verdictOptions.map((v,i)=>`<option value="${esc(v)}">${i+1} · ${esc(verdictLabel(v))}</option>`).join('')}</select><button type="button" class="row-note" aria-label="Note for ${esc(e.name)}" data-tip="Review note\nWrite or edit a note without expanding the script">Note</button></span><span class="verdicts"><span class="baseline">${esc(verdictLabel(e.verdict))}</span><span class="personal" hidden></span><span class="review-marker" hidden></span></span></summary><div class="detail"></div></details>`).join('\n');
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
  '@@HELP@@':reviewHelpHtml(),'@@COUNT@@':String(entries.length),'@@REVIEWED@@':String(reviews.length),'@@ROWS@@':rows,
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
console.log(`Built ${entries.length} tools, ${reviews.length} source assessments and ${entries.filter(e=>e.acceptedReview).length} accepted contributor verdicts.`);
