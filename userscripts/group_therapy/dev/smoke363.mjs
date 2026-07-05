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
  // the matrix should appear IMMEDIATELY with all rows pending ("matching…") — capture that first
  await page.waitForTimeout(700);
  const early = await page.evaluate(() => ({ rows: Math.max(0, document.querySelectorAll('.gt-wm-tbl tr').length - 1), matching: [...document.querySelectorAll('.gt-wm-wk')].filter(n => /matching…/.test(n.textContent)).length }));
  console.log(`immediate render: ${early.rows} rows visible, ${early.matching} still "matching…"`);
  // then wait until every row has resolved
  for (let i = 0; i < 60; i++) {
    const pending = await page.evaluate(() => [...document.querySelectorAll('.gt-wm-wk')].filter(n => /matching…/.test(n.textContent)).length);
    if (!pending && i > 0) break;
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
  await page.waitForTimeout(9000); // let lazy writer-loading finish
  const writers = await page.evaluate(() => [...document.querySelectorAll('.gt-wm-wr')].map(n => n.textContent).filter(Boolean).length);
  console.log('rows showing writers:', writers);
  await page.screenshot({ path: 'userscripts/group_therapy/dev/_smoke363.png' });
  const clickBtn = re => page.evaluate(r => { const b = [...document.querySelectorAll('.gt-cons-btn, .gt-wm-new, .gt-cons-apply')].find(x => new RegExp(r).test(x.textContent || '')); if (b) { b.click(); return true; } return false; }, re);
  // existing-work Apply stages rels (never submits)
  const before = await page.evaluate(() => document.querySelectorAll('.relationship-item a[href*="/work/"]').length);
  await clickBtn('Apply'); await page.waitForTimeout(6000);
  const applied = await page.evaluate(() => ({ relWorks: document.querySelectorAll('.relationship-item a[href*="/work/"]').length, toast: document.querySelector('.gt-toast')?.textContent || '', err: window.MB.relationshipEditor.state.reducerError || null }));
  console.log(`existing-work apply: editor work-rels ${before} -> ${applied.relWorks} | toast: "${applied.toast}" | reducerError: ${applied.err}`);
  // ＋ new work path: Clear, "+ new for rest", verify tags, Apply, confirm the reducer accepts the new works
  await clickBtn('Clear'); await clickBtn('new for rest'); await page.waitForTimeout(500);
  const newtags = await page.evaluate(() => document.querySelectorAll('.gt-wm-newtag').length);
  await clickBtn('Apply'); await page.waitForTimeout(6000);
  const newApplied = await page.evaluate(() => ({ toast: document.querySelector('.gt-toast')?.textContent || '', err: window.MB.relationshipEditor.state.reducerError ? String(window.MB.relationshipEditor.state.reducerError).slice(0, 150) : null }));
  console.log(`new-work path: tags=${newtags} | apply toast: "${newApplied.toast}" | reducerError: ${newApplied.err}`);
  await page.screenshot({ path: 'userscripts/group_therapy/dev/_smoke363_applied.png' });
}
console.log('pageerrors:', errs.length ? errs.slice(0, 5) : 'none');
await ctx.close();
