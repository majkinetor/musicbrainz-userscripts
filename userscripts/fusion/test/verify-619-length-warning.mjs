// #619 (chaban-mb): "The lengths are off by more than 5 seconds and on hover it says 'Holds
// together at the strict cutoff'" — a group held together by AcoustID/title/artist showed all
// green, with only a faded Length chip hinting that 4:53 vs 4:38 is 15 s apart.
//
// test.musicbrainz.org, nothing merged: two groups built from sandbox recordings with their
// lengths set to the issue's case (4:53 / 4:38 → 15 s, tolerance 5 s) and to a within-
// tolerance pair (3:20 / 3:22). The first must show the amber Length chip, the "⚠ 15s" badge,
// the off row's amber length cell and the tooltip note; the second none of it.
// FUSION_SRC=<old build> to watch it stay silent.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile(process.env.FUSION_SRC || 'C:/Work/mb-userscripts/userscripts/fusion/fusion.user.js', 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { const s = new Map(); window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d; window.GM_setValue = (k, v) => s.set(k, v); window.GM_info = { script: { name: 'Fusion', version: 't' } }; window.GM_xmlhttpRequest = async (o) => { try { const same = new URL(o.url, location.href).origin === location.origin; const r = await fetch(o.url, { method: o.method || 'GET', headers: o.headers || {}, body: o.data, credentials: same ? 'include' : 'omit' }); o.onload && o.onload({ status: r.status, responseText: await r.text(), finalUrl: r.url }); } catch (e) { o.onerror && o.onerror(e); } }; });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
// four sandbox recordings (any — their lengths are set in the page)
const gids = await (async () => {
  const r = await fetch('https://test.musicbrainz.org/ws/2/recording?query=arid:c321a13a-1c52-43c0-b60a-3a454cb7f9a2&limit=8&fmt=json', { headers: { 'User-Agent': 'mb-userscripts-test/1.0 ( https://github.com/majkinetor/musicbrainz-userscripts )', Accept: 'application/json' } });
  return (await r.json()).recordings.map(x => x.id).slice(0, 4);
})();
await page.goto(`https://test.musicbrainz.org/recording/${gids[0]}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.addScriptTag({ content: code });
await page.waitForFunction(() => window.__fusion, null, { timeout: 20000 });
const ids = await page.evaluate(async (gids) => {
  const F = window.__fusion;
  await F.openFusion();
  F.clearBoard();
  const recs = [];
  for (const g of gids) { const r = await F.fetchRecordingByGid(g); F.addToPool(r); recs.push(r); }
  const setLen = (r, ms) => { r.length = ms; const st = F.STATE.recordings.get(r.gid); if (st) st.length = ms; };   // Fusion's own record, not a copy
  setLen(recs[0], 293000); setLen(recs[1], 278000);   // 4:53 / 4:38 — the issue
  setLen(recs[2], 200000); setLen(recs[3], 202000);   // 3:20 / 3:22 — within 5 s
  const g1 = F.createGroupWithMember(recs[0].gid); F.addToGroup(recs[1].gid, g1.id); g1.target = recs[0].gid;
  const g2 = F.createGroupWithMember(recs[2].gid); F.addToGroup(recs[3].gid, g2.id); g2.target = recs[2].gid;
  F.renderAll();
  return { g1: g1.id, g2: g2.id, off: recs[1].gid };
}, gids);
await page.waitForTimeout(800);
const card = id => page.evaluate(([id, off]) => {
  const c = document.querySelector(`.fs-gcard[data-gid="${id}"]`); if (!c) return null;
  const chip = [...c.querySelectorAll('.fs-sig span')].find(s => /Length/.test(s.textContent));
  const offRow = c.querySelector(`.fs-grow[data-gid="${off}"] .fs-len`);
  return { chipWarn: !!(chip && chip.classList.contains('warn')), chipTitle: chip ? chip.title : '', badge: (c.querySelector('.fs-lenwarn') || {}).textContent || null, offCells: c.querySelectorAll('.fs-len-off').length, offRowOff: !!(offRow && offRow.classList.contains('fs-len-off')), offRowTitle: offRow ? offRow.title : '', cardTitle: c.title };
}, [id, ids.off]);
const a = await card(ids.g1), b = await card(ids.g2);
console.log('15s group :', JSON.stringify(a)); console.log('2s group  :', JSON.stringify(b));
ck(a && a.chipWarn && /15s/.test(a.chipTitle), 'lengths 15 s apart → the Length chip is amber, with the spread in its tooltip');
ck(a && a.badge === '⚠ 15s', `…a "⚠ 15s" badge next to the title (${a && a.badge})`);
ck(a && a.offRowOff && /−15s against the merge target \(4:53\)/.test(a.offRowTitle), `…the 4:38 row's length is amber: "${a && a.offRowTitle}"`);
ck(a && a.offCells === 1, `…only the off row, not the target (${a && a.offCells})`);
ck(a && /but its lengths differ by up to 15s \(tolerance 5s\)/.test(a.cardTitle), '…and the card tooltip says so');
ck(b && !b.chipWarn && !b.badge && b.offCells === 0 && !/lengths differ/.test(b.cardTitle), 'within tolerance (2 s) → no warning anywhere');
const box = await page.evaluate(id => { const c = document.querySelector(`.fs-gcard[data-gid="${id}"]`); c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, ids.g1);
await page.screenshot({ path: join(tmpdir(), '619-length-warning.png'), clip: box });
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
