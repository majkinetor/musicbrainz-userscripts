import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const script = readFileSync('userscripts/group_therapy/group_therapy.user.js', 'utf8');
const MBID = process.argv[2] || 'd3348057-a87d-408e-99d2-34d6bf15e7b0'; // The Köln Concert (live — recording dates)
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1400, height: 1100 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/edit-relationships`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
const loggedIn = await page.evaluate(() => !document.querySelector('a[href="/login"]'));
await page.addScriptTag({ content: script });
await page.waitForTimeout(2000);

// find a rel with a date, via the React fiber the .relationship-item carries
const dated = await page.evaluate(() => {
  const relOf = item => { for (const k in item) if (k.startsWith('__reactFiber')) { let f = item[k], g = 0; while (f && g++ < 40) { const r = f.memoizedProps && f.memoizedProps.relationship; if (r && r.linkTypeID != null) return r; f = f.return; } } return null; };
  const has = r => !!((r.begin_date && r.begin_date.year) || (r.end_date && r.end_date.year) || r.ended);
  const out = [];
  document.querySelectorAll('.relationship-item').forEach((it, i) => {
    const r = relOf(it); if (!r || !has(r)) return;
    const e0 = r.entity0, e1 = r.entity1;
    const other = (e0 && e0.entityType === 'recording') ? e1 : e0;
    if (!other || other.entityType === 'url') return;
    const hasPencil = !!it.querySelector('button.icon.edit-item');
    out.push({ i, other: other.entityType, name: (typeof other.name === 'function' ? other.name() : other.name), hasPencil });
  });
  return out;
});
console.log('logged in:', loggedIn);
console.log('dated recording rels found:', dated.length);
dated.slice(0, 8).forEach(d => console.log(`  #${d.i} ${d.other} "${d.name}" pencil=${d.hasPencil}`));

let popup = null;
if (dated.length) {
  const idx = (dated.find(d => d.hasPencil) || dated[0]).i;
  // right-click the pencil of that rel to open GT's copy menu (which now carries "Set dates from…")
  const menuItems = await page.evaluate(idx => {
    const it = document.querySelectorAll('.relationship-item')[idx];
    const pencil = it.querySelector('button.icon.edit-item') || it;
    const r = pencil.getBoundingClientRect();
    pencil.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 4, clientY: r.top + 4 }));
    return [...document.querySelectorAll('.gt-menu .gt-mi-l')].map(n => n.textContent);
  }, idx);
  console.log('menu items:', JSON.stringify(menuItems));
  // click the "Set dates" item
  const clicked = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.gt-menu .gt-mi')].find(b => /Set dates/.test(b.textContent || ''));
    if (row) { row.click(); return true; } return false;
  });
  await page.waitForTimeout(600);
  popup = await page.evaluate(() => {
    const p = document.querySelector('.gt-dp'); if (!p) return { open: false };
    return {
      open: true,
      title: p.querySelector('.gt-cons-title')?.textContent,
      begin: p.querySelectorAll('.gt-dp-date')[0]?.value,
      end: p.querySelectorAll('.gt-dp-date')[1]?.value,
      roles: [...p.querySelectorAll('.gt-dp-chip')].map(c => c.textContent.replace('×', '').trim()),
      tracks: p.querySelectorAll('.gt-dp-trow').length,
      credits: p.querySelectorAll('.gt-dp-crow').length,
      checked: [...p.querySelectorAll('.gt-dp-crow input')].filter(cb => cb.checked).length,
      dated: p.querySelectorAll('.gt-dp-crow.gt-dp-dated').length,
      plan: p.querySelector('.gt-cons-plan')?.textContent,
      applyDisabled: p.querySelector('.gt-cons-apply')?.disabled,
    };
  });
  console.log('date picker:', JSON.stringify(popup, null, 2));
  await page.screenshot({ path: 'userscripts/group_therapy/dev/_smoke398.png', clip: await page.evaluate(() => { const p = document.querySelector('.gt-dp').getBoundingClientRect(); return { x: p.x - 8, y: p.y - 8, width: p.width + 16, height: Math.min(p.height + 16, 1000) }; }) });

  // verify Apply actually stages dates: count recording rels with a begin_date before/after clicking Apply
  const datedCount = () => page.evaluate(() => {
    const relOf = item => { for (const k in item) if (k.startsWith('__reactFiber')) { let f = item[k], g = 0; while (f && g++ < 40) { const r = f.memoizedProps && f.memoizedProps.relationship; if (r && r.linkTypeID != null) return r; f = f.return; } } return null; };
    let n = 0; document.querySelectorAll('.relationship-item').forEach(it => { const r = relOf(it); if (r && r.begin_date && r.begin_date.year) n++; }); return n;
  });
  const before = await datedCount();
  await page.evaluate(() => document.querySelector('.gt-dp .gt-cons-apply')?.click());
  await page.waitForTimeout(2500);
  const after = await datedCount();
  const toast = await page.evaluate(() => document.querySelector('.gt-toast')?.textContent || '');
  const err = await page.evaluate(() => (window.MB && window.MB.relationshipEditor && window.MB.relationshipEditor.state.reducerError) || null);
  console.log(`APPLY: rels with begin_date ${before} -> ${after} (expect +${popup.checked}) | toast: "${toast}" | reducerError: ${err}`);
}
console.log('pageerrors:', errs.length ? errs.slice(0, 5) : 'none');
await ctx.close();
