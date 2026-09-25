// #609 (NicolasPL64): a newly added URL with no relationship type yet shows only
// a chevron — "I can't see where I'm supposed to click to add the relationship
// type". majkinetor: "Regarding combo, I will add a border."
//
// Stages a URL MB can't auto-type on test.musicbrainz.org's release editor
// (never submitted — POSTs aborted), then asserts the empty type <select> has a
// visible border and a click-worthy size, and screenshots it.
// APOLLO_SRC=<old build> to see the borderless one.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.APOLLO_SRC || resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');
const SHOT = process.env.SHOT || resolve(HERE, 'logs', '609-link-type.png');
const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 3 });
await ctx.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
  window.GM_setValue = (k, v) => s.set(k, v);
  window.GM_info = { script: { name: 'Apollo', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
for (let a = 1; ; a++) {
  try { await page.goto(`https://test.musicbrainz.org/release/${RELEASE}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 4) throw e; await page.waitForTimeout(5000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(5000);
const posted = [];
await page.route(() => true, route => { const r = route.request(); if (r.method() === 'POST') { posted.push(r.url()); return route.abort(); } return route.continue(); });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => document.body.classList.contains('tc-ri-on'), null, { timeout: 20000 });

// a URL no MB cleanup rule knows → the type stays unset and MB shows the <select>
const input = page.locator('#external-links-editor input[type=url]').last();
await input.fill('https://example.org/some-page-609');
await input.press('Tab');
await page.waitForTimeout(1500);
const sel = await page.evaluate(() => {
  const row = [...document.querySelectorAll('#external-links-editor tr.external-link-item')].find(tr => /example\.org\/some-page-609/.test(tr.textContent + [...tr.querySelectorAll('input')].map(i => i.value).join(' ')));
  let s = null;
  for (let tr = row && row.nextElementSibling; tr && !tr.classList.contains('external-link-item'); tr = tr.nextElementSibling) { s = tr.querySelector('select'); if (s) break; }
  if (!s) return null;
  s.scrollIntoView({ block: 'center' });
  const cs = getComputedStyle(s), r = s.getBoundingClientRect(), rr = row.getBoundingClientRect();
  return { value: s.value, border: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor, width: Math.round(r.width), height: Math.round(r.height),
    clip: { x: rr.left - 4, y: rr.top - 4, width: Math.min(700, rr.width + 8), height: r.bottom - rr.top + 12 } };
});
console.log('type select:', JSON.stringify(sel));
ck(!!sel, 'the new URL has a relationship-type select');
if (sel) {
  ck(sel.value === '' || sel.value == null, 'no type selected yet (the #609 state)');
  ck(/^1px solid/.test(sel.border), `select has a visible border (${sel.border})`);
  ck(sel.width >= 60 && sel.height >= 16, `select is a real click target (${sel.width}×${sel.height})`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOT, clip: sel.clip });
  console.log('screenshot:', SHOT);
}
ck(!posted.some(u => /\/ws\/js\/edit\/create|\/release\/[0-9a-f-]{36}\/edit(?:[?#]|$)/.test(u)), 'nothing submitted');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
