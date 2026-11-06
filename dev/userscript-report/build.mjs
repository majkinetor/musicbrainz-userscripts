// Offline report generation; all judgments live in data/reviews.json. See README.md.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validate, reviewState, evidenceUrl, repoUrl } from './lib.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = name => JSON.parse(readFileSync(path.join(dir, 'data', name)));
const sources = read('sources.json'), reviews = read('reviews.json');
validate(sources, reviews);
const esc = v => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const names = { apollo_editor: 'Apollo Editor', mammoth: 'Mammoth', first_contact: 'First Contact', art_station: 'Art Station', falcon: 'Falcon', fusion: 'Fusion' };
const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
const list = items => `<ul>${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
const queue = reviews.map(r => ({ id: r.id, ...reviewState(r, sources) }));
const counts = new Map();
reviews.forEach(r => counts.set(r.verdict, (counts.get(r.verdict) || 0) + 1));
const options = (items, label) => `<option value="">${label}</option>` + [...new Set(items)].sort().map(x => `<option>${esc(x)}</option>`).join('');
const rows = reviews.map(r => {
  const original = r.reviewedExternal, state = queue.find(q => q.id === r.id);
  const toolLinks = r.tools.map(t => link(`${repoUrl}/blob/${r.reviewedToolsetCommit}/userscripts/${t}/README.md`, names[t] || t)).join('<br>');
  const code = r.verdict === 'Replaceable' ? 'yes' : r.verdict === 'No equivalent' ? 'keep' : 'some';
  const versions = r.tools.map(t => {
    const f = r.reviewedVersions.find(f => f.path === `userscripts/${t}/${t}.user.js`);
    return `${names[t] || t}: ${f?.version || 'see pinned commit'}`;
  });
  return `<tbody data-id="${r.id}" data-verdict="${esc(r.verdict)}" data-workflow="${esc(r.workflow)}" data-tools="${r.tools.join(' ')}" data-freshness="${state.status}">
    <tr><th scope="row">${link(original.url, original.name)}<small>${esc(original.author)}</small><span class="platforms">${esc(r.platforms.join(' · '))}</span></th>
    <td><span class="verdict ${code}">${esc(r.verdict)}</span><small>${esc(r.confidence)} confidence<br>Code inspection</small></td>
    <td>${toolLinks || '<span class="dim">No equivalent found</span>'}</td>
    <td><b>${esc(r.workflow)}</b><p>${esc(r.summary)}</p><details><summary>Capabilities, gaps & evidence</summary>
    <p class="scope">${esc(r.scope)}</p>
    <table class="caps"><caption>Important capabilities</caption><thead><tr><th>Capability</th><th>Coverage</th><th>Reason</th></tr></thead><tbody>${r.capabilities.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.coverage)}</td><td>${esc(c.reason)}</td></tr>`).join('')}</tbody></table>
    <h3>What you would lose / limits</h3>${list(r.gaps)}<h3>Switching route</h3><p>${esc(r.migration)}</p>
    <h3>Evidence at assessed versions</h3><ul>${r.evidence.map(e => `<li>${link(evidenceUrl(r, e), e.label)}</li>`).join('')}</ul>
    <p class="dim">${esc(original.dependencyScope)} No end-to-end workflow was run for this pilot.</p>
    <h3>Review provenance</h3><p>${esc(r.reviewer)} · ${esc(r.reviewedAt)} · toolset ${link(`${repoUrl}/commit/${r.reviewedToolsetCommit}`, r.reviewedToolsetCommit.slice(0, 8))}</p>
    <p class="dim">${esc(versions.join(' · '))}</p>
    <details><summary>Change-detection fingerprints</summary><pre>${esc(JSON.stringify(r.reviewedInputs, null, 2))}</pre></details>
    </details></td>
    <td class="fresh"><span class="${state.reasons.length ? 'warning' : 'dim'}">${esc(state.status)}</span><small>Reviewed ${esc(r.reviewedAt.slice(0, 10))}<br>External @${esc(original.version || 'unknown')}</small>${state.reasons.length ? list(state.reasons) : ''}</td></tr></tbody>`;
}).join('\n');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>MusicBrainz userscripts · Replacement pilot</title>
<style>
:root{color-scheme:light dark;--bg:#fbfbf8;--ink:#202b2c;--muted:#59666a;--line:#d7ded9;--accent:#166454;--soft:#edf4ee;--warn:#855207}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,sans-serif}main{max-width:1640px;margin:auto;padding:36px 40px 70px}a{color:var(--accent);text-underline-offset:3px}header .eyebrow{color:var(--accent);font-size:12px;letter-spacing:.14em;text-transform:uppercase}h1{font-size:clamp(28px,3.3vw,48px);letter-spacing:-.045em;line-height:1.12;margin:12px 0 20px;font-weight:650}header p{max-width:900px;margin:9px 0}.dim,small{color:var(--muted)}small{display:block;margin-top:8px;font-size:12px}.statusline{border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin:24px 0;padding:13px 0;display:flex;gap:26px;flex-wrap:wrap;font-size:13px}.statusline strong{font-size:22px;margin-right:6px;font-weight:600}.notice{border-left:3px solid var(--accent);padding-left:15px;margin:20px 0;max-width:1100px}.warning{color:var(--warn);font-weight:600}.filters{display:flex;flex-wrap:wrap;align-items:end;gap:12px;border-top:1px solid var(--line);padding-top:22px;margin-top:26px}.filters label{display:grid;gap:5px;font-size:12px;color:var(--muted)}input,select,button{font:inherit;background:transparent;border:1px solid var(--line);border-radius:2px;color:var(--ink);padding:8px 10px;min-height:39px}input{width:280px}button{cursor:pointer}button:hover{background:var(--soft)}:focus-visible{outline:2px solid var(--accent);outline-offset:3px}.count{font-size:13px;color:var(--muted);margin:14px 0}.scroll{overflow:auto;scrollbar-width:thin;scrollbar-color:var(--line) transparent}table{border-collapse:collapse;width:100%;min-width:1020px;text-align:left}thead th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:600;border-bottom:2px solid var(--line);padding:13px 12px}td,tbody th{vertical-align:top;padding:22px 12px;border-bottom:1px solid var(--line);font-weight:400}tbody th{width:19%;font-weight:600}td:nth-child(2){width:14%}td:nth-child(3){width:12%}td:nth-child(4){width:41%}td:last-child{width:14%}td p{margin:8px 0 12px}b{font-weight:600}.platforms{display:block;color:var(--muted);font-size:11px;font-weight:400;margin-top:8px}.verdict{display:inline-block;border-bottom:2px solid var(--line);font-size:13px;font-weight:600;padding-bottom:3px}.yes{color:var(--accent);border-color:var(--accent)}.some{color:var(--warn);border-color:var(--warn)}.keep{color:var(--muted)}summary{cursor:pointer;color:var(--accent);font-size:13px}details[open]>summary{margin-bottom:12px}h2{font-size:23px;margin-top:35px}h3{font-size:13px;margin:20px 0 7px}ul{padding-left:19px}li{margin:7px 0}.caps{min-width:0;font-size:12px}.caps caption{text-align:left;font-weight:600;margin:10px 0}.caps td,.caps th{width:auto;padding:9px 6px}.scope{font-size:13px}pre{max-height:240px;overflow:auto;white-space:pre-wrap;word-break:break-all;font-size:10px;scrollbar-width:thin;scrollbar-color:var(--line) transparent}.method{max-width:1000px;border-top:1px solid var(--line);margin-top:35px}footer{margin-top:35px;font-size:12px;color:var(--muted)}[hidden]{display:none!important}@media(max-width:700px){main{padding:24px 16px}.filters label:first-child{width:100%}input{width:100%}}@media(prefers-color-scheme:dark){:root{--bg:#172122;--ink:#e3eae5;--muted:#b0bdb6;--line:#3b504b;--accent:#8bceb6;--soft:#253a33;--warn:#e5bc7c}}@media print{.filters,.count{display:none}main{padding:0}details{display:block}.scroll{overflow:visible}table{min-width:0}body{font-size:10px}}
@media(max-width:700px){#matrix{min-width:0}#matrix>thead{display:none}#matrix>tbody{display:block;border-bottom:1px solid var(--line);padding:16px 0}#matrix>tbody>tr{display:grid;grid-template-columns:1fr 1fr;gap:12px}#matrix>tbody>tr>th,#matrix>tbody>tr>td{width:auto;border:0;padding:4px 0}#matrix>tbody>tr>th,#matrix>tbody>tr>td:nth-child(4),#matrix>tbody>tr>td:last-child{grid-column:1/-1}.caps{table-layout:fixed;font-size:11px}.caps td{overflow-wrap:anywhere}}
</style></head><body><main><header><div class="eyebrow">MusicBrainz toolset / Research pilot 01</div><h1>Which scripts can the suite replace?</h1>
<p>Seven source-reviewed comparisons of important editing workflows. Find what is covered, what you would lose, and the evidence behind each judgment.</p>
<p class="dim">A pilot against the ${link(sources.wiki.url, 'MusicBrainz userscript wiki')}. The rest of the listing is not assessed here. “Replaceable” applies only to the stated workflow and versions.</p></header>
<div class="statusline"><span><strong>7</strong> reviewed scripts</span>${[...counts].map(([v,n]) => `<span><strong>${n}</strong> ${esc(v.toLowerCase())}</span>`).join('')}<span><strong>0</strong> live workflow comparisons</span></div>
<p class="notice">AI judgment, preserved evidence. Collection and rendering can be automated; coverage decisions need review. <b>Code-level coverage is not a guarantee that a script currently works or that it is safe to uninstall.</b></p>
<p class="dim">Sources collected <time>${esc(sources.collectedAt)}</time> · Wiki revision ${sources.wiki.revision} · Toolset ${link(`${repoUrl}/commit/${sources.toolset.commit}`, sources.toolset.commit.slice(0,8))}<br>Freshness compares against this collected snapshot, not live upstream state. <span id="collection-age"></span></p>
<section aria-label="Filter comparisons" class="filters"><label>Search scripts, platforms, gaps<input id="search" type="search" placeholder="Try Bandcamp, aliases, AcoustID…"></label>
<label>Coverage<select id="verdict">${options(reviews.map(r => r.verdict),'All verdicts')}</select></label><label>Workflow<select id="workflow">${options(reviews.map(r => r.workflow),'All workflows')}</select></label>
<label>Suite tool<select id="tool"><option value="">All tools</option>${Object.entries(names).map(([id,name]) => `<option value="${id}">${name}</option>`).join('')}<option value="none">No equivalent</option></select></label>
<label>Freshness<select id="freshness">${options(['Reviewed snapshot','Needs review'],'All statuses')}</select></label><button id="reset" type="button">Reset filters</button></section>
<p id="count" class="count" role="status" aria-live="polite">7 of 7 comparisons</p><div class="scroll" tabindex="0" aria-label="Comparison matrix"><table id="matrix"><thead><tr><th>Original script / author</th><th>Coverage</th><th>Suite route</th><th>Important workflow / comparison</th><th>Assessed snapshot</th></tr></thead>${rows}</table></div><p id="empty" hidden>No comparisons match these filters. Reset filters to see all seven.</p>
<section class="method"><h2>How to read this pilot</h2><p><b>Replaceable:</b> important assessed functions covered. <b>Mostly replaceable:</b> main workflow covered with an important limitation. <b>Partial overlap:</b> substantial reasons to keep both. <b>No equivalent:</b> no matching workflow found in the inspected suite inventory.</p>
<p>Confidence is medium throughout: entry scripts and suite implementation/docs were inspected, but external shared dependencies and live end-to-end behavior were not independently verified. “No equivalent” is an inventory finding; it does not rule out a manual workaround.</p>
<p>Versions and SHA-256 hashes are retained separately. Changed source or documentation fingerprints put dependent comparisons back into review. New suite features can also overturn old gaps, so periodic full reconciliation remains necessary. Evidence older than 90 days needs another review.</p>
<h2>Useful gaps to revisit</h2><p>Bandcamp archive/private-stream handling and hidden-track availability; specialist artwork galleries and track images; direct AcoustID candidate handoff; event setlist-text linking; Japanese rights-database work importing. These are research findings, not commitments to add features.</p></section>
<footer>${link('https://github.com/majkinetor/musicbrainz-userscripts/issues/926','Issue #926')} · Original authors retain credit for their work. This report does not modify the wiki or any userscript.<noscript> Search and filters require JavaScript; all comparisons and evidence remain available below their disclosure controls.</noscript></footer></main>
<script type="application/json" id="report-meta">${JSON.stringify({collectedAt:sources.collectedAt, reviews:reviews.map(r=>({id:r.id,reviewedAt:r.reviewedAt}))}).replaceAll('<','\\u003c')}</script><script>
const controls=['search','verdict','workflow','tool','freshness'].map(id=>document.getElementById(id));
const bodies=[...document.querySelectorAll('#matrix>tbody')];
function filter(){const [search,verdict,workflow,tool,freshness]=controls.map(c=>c.value);let count=0;for(const row of bodies){const match=(!search||row.textContent.toLowerCase().includes(search.toLowerCase()))&&(!verdict||row.dataset.verdict===verdict)&&(!workflow||row.dataset.workflow===workflow)&&(!tool||(tool==='none'?!row.dataset.tools:row.dataset.tools.split(' ').includes(tool)))&&(!freshness||row.dataset.freshness===freshness);row.hidden=!match;if(match)count++;}document.getElementById('count').textContent=count+' of '+bodies.length+' comparisons';document.getElementById('empty').hidden=count!==0;}
controls.forEach(c=>c.addEventListener(c.id==='search'?'input':'change',filter));document.getElementById('reset').onclick=()=>{controls.forEach(c=>c.value='');filter();};
const meta=JSON.parse(document.getElementById('report-meta').textContent);const days=Math.floor((Date.now()-Date.parse(meta.collectedAt))/86400000);document.getElementById('collection-age').textContent=days>0?'Collected '+days+' day(s) ago.':'';
for(const r of meta.reviews){if(Date.now()-Date.parse(r.reviewedAt)>90*86400000){const body=bodies.find(b=>b.dataset.id===r.id);body.dataset.freshness='Needs review';body.querySelector('.fresh>span').textContent='Needs review · evidence age';}}filter();
</script></body></html>`;
mkdirSync(path.join(dir, 'out'), { recursive: true });
writeFileSync(path.join(dir, 'out/index.html'), html);
writeFileSync(path.join(dir, 'data/review-queue.json'), JSON.stringify(queue.filter(q => q.reasons.length), null, 2) + '\n');
console.log(`Built ${reviews.length} comparisons; ${queue.filter(q => q.reasons.length).length} need review.`);
