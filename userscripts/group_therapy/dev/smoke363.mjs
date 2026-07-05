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
  // wait for matching to finish (throttled WS2)
  for (let i = 0; i < 40; i++) {
    const note = await page.evaluate(() => { const n = document.querySelector('.gt-cons .gt-pop-note'); return n ? n.textContent : null; });
    const rows = await page.evaluate(() => document.querySelectorAll('.gt-wm-tbl tr').length);
    if (rows > 1) break;
    await page.waitForTimeout(1500);
  }
  const res = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.gt-wm-tbl tr')].slice(1);
    const data = rows.map(tr => {
      const tk = tr.querySelector('.gt-wm-tk')?.textContent?.trim() || '';
      const dot = tr.querySelector('.gt-wm-dot');
      const color = dot ? dot.style.background : '';
      const wk = tr.querySelector('.gt-wm-wa')?.textContent?.trim() || tr.querySelector('.gt-wm-dim')?.textContent?.trim() || '';
      const ticked = tr.querySelector('input[type=checkbox]')?.checked;
      return { tk, color, wk, ticked };
    });
    return { count: rows.length, data };
  });
  console.log('modal rows:', res.count);
  res.data.forEach(r => console.log(`  [${r.ticked ? 'x' : ' '}] ${r.tk}  ${r.color}  -> ${r.wk}`));
  await page.screenshot({ path: 'userscripts/group_therapy/dev/_smoke363.png' });
  // verify Apply STAGES recording→work rels into the editor (never submits — safe)
  const relWorksBefore = await page.evaluate(() => document.querySelectorAll('.relationship-item a[href*="/work/"]').length);
  await page.evaluate(() => document.querySelector('.gt-cons-apply')?.click());
  await page.waitForTimeout(6000);
  const applied = await page.evaluate(() => ({
    relWorks: document.querySelectorAll('.relationship-item a[href*="/work/"]').length,
    toast: document.querySelector('.gt-toast')?.textContent || '',
  }));
  console.log(`apply: editor work-rels ${relWorksBefore} -> ${applied.relWorks} | toast: "${applied.toast}"`);
  await page.screenshot({ path: 'userscripts/group_therapy/dev/_smoke363_applied.png' });
}
console.log('pageerrors:', errs.length ? errs.slice(0, 5) : 'none');
await ctx.close();
