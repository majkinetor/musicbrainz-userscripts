// #605 — split a combined credit. Release aba74013 (Discogs 5889603) credits
// "George & Ira Gershwin" as writer on track 8. The review row gets a ⋔ button;
// clicking it replaces the row with "George Gershwin" + "Ira Gershwin" rows, and
// Start import stages the writer credit for BOTH (fan-out in dispatch).
// Stages in the relationship editor only — nothing is submitted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/credit_hoarder/dist/credit_hoarder.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1700, height: 1100 }, deviceScaleFactor: 2, bypassCSP: true });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const con = []; page.on('console', m => con.push(m.text()));
await page.addInitScript(() => {
  window.GM_getValue = (k, d) => d; window.GM_setValue = () => {};
  window.GM_info = { script: { name: 'CH', version: 't', homepageURL: 'x' } };
  window.unsafeWindow = window;
});
// Belt and braces: this probe must never submit an edit.
await page.route(/\/(ws\/js\/edit\/|edit-relationships$)/, (route, req) => req.method() === 'POST' ? route.abort() : route.continue());
await page.goto('https://musicbrainz.org/release/aba74013-0e72-4ab9-87ee-7dc82193dc35/edit-relationships', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(3000);
await page.addScriptTag({ content: code });
await page.waitForSelector('.discogs-bar', { timeout: 30000 });
await page.waitForTimeout(1000);
await page.click('.discogs-src-ico[data-src="Discogs"]').catch(async () => { await page.click('.discogs-src-ico'); });
await page.waitForFunction(() => /Preflight done/.test(document.body.innerText), null, { timeout: 180000 });
await page.waitForTimeout(2000);

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const rowOf = name => page.evaluate(n => {
  const tr = [...document.querySelectorAll('tbody tr')].find(x => x.querySelector('a,span.discogs-entity-name') && [...x.querySelectorAll('a,span.discogs-entity-name')].some(a => a.textContent.trim() === n));
  if (!tr) return null;
  return { hasSplit: !!tr.querySelector('.discogs-split-btn'), splitTitle: tr.querySelector('.discogs-split-btn')?.title || '', text: tr.innerText.replace(/\s+/g, ' ').slice(0, 220), bg: tr.style.background };
}, name);

const before = await rowOf('George & Ira Gershwin');
console.log('before:', JSON.stringify(before));
ck(before && before.hasSplit, 'combined row shows the ⋔ split button');
const plainWithBtn = await page.evaluate(() => [...document.querySelectorAll('tbody tr')].filter(tr => tr.querySelector('.discogs-split-btn')).length);
ck(plainWithBtn === 1, `⋔ only on rows with a separator (${plainWithBtn} row(s) have it)`);

await page.click('.discogs-split-btn');
// wait for the combined row to be REPLACED (each part may need an MB search — slow when MB throttles)
await page.waitForFunction(() => ![...document.querySelectorAll('tbody tr')].some(x => [...x.querySelectorAll('a,span')].some(a => a.textContent.trim() === 'George & Ira Gershwin')), null, { timeout: 90000 });
await page.waitForTimeout(3000);
const g = await rowOf('George Gershwin'), i = await rowOf('Ira Gershwin'), gone = await rowOf('George & Ira Gershwin');
console.log('george:', JSON.stringify(g)); console.log('ira   :', JSON.stringify(i));
ck(!gone, 'combined row replaced');
ck(g && /split/.test(g.text) && i && /split/.test(i.text), 'two part rows, badged "split"');
ck(g && /writer/.test(g.text) && i && /writer/.test(i.text), 'both parts carry the writer role');
ck(g && /✓ George Gershwin/.test(g.text), 'George Gershwin auto-matched');
ck(i && /✓ Ira Gershwin/.test(i.text), 'Ira Gershwin auto-matched');

const tbl = await page.$('table');
const splitTr = await page.$$('tbody tr');
await page.evaluate(() => [...document.querySelectorAll('tbody tr')].find(tr => /George Gershwin/.test(tr.innerText))?.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(500);
const box = await page.evaluate(() => { const rs = [...document.querySelectorAll('tbody tr')].filter(tr => /(George|Ira) Gershwin/.test(tr.innerText)); const a = rs[0].getBoundingClientRect(), b = rs[rs.length - 1].getBoundingClientRect(); return { x: a.x, y: a.y - 4, width: Math.max(a.width, b.width), height: b.bottom - a.y + 8 }; });
await page.screenshot({ path: 'C:/Users/mmilic/AppData/Local/Temp/claude/C--Work-mb-userscripts/51941c58-fa99-48bf-941e-e47501abdb35/scratchpad/605-split-rows.png', clip: box });

// Start import → dispatch fans the writer role out to both parts.
// Track 8 has no work, and writer is work-only: let the import stage a new work
// (set without a change event, so no confirm dialog — dispatch re-reads the value).
console.log('works mode:', await page.evaluate(() => { const s = [...document.querySelectorAll('select')].find(x => [...x.options].some(o => o.value === 'when-needed')); if (s) s.value = 'when-needed'; return s ? s.value : 'no select'; }));
const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /Start import/i.test(b.textContent)); if (b) b.click(); return b ? b.textContent : null; });
console.log('clicked:', clicked);
for (let t = 0; t < 180 && !con.some(l => /Done: \d+ added/.test(l)); t++) await page.waitForTimeout(1000);
console.log('log:', con.filter(l => /#605|Gershwin|Done:/.test(l)).map(l => l.replace(/<[^>]+>/g, '')).join(' | '));
const fan = con.find(l => /#605 split: \d+ role/.test(l));
console.log('fan-out:', fan);
// what dispatch staged, from its own log ("→ writer: <work> ↔ <artist>")
// what dispatch did per part: staged ("→ writer…"), or skipped because MB already has it
// (MB data moves on — the work may since carry the composer; dedup is the right outcome)
const staged = con.map(l => l.replace(/<[^>]+>/g, '').replace(/^\[credit_hoarder\] /, '')).filter(l => /→ writer\b.*Gershwin|writer not added — .*already in MB.*Gershwin/.test(l));   // log lines carry HTML (<strong>writer</strong>) — strip first
console.log('staged Gershwin rels:', JSON.stringify(staged, null, 1));
ck(!!fan, 'dispatch logged the fan-out');
ck(staged.some(s => /George Gershwin/.test(s)) && staged.some(s => /Ira Gershwin/.test(s)), 'writer staged (or already in MB) for George AND Ira Gershwin');
ck(!staged.some(s => /George & Ira/.test(s)), 'nothing staged for the combined name');
ck(con.some(l => /Done: \d+ added, .*, 0 failed/.test(l)), 'import finished with 0 failed');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
