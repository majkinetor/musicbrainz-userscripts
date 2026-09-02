// Builds a single self-contained interactive HTML dashboard from the snapshot.
// All data is embedded; the page makes no network requests and works offline.
// Every aggregate (per day/month, per user, per type, per version, accepted vs
// rejected) is computed in-browser from the embedded edit list, so filters
// (which scripts, exclude the author, day vs month) recompute instantly.

const PALETTE = ['#7a4fd0', '#2e9bd6', '#e0732f', '#3bb273', '#d64570', '#c9a227', '#7d8aa8', '#9b5de5'];
const AUTHOR = 'majkinetor';

export function buildDashboard(snap) {
  const edits = Object.values(snap.edits).filter(e => e.date); // need a date to chart
  const scriptMeta = Object.values(snap.scripts).map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] }));
  const payload = {
    generatedAt: snap.generatedAt,
    cutoff: snap.cutoff,
    author: AUTHOR,
    scripts: scriptMeta,
    edits,
  };
  const json = JSON.stringify(payload).replace(/</g, '\\u003c'); // safe inside <script>
  return HEAD + '<script>\nconst DATA = ' + json + ';\n' + CLIENT + '\n</script>\n' + TAIL;
}

const HEAD = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MB Userscript Usage</title>
<style>
:root{--bg:#16131f;--panel:#1f1b2b;--panel2:#272135;--ink:#ece8f5;--mut:#9d94b5;--line:#352c4a;--acc:#7a4fd0}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
a{color:#b79bf0;text-decoration:none}a:hover{text-decoration:underline}
header{padding:22px 26px 10px}
h1{margin:0 0 2px;font-size:21px}
.sub{color:var(--mut);font-size:12.5px}
.wrap{padding:0 26px 60px;max-width:1180px}
.cards{display:flex;flex-wrap:wrap;gap:12px;margin:18px 0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 16px;min-width:130px}
.card .n{font-size:24px;font-weight:700}
.card .l{color:var(--mut);font-size:11.5px;text-transform:uppercase;letter-spacing:.04em}
.controls{display:flex;flex-wrap:wrap;gap:14px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin-bottom:18px}
.chips{display:flex;flex-wrap:wrap;gap:7px}
.chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:20px;border:1px solid var(--line);background:var(--panel2);cursor:pointer;font-size:12.5px;user-select:none}
.chip .dot{width:9px;height:9px;border-radius:50%}
.chip.off{opacity:.38}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.seg button{background:var(--panel2);color:var(--ink);border:0;padding:5px 11px;cursor:pointer;font-size:12.5px}
.seg button.on{background:var(--acc)}
label.tog{display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:12.5px;color:var(--mut)}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin-bottom:18px}
.panel h2{margin:0 0 12px;font-size:14px;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;font-weight:600}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
@media(max-width:820px){.grid2{grid-template-columns:1fr}}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:6px 9px;border-bottom:1px solid var(--line);white-space:nowrap}
th{color:var(--mut);font-weight:600;cursor:pointer;font-size:11.5px;text-transform:uppercase;letter-spacing:.03em}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.bar{height:7px;border-radius:4px;background:var(--acc);display:inline-block;vertical-align:middle}
tbody tr:hover{background:var(--panel2)}
.scroll{max-height:420px;overflow:auto}
svg text{fill:var(--mut);font-size:10px}
.legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;font-size:12px;color:var(--mut)}
.legend span{display:inline-flex;align-items:center;gap:5px}
.tip{position:fixed;pointer-events:none;background:#0c0a12;border:1px solid var(--line);border-radius:8px;padding:7px 10px;font-size:12px;z-index:9;display:none;box-shadow:0 6px 20px rgba(0,0,0,.5)}
.muted{color:var(--mut)}
.warn{color:#e0a13f}
</style></head><body>
<header><h1>MusicBrainz Userscript Usage</h1><div class="sub" id="sub"></div></header>
<div class="wrap">
<div class="cards" id="cards"></div>
<div class="controls" id="controls"></div>
<div class="panel"><h2 id="chartTitle">Edits over time</h2><div id="chart"></div><div class="legend" id="legend"></div></div>
<div class="panel"><h2>Per script</h2><div id="byScript"></div></div>
<div class="grid2">
  <div class="panel"><h2>Individual MB users <span class="muted" id="userCount"></span></h2><div class="scroll" id="users"></div></div>
  <div class="panel"><h2>Edit types</h2><div class="scroll" id="types"></div></div>
</div>
<div class="grid2">
  <div class="panel"><h2>Outcomes &amp; status</h2><div id="status"></div></div>
  <div class="panel"><h2>Script versions in the wild</h2><div class="scroll" id="versions"></div></div>
</div>
</div>
<div class="tip" id="tip"></div>
`;

const TAIL = `</body></html>`;

// Client code: plain string, NO template literals / ${} so it nests cleanly.
const CLIENT = `
const MB='https://musicbrainz.org';
const ACCEPT=new Set(['applied']);
const PENDING=new Set(['open']);
const NOCHANGE=new Set(['evalnochange']);
function outcome(s){ if(ACCEPT.has(s))return'accepted'; if(PENDING.has(s))return'pending'; if(NOCHANGE.has(s))return'no change'; return'rejected'; }
const COLOR={}; DATA.scripts.forEach(function(s){COLOR[s.slug]=s.color;});
const NAME={}; DATA.scripts.forEach(function(s){NAME[s.slug]=s.name;});
const fmtN=function(n){return n.toLocaleString();};
const period=function(iso,g){return g==='day'?iso.slice(0,10):iso.slice(0,7);};

const state={sel:new Set(DATA.scripts.filter(function(s){return s.total>0;}).map(function(s){return s.slug;})),excl:false,gran:'month',userSort:'edits'};
if(state.sel.size===0)DATA.scripts.forEach(function(s){state.sel.add(s.slug);});

function filtered(){
  return DATA.edits.filter(function(e){
    if(!state.sel.has(e.script))return false;
    if(state.excl && e.editor && e.editor.toLowerCase()===DATA.author.toLowerCase())return false;
    return true;
  });
}

function el(tag,attrs,html){var n=document.createElement(tag);if(attrs)for(var k in attrs)n.setAttribute(k,attrs[k]);if(html!=null)n.innerHTML=html;return n;}
function svgEl(tag,attrs){var n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(var k in attrs)n.setAttribute(k,attrs[k]);return n;}

function renderCards(rows){
  var users={},acc=0,rej=0,pend=0,minD=null,maxD=null;
  rows.forEach(function(e){ if(e.editor)users[e.editor]=1; var o=outcome(e.status); if(o==='accepted')acc++;else if(o==='pending')pend++;else if(o==='rejected')rej++; if(e.date){if(!minD||e.date<minD)minD=e.date; if(!maxD||e.date>maxD)maxD=e.date;} });
  var cards=[['Edits',fmtN(rows.length)],['MB users',fmtN(Object.keys(users).length)],['Accepted',fmtN(acc)],['Rejected/failed',fmtN(rej)],['Open',fmtN(pend)],['Active scripts',fmtN(state.sel.size)]];
  var c=document.getElementById('cards');c.innerHTML='';
  cards.forEach(function(x){var d=el('div',{'class':'card'});d.appendChild(el('div',{'class':'n'},x[1]));d.appendChild(el('div',{'class':'l'},x[0]));c.appendChild(d);});
  var range=(minD?minD.slice(0,10):'—')+' → '+(maxD?maxD.slice(0,10):'—');
  document.getElementById('sub').innerHTML='Generated '+(DATA.generatedAt?DATA.generatedAt.replace('T',' ').slice(0,16)+' UTC':'—')+' · data range '+range+' · cutoff '+DATA.cutoff;
}

function renderControls(){
  var c=document.getElementById('controls');c.innerHTML='';
  var chips=el('div',{'class':'chips'});
  DATA.scripts.forEach(function(s){
    var on=state.sel.has(s.slug);
    var chip=el('div',{'class':'chip'+(on?'':' off'),title:s.note||''});
    chip.appendChild(el('span',{'class':'dot',style:'background:'+s.color}));
    chip.appendChild(el('span',null,s.name+' '+(s.total?'('+fmtN(s.total)+')':'(0)')));
    chip.onclick=function(){ if(state.sel.has(s.slug))state.sel.delete(s.slug);else state.sel.add(s.slug); renderAll(); };
    chips.appendChild(chip);
  });
  c.appendChild(chips);
  var seg=el('div',{'class':'seg'});
  ['month','day'].forEach(function(g){var b=el('button',{'class':state.gran===g?'on':''},g);b.onclick=function(){state.gran=g;renderAll();};seg.appendChild(b);});
  c.appendChild(seg);
  var tog=el('label',{'class':'tog'});var cb=el('input',{type:'checkbox'});if(state.excl)cb.setAttribute('checked','');cb.onchange=function(){state.excl=cb.checked;renderAll();};
  tog.appendChild(cb);tog.appendChild(el('span',null,'exclude '+DATA.author+' (only other editors)'));c.appendChild(tog);
}

function renderChart(rows){
  var slugs=DATA.scripts.map(function(s){return s.slug;}).filter(function(s){return state.sel.has(s);});
  var byP={};var periods=[];
  rows.forEach(function(e){var p=period(e.date,state.gran);if(!byP[p]){byP[p]={};periods.push(p);}byP[p][e.script]=(byP[p][e.script]||0)+1;});
  periods.sort();
  // fill gaps for month granularity so the axis is continuous
  var host=document.getElementById('chart');host.innerHTML='';
  if(periods.length===0){host.appendChild(el('div',{'class':'muted'},'No edits for this selection.'));return;}
  var W=Math.max(620,periods.length*(state.gran==='day'?9:46)),H=240,padL=42,padB=46,padT=10;
  var max=0;periods.forEach(function(p){var t=0;for(var s in byP[p])t+=byP[p][s];if(t>max)max=t;});
  max=Math.max(1,max);
  var svg=svgEl('svg',{width:'100%',viewBox:'0 0 '+W+' '+H,preserveAspectRatio:'xMinYMid meet'});
  var plotH=H-padB-padT,plotW=W-padL-8;
  // y gridlines
  for(var g=0;g<=4;g++){var yv=Math.round(max*g/4);var y=padT+plotH-(plotH*g/4);
    svg.appendChild(svgEl('line',{x1:padL,y1:y,x2:W-8,y2:y,stroke:'#352c4a','stroke-width':1}));
    var tx=svgEl('text',{x:padL-6,y:y+3,'text-anchor':'end'});tx.textContent=yv;svg.appendChild(tx);}
  var bw=plotW/periods.length;
  periods.forEach(function(p,i){
    var x=padL+i*bw+bw*0.12,w=bw*0.76,acc=0;
    slugs.forEach(function(s){var v=byP[p][s]||0;if(!v)return;var h=plotH*v/max;var y=padT+plotH-acc-h;acc+=h;
      var r=svgEl('rect',{x:x,y:y,width:w,height:h,fill:COLOR[s]||'#888',rx:1});
      r.addEventListener('mousemove',function(ev){showTip(ev,p,byP[p]);});
      r.addEventListener('mouseleave',hideTip);
      svg.appendChild(r);});
    if(state.gran==='month'||i%Math.ceil(periods.length/14)===0){var t=svgEl('text',{x:padL+i*bw+bw/2,y:H-padB+16,'text-anchor':'middle'});t.setAttribute('transform','rotate(35 '+(padL+i*bw+bw/2)+' '+(H-padB+16)+')');t.textContent=p;svg.appendChild(t);}
  });
  host.appendChild(svg);
  var lg=document.getElementById('legend');lg.innerHTML='';
  slugs.forEach(function(s){var sp=el('span');sp.appendChild(el('span',{'class':'dot',style:'width:10px;height:10px;border-radius:2px;display:inline-block;background:'+COLOR[s]}));sp.appendChild(document.createTextNode(' '+NAME[s]));lg.appendChild(sp);});
  document.getElementById('chartTitle').textContent='Edits per '+state.gran;
}
function showTip(ev,p,counts){var t=document.getElementById('tip');var rows=Object.keys(counts).sort(function(a,b){return counts[b]-counts[a];}).map(function(s){return '<span style=\"color:'+(COLOR[s]||'#fff')+'\">●</span> '+NAME[s]+': '+counts[s];});var tot=Object.keys(counts).reduce(function(a,s){return a+counts[s];},0);t.innerHTML='<b>'+p+'</b> — '+tot+' edits<br>'+rows.join('<br>');t.style.display='block';t.style.left=Math.min(ev.clientX+14,innerWidth-200)+'px';t.style.top=(ev.clientY+14)+'px';}
function hideTip(){document.getElementById('tip').style.display='none';}

function tableHTML(headers,rows){
  var h='<table><thead><tr>'+headers.map(function(x){return '<th class=\"'+(x.num?'num':'')+'\">'+x.t+'</th>';}).join('')+'</tr></thead><tbody>';
  h+=rows.map(function(r){return '<tr>'+r.map(function(c,i){return '<td class=\"'+(headers[i].num?'num':'')+'\">'+c+'</td>';}).join('')+'</tr>';}).join('');
  return h+'</tbody></table>';
}

function renderByScript(rows){
  var m={};rows.forEach(function(e){var s=e.script;if(!m[s])m[s]={n:0,u:{},acc:0,rej:0,pend:0,first:null,last:null};var o=m[s];o.n++;if(e.editor)o.u[e.editor]=1;var oc=outcome(e.status);if(oc==='accepted')o.acc++;else if(oc==='pending')o.pend++;else if(oc==='rejected')o.rej++;if(e.date){if(!o.first||e.date<o.first)o.first=e.date;if(!o.last||e.date>o.last)o.last=e.date;}});
  var maxN=0;for(var s in m)maxN=Math.max(maxN,m[s].n);
  var order=DATA.scripts.filter(function(s){return m[s.slug];}).sort(function(a,b){return m[b.slug].n-m[a.slug].n;});
  var rowsH=order.map(function(s){var o=m[s.slug];var pct=maxN?Math.round(o.n/maxN*100):0;
    return ['<span class=\"dot\" style=\"display:inline-block;width:9px;height:9px;border-radius:50%;background:'+s.color+';margin-right:6px\"></span>'+s.name,
      '<span class=\"bar\" style=\"width:'+Math.max(2,pct)+'px;background:'+s.color+'\"></span> '+fmtN(o.n),
      fmtN(Object.keys(o.u).length),fmtN(o.acc),fmtN(o.rej),fmtN(o.pend),
      (o.first?o.first.slice(0,10):'—'),(o.last?o.last.slice(0,10):'—')];});
  document.getElementById('byScript').innerHTML=tableHTML(
    [{t:'Script'},{t:'Edits',num:1},{t:'Users',num:1},{t:'Accepted',num:1},{t:'Rej/fail',num:1},{t:'Open',num:1},{t:'First'},{t:'Last'}],rowsH);
}

function renderUsers(rows){
  var m={};rows.forEach(function(e){var u=e.editor||'(unknown)';if(!m[u])m[u]={n:0,s:{},last:null};var o=m[u];o.n++;o.s[e.script]=(o.s[e.script]||0)+1;if(e.date&&(!o.last||e.date>o.last))o.last=e.date;});
  var arr=Object.keys(m).map(function(u){return {u:u,n:m[u].n,s:m[u].s,last:m[u].last};});
  arr.sort(function(a,b){return state.userSort==='last'?(b.last||'').localeCompare(a.last||''):b.n-a.n;});
  document.getElementById('userCount').textContent='('+arr.length+')';
  var maxN=arr.length?arr[0].n:1;
  var rowsH=arr.map(function(r){
    var dots=DATA.scripts.filter(function(s){return r.s[s.slug];}).map(function(s){return '<span title=\"'+s.name+': '+r.s[s.slug]+'\" style=\"display:inline-block;width:9px;height:9px;border-radius:50%;background:'+s.color+';margin-right:3px\"></span>';}).join('');
    var name=r.u==='(unknown)'?'<span class=\"muted\">(unknown)</span>':'<a href=\"'+MB+'/user/'+encodeURIComponent(r.u)+'\" target=\"_blank\" rel=\"noopener\">'+r.u+'</a>';
    return [name,'<span class=\"bar\" style=\"width:'+Math.max(2,Math.round(r.n/maxN*90))+'px\"></span> '+fmtN(r.n),dots,(r.last?r.last.slice(0,10):'—')];});
  var t=tableHTML([{t:'MB user'},{t:'Edits',num:1},{t:'Scripts'},{t:'Last active'}],rowsH);
  var host=document.getElementById('users');host.innerHTML=t;
  var ths=host.querySelectorAll('th');ths[1].onclick=function(){state.userSort='edits';renderAll();};ths[3].onclick=function(){state.userSort='last';renderAll();};
}

function renderTypes(rows){
  var m={};rows.forEach(function(e){m[e.type]=(m[e.type]||0)+1;});
  var arr=Object.keys(m).map(function(t){return [t,m[t]];}).sort(function(a,b){return b[1]-a[1];});
  var max=arr.length?arr[0][1]:1;
  document.getElementById('types').innerHTML=tableHTML([{t:'Edit type'},{t:'Count',num:1}],
    arr.map(function(x){return [x[0],'<span class=\"bar\" style=\"width:'+Math.max(2,Math.round(x[1]/max*90))+'px\"></span> '+fmtN(x[1])];}));
}

function renderStatus(rows){
  var oc={accepted:0,rejected:0,pending:0,'no change':0};var st={};
  rows.forEach(function(e){oc[outcome(e.status)]++;st[e.status]=(st[e.status]||0)+1;});
  var total=rows.length||1;
  var bars=Object.keys(oc).map(function(k){var pct=Math.round(oc[k]/total*100);var col=k==='accepted'?'#3bb273':k==='rejected'?'#d64570':k==='pending'?'#c9a227':'#7d8aa8';
    return '<div style=\"margin:4px 0\"><div class=\"muted\" style=\"display:flex;justify-content:space-between\"><span>'+k+'</span><span>'+fmtN(oc[k])+' · '+pct+'%</span></div><div style=\"height:8px;border-radius:5px;background:'+col+';width:'+Math.max(1,pct)+'%\"></div></div>';}).join('');
  var stArr=Object.keys(st).map(function(k){return [k,st[k]];}).sort(function(a,b){return b[1]-a[1];});
  document.getElementById('status').innerHTML=bars+'<div style=\"margin-top:10px\">'+tableHTML([{t:'Raw status'},{t:'Count',num:1}],stArr.map(function(x){return [x[0],fmtN(x[1])];}))+'</div>';
}

function renderVersions(rows){
  var m={};rows.forEach(function(e){if(!e.version)return;var key=e.script+'|'+e.version;m[key]=(m[key]||0)+1;});
  var arr=Object.keys(m).map(function(k){var p=k.split('|');return [NAME[p[0]]||p[0],p[1],m[k]];}).sort(function(a,b){return b[2]-a[2];});
  if(arr.length===0){document.getElementById('versions').innerHTML='<div class=\"muted\">No version stamps parsed.</div>';return;}
  document.getElementById('versions').innerHTML=tableHTML([{t:'Script'},{t:'Version'},{t:'Edits',num:1}],
    arr.map(function(x){return [x[0],x[1],fmtN(x[2])];}));
}

function renderAll(){var rows=filtered();renderControls();renderCards(rows);renderChart(rows);renderByScript(rows);renderUsers(rows);renderTypes(rows);renderStatus(rows);renderVersions(rows);}
renderAll();
`;
