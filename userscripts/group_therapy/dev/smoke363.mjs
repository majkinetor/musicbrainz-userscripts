import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const script = readFileSync('userscripts/group_therapy/group_therapy.user.js', 'utf8');
const MBID = '1fba770d-16c5-4907-b110-a49aaac32c1e'; // The RCA Session — jazz standards (works exist)
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1500, height: 1100 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/edit-relationships`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const loggedIn = await page.evaluate(() => !document.querySelector('a[href="/login"]') && !!document.querySelector('h2'));
await page.addScriptTag({ content: script });
await page.waitForTimeout(2500);
const btn = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button.gt-clone-btn')].find(x => /Match works/.test(x.textContent || ''));
  return !!b;
});
console.log('logged in:', loggedIn);
console.log('Match works button present:', btn);
if (btn) {
  await page.evaluate(() => [...document.querySelectorAll('button.gt-clone-btn')].find(x => /Match works/.test(x.textContent || '')).click());
  // matrix appears immediately with rows pending ("matching…")
  await page.waitForTimeout(700);
  const early = await page.evaluate(() => ({ rows: document.querySelectorAll('.gt-wm-row').length, matching: [...document.querySelectorAll('.gt-wm-wk')].filter(n => /matching…/.test(n.textContent)).length }));
  console.log(`immediate render: ${early.rows} rows visible, ${early.matching} still "matching…"`);
  for (let i = 0; i < 60; i++) {
    const pending = await page.evaluate(() => [...document.querySelectorAll('.gt-wm-wk')].filter(n => /matching…/.test(n.textContent)).length);
    if (!pending && i > 0) break;
    await page.waitForTimeout(1500);
  }
  const res = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.gt-wm-row')].map(tr => {
      const tk = (tr.querySelector('.gt-wm-tkt')?.textContent || '').trim();
      const ar = (tr.querySelector('.gt-wm-tka')?.textContent || '').trim();
      const d = tr.querySelector('.gt-wm-dot'); const dot = d && d.style.visibility !== 'hidden' ? d.style.background : '';
      const wa = tr.querySelector('.gt-wm-wa'), nt = tr.querySelector('.gt-wm-newtag'), nn = tr.querySelector('.gt-wm-none');
      const wk = wa ? wa.textContent.trim() : nt ? nt.textContent.trim() : nn ? '— none —' : '';
      return { tk, ar, dot, wk, authors: (tr.querySelector('.gt-wm-authors')?.textContent || '').trim(), resolved: !!(wa || nt) };
    });
    return { count: rows.length, warn: document.querySelector('.gt-wm-warn')?.textContent || '', data: rows };
  });
  console.log('modal rows:', res.count, '| header:', res.warn || '(0 unresolved)');
  res.data.forEach(r => console.log(`  [${r.resolved ? 'x' : ' '}] ${r.tk} — ${r.ar}  ${r.dot}  -> ${r.wk}${r.authors ? '  {' + r.authors + '}' : ''}`));
  console.log('rows with BOTH performer + work-writers:', res.data.filter(r => r.ar && r.authors).length);
  await page.screenshot({ path: 'userscripts/group_therapy/dev/_smoke363.png' });
  // Apply stages every resolved row (never submits)
  const before = await page.evaluate(() => document.querySelectorAll('.relationship-item a[href*="/work/"]').length);
  await page.evaluate(() => document.querySelector('.gt-cons-apply')?.click()); await page.waitForTimeout(6000);
  const applied = await page.evaluate(() => ({ relWorks: document.querySelectorAll('.relationship-item a[href*="/work/"]').length, toast: document.querySelector('.gt-toast')?.textContent || '', err: window.MB.relationshipEditor.state.reducerError || null }));
  console.log(`apply resolved: editor work-rels ${before} -> ${applied.relWorks} | toast: "${applied.toast}" | reducerError: ${applied.err}`);
  await page.screenshot({ path: 'userscripts/group_therapy/dev/_smoke363_applied.png' });
}
console.log('pageerrors:', errs.length ? errs.slice(0, 5) : 'none');
await ctx.close();
