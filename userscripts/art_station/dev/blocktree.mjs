import { createRequire } from 'module';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = '6bf7a85c-330b-4d8d-bd0d-a33759a5cfb9';
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 900 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'domcontentloaded' });
const dump = await page.evaluate(() => {
  const walk = (el, d = 0) => {
    let out = [];
    el.childNodes.forEach(n => {
      if (n.nodeType === 3) { const t = n.textContent.trim(); if (t) out.push(`${'  '.repeat(d)}#text ${JSON.stringify(t)}`); }
      else if (n.nodeType === 1 && n.tagName !== 'NOSCRIPT' && n.tagName !== 'A') {
        out.push(`${'  '.repeat(d)}<${n.tagName.toLowerCase()}${n.className?'.'+n.className:''}>${n.children.length===0?' '+JSON.stringify(n.textContent.trim().slice(0,50)):''}`);
        if (n.children.length) out = out.concat(walk(n, d + 1));
      }
    });
    return out;
  };
  return [...document.querySelectorAll('.artwork-cont')].map((b, i) => `=== block ${i} (id ${(b.innerHTML.match(/edit-cover-art\/(\d+)/)||[])[1]}) ===\n` + walk(b).join('\n')).join('\n\n');
});
console.log(dump);
await ctx.close();
