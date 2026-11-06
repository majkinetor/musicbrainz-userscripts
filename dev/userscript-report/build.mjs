// Offline full-list report and portable review workspace. See README.md.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validate, reviewState, evidenceUrl, hash, inputsFor } from './lib.mjs';
import { parseCatalog, githubIdentity } from './catalog.mjs';
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
const entries = catalog.map(c => {
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
const data = {schemaVersion:2,reportId:'mb-userscripts-926',wiki:sources.wiki,collectedAt:sources.collectedAt,
  toolsetCommit:sources.toolset.commit,sourceManifestSha256:hash(JSON.stringify(sources)),entries};
const esc = v => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const options = values => [...new Set(values)].sort().map(v=>`<option>${esc(v)}</option>`).join('');
const duplicateNames = new Set(entries.filter((e,i)=>entries.findIndex(x=>x.name===e.name)!==i).map(e=>e.name));
const rows = entries.map(e=>`<details class="script" data-id="${esc(e.id)}"><summary><span class="name">${esc(e.name)}${duplicateNames.has(e.name)?` <small>(${esc(e.author)})</small>`:''}</span><span class="verdicts"><span class="baseline">${esc(e.verdict)}</span><span class="personal" hidden></span><span class="review-marker" hidden></span></span></summary><div class="detail"></div></details>`).join('\n');
const model = readFileSync(path.join(dir,'review-model.mjs'),'utf8').replace(/^export /gm,'');
let html = readFileSync(path.join(dir,'template.html'),'utf8');
const tokens = {
  '@@COUNT@@':String(entries.length),'@@REVIEWED@@':String(reviews.length),'@@ROWS@@':rows,
  '@@VERDICTS@@':options(entries.map(e=>e.verdict)),'@@CATEGORIES@@':options(entries.flatMap(e=>e.categories)),
  '@@TOOLS@@':options(entries.flatMap(e=>e.tools)),
  '@@DATA@@':JSON.stringify(data).replaceAll('<','\\u003c'),
  '@@CSS@@':readFileSync(path.join(dir,'style.css'),'utf8'),
  '@@MODEL@@':model,'@@UI@@':readFileSync(path.join(dir,'review-ui.js'),'utf8')};
html = html.replace(/@@[A-Z]+@@/g,token=>tokens[token] ?? token);
mkdirSync(path.join(dir,'out'),{recursive:true});
writeFileSync(path.join(dir,'out/index.html'),html);
writeFileSync(path.join(dir,'data/catalog.json'),JSON.stringify({wikiRevision:sources.wiki.revision,wikiSha256:sources.wiki.sha256,entries:catalog},null,2)+'\n');
writeFileSync(path.join(dir,'data/review-queue.json'),JSON.stringify(reviews.map(r=>({id:r.id,...reviewState(r,sources)})).filter(r=>r.reasons.length),null,2)+'\n');
console.log(`Built ${entries.length} unique listed tools; ${reviews.length} source-reviewed. Other entries remain explicitly unassessed or self/companion entries.`);
