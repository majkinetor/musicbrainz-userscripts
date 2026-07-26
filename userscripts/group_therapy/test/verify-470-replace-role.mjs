// #470 (majkinetor, from a community request): "All the works have 'writer'
// instead of 'composer'. It'd be awesome if I could just mark all writers on
// highlighted works and change them from 'writer' to 'composer'."
//
// MB has no bulk "change relationship type", so Replace role is a remove +
// re-add of the same entity pair under a different link type, dispatched
// through the same editor state everything else in GT uses.
//
// Runs against test.musicbrainz.org (the sanctioned sandbox) and never submits
// — every edit POST is blocked, so this only exercises the editor's staged
// state, which is exactly what the user reviews before saving.
//
// Two real bugs this guards against, both found live:
//   * MB keys linkedEntities.link_type by BOTH numeric id and gid, so a naive
//     Object.values() listed every candidate role twice in the picker.
//   * Picking a role the entity ALREADY has is a no-op (MB marks it rel-noop,
//     no rel-add) — so the test deliberately picks a role that isn't present,
//     or it would pass without proving anything.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/group_therapy/group_therapy.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Group Therapy', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
let posts = 0;
await page.route('**/*', route => {
  const r = route.request();
  if (r.method() === 'POST' && /\/edit/.test(r.url())) { posts++; return route.abort(); }
  return route.continue();
});
await page.goto('https://test.musicbrainz.org/release/3a37a35f-1e06-457f-9b2a-46155c5c03ce/edit-relationships', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(4500);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__groupTherapy, { timeout: 15000 });
await page.waitForTimeout(1500);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// locate a work credit rel item via GT's own relEnds
const found = await page.evaluate(() => {
  const GT = window.__groupTherapy;
  for (const it of document.querySelectorAll('.relationship-item')) {
    // relFromNode isn't exported; use relEnds on the rel we can reach via GT.workCreditRels? Instead
    // reuse replaceRoleMenuItems: it returns [] when the item isn't a replaceable credit.
    const items = GT.replaceRoleMenuItems(it);
    if (items && items.length) {
      return { text: it.textContent.trim().replace(/\s+/g,' ').slice(0,60), labels: items.filter(x => x.label).map(x => x.label + ' [' + x.sub + ']') };
    }
  }
  return null;
});
console.log('first replaceable credit:', JSON.stringify(found, null, 1));
ck(!!found, 'replaceRoleMenuItems finds a replaceable credit in the editor');
ck(found && found.labels.some(l => /^Replace role /.test(l)), 'offers "Replace role <role>…"');
ck(found && found.labels.some(l => /^Replace .* for /.test(l)), 'offers "Replace <role> for <target>…"');

// candidate roles for that credit
const roles = await page.evaluate(() => {
  const GT = window.__groupTherapy;
  for (const it of document.querySelectorAll('.relationship-item')) {
    if (!GT.replaceRoleMenuItems(it).length) continue;
    // dig the rel out through the same path replaceRoleMenuItems uses
    const rel = (function find(node){ for (const k in node) if (k.startsWith('__reactFiber$')) { let f = node[k]; let d=0; while (f && d++<40) { const s=f.memoizedProps && f.memoizedProps.relationship; if (s && 'linkTypeID' in s) return s; f=f.return; } } return null; })(it);
    if (!rel) continue;
    const r = GT.replacementRoles(rel);
    return { current: rel.linkTypeID, count: r.length, sample: r.slice(0,8).map(x => x.name), hasComposer: r.some(x => x.name === 'composer'), hasWriter: r.some(x => x.name === 'writer') };
  }
  return null;
});
console.log('replacement roles:', JSON.stringify(roles, null, 1));
ck(roles && roles.count > 0 && new Set(roles.sample).size === roles.sample.length, `offers de-duplicated replacement roles for the same entity pair (${roles && roles.count}: ${roles && roles.sample.join(', ')})`);

// actually perform a replacement and confirm MB state changed
const applied = await page.evaluate(() => {
  const GT = window.__groupTherapy;
  const findRel = it => { for (const k in it) if (k.startsWith('__reactFiber$')) { let f=it[k],d=0; while(f&&d++<40){const s=f.memoizedProps&&f.memoizedProps.relationship; if(s&&'linkTypeID' in s) return s; f=f.return;} } return null; };
  for (const it of document.querySelectorAll('.relationship-item')) {
    if (!GT.replaceRoleMenuItems(it).length) continue;
    const rel = findRel(it); if (!rel) continue;
    const roles = GT.replacementRoles(rel);
    const present = new Set([...document.querySelectorAll('.relationship-item')].map(findRel).filter(Boolean).map(r => r.linkTypeID));
    const target = roles.find(r => !present.has(r.id) && /librettist|translator|revised by|orchestrator/.test(r.name)) || roles.find(r => !present.has(r.id)) || roles[0];
    const beforeType = rel.linkTypeID;
    const n = GT.replaceRole([it], target, () => 'test replace');
    return { n, beforeType, newType: target.id, newName: target.name };
  }
  return null;
});
console.log('applied:', JSON.stringify(applied));
ck(applied && applied.n === 1, `replaceRole reports 1 credit replaced (${applied && applied.n})`);

await page.waitForTimeout(1200);
const after = await page.evaluate((newType) => {
  const findRel = it => { for (const k in it) if (k.startsWith('__reactFiber$')) { let f=it[k],d=0; while(f&&d++<40){const s=f.memoizedProps&&f.memoizedProps.relationship; if(s&&'linkTypeID' in s) return s; f=f.return;} } return null; };
  const types = [...document.querySelectorAll('.relationship-item')].map(findRel).filter(Boolean).map(r => r.linkTypeID);
  return { hasNewType: types.includes(newType), relAdd: document.querySelectorAll('.rel-add').length, relRemove: document.querySelectorAll('.rel-remove').length };
}, applied ? applied.newType : -1);
console.log('after:', JSON.stringify(after));
ck(after.hasNewType, 'a relationship with the NEW link type is now present in the editor');
ck(after.relAdd > 0, `MB staged the addition (${after.relAdd} rel-add)`);
ck(after.relRemove > 0, `and staged the removal of the old one (${after.relRemove} rel-remove)`);
ck(posts === 0, `nothing submitted during the test (${posts})`);

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
