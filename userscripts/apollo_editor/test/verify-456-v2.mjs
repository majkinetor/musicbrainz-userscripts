// #456 v2 — the interactive layer: (1) the split first/last toggle flips which separator a
// repeated-delimiter line splits on; (2) selecting a span in a raw cell pops a field-chip bar
// that binds the span to a field as a slice in the row's pattern. Read-only — never submits.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');
const REL = '20b03c7d-9e8a-42b9-8a96-bcc9564de034';
const ctx = await chromium.launchPersistentContext(resolve(HERE, '..', '..', '..', '.pw-profile'), { headless: true, viewport: { width: 1400, height: 900 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } }; });
await page.goto(`https://musicbrainz.org/release/${REL}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForSelector('#release-editor, form', { timeout: 30000 }).catch(() => {});
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, { timeout: 20000 });
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
await page.evaluate(() => window.__apolloEditor.openTrackPatternParser(0));
await page.waitForSelector('#tc-tpppop');

// (1) split first/last
await page.fill('#tc-tpppop .tc-tpp-pi', '# A - T');
await page.fill('#tc-tpppop .tc-tpp-ta', '1 a - b - c');
await page.waitForTimeout(200);
const first = await page.evaluate(() => { const c = document.querySelector('#tc-tpppop tbody tr').querySelectorAll('.tc-tpp-c'); return { a: c[1].textContent, t: c[2].textContent }; });
ck(first.a === 'a' && first.t === 'b - c', `split first: A=${first.a} T=${first.t}`);
await page.click('#tc-tpppop .tc-tpp-split');
await page.waitForTimeout(200);
const last = await page.evaluate(() => { const c = document.querySelector('#tc-tpppop tbody tr').querySelectorAll('.tc-tpp-c'); return { a: c[1].textContent, t: c[2].textContent, l: document.querySelector('#tc-tpppop .tc-tpp-split').textContent }; });
ck(last.a === 'a - b' && last.t === 'c' && /last/.test(last.l), `split last: A=${last.a} T=${last.t}`);
await page.click('#tc-tpppop .tc-tpp-split');   // back to first

// (2) selection → field chip
await page.evaluate(() => document.querySelector('#tc-tpppop .tc-tpp-src').classList.remove('tc-collapsed'));
await page.fill('#tc-tpppop .tc-tpp-pi', '#. T');
await page.fill('#tc-tpppop .tc-tpp-ta', 'GARBAGE So What GARBAGE');
await page.waitForTimeout(200);
await page.evaluate(() => {
  const cell = document.querySelector('#tc-tpppop tbody tr .tc-tpp-raw');
  const tn = cell.firstChild, t = tn.textContent, i = t.indexOf('So What');
  const r = document.createRange(); r.setStart(tn, i); r.setEnd(tn, i + 7);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
  document.querySelector('#tc-tpppop tbody').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
});
await page.waitForTimeout(150);
ck(await page.evaluate(() => getComputedStyle(document.querySelector('#tc-tpppop .tc-tpp-chipbar')).display !== 'none'), 'chip bar appears on raw selection');
await page.click('#tc-tpppop .tc-tpp-chipbar button[data-g="T"]');
await page.waitForTimeout(200);
const bound = await page.evaluate(() => { const tr = document.querySelector('#tc-tpppop tbody tr'); return { ov: tr.querySelector('.tc-tpp-ov').value, title: tr.querySelectorAll('.tc-tpp-c')[2].textContent }; });
ck(/^T\[\d+-\d+\]$/.test(bound.ov), `row override became a title slice (${bound.ov})`);
ck(bound.title === 'So What', `title extracted from the slice (${bound.title})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
