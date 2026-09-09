// #564 (majkinetor): "Apollo pending changes on Recordings could be more
// readable (currently blue over redish)".
//
// My first fix was aimed at the wrong element — the pending-edit tint — and he
// came back with the answer in a DevTools capture: an <a> inside `span.tc-dh`,
// forced to `color: yellow` by hand, looking right. The culprit is the DIFF
// highlight, not the pending one.
//
// `.tc-rectbl .tc-dh` sets its own white foreground for the highlighted run, but
// that run is usually an artist LINK — and `.tc-rectbl td a` (0,1,2) matches the
// <a> directly, where `.tc-dh` only reaches it by inheritance. So the link kept
// its --mbu-info blue and sat on the red wash at 1.13:1. The plain text beside it
// in the very same highlight measured 4.23:1, which is why this read as "only the
// links are wrong".
//
// The fixture is his exact structure, copied from that capture:
//   td.tc-tka > span.tc-dh > a[href="…/artist/7013b20e-…"]
//
// Read-only: every POST is aborted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile(process.env.APOLLO_SRC || 'C:/Work/mb-userscripts/userscripts/apollo_editor/apollo_editor.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => { const st=new Map(); window.GM_getValue=(k,d)=>st.has(k)?st.get(k):d; window.GM_setValue=(k,v)=>st.set(k,v); window.GM_info={script:{name:'apollo',version:'t'}}; });
const page = ctx.pages()[0] || await ctx.newPage();
await page.route(() => true, r => (r.request().method()==='POST' ? r.abort() : r.continue()));
await page.goto('https://musicbrainz.org/release/add', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => window.__apolloEditor, null, { timeout: 60000 });
await page.evaluate(() => { try { window.__apolloEditor.showRecMirror(); } catch (e) {} });
await page.waitForFunction(() => [...document.styleSheets].some(sh => { try { return [...sh.cssRules].some(r => r.selectorText && r.selectorText.includes('tc-dh')); } catch(e){return false;} }), { timeout: 30000 });
const out = await page.evaluate(async () => {
  const parse = s => { let m=s.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?/); if(m) return {r:+m[1]*255,g:+m[2]*255,b:+m[3]*255,a:m[4]===undefined?1:+m[4]}; m=s.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s\/]+([\d.]+))?/); return m?{r:+m[1],g:+m[2],b:+m[3],a:m[4]===undefined?1:+m[4]}:null; };
  const over=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1});
  const lum=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b);};
  const ratio=(a,b)=>{const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);};
  // Exactly the structure from his DevTools capture:
  //   td.tc-tka > span.tc-dh > a[href=/artist/...]
  // Second thing he flagged: the left marker on a modified row.
  const mirror=document.createElement('table'); mirror.className='tc-mirror mbu-ui';
  mirror.innerHTML='<tbody><tr class="tc-changed"><td>1</td><td>Bule bule21</td></tr></tbody>';
  document.body.appendChild(mirror);
  const host=document.createElement('div'); host.id='tc-recwrap'; host.className='mbu-ui';
  host.innerHTML='<table class="tc-rectbl compact alt gridcols"><tbody>'
    + '<tr class="tc-recrow"><td>1</td><td class="tc-tkt">Incomprendidos</td>'
    + '<td class="tc-tka"><span class="tc-dh"><a href="https://musicbrainz.org/artist/7013b20e-43ce-4da3-b1f5-8a644c9873de" target="_blank" rel="noopener">Los 1 Nivram</a></span></td></tr>'
    + '</tbody></table>';
  document.body.appendChild(host);
  const res={};
  for (const t of ['light','dark']) {
    document.documentElement.setAttribute('data-mbu-theme', t);
    await new Promise(r=>requestAnimationFrame(r));
    const span=host.querySelector('span.tc-dh'), a=span.querySelector('a');
    const page=parse(getComputedStyle(document.body).backgroundColor)||{r:255,g:255,b:255,a:1};
    const bg=over(parse(getComputedStyle(span).backgroundColor)||{r:0,g:0,b:0,a:0}, page);
    const fg=over(parse(getComputedStyle(a).color), bg);
    const spanFg=over(parse(getComputedStyle(span).color), bg);
    document.body.style.background = t==='dark' ? '#1e1b24' : '#ffffff';
    await new Promise(r=>requestAnimationFrame(r));
    const rowBg=parse(getComputedStyle(document.body).backgroundColor);
    const sh=getComputedStyle(mirror.querySelector('td:first-child')).boxShadow;
    const mk=sh.match(/(rgba?\([^)]*\)|color\(srgb[^)]*\))/);
    res[t]={ link:getComputedStyle(a).color, spanText:getComputedStyle(span).color, hl:getComputedStyle(span).backgroundColor,
             linkContrast:ratio(fg,bg), plainTextContrast:ratio(spanFg,bg),
             marker:sh, markerContrast: mk ? ratio(parse(mk[1]), rowBg) : null };
  }
  return res;
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
for (const t of ['light','dark']) {
  const m=out[t];
  console.log(`${t}: link ${m.link} on ${m.hl} -> ${m.linkContrast.toFixed(2)}:1   (plain text in the same highlight: ${m.plainTextContrast.toFixed(2)}:1)`);
  console.log(`${t}: modified-row marker ${m.marker} -> ${m.markerContrast.toFixed(2)}:1 vs the row`);
}
for (const t of ['light','dark']) {
  const m = out[t];
  ck(m.linkContrast >= 4.0, `${t}: a link inside the diff highlight is readable on it (${m.linkContrast.toFixed(2)}:1)`);
  // The point is not merely "readable" but "as readable as the text next to it":
  // the highlight owns its foreground, and a link in it is not a special case.
  ck(Math.abs(m.linkContrast - m.plainTextContrast) < 0.01,
    `${t}: and reads exactly like the plain text in the same highlight (${m.linkContrast.toFixed(2)}:1 vs ${m.plainTextContrast.toFixed(2)}:1)`);
  /* "you should also change the blue color on the left that marks modified row,
     it doesn't look very visible" — it was a hard-coded #5f3ec0, the LIGHT
     theme's accent, so on a dark row it scored 2.37:1 against the row it was
     meant to stand out from. */
  ck(m.markerContrast >= 4.5, `${t}: the modified-row marker stands out from the row (${m.markerContrast.toFixed(2)}:1)`);
}
await ctx.close();
console.log(fail ? String.fromCharCode(10) + fail + ' FAILED' : String.fromCharCode(10) + 'ALL PASS');
process.exit(fail ? 1 : 0);
