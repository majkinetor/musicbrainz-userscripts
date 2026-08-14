// #506 (majkinetor): "All queue processing status fields should have color which
// should be used for row background in unintrusive way." Reuses the existing
// per-status DOT palette (already used for the little status dot) as a faint
// (~7% alpha) row background tint — same color family, so the dot and the row
// agree, but subtle enough not to fight the row's text for attention.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(500);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 5000 });

const STATUSES = ['queued', 'active', 'done', 'partial', 'failed', 'manual', 'skipped'];
await page.evaluate((statuses) => window.__falconTest.setQueue(statuses.map((s, i) => ({
  id: 's' + i, entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7' , urls: [{ url: 'https://myspace.com/' + s, linkTypeId: null }],
  name: 'Test ' + s, urlResults: null, status: s, error: '',
}))), STATUSES);

const rows = await page.evaluate((statuses) => statuses.map((s, i) => {
  const row = document.querySelector(`.falcon-row[data-id="s${i}"]`);
  return { status: s, bg: getComputedStyle(row).backgroundColor };
}), STATUSES);
console.log('row backgrounds:', JSON.stringify(rows));

// every status gets SOME non-transparent tint, and no two DIFFERENT statuses share
// the same tint (each status is visually distinguishable from the others).
for (const r of rows) {
  ck(r.bg && r.bg !== 'rgba(0, 0, 0, 0)' && r.bg !== 'transparent', `"${r.status}" row has a background tint (got "${r.bg}")`);
}
const uniqueBgs = new Set(rows.map(r => r.bg));
ck(uniqueBgs.size === STATUSES.length, `all ${STATUSES.length} statuses render a distinct background color (got ${uniqueBgs.size} distinct)`);

// "unintrusive" — the tint should be a low-alpha version of the existing DOT color,
// not a loud solid fill. Cross-check against the DOT map's own hex values via the
// dot element's inline background (full opacity) vs. the row's (should share RGB,
// differ only in alpha).
const dotVsRow = await page.evaluate((statuses) => statuses.map((s, i) => {
  const row = document.querySelector(`.falcon-row[data-id="s${i}"]`);
  const dot = row.querySelector('span[style*="border-radius:50%"]');
  return { status: s, dotBg: getComputedStyle(dot).backgroundColor, rowBg: getComputedStyle(row).backgroundColor };
}), STATUSES);
console.log('dot vs row:', JSON.stringify(dotVsRow));
for (const d of dotVsRow) {
  const rgb = c => c.match(/\d+/g).slice(0, 3).join(',');
  ck(rgb(d.dotBg) === rgb(d.rowBg), `"${d.status}" row tint shares the dot's RGB, differing only in alpha (dot=${d.dotBg}, row=${d.rowBg})`);
  const alphaMatch = d.rowBg.match(/[\d.]+\)$/);
  const alpha = alphaMatch ? parseFloat(alphaMatch[0]) : 1;
  ck(alpha > 0 && alpha < 0.15, `"${d.status}" row tint alpha is subtle, under 15% (got ${alpha})`);
}

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
